// src/app/api/export-packet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import PDFDocument from 'pdfkit';

export const runtime = 'nodejs';

// Colors matching the Debtera brand
const ACCENT = '#2D6A4F';
const TEXT = '#2C2C2C';
const MUTED = '#6B6B6B';
const BORDER = '#E8E2DB';

function formatCurrency(val: any): string {
  const n = parseFloat(val);
  if (isNaN(n)) return '';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(val: string): string {
  if (!val) return '';
  try {
    return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return val;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { company, owners, debts, banks, affiliates, loan, history, pfs, eligibility } = data;

    // Build PDF in memory
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: `Financial Packet: ${company?.legalName || 'Untitled'}`,
        Author: 'Debtera',
        Subject: 'Lender Financial Packet',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const pdfReady = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // ===================== COVER PAGE =====================
    doc.moveDown(6);
    doc.fontSize(32).fillColor(ACCENT).text('debtera', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor(MUTED).text('Financial Packet Builder', { align: 'center' });
    doc.moveDown(3);
    doc.fontSize(24).fillColor(TEXT).text(company?.legalName || 'Financial Packet', { align: 'center' });
    if (company?.dba) {
      doc.fontSize(14).fillColor(MUTED).text(`DBA: ${company.dba}`, { align: 'center' });
    }
    doc.moveDown(2);
    doc.fontSize(12).fillColor(MUTED).text(`Prepared ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'center' });
    doc.moveDown(1);
    if (loan?.amountRequested) {
      doc.fontSize(16).fillColor(TEXT).text(`Loan Request: ${formatCurrency(loan.amountRequested)}`, { align: 'center' });
    }
    if (loan?.keyPurpose) {
      doc.fontSize(12).fillColor(MUTED).text(`Purpose: ${loan.keyPurpose}`, { align: 'center' });
    }

    // Helper: section header
    const sectionHeader = (title: string) => {
      doc.addPage();
      doc.fontSize(18).fillColor(ACCENT).text(title);
      doc.moveDown(0.3);
      doc.moveTo(60, doc.y).lineTo(552, doc.y).strokeColor(BORDER).lineWidth(1).stroke();
      doc.moveDown(0.8);
    };

    // Helper: labeled field
    const field = (label: string, value: any) => {
      if (!value && value !== 0) return;
      doc.fontSize(10).fillColor(MUTED).text(label, { continued: false });
      doc.fontSize(11).fillColor(TEXT).text(String(value));
      doc.moveDown(0.4);
    };

    // Helper: check page space
    const ensureSpace = (needed: number) => {
      if (doc.y + needed > 700) doc.addPage();
    };

    // ===================== COMPANY INFO =====================
    sectionHeader('Company Information');
    field('Legal Business Name', company?.legalName);
    field('DBA / Trade Name', company?.dba);
    field('Tax ID (EIN)', company?.tin);
    field('Entity Type', company?.entityType);
    field('NAICS Code', company?.naicsCode);
    field('Year Operations Began', company?.yearBegan);
    doc.moveDown(0.5);
    field('Street Address', company?.streetAddress);
    field('Mailing Address', company?.mailingAddress);
    field('Phone', company?.phone);
    field('Email', company?.email);
    doc.moveDown(0.5);
    field('Full-Time Employees', company?.employeesFT);
    field('Part-Time Employees', company?.employeesPT);

    // ===================== OWNERSHIP =====================
    if (owners && owners.length > 0) {
      sectionHeader('Ownership Structure');
      const totalPct = owners.reduce((s: number, o: any) => s + (parseFloat(o.ownershipPct) || 0), 0);
      doc.fontSize(11).fillColor(TEXT).text(`Total Ownership: ${totalPct}%`);
      doc.moveDown(0.8);

      owners.forEach((owner: any, i: number) => {
        ensureSpace(120);
        doc.fontSize(13).fillColor(ACCENT).text(`Owner ${i + 1}: ${owner.name || 'Unnamed'}`);
        doc.moveDown(0.3);
        field('Title', owner.title);
        field('Ownership %', owner.ownershipPct ? `${owner.ownershipPct}%` : '');
        field('Date of Birth', formatDate(owner.dob));
        field('Home Address', owner.homeAddress);
        field('Phone', owner.phone);
        field('Email', owner.email);
        doc.moveDown(0.5);
      });
    }

    // ===================== DEBT SCHEDULE =====================
    if (debts && debts.length > 0 && debts.some((d: any) => d.lender)) {
      sectionHeader('Debt Schedule');
      const totalBalance = debts.reduce((s: number, d: any) => s + (parseFloat(d.presentBalance) || 0), 0);
      const totalPayment = debts.reduce((s: number, d: any) => s + (parseFloat(d.monthlyPayment) || 0), 0);
      doc.fontSize(11).fillColor(TEXT).text(`Total Outstanding Balance: ${formatCurrency(totalBalance)}    |    Total Monthly Payments: ${formatCurrency(totalPayment)}`);
      doc.moveDown(0.8);

      debts.forEach((debt: any, i: number) => {
        if (!debt.lender) return;
        ensureSpace(130);
        doc.fontSize(12).fillColor(ACCENT).text(`${debt.lender}`);
        doc.moveDown(0.3);
        field('Original Amount', formatCurrency(debt.loanAmount));
        field('Present Balance', formatCurrency(debt.presentBalance));
        field('Interest Rate', debt.intRate ? `${debt.intRate}%` : '');
        field('Monthly Payment', formatCurrency(debt.monthlyPayment));
        field('Origination', formatDate(debt.originationDate));
        field('Maturity', formatDate(debt.maturityDate));
        field('Collateral', debt.security);
        field('Status', debt.status);
        doc.moveDown(0.5);
      });
    }

    // ===================== BANK ACCOUNTS =====================
    if (banks && banks.length > 0 && banks.some((b: any) => b.bank)) {
      sectionHeader('Bank Accounts');
      banks.forEach((bank: any) => {
        if (!bank.bank) return;
        ensureSpace(80);
        doc.fontSize(12).fillColor(ACCENT).text(bank.bank);
        doc.moveDown(0.3);
        field('Account Type', bank.accountType);
        field('Balance', formatCurrency(bank.balance));
        field('Name on Account', bank.nameOnAccount);
        doc.moveDown(0.5);
      });
    }

    // ===================== AFFILIATES =====================
    if (affiliates && affiliates.length > 0 && affiliates.some((a: any) => a.name)) {
      sectionHeader('Affiliated Businesses');
      affiliates.forEach((aff: any) => {
        if (!aff.name) return;
        ensureSpace(80);
        doc.fontSize(12).fillColor(ACCENT).text(aff.name);
        doc.moveDown(0.3);
        field('Title/Role', aff.title);
        field('Ownership %', aff.ownershipPct ? `${aff.ownershipPct}%` : '');
        field('Employees', aff.employees);
        doc.moveDown(0.5);
      });
    }

    // ===================== LOAN REQUEST =====================
    sectionHeader('Loan Request');
    field('Amount Requested', formatCurrency(loan?.amountRequested));
    field('Primary Purpose', loan?.keyPurpose);
    if (loan?.projectDescription) {
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor(MUTED).text('Project Description');
      doc.fontSize(11).fillColor(TEXT).text(loan.projectDescription);
      doc.moveDown(0.5);
    }
    if (loan?.collateralDescription) {
      doc.fontSize(10).fillColor(MUTED).text('Collateral Description');
      doc.fontSize(11).fillColor(TEXT).text(loan.collateralDescription);
      doc.moveDown(0.5);
    }

    // Use of Proceeds breakdown
    const purposeFields: [string, string][] = [
      ['landBuilding', 'Land & Building'], ['newConstruction', 'New Construction'],
      ['landAcquisition', 'Land Only'], ['machineryEquipment', 'Machinery/Equipment'],
      ['businessAcquisition', 'Business Acquisition'], ['furnitureFixtures', 'Furniture & Fixtures'],
      ['debtRefinance', 'Debt Refinance'], ['inventory', 'Inventory'],
      ['leaseholdImprovements', 'Leasehold Improvements'], ['closingCosts', 'Closing Costs'],
      ['workingCapital', 'Working Capital'], ['other', 'Other'],
    ];
    const hasProceeds = purposeFields.some(([k]) => parseFloat(loan?.[k]) > 0);
    if (hasProceeds) {
      doc.moveDown(0.3);
      doc.fontSize(13).fillColor(ACCENT).text('Use of Proceeds');
      doc.moveDown(0.3);
      purposeFields.forEach(([k, label]) => {
        const val = parseFloat(loan?.[k]);
        if (val > 0) {
          field(label, formatCurrency(val));
        }
      });
    }

    // ===================== BUSINESS HISTORY =====================
    const historyQuestions = [
      "Briefly describe the business, its products, services, and customer base:",
      "How long has the business been in operation?",
      "What are the business hours and days of operation?",
      "How many full-time and part-time employees does the business employ?",
      "If this is a business acquisition: Are all existing employees expected to continue? Reason for sale?",
      "List current owners and their ownership percentages (must total 100%):",
      "What role does the current owner(s) play? How many hours per week?",
      "Who is responsible for day-to-day operations? Is the business managed by an employee?",
      "Who are your key customers and key competitors?",
      "Is your property leased? When does the lease expire?",
    ];
    if (history && history.some((h: any) => h)) {
      sectionHeader('Business History');
      historyQuestions.forEach((q, i) => {
        if (!history[i]) return;
        ensureSpace(80);
        doc.fontSize(10).fillColor(MUTED).text(`${i + 1}. ${q}`);
        doc.fontSize(11).fillColor(TEXT).text(history[i]);
        doc.moveDown(0.6);
      });
    }

    // ===================== PERSONAL FINANCIAL STATEMENTS =====================
    if (pfs && pfs.length > 0 && owners) {
      sectionHeader('Personal Financial Statements');
      const assetKeys = ['cashOnHand', 'savings', 'ira', 'accountsReceivable', 'lifeInsurance', 'stocksBonds', 'realEstate', 'automobiles', 'otherProperty', 'otherAssets'];
      const liabKeys = ['accountsPayable', 'notesPayable', 'installmentAuto', 'installmentOther', 'loanAgainstInsurance', 'mortgages', 'unpaidTaxes', 'otherLiabilities'];

      owners.forEach((owner: any, oi: number) => {
        const p = pfs[oi];
        if (!p) return;
        ensureSpace(200);
        doc.fontSize(13).fillColor(ACCENT).text(`${owner.name || `Owner ${oi + 1}`}`);
        doc.moveDown(0.3);

        const totalAssets = assetKeys.reduce((s, k) => s + (parseFloat(p[k]) || 0), 0);
        const totalLiab = liabKeys.reduce((s, k) => s + (parseFloat(p[k]) || 0), 0);
        const netWorth = totalAssets - totalLiab;

        field('Total Assets', formatCurrency(totalAssets));
        field('Total Liabilities', formatCurrency(totalLiab));
        field('Net Worth', formatCurrency(netWorth));
        if (p.salary) field('Salary', formatCurrency(p.salary));
        if (p.netInvestmentIncome) field('Net Investment Income', formatCurrency(p.netInvestmentIncome));
        if (p.realEstateIncome) field('Real Estate Income', formatCurrency(p.realEstateIncome));
        if (p.otherIncome) field('Other Income', formatCurrency(p.otherIncome));
        doc.moveDown(0.5);
      });
    }

    // ===================== ELIGIBILITY =====================
    const eligibilityQuestions = [
      "Is the applicant or any associate currently suspended, debarred, or involved in any bankruptcy?",
      "Is the applicant or any associate currently delinquent or have they ever defaulted on a federal loan?",
      "Is the applicant or any owner also an owner of any other business?",
      "Is the applicant or any associate currently incarcerated or under indictment for a felony or financial crime?",
      "Are any products or services exported, or is there a plan to begin exporting?",
      "Has a fee been paid to a third party to assist with this loan application?",
      "Are any revenues derived from gambling, lending, lobbying, or adult entertainment?",
      "Is any owner (10%+) an SBA employee or household member of an SBA employee?",
      "Is any associate a former SBA employee separated less than one year ago?",
      "Is any owner (10%+) a member of Congress or federal legislative/judicial branch employee?",
      "Is any owner (10%+) a federal employee at GS-13 or higher (or military equivalent)?",
      "Is any owner (10%+) a SCORE volunteer or Small Business Advisory Council member?",
      "Is the applicant or any owner currently involved in any legal action, including divorce?",
    ];
    if (eligibility && eligibility.some((e: any) => e)) {
      sectionHeader('Eligibility & Compliance');
      eligibilityQuestions.forEach((q, i) => {
        if (!eligibility[i]) return;
        ensureSpace(50);
        doc.fontSize(10).fillColor(MUTED).text(`${i + 1}. ${q}`, { continued: false });
        const answer = eligibility[i];
        const color = answer === 'Yes' ? '#C1524A' : ACCENT;
        doc.fontSize(11).fillColor(color).text(answer);
        doc.moveDown(0.4);
      });
    }

    // ===================== FOOTER NOTE =====================
    doc.addPage();
    doc.moveDown(4);
    doc.fontSize(11).fillColor(MUTED).text(
      'This financial packet was assembled using Debtera. All information was provided by the applicant and has not been independently verified. The applicant certifies that the information provided is true and complete to the best of their knowledge.',
      { align: 'center' }
    );

    doc.end();

    const pdfBuffer = await pdfReady;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(company?.legalName || 'Financial-Packet').replace(/[^a-zA-Z0-9 ]/g, '')}-Packet.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('PDF export error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
