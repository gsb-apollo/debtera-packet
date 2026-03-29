'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import SmartUpload from '@/components/SmartUpload'
import PacketReviewer from '@/components/PacketReviewer'
import { useRouter, useParams } from 'next/navigation'

// @ts-nocheck

const STEPS = [
  { id: "company", label: "Company Info", icon: "🏢" },
  { id: "ownership", label: "Ownership", icon: "👥" },
  { id: "debt", label: "Debt Schedule", icon: "📊" },
  { id: "banking", label: "Bank Accounts", icon: "🏦" },
  { id: "affiliates", label: "Affiliates", icon: "🔗" },
  { id: "loan", label: "Loan Request", icon: "💰" },
  { id: "history", label: "Business History", icon: "📖" },
  { id: "resume", label: "Management", icon: "📋" },
  { id: "pfs", label: "Personal Finances", icon: "🏠" },
  { id: "eligibility", label: "Eligibility", icon: "✅" },
  { id: "documents", label: "Documents", icon: "📎" },
  { id: "review", label: "Review & Export", icon: "📦" },
];

const documentCategories: any[] = [
  { id: "tax_personal", label: "Personal Tax Returns", description: "Last 3 years of personal tax returns for all owners (20%+ interest).", required: true, accepts: ".pdf,.doc,.docx" },
  { id: "tax_business", label: "Business Tax Returns", description: "Last 3 years of IRS business tax returns.", required: true, accepts: ".pdf,.doc,.docx" },
  { id: "financial_statements", label: "Interim Financial Statements", description: "Month-end income statement and balance sheet, not over 90 days old.", required: true, accepts: ".pdf,.doc,.docx,.xlsx,.xls,.csv" },
  { id: "pl_projections", label: "P&L Projections", description: "Profit and loss projections for the next 2 years, first year month by month.", required: false, accepts: ".pdf,.doc,.docx,.xlsx,.xls,.csv" },
  { id: "business_plan", label: "Business Plan", description: "Required for startups and expansions.", required: false, accepts: ".pdf,.doc,.docx" },
  { id: "loan_agreements", label: "Existing Loan Agreements / Notes", description: "Copies of all existing loan notes, credit agreements, and promissory notes.", required: true, accepts: ".pdf,.doc,.docx" },
  { id: "lease", label: "Lease Agreement", description: "Copy of existing lease or proposed lease for business premises.", required: false, accepts: ".pdf,.doc,.docx" },
  { id: "purchase_agreement", label: "Purchase Agreement", description: "Required for business or real estate acquisitions.", required: false, accepts: ".pdf,.doc,.docx" },
  { id: "organizational", label: "Organizational Documents", description: "Articles of Incorporation, By-Laws, Partnership Agreement, LLC Operating Agreement.", required: true, accepts: ".pdf,.doc,.docx" },
  { id: "ar_ap", label: "Accounts Receivable & Payable Aging", description: "Current AR and AP aging schedules.", required: false, accepts: ".pdf,.doc,.docx,.xlsx,.xls,.csv" },
  { id: "environmental", label: "Environmental Questionnaire", description: "To be completed by owner of leased location or seller.", required: false, accepts: ".pdf,.doc,.docx" },
  { id: "other", label: "Other Supporting Documents", description: "Any additional documents relevant to your application.", required: false, accepts: ".pdf,.doc,.docx,.xlsx,.xls,.csv,.jpg,.jpeg,.png" },
];

const initialCompany: any = { legalName: "", dba: "", tin: "", streetAddress: "", mailingAddress: "", phone: "", cellular: "", email: "", entityType: "", naicsCode: "", yearBegan: "", employeesFT: "", employeesPT: "" };
const emptyOwner: any = { name: "", title: "", ownershipPct: "", dob: "", ssn: "", homeAddress: "", phone: "", email: "", spouseName: "", spouseSsn: "", spouseDob: "", spouseEmployer: "", education: [{ school: "", dates: "", major: "", degree: "" }], workHistory: [{ company: "", from: "", to: "", title: "", duties: "" }] };
const emptyDebt: any = { lender: "", originationDate: "", loanAmount: "", intRate: "", maturityDate: "", monthlyPayment: "", presentBalance: "", security: "", status: "Current" };
const emptyBank: any = { bank: "", accountType: "", balance: "", nameOnAccount: "" };
const emptyAffiliate: any = { name: "", title: "", ownershipPct: "", employees: "" };
const emptyPFS: any = { cashOnHand: "", savings: "", ira: "", accountsReceivable: "", lifeInsurance: "", stocksBonds: "", realEstate: "", automobiles: "", otherProperty: "", otherAssets: "", accountsPayable: "", notesPayable: "", installmentAuto: "", installmentAutoMo: "", installmentOther: "", installmentOtherMo: "", loanAgainstInsurance: "", mortgages: "", unpaidTaxes: "", otherLiabilities: "", salary: "", netInvestmentIncome: "", realEstateIncome: "", otherIncome: "" };
const emptyLoan: any = { amountRequested: "", keyPurpose: "", projectDescription: "", collateralDescription: "", landBuilding: "", newConstruction: "", landAcquisition: "", machineryEquipment: "", businessAcquisition: "", furnitureFixtures: "", debtRefinance: "", inventory: "", leaseholdImprovements: "", closingCosts: "", workingCapital: "", other: "" };

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

const eligibilityQuestions = [
  { q: "Is the applicant or any associate currently suspended, debarred, or involved in any bankruptcy?", help: "This covers formal federal exclusions from doing business with government agencies, as well as active bankruptcy proceedings." },
  { q: "Is the applicant or any associate currently delinquent or have they ever defaulted on a federal loan?", help: "Includes SBA, USDA, FHA, EDA, and any other federal agency loan programs." },
  { q: "Is the applicant or any owner also an owner of any other business?", help: "If yes, list all businesses, their TINs, ownership percentages, and describe the relationship." },
  { q: "Is the applicant or any associate currently incarcerated or under indictment for a felony or financial crime?", help: "A 'yes' answer here makes the applicant ineligible for SBA financial assistance." },
  { q: "Are any products or services exported, or is there a plan to begin exporting?", help: "Not a disqualifier. SBA has export-specific loan programs." },
  { q: "Has a fee been paid to a third party to assist with this loan application?", help: "Loan brokers and packagers are common, but fees must be disclosed." },
  { q: "Are any revenues derived from gambling, lending, lobbying, or adult entertainment?", help: "Certain business types are restricted from SBA lending." },
  { q: "Is any owner (10%+) an SBA employee or household member of an SBA employee?", help: "Conflict of interest provision." },
  { q: "Is any associate a former SBA employee separated less than one year ago?", help: "Cooling-off period provision." },
  { q: "Is any owner (10%+) a member of Congress or federal legislative/judicial branch employee?", help: "Federal ethics provision." },
  { q: "Is any owner (10%+) a federal employee at GS-13 or higher (or military equivalent)?", help: "May require additional review." },
  { q: "Is any owner (10%+) a SCORE volunteer or Small Business Advisory Council member?", help: "Conflict of interest provision related to SBA advisory organizations." },
  { q: "Is the applicant or any owner currently involved in any legal action, including divorce?", help: "Active litigation can affect loan approval. Provide details." },
];

const colors: any = { bg: "#FAF8F5", card: "#FFFFFF", accent: "#2D6A4F", accentLight: "#D8F3DC", accentMuted: "#95D5B2", warm: "#E8DDD3", warmDark: "#8B7E74", text: "#2C2C2C", textMuted: "#6B6B6B", border: "#E8E2DB", danger: "#C1524A", dangerLight: "#FDE8E6" };

const Input = ({ label, value, onChange, type = "text", placeholder, help, wide }: any) => (
  <div style={{ flex: wide ? "1 1 100%" : "1 1 280px", minWidth: 0 }}>
    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 4 }}>{label}</label>
    {help && <p style={{ fontSize: 12, color: colors.textMuted, margin: "0 0 4px", lineHeight: 1.4 }}>{help}</p>}
    <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder || ""} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 14, background: colors.bg, color: colors.text, outline: "none", boxSizing: "border-box" as const }} />
  </div>
);

const TextArea = ({ label, value, onChange, placeholder, help, rows = 3 }: any) => (
  <div style={{ flex: "1 1 100%" }}>
    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 4 }}>{label}</label>
    {help && <p style={{ fontSize: 12, color: colors.textMuted, margin: "0 0 4px", lineHeight: 1.4 }}>{help}</p>}
    <textarea value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 14, background: colors.bg, color: colors.text, outline: "none", boxSizing: "border-box" as const, resize: "vertical" as const }} />
  </div>
);

const Select = ({ label, value, onChange, options, help }: any) => (
  <div style={{ flex: "1 1 280px", minWidth: 0 }}>
    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 4 }}>{label}</label>
    {help && <p style={{ fontSize: 12, color: colors.textMuted, margin: "0 0 4px", lineHeight: 1.4 }}>{help}</p>}
    <select value={value} onChange={(e: any) => onChange(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 14, background: colors.bg, color: value ? colors.text : colors.textMuted, outline: "none", boxSizing: "border-box" as const, cursor: "pointer" }}>
      <option value="">Select...</option>
      {options.map((o: any) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const SectionCard = ({ title, subtitle, children }: any) => (
  <div style={{ background: colors.card, borderRadius: 12, padding: "24px 28px", border: `1px solid ${colors.border}`, marginBottom: 16 }}>
    {title && <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: colors.text }}>{title}</h3>}
    {subtitle && <p style={{ margin: "0 0 16px", fontSize: 13, color: colors.textMuted, lineHeight: 1.5 }}>{subtitle}</p>}
    {children}
  </div>
);

const Row = ({ children, gap = 16 }: any) => (<div style={{ display: "flex", flexWrap: "wrap" as const, gap, alignItems: "flex-start" }}>{children}</div>);
const AddButton = ({ onClick, label }: any) => (<button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: colors.accentLight, color: colors.accent, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ {label}</button>);
const RemoveButton = ({ onClick }: any) => (<button onClick={onClick} style={{ padding: "4px 10px", background: colors.dangerLight, color: colors.danger, border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove</button>);

const YesNo = ({ value, onChange, label, help }: any) => (
  <div style={{ padding: "12px 0", borderBottom: `1px solid ${colors.border}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, color: colors.text, fontWeight: 500, lineHeight: 1.5 }}>{label}</p>
        {help && <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.textMuted, lineHeight: 1.4 }}>{help}</p>}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {["Yes", "No"].map(opt => (
          <button key={opt} onClick={() => onChange(opt)} style={{ padding: "6px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", border: value === opt ? "none" : `1px solid ${colors.border}`, background: value === opt ? (opt === "Yes" ? colors.dangerLight : colors.accentLight) : colors.card, color: value === opt ? (opt === "Yes" ? colors.danger : colors.accent) : colors.textMuted }}>{opt}</button>
        ))}
      </div>
    </div>
  </div>
);

// Step Components
const CompanyStep = ({ data, setData }: any) => {
  const set = (k: string, v: any) => setData({ ...data, [k]: v });
  return (<>
    <SectionCard title="Basic Information" subtitle="Enter the legal details for the borrowing entity.">
      <Row><Input label="Legal Business Name" value={data.legalName} onChange={(v: any) => set("legalName", v)} placeholder="e.g. Acme Manufacturing, LLC" /><Input label="DBA / Trade Name" value={data.dba} onChange={(v: any) => set("dba", v)} placeholder="If different from legal name" /></Row>
      <Row><Input label="Tax ID (EIN)" value={data.tin} onChange={(v: any) => set("tin", v)} placeholder="XX-XXXXXXX" /><Select label="Entity Type" value={data.entityType} onChange={(v: any) => set("entityType", v)} options={["Sole Proprietorship", "Partnership", "S-Corporation", "C-Corporation", "LLC", "Nonprofit", "Other"]} /></Row>
      <Row><Input label="NAICS Code" value={data.naicsCode} onChange={(v: any) => set("naicsCode", v)} placeholder="6-digit code" help="Must match your IRS tax filings" /><Input label="Year Operations Began" value={data.yearBegan} onChange={(v: any) => set("yearBegan", v)} placeholder="e.g. 2018" /></Row>
    </SectionCard>
    <SectionCard title="Contact Information">
      <Row><Input label="Street Address" value={data.streetAddress} onChange={(v: any) => set("streetAddress", v)} wide placeholder="No P.O. Box" /></Row>
      <Row><Input label="Mailing Address" value={data.mailingAddress} onChange={(v: any) => set("mailingAddress", v)} wide placeholder="If different from street address" /></Row>
      <Row><Input label="Phone" value={data.phone} onChange={(v: any) => set("phone", v)} placeholder="(xxx) xxx-xxxx" /><Input label="Cellular" value={data.cellular} onChange={(v: any) => set("cellular", v)} placeholder="(xxx) xxx-xxxx" /><Input label="Email" value={data.email} onChange={(v: any) => set("email", v)} type="email" /></Row>
    </SectionCard>
    <SectionCard title="Employees">
      <Row><Input label="Full-Time Employees" value={data.employeesFT} onChange={(v: any) => set("employeesFT", v)} type="number" /><Input label="Part-Time Employees" value={data.employeesPT} onChange={(v: any) => set("employeesPT", v)} type="number" /></Row>
    </SectionCard>
  </>);
};

const OwnershipStep = ({ data, setData }: any) => {
  const addOwner = () => setData([...data, { ...emptyOwner }]);
  const removeOwner = (i: number) => setData(data.filter((_: any, idx: number) => idx !== i));
  const setOwner = (i: number, k: string, v: any) => { const n = [...data]; n[i] = { ...n[i], [k]: v }; setData(n); };
  const totalPct = data.reduce((s: number, o: any) => s + (parseFloat(o.ownershipPct) || 0), 0);
  return (<>
    <SectionCard title="Ownership Structure" subtitle="Add every individual who owns 20% or more. Ownership must total 100%.">
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", background: totalPct === 100 ? colors.accentLight : totalPct > 100 ? colors.dangerLight : colors.warm, borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600, color: totalPct === 100 ? colors.accent : totalPct > 100 ? colors.danger : colors.warmDark }}>
        Total Ownership: {totalPct}% {totalPct === 100 ? "✓" : totalPct > 100 ? "(exceeds 100%)" : `(${100 - totalPct}% remaining)`}
      </div>
    </SectionCard>
    {data.map((owner: any, i: number) => (
      <SectionCard key={i} title={owner.name || `Owner ${i + 1}`}>
        <Row><Input label="Full Legal Name" value={owner.name} onChange={(v: any) => setOwner(i, "name", v)} /><Input label="Title" value={owner.title} onChange={(v: any) => setOwner(i, "title", v)} placeholder="e.g. CEO, Managing Member" /><Input label="Ownership %" value={owner.ownershipPct} onChange={(v: any) => setOwner(i, "ownershipPct", v)} type="number" /></Row>
        <Row><Input label="Date of Birth" value={owner.dob} onChange={(v: any) => setOwner(i, "dob", v)} type="date" /><Input label="Home Address" value={owner.homeAddress} onChange={(v: any) => setOwner(i, "homeAddress", v)} /></Row>
        <Row><Input label="Phone" value={owner.phone} onChange={(v: any) => setOwner(i, "phone", v)} /><Input label="Email" value={owner.email} onChange={(v: any) => setOwner(i, "email", v)} type="email" /></Row>
        {data.length > 1 && <div style={{ marginTop: 12 }}><RemoveButton onClick={() => removeOwner(i)} /></div>}
      </SectionCard>
    ))}
    <AddButton onClick={addOwner} label="Add Owner" />
  </>);
};

const DebtStep = ({ data, setData }: any) => {
  const addDebt = () => setData([...data, { ...emptyDebt }]);
  const removeDebt = (i: number) => setData(data.filter((_: any, idx: number) => idx !== i));
  const setDebt = (i: number, k: string, v: any) => { const n = [...data]; n[i] = { ...n[i], [k]: v }; setData(n); };
  const totalBalance = data.reduce((s: number, d: any) => s + (parseFloat(d.presentBalance) || 0), 0);
  const totalPayment = data.reduce((s: number, d: any) => s + (parseFloat(d.monthlyPayment) || 0), 0);
  return (<>
  <SmartUpload onFieldsExtracted={(docType: any, fields: any) => {
      if (docType === 'loan_agreement') {
        setData([...data, {
          lender: fields.lender || '',
          originationDate: fields.originationDate || '',
          loanAmount: fields.loanAmount?.toString() || '',
          intRate: fields.interestRate?.toString() || '',
          maturityDate: fields.maturityDate || '',
          monthlyPayment: fields.monthlyPayment?.toString() || '',
          presentBalance: fields.loanAmount?.toString() || '',
          security: fields.collateral || '',
          status: 'Current',
        }]);
      }
    }} />
    <SectionCard title="Current Debt Schedule" subtitle="List every outstanding debt obligation of the business.">
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" as const }}>
        <div style={{ padding: "10px 16px", background: colors.accentLight, borderRadius: 8 }}><div style={{ fontSize: 11, color: colors.accent, fontWeight: 600, textTransform: "uppercase" as const }}>Total Balance</div><div style={{ fontSize: 20, fontWeight: 700, color: colors.accent }}>${totalBalance.toLocaleString()}</div></div>
        <div style={{ padding: "10px 16px", background: colors.warm, borderRadius: 8 }}><div style={{ fontSize: 11, color: colors.warmDark, fontWeight: 600, textTransform: "uppercase" as const }}>Monthly Payments</div><div style={{ fontSize: 20, fontWeight: 700, color: colors.warmDark }}>${totalPayment.toLocaleString()}</div></div>
      </div>
    </SectionCard>
    {data.map((debt: any, i: number) => (
      <SectionCard key={i} title={debt.lender || `Debt ${i + 1}`}>
        <Row><Input label="Lender" value={debt.lender} onChange={(v: any) => setDebt(i, "lender", v)} placeholder="e.g. Wells Fargo" /><Input label="Origination Date" value={debt.originationDate} onChange={(v: any) => setDebt(i, "originationDate", v)} type="date" /><Input label="Original Loan Amount" value={debt.loanAmount} onChange={(v: any) => setDebt(i, "loanAmount", v)} placeholder="$" /></Row>
        <Row><Input label="Interest Rate (%)" value={debt.intRate} onChange={(v: any) => setDebt(i, "intRate", v)} placeholder="e.g. 6.5" /><Input label="Maturity Date" value={debt.maturityDate} onChange={(v: any) => setDebt(i, "maturityDate", v)} type="date" /><Input label="Monthly Payment" value={debt.monthlyPayment} onChange={(v: any) => setDebt(i, "monthlyPayment", v)} placeholder="$" /></Row>
        <Row><Input label="Present Balance" value={debt.presentBalance} onChange={(v: any) => setDebt(i, "presentBalance", v)} placeholder="$" /><Input label="Security / Collateral" value={debt.security} onChange={(v: any) => setDebt(i, "security", v)} /><Select label="Status" value={debt.status} onChange={(v: any) => setDebt(i, "status", v)} options={["Current", "Late"]} /></Row>
        <div style={{ marginTop: 12 }}><RemoveButton onClick={() => removeDebt(i)} /></div>
      </SectionCard>
    ))}
    <AddButton onClick={addDebt} label="Add Debt" />
  </>);
};

const BankingStep = ({ data, setData }: any) => {
  const addBank = () => setData([...data, { ...emptyBank }]);
  const removeBank = (i: number) => setData(data.filter((_: any, idx: number) => idx !== i));
  const setBank = (i: number, k: string, v: any) => { const n = [...data]; n[i] = { ...n[i], [k]: v }; setData(n); };
  return (<>
    <SectionCard title="Bank Relationships" subtitle="List all business bank accounts.">
      {data.map((b: any, i: number) => (
        <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: i < data.length - 1 ? `1px solid ${colors.border}` : "none" }}>
          <Row><Input label="Bank Name" value={b.bank} onChange={(v: any) => setBank(i, "bank", v)} /><Select label="Account Type" value={b.accountType} onChange={(v: any) => setBank(i, "accountType", v)} options={["Checking", "Savings", "Money Market", "Line of Credit", "Other"]} /><Input label="Balance" value={b.balance} onChange={(v: any) => setBank(i, "balance", v)} placeholder="$" /><Input label="Name on Account" value={b.nameOnAccount} onChange={(v: any) => setBank(i, "nameOnAccount", v)} /></Row>
          {data.length > 1 && <div style={{ marginTop: 8 }}><RemoveButton onClick={() => removeBank(i)} /></div>}
        </div>
      ))}
    </SectionCard>
    <AddButton onClick={addBank} label="Add Account" />
  </>);
};

const AffiliatesStep = ({ data, setData }: any) => {
  const addAff = () => setData([...data, { ...emptyAffiliate }]);
  const removeAff = (i: number) => setData(data.filter((_: any, idx: number) => idx !== i));
  const setAff = (i: number, k: string, v: any) => { const n = [...data]; n[i] = { ...n[i], [k]: v }; setData(n); };
  return (
    <SectionCard title="Affiliated Businesses" subtitle="List any business where the applicant or any owner holds 20% or more ownership. If none, skip this section.">
      {data.map((a: any, i: number) => (
        <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: i < data.length - 1 ? `1px solid ${colors.border}` : "none" }}>
          <Row><Input label="Business Name" value={a.name} onChange={(v: any) => setAff(i, "name", v)} /><Input label="Title/Role" value={a.title} onChange={(v: any) => setAff(i, "title", v)} /><Input label="Ownership %" value={a.ownershipPct} onChange={(v: any) => setAff(i, "ownershipPct", v)} type="number" /><Input label="# Employees" value={a.employees} onChange={(v: any) => setAff(i, "employees", v)} type="number" /></Row>
          <div style={{ marginTop: 8 }}><RemoveButton onClick={() => removeAff(i)} /></div>
        </div>
      ))}
      <AddButton onClick={addAff} label="Add Affiliate" />
    </SectionCard>
  );
};

const LoanStep = ({ data, setData }: any) => {
  const set = (k: string, v: any) => setData({ ...data, [k]: v });
  const purposeFields: any[] = [["landBuilding", "Land & Building"], ["newConstruction", "New Construction"], ["landAcquisition", "Land Only"], ["machineryEquipment", "Machinery/Equipment"], ["businessAcquisition", "Business Acquisition"], ["furnitureFixtures", "Furniture & Fixtures"], ["debtRefinance", "Debt Refinance"], ["inventory", "Inventory"], ["leaseholdImprovements", "Leasehold Improvements"], ["closingCosts", "Closing Costs"], ["workingCapital", "Working Capital"], ["other", "Other"]];
  const total = purposeFields.reduce((s, [k]) => s + (parseFloat(data[k]) || 0), 0);
  return (<>
    <SectionCard title="Loan Details" subtitle="What are you borrowing and what will it be used for?">
      <Row><Input label="Total Loan Amount Requested" value={data.amountRequested} onChange={(v: any) => set("amountRequested", v)} placeholder="$" /><Select label="Primary Purpose" value={data.keyPurpose} onChange={(v: any) => set("keyPurpose", v)} options={["Debt Refinance", "Business Purchase", "New Construction", "Purchase Building", "New Equipment", "Working Capital", "Expansion", "Other"]} /></Row>
      <TextArea label="Describe the project or business purpose" value={data.projectDescription} onChange={(v: any) => set("projectDescription", v)} placeholder="Explain what you're doing with the loan proceeds..." rows={4} />
      <TextArea label="Describe the collateral being pledged" value={data.collateralDescription} onChange={(v: any) => set("collateralDescription", v)} placeholder="If commercial real estate, include names on deeds..." rows={3} />
    </SectionCard>
    <SectionCard title="Use of Proceeds Breakdown" subtitle="Allocate the loan amount across categories.">
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", marginBottom: 16, background: total === parseFloat(data.amountRequested) ? colors.accentLight : colors.warm, borderRadius: 8, fontSize: 13, fontWeight: 600, color: total === parseFloat(data.amountRequested) ? colors.accent : colors.warmDark }}>
        Allocated: ${total.toLocaleString()} of ${(parseFloat(data.amountRequested) || 0).toLocaleString()} {total === parseFloat(data.amountRequested) && " ✓"}
      </div>
      <Row>{purposeFields.map(([k, label]: any) => (<Input key={k} label={label} value={data[k]} onChange={(v: any) => set(k, v)} placeholder="$" />))}</Row>
    </SectionCard>
  </>);
};

const HistoryStep = ({ data, setData }: any) => {
  const set = (i: number, v: any) => { const n = [...data]; n[i] = v; setData(n); };
  return (
    <SectionCard title="History of Business" subtitle="These narrative questions help the lender understand your business beyond the numbers.">
      {historyQuestions.map((q, i) => (<div key={i} style={{ marginBottom: 16 }}><TextArea label={`${i + 1}. ${q}`} value={data[i]} onChange={(v: any) => set(i, v)} rows={i === 0 ? 4 : 2} /></div>))}
    </SectionCard>
  );
};

const ResumeStep = ({ owners, data, setData }: any) => {
  const setEdu = (oi: number, ei: number, k: string, v: any) => { const n = [...data]; if (!n[oi]) n[oi] = { ...emptyOwner }; const edu = [...(n[oi].education || [])]; edu[ei] = { ...edu[ei], [k]: v }; n[oi] = { ...n[oi], education: edu }; setData(n); };
  const setWork = (oi: number, wi: number, k: string, v: any) => { const n = [...data]; if (!n[oi]) n[oi] = { ...emptyOwner }; const work = [...(n[oi].workHistory || [])]; work[wi] = { ...work[wi], [k]: v }; n[oi] = { ...n[oi], workHistory: work }; setData(n); };
  return (<>{owners.map((owner: any, oi: number) => { const d = data[oi] || emptyOwner; return (<div key={oi}>
    <SectionCard title={`${owner.name || `Owner ${oi + 1}`} — Education`}>{(d.education || []).map((edu: any, ei: number) => (<Row key={ei}><Input label="School" value={edu.school} onChange={(v: any) => setEdu(oi, ei, "school", v)} /><Input label="Dates Attended" value={edu.dates} onChange={(v: any) => setEdu(oi, ei, "dates", v)} /><Input label="Major" value={edu.major} onChange={(v: any) => setEdu(oi, ei, "major", v)} /><Input label="Degree" value={edu.degree} onChange={(v: any) => setEdu(oi, ei, "degree", v)} /></Row>))}</SectionCard>
    <SectionCard title={`${owner.name || `Owner ${oi + 1}`} — Work Experience`} subtitle="List chronologically, starting with current position.">{(d.workHistory || []).map((w: any, wi: number) => (<div key={wi} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${colors.border}` }}><Row><Input label="Company" value={w.company} onChange={(v: any) => setWork(oi, wi, "company", v)} /><Input label="From" value={w.from} onChange={(v: any) => setWork(oi, wi, "from", v)} type="date" /><Input label="To" value={w.to} onChange={(v: any) => setWork(oi, wi, "to", v)} type="date" /><Input label="Title" value={w.title} onChange={(v: any) => setWork(oi, wi, "title", v)} /></Row><TextArea label="Duties" value={w.duties} onChange={(v: any) => setWork(oi, wi, "duties", v)} rows={2} /></div>))}
      <AddButton onClick={() => { const n = [...data]; if (!n[oi]) n[oi] = { ...emptyOwner }; n[oi] = { ...n[oi], workHistory: [...(n[oi].workHistory || []), { company: "", from: "", to: "", title: "", duties: "" }] }; setData(n); }} label="Add Position" />
    </SectionCard>
  </div>); })}</>);
};

const PFSStep = ({ owners, data, setData }: any) => {
  const setField = (oi: number, k: string, v: any) => { const n = [...data]; if (!n[oi]) n[oi] = { ...emptyPFS }; n[oi] = { ...n[oi], [k]: v }; setData(n); };
  const assetFields: any[] = [["cashOnHand", "Cash on Hand & in Banks"], ["savings", "Savings Accounts"], ["ira", "IRA / Retirement Accounts"], ["accountsReceivable", "Accounts & Notes Receivable"], ["lifeInsurance", "Life Insurance (Cash Surrender Value)"], ["stocksBonds", "Stocks and Bonds"], ["realEstate", "Real Estate"], ["automobiles", "Automobiles"], ["otherProperty", "Other Personal Property"], ["otherAssets", "Other Assets"]];
  const liabFields: any[] = [["accountsPayable", "Accounts Payable"], ["notesPayable", "Notes Payable to Banks"], ["installmentAuto", "Installment Account (Auto)"], ["installmentOther", "Installment Account (Other)"], ["loanAgainstInsurance", "Loans Against Life Insurance"], ["mortgages", "Mortgages on Real Estate"], ["unpaidTaxes", "Unpaid Taxes"], ["otherLiabilities", "Other Liabilities"]];
  return (<>
    <SectionCard title="Personal Financial Statement (SBA Form 413)" subtitle="Required for each owner with 20%+ interest. This is your personal balance sheet, not the business." />
    {owners.map((owner: any, oi: number) => { const d = data[oi] || emptyPFS; const totalAssets = assetFields.reduce((s: number, [k]: any) => s + (parseFloat(d[k]) || 0), 0); const totalLiab = liabFields.reduce((s: number, [k]: any) => s + (parseFloat(d[k]) || 0), 0); const netWorth = totalAssets - totalLiab; return (<div key={oi}>
      <SectionCard title={`${owner.name || `Owner ${oi + 1}`} — Assets`}><Row>{assetFields.map(([k, label]: any) => (<Input key={k} label={label} value={d[k]} onChange={(v: any) => setField(oi, k, v)} placeholder="$" />))}</Row><div style={{ marginTop: 12, padding: "8px 16px", background: colors.accentLight, borderRadius: 8, fontSize: 14, fontWeight: 700, color: colors.accent }}>Total Assets: ${totalAssets.toLocaleString()}</div></SectionCard>
      <SectionCard title={`${owner.name || `Owner ${oi + 1}`} — Liabilities`}><Row>{liabFields.map(([k, label]: any) => (<Input key={k} label={label} value={d[k]} onChange={(v: any) => setField(oi, k, v)} placeholder="$" />))}</Row><div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" as const }}><div style={{ padding: "8px 16px", background: colors.warm, borderRadius: 8, fontSize: 14, fontWeight: 700, color: colors.warmDark }}>Total Liabilities: ${totalLiab.toLocaleString()}</div><div style={{ padding: "8px 16px", background: netWorth >= 0 ? colors.accentLight : colors.dangerLight, borderRadius: 8, fontSize: 14, fontWeight: 700, color: netWorth >= 0 ? colors.accent : colors.danger }}>Net Worth: ${netWorth.toLocaleString()}</div></div></SectionCard>
      <SectionCard title={`${owner.name || `Owner ${oi + 1}`} — Income`}><Row><Input label="Salary" value={d.salary} onChange={(v: any) => setField(oi, "salary", v)} placeholder="$" /><Input label="Net Investment Income" value={d.netInvestmentIncome} onChange={(v: any) => setField(oi, "netInvestmentIncome", v)} placeholder="$" /><Input label="Real Estate Income" value={d.realEstateIncome} onChange={(v: any) => setField(oi, "realEstateIncome", v)} placeholder="$" /><Input label="Other Income" value={d.otherIncome} onChange={(v: any) => setField(oi, "otherIncome", v)} placeholder="$" /></Row></SectionCard>
    </div>); })}
  </>);
};

const EligibilityStep = ({ data, setData }: any) => {
  const set = (i: number, v: any) => { const n = [...data]; n[i] = v; setData(n); };
  return (
    <SectionCard title="Eligibility & Compliance" subtitle="Answer honestly. A 'yes' does not automatically disqualify you, but will require additional documentation.">
      {eligibilityQuestions.map((eq, i) => (<YesNo key={i} value={data[i]} onChange={(v: any) => set(i, v)} label={eq.q} help={eq.help} />))}
    </SectionCard>
  );
};

const DocumentsStep = ({ data, setData }: any) => {
  const handleFileUpload = (categoryId: string, files: FileList) => {
    const newData = { ...data }; if (!newData[categoryId]) newData[categoryId] = [];
    Array.from(files).forEach(file => { newData[categoryId] = [...(newData[categoryId] || []), { name: file.name, size: file.size, type: file.type, uploadedAt: new Date().toISOString() }]; setData({ ...newData }); });
  };
  const removeFile = (categoryId: string, fileIndex: number) => { const newData = { ...data }; newData[categoryId] = newData[categoryId].filter((_: any, i: number) => i !== fileIndex); setData({ ...newData }); };
  const formatSize = (bytes: number) => { if (bytes < 1024) return bytes + " B"; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"; return (bytes / (1024 * 1024)).toFixed(1) + " MB"; };
  const getFileIcon = (name: string) => { const ext = name.split(".").pop()?.toLowerCase(); if (ext === "pdf") return "📄"; if (["doc", "docx"].includes(ext || "")) return "📝"; if (["xls", "xlsx", "csv"].includes(ext || "")) return "📊"; return "📎"; };
  const totalFiles = Object.values(data).reduce((sum: number, files: any) => sum + (Array.isArray(files) ? files.length : 0), 0);
  const requiredCategories = documentCategories.filter(c => c.required);
  const requiredComplete = requiredCategories.filter(c => data[c.id] && data[c.id].length > 0).length;
  return (<>
    <SectionCard title="Supporting Documents" subtitle="Upload the documents your lender needs. Accepted formats include PDF, Word, Excel, and CSV.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const, marginBottom: 8 }}>
        <div style={{ padding: "8px 16px", background: colors.accentLight, borderRadius: 8 }}><div style={{ fontSize: 11, color: colors.accent, fontWeight: 600, textTransform: "uppercase" as const }}>Files Uploaded</div><div style={{ fontSize: 20, fontWeight: 700, color: colors.accent }}>{totalFiles as number}</div></div>
        <div style={{ padding: "8px 16px", background: requiredComplete === requiredCategories.length ? colors.accentLight : colors.dangerLight, borderRadius: 8 }}><div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: requiredComplete === requiredCategories.length ? colors.accent : colors.danger }}>Required Docs</div><div style={{ fontSize: 20, fontWeight: 700, color: requiredComplete === requiredCategories.length ? colors.accent : colors.danger }}>{requiredComplete} / {requiredCategories.length}</div></div>
      </div>
    </SectionCard>
    {documentCategories.map(cat => { const files = data[cat.id] || []; const hasFiles = files.length > 0; const inputId = `file-upload-${cat.id}`; return (
      <SectionCard key={cat.id} title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}>{cat.label}{cat.required && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: hasFiles ? colors.accentLight : colors.dangerLight, color: hasFiles ? colors.accent : colors.danger, textTransform: "uppercase" as const }}>{hasFiles ? "Complete" : "Required"}</span>}</span>} subtitle={cat.description}>
        {files.length > 0 && <div style={{ marginBottom: 12 }}>{files.map((file: any, fi: number) => (<div key={fi} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: colors.bg, borderRadius: 8, marginBottom: 6, border: `1px solid ${colors.border}` }}><div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}><span style={{ fontSize: 20 }}>{getFileIcon(file.name)}</span><div><div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{file.name}</div><div style={{ fontSize: 11, color: colors.textMuted }}>{formatSize(file.size)}</div></div></div><RemoveButton onClick={() => removeFile(cat.id, fi)} /></div>))}</div>}
        <label htmlFor={inputId} style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", padding: "24px 16px", borderRadius: 10, border: `2px dashed ${colors.border}`, background: colors.bg, cursor: "pointer", minHeight: 80 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>{hasFiles ? "➕" : "📂"}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.accent, marginBottom: 2 }}>{hasFiles ? "Add more files" : "Drop files here or click to upload"}</div>
          <div style={{ fontSize: 11, color: colors.textMuted }}>{cat.accepts.replace(/\./g, "").toUpperCase().replace(/,/g, ", ")}</div>
          <input id={inputId} type="file" accept={cat.accepts} multiple style={{ display: "none" }} onChange={(e: any) => { if (e.target.files.length) handleFileUpload(cat.id, e.target.files); e.target.value = ""; }} />
        </label>
      </SectionCard>
    ); })}
  </>);
};

const ReviewStep = ({ company, owners, debts, banks, loan, history, eligibility, documents }: any) => {
  const fieldFilled = (v: any) => v !== "" && v !== undefined && v !== null;
  const countFilled = (obj: any, keys: string[]) => keys.filter(k => fieldFilled(obj[k])).length;
  const companyKeys = ["legalName", "tin", "streetAddress", "phone", "email", "entityType"];
  const loanKeys = ["amountRequested", "keyPurpose", "projectDescription"];
  const requiredDocs = documentCategories.filter(c => c.required);
  const docsUploaded = requiredDocs.filter(c => documents[c.id] && documents[c.id].length > 0).length;
  const sections = [
    { label: "Company Info", filled: countFilled(company, companyKeys), total: companyKeys.length, icon: "🏢" },
    { label: "Ownership", filled: owners.filter((o: any) => fieldFilled(o.name)).length, total: Math.max(owners.length, 1), icon: "👥" },
    { label: "Debt Schedule", filled: debts.filter((d: any) => fieldFilled(d.lender)).length, total: Math.max(debts.length, 1), icon: "📊" },
    { label: "Bank Accounts", filled: banks.filter((b: any) => fieldFilled(b.bank)).length, total: Math.max(banks.length, 1), icon: "🏦" },
    { label: "Loan Request", filled: countFilled(loan, loanKeys), total: loanKeys.length, icon: "💰" },
    { label: "Business History", filled: history.filter((h: any) => fieldFilled(h)).length, total: historyQuestions.length, icon: "📖" },
    { label: "Eligibility", filled: eligibility.filter((e: any) => fieldFilled(e)).length, total: eligibilityQuestions.length, icon: "✅" },
    { label: "Documents", filled: docsUploaded, total: requiredDocs.length, icon: "📎" },
  ];
  const overallFilled = sections.reduce((s, sec) => s + sec.filled, 0);
  const overallTotal = sections.reduce((s, sec) => s + sec.total, 0);
  const pct = Math.round((overallFilled / overallTotal) * 100);
  return (<>
    <SectionCard title="Packet Completion Summary" subtitle="Sections marked incomplete need attention before you submit to your lender.">
      <div style={{ marginBottom: 20 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{pct}% Complete</span><span style={{ fontSize: 13, color: colors.textMuted }}>{overallFilled} / {overallTotal} fields</span></div><div style={{ height: 10, background: colors.warm, borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${colors.accent}, ${colors.accentMuted})`, borderRadius: 5, transition: "width 0.5s ease" }} /></div></div>
      {sections.map((sec, i) => (<div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < sections.length - 1 ? `1px solid ${colors.border}` : "none" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 18 }}>{sec.icon}</span><span style={{ fontSize: 14, fontWeight: 500, color: colors.text }}>{sec.label}</span></div><div style={{ padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: sec.filled === sec.total ? colors.accentLight : colors.warm, color: sec.filled === sec.total ? colors.accent : colors.warmDark }}>{sec.filled === sec.total ? "Complete ✓" : `${sec.filled} / ${sec.total}`}</div></div>))}
    </SectionCard>
    <PacketReviewer company={company} owners={owners} debts={debts} banks={banks} loan={loan} history={history} eligibility={eligibility} documents={documents} />
    <div style={{ textAlign: "center" as const, padding: "24px", background: colors.accentLight, borderRadius: 12, border: `1px dashed ${colors.accentMuted}` }}><div style={{ fontSize: 24, marginBottom: 8 }}>📦</div><div style={{ fontSize: 16, fontWeight: 700, color: colors.accent, marginBottom: 4 }}>Export Packet</div><div style={{ fontSize: 13, color: colors.accent }}>PDF generation coming in Phase 2. Your data is saved automatically.</div></div>
  </>);
};

// ==================== MAIN PAGE WITH SUPABASE ====================

export default function PacketPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const loanAppId = params.id as string

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [companyId, setCompanyId] = useState('')

  const [company, setCompany] = useState<any>({ ...initialCompany })
  const [owners, setOwners] = useState<any[]>([{ ...emptyOwner }])
  const [debts, setDebts] = useState<any[]>([{ ...emptyDebt }])
  const [banks, setBanks] = useState<any[]>([{ ...emptyBank }])
  const [affiliates, setAffiliates] = useState<any[]>([])
  const [loan, setLoan] = useState<any>({ ...emptyLoan })
  const [history, setHistory] = useState<any[]>(historyQuestions.map(() => ''))
  const [resumes, setResumes] = useState<any[]>([])
  const [pfs, setPfs] = useState<any[]>([])
  const [eligibility, setEligibility] = useState<any[]>(eligibilityQuestions.map(() => ''))
  const [documents, setDocuments] = useState<any>({})

  useEffect(() => { loadAllData() }, [loanAppId])

  const loadAllData = async () => {
    try {
      const { data: loanApp } = await supabase.from('loan_applications').select('*').eq('id', loanAppId).single()
      if (!loanApp) { router.push('/'); return; }
      setCompanyId(loanApp.company_id)

      const { data: comp } = await supabase.from('companies').select('*').eq('id', loanApp.company_id).single()
      if (comp) {
        setCompany({ legalName: comp.legal_name || '', dba: comp.dba || '', tin: comp.tin || '', streetAddress: comp.street_address || '', mailingAddress: comp.mailing_address || '', phone: comp.phone || '', cellular: comp.cellular || '', email: comp.email || '', entityType: comp.entity_type || '', naicsCode: comp.naics_code || '', yearBegan: comp.year_began || '', employeesFT: comp.employees_ft?.toString() || '', employeesPT: comp.employees_pt?.toString() || '' })
      }

      if (loanApp.amount_requested || loanApp.key_purpose) {
        setLoan({ amountRequested: loanApp.amount_requested || '', keyPurpose: loanApp.key_purpose || '', projectDescription: loanApp.project_description || '', collateralDescription: loanApp.collateral_description || '', ...(loanApp.use_of_proceeds || {}) })
      }
      if (loanApp.business_history?.length > 0) setHistory(loanApp.business_history)
      if (loanApp.eligibility_answers?.length > 0) setEligibility(loanApp.eligibility_answers)
      if (loanApp.documents) setDocuments(loanApp.documents)
    } catch (err) { console.error('Error loading:', err) }
    finally { setLoading(false) }
  }

  const saveAllData = async () => {
    if (!companyId) return; setSaving(true)
    try {
      await supabase.from('companies').update({
        legal_name: company.legalName, dba: company.dba, tin: company.tin, street_address: company.streetAddress, mailing_address: company.mailingAddress, phone: company.phone, cellular: company.cellular, email: company.email, entity_type: company.entityType, naics_code: company.naicsCode, year_began: company.yearBegan, employees_ft: parseInt(company.employeesFT) || 0, employees_pt: parseInt(company.employeesPT) || 0,
      }).eq('id', companyId)

      await supabase.from('loan_applications').update({
        amount_requested: loan.amountRequested, key_purpose: loan.keyPurpose, project_description: loan.projectDescription, collateral_description: loan.collateralDescription,
        use_of_proceeds: { landBuilding: loan.landBuilding, newConstruction: loan.newConstruction, landAcquisition: loan.landAcquisition, machineryEquipment: loan.machineryEquipment, businessAcquisition: loan.businessAcquisition, furnitureFixtures: loan.furnitureFixtures, debtRefinance: loan.debtRefinance, inventory: loan.inventory, leaseholdImprovements: loan.leaseholdImprovements, closingCosts: loan.closingCosts, workingCapital: loan.workingCapital, other: loan.other },
        business_history: history, eligibility_answers: eligibility, documents: documents,
      }).eq('id', loanAppId)
    } catch (err) { console.error('Error saving:', err) }
    finally { setSaving(false) }
  }

  const changeStep = (newStep: number) => { saveAllData(); setStep(newStep); }

  const renderStep = () => {
    switch (step) {
      case 0: return <CompanyStep data={company} setData={setCompany} />
      case 1: return <OwnershipStep data={owners} setData={setOwners} />
      case 2: return <DebtStep data={debts} setData={setDebts} />
      case 3: return <BankingStep data={banks} setData={setBanks} />
      case 4: return <AffiliatesStep data={affiliates} setData={setAffiliates} />
      case 5: return <LoanStep data={loan} setData={setLoan} />
      case 6: return <HistoryStep data={history} setData={setHistory} />
      case 7: return <ResumeStep owners={owners} data={resumes} setData={setResumes} />
      case 8: return <PFSStep owners={owners} data={pfs} setData={setPfs} />
      case 9: return <EligibilityStep data={eligibility} setData={setEligibility} />
      case 10: return <DocumentsStep data={documents} setData={setDocuments} />
      case 11: return <ReviewStep company={company} owners={owners} debts={debts} banks={banks} affiliates={affiliates} loan={loan} history={history} resumes={resumes} pfs={pfs} eligibility={eligibility} documents={documents} />
      default: return null
    }
  }

  if (loading) return (<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF8F5' }}><p style={{ color: '#6B6B6B', fontSize: 16 }}>Loading your packet...</p></div>)

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      <div style={{ background: colors.card, borderBottom: `1px solid ${colors.border}`, padding: '16px 24px', position: 'sticky' as const, top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={() => { saveAllData(); router.push('/'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: colors.textMuted }}>← Dashboard</button>
              <div><h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.accent, fontFamily: "'DM Serif Display', serif" }}>debtera</h1><p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>Financial Packet Builder</p></div>
            </div>
            <div style={{ fontSize: 13, color: colors.textMuted }}>{saving ? 'Saving...' : `Step ${step + 1} of ${STEPS.length}`}</div>
          </div>
          <div style={{ display: 'flex', gap: 2, overflow: 'hidden' }}>
            {STEPS.map((s, i) => (<button key={s.id} onClick={() => changeStep(i)} style={{ flex: 1, padding: '6px 2px', border: 'none', cursor: 'pointer', background: 'transparent' }} title={s.label}><div style={{ height: 4, borderRadius: 2, background: i <= step ? colors.accent : colors.warm, transition: 'background 0.3s' }} /><div style={{ fontSize: 9, marginTop: 4, color: i === step ? colors.accent : colors.textMuted, fontWeight: i === step ? 700 : 400, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div></button>))}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 100px' }}>
        <div style={{ marginBottom: 20 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}><span style={{ fontSize: 28 }}>{STEPS[step].icon}</span><h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: colors.text, fontFamily: "'DM Serif Display', serif" }}>{STEPS[step].label}</h2></div></div>
        {renderStep()}
      </div>
      <div style={{ position: 'fixed' as const, bottom: 0, left: 0, right: 0, background: colors.card, borderTop: `1px solid ${colors.border}`, padding: '12px 24px', zIndex: 100 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={() => changeStep(Math.max(0, step - 1))} disabled={step === 0} style={{ padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: step === 0 ? 'default' : 'pointer', background: 'transparent', border: `1px solid ${colors.border}`, color: step === 0 ? colors.border : colors.text }}>← Back</button>
          <button onClick={() => changeStep(Math.min(STEPS.length - 1, step + 1))} disabled={step === STEPS.length - 1} style={{ padding: '10px 32px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: step === STEPS.length - 1 ? 'default' : 'pointer', background: step === STEPS.length - 1 ? colors.warm : colors.accent, border: 'none', color: step === STEPS.length - 1 ? colors.warmDark : '#fff' }}>
            {step === STEPS.length - 2 ? 'Review Packet →' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
