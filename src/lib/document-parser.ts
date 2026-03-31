// src/lib/document-parser.ts
// Dual-mode parser: text for clean PDFs, vision for scanned docs
// Supports 11 document types covering the full SBA loan packet

type DocumentType =
  | 'loan_agreement'
  | 'debt_schedule'
  | 'tax_return_personal'
  | 'tax_return_business'
  | 'articles_of_incorporation'
  | 'operating_agreement'
  | 'lease_agreement'
  | 'financial_statement'
  | 'bank_statement'
  | 'k1_schedule'
  | 'pfs_form'
  | 'unknown';

interface ParsedDocument {
  documentType: DocumentType;
  confidence: number;
  extractedFields: Record<string, any>;
  mode: 'text' | 'vision';
}

const EXTRACTION_PROMPTS: Record<string, string> = {
  loan_agreement: `Extract ALL available fields from this loan agreement. Return ONLY valid JSON, no markdown fences, no commentary:
{"lender":"lending institution name","borrower":"borrower name","loanAmount":0,"interestRate":0,"maturityDate":"YYYY-MM-DD","originationDate":"YYYY-MM-DD","monthlyPayment":0,"collateral":"collateral description","loanType":"term/revolving/SBA/line of credit/etc","presentBalance":0,"guarantors":"personal guarantor names"}
If a field is not found, use null. For amounts, return numbers only (no $ or commas).`,

  debt_schedule: `Extract ALL debt obligations from this debt schedule or summary of liabilities. Return ONLY valid JSON, no markdown fences:
{"debts":[{"lender":"institution name","loanAmount":0,"presentBalance":0,"interestRate":0,"maturityDate":"YYYY-MM-DD","originationDate":"YYYY-MM-DD","monthlyPayment":0,"collateral":"security description","loanType":"term/revolving/SBA/etc","status":"Current or Late"}]}
Extract every row/entry. For amounts, return numbers only. If a field is not found, use null.`,

  tax_return_personal: `Extract ALL available fields from this personal tax return (Form 1040). Return ONLY valid JSON, no markdown fences:
{"taxYear":"year","filingStatus":"single/married filing jointly/etc","taxpayerName":"full name","spouseName":"spouse name or null","address":"full address","totalIncome":0,"wagesAndSalary":0,"businessIncome":0,"rentalIncome":0,"interestIncome":0,"dividendIncome":0,"capitalGains":0,"totalTax":0,"adjustedGrossIncome":0}
NEVER extract SSN values. Always use null for SSN. For amounts, return numbers only. If a field is not found, use null.`,

  tax_return_business: `Extract ALL available fields from this business tax return (1120, 1120S, 1065, etc). Return ONLY valid JSON, no markdown fences:
{"taxYear":"year","formType":"1120/1120S/1065/etc","businessName":"legal name","ein":"EIN number","entityType":"S-Corp/C-Corp/Partnership/LLC","address":"business address","naicsCode":"6-digit NAICS","yearIncorporated":"year","totalRevenue":0,"costOfGoodsSold":0,"grossProfit":0,"totalDeductions":0,"netIncome":0,"officerCompensation":0,"totalAssets":0,"totalLiabilities":0,"totalEquity":0,"cashOnHand":0,"accountsReceivable":0,"inventory":0}
For amounts, return numbers only. If a field is not found, use null.`,

  articles_of_incorporation: `Extract ALL available fields from these organizational documents (articles of incorporation, certificate of formation, etc). Return ONLY valid JSON, no markdown fences:
{"entityName":"exact legal name","entityType":"LLC/Corporation/S-Corp/Partnership/etc","stateOfFormation":"two-letter state code","dateOfFormation":"YYYY-MM-DD","registeredAgent":"agent name and address","principalAddress":"business address","purpose":"stated business purpose","members":[{"name":"full name","title":"Manager/Member/President/etc","ownershipPct":0}]}
If a field is not found, use null.`,

  operating_agreement: `Extract ALL available fields from this operating agreement or bylaws. Return ONLY valid JSON, no markdown fences:
{"entityName":"exact legal name","entityType":"LLC/Corporation/etc","stateOfFormation":"two-letter state code","effectiveDate":"YYYY-MM-DD","managementStructure":"member-managed or manager-managed","fiscalYearEnd":"month","members":[{"name":"full name","title":"role","ownershipPct":0,"capitalContribution":0,"votingRights":"percentage or description"}]}
If a field is not found, use null.`,

  lease_agreement: `Extract ALL available fields from this lease or rental agreement. Return ONLY valid JSON, no markdown fences:
{"landlord":"landlord name","tenant":"tenant name","propertyAddress":"full property address","leaseStartDate":"YYYY-MM-DD","leaseEndDate":"YYYY-MM-DD","monthlyRent":0,"annualRent":0,"securityDeposit":0,"leaseType":"gross/net/triple net/modified gross","squareFootage":0,"renewalOptions":"description of renewal terms","personalGuarantee":"yes/no/details"}
For amounts, return numbers only. If a field is not found, use null.`,

  financial_statement: `Extract ALL available fields from this financial statement (income statement, balance sheet, P&L). Return ONLY valid JSON, no markdown fences:
{"companyName":"name","statementDate":"YYYY-MM-DD","statementType":"income statement/balance sheet/P&L","totalRevenue":0,"costOfGoodsSold":0,"grossProfit":0,"operatingExpenses":0,"netIncome":0,"totalAssets":0,"totalLiabilities":0,"totalEquity":0,"cashAndEquivalents":0,"accountsReceivable":0,"inventory":0,"accountsPayable":0,"currentAssets":0,"currentLiabilities":0}
For amounts, return numbers only. If a field is not found, use null.`,

  bank_statement: `Extract ALL available fields from this bank statement. Return ONLY valid JSON, no markdown fences:
{"bankName":"institution name","accountHolder":"name on account","accountType":"checking/savings/money market/etc","accountNumberLast4":"last 4 digits only","statementDate":"YYYY-MM-DD","statementPeriodStart":"YYYY-MM-DD","statementPeriodEnd":"YYYY-MM-DD","beginningBalance":0,"endingBalance":0,"totalDeposits":0,"totalWithdrawals":0,"averageDailyBalance":0}
NEVER extract full account numbers. Only last 4 digits. For amounts, return numbers only. If a field is not found, use null.`,

  k1_schedule: `Extract ALL available fields from this Schedule K-1 (Form 1065 or 1120S). Return ONLY valid JSON, no markdown fences:
{"taxYear":"year","partnershipName":"entity name","partnershipEIN":"EIN","partnerName":"partner/shareholder name","partnerAddress":"address","ownershipPct":0,"profitSharingPct":0,"capitalAccountBeginning":0,"capitalAccountEnding":0,"ordinaryIncome":0,"rentalIncome":0,"interestIncome":0,"dividends":0,"guaranteedPayments":0,"distributions":0}
NEVER extract SSN values. For amounts, return numbers only. If a field is not found, use null.`,

  pfs_form: `Extract ALL available fields from this Personal Financial Statement (SBA Form 413 or equivalent). Return ONLY valid JSON, no markdown fences:
{"name":"individual name","address":"home address","assets":{"cashOnHand":0,"savings":0,"retirementAccounts":0,"accountsReceivable":0,"lifeInsurance":0,"stocksBonds":0,"realEstate":0,"automobiles":0,"otherAssets":0},"liabilities":{"accountsPayable":0,"notesPayable":0,"installmentAuto":0,"installmentOther":0,"loanAgainstInsurance":0,"mortgages":0,"unpaidTaxes":0,"otherLiabilities":0},"income":{"salary":0,"netInvestmentIncome":0,"realEstateIncome":0,"otherIncome":0},"totalAssets":0,"totalLiabilities":0,"netWorth":0}
NEVER extract SSN values. For amounts, return numbers only. If a field is not found, use null.`,
};

const CLASSIFICATION_PROMPT = `Classify this document into exactly one category. Return ONLY valid JSON, no markdown fences, no commentary. Just the JSON object with "type" and "confidence" (0 to 1):
Categories: loan_agreement, debt_schedule, tax_return_personal, tax_return_business, articles_of_incorporation, operating_agreement, lease_agreement, financial_statement, bank_statement, k1_schedule, pfs_form, unknown

Guidance:
- "debt_schedule" = lists multiple debts/liabilities in table format
- "loan_agreement" = individual loan contract, promissory note, or commitment letter
- "bank_statement" = monthly/periodic statement from a bank showing transactions and balances
- "k1_schedule" = IRS Schedule K-1 from a partnership (1065) or S-Corp (1120S)
- "pfs_form" = Personal Financial Statement (SBA Form 413 or similar personal balance sheet)
- "financial_statement" = company income statement, balance sheet, or P&L
- "tax_return_personal" = Form 1040 individual income tax return
- "tax_return_business" = Form 1120, 1120S, 1065 business tax return`;

// Combined prompt for vision mode: classify AND extract in one call
function buildCombinedVisionPrompt(): string {
  return `Analyze this document and do two things:

1. Classify it into one of these categories: loan_agreement, debt_schedule, tax_return_personal, tax_return_business, articles_of_incorporation, operating_agreement, lease_agreement, financial_statement, bank_statement, k1_schedule, pfs_form, unknown

Guidance:
- "debt_schedule" = lists multiple debts/liabilities in table format
- "loan_agreement" = individual loan contract, promissory note, or commitment letter
- "bank_statement" = monthly/periodic statement from a bank
- "k1_schedule" = IRS Schedule K-1
- "pfs_form" = Personal Financial Statement / SBA Form 413
- "financial_statement" = company P&L, income statement, or balance sheet

2. Extract ALL available fields based on the document type.

Return ONLY valid JSON, no markdown fences, no commentary. Use this exact format:
{
  "classification": {"type": "the_category", "confidence": 0.95},
  "fields": {extracted fields object based on document type}
}

Field schemas by type:
- loan_agreement: {"lender":"","borrower":"","loanAmount":0,"interestRate":0,"maturityDate":"","originationDate":"","monthlyPayment":0,"collateral":"","loanType":"","presentBalance":0}
- debt_schedule: {"debts":[{"lender":"","loanAmount":0,"presentBalance":0,"interestRate":0,"maturityDate":"","originationDate":"","monthlyPayment":0,"collateral":"","loanType":"","status":"Current"}]}
- tax_return_personal: {"taxYear":"","filingStatus":"","taxpayerName":"","address":"","totalIncome":0,"wagesAndSalary":0,"businessIncome":0,"rentalIncome":0,"interestIncome":0,"dividendIncome":0,"capitalGains":0,"adjustedGrossIncome":0}
- tax_return_business: {"taxYear":"","formType":"","businessName":"","ein":"","entityType":"","address":"","naicsCode":"","totalRevenue":0,"costOfGoodsSold":0,"grossProfit":0,"netIncome":0,"officerCompensation":0,"totalAssets":0,"totalLiabilities":0,"cashOnHand":0}
- articles_of_incorporation: {"entityName":"","entityType":"","stateOfFormation":"","dateOfFormation":"","principalAddress":"","purpose":"","members":[{"name":"","title":"","ownershipPct":0}]}
- operating_agreement: {"entityName":"","entityType":"","stateOfFormation":"","effectiveDate":"","managementStructure":"","members":[{"name":"","title":"","ownershipPct":0,"capitalContribution":0}]}
- lease_agreement: {"landlord":"","tenant":"","propertyAddress":"","leaseStartDate":"","leaseEndDate":"","monthlyRent":0,"securityDeposit":0,"leaseType":"","squareFootage":0}
- financial_statement: {"companyName":"","statementDate":"","totalRevenue":0,"grossProfit":0,"netIncome":0,"totalAssets":0,"totalLiabilities":0,"totalEquity":0,"cashAndEquivalents":0,"accountsReceivable":0,"accountsPayable":0}
- bank_statement: {"bankName":"","accountHolder":"","accountType":"","statementDate":"","endingBalance":0,"totalDeposits":0,"totalWithdrawals":0,"averageDailyBalance":0}
- k1_schedule: {"taxYear":"","partnershipName":"","partnershipEIN":"","partnerName":"","ownershipPct":0,"ordinaryIncome":0,"guaranteedPayments":0,"distributions":0}
- pfs_form: {"name":"","address":"","assets":{"cashOnHand":0,"savings":0,"realEstate":0,"stocksBonds":0},"liabilities":{"mortgages":0,"notesPayable":0},"income":{"salary":0,"netInvestmentIncome":0,"realEstateIncome":0},"totalAssets":0,"totalLiabilities":0,"netWorth":0}

NEVER extract SSN values. For amounts, return numbers only (no $ or commas). If a field is not found, use null.`;
}

// ============================================================
// LLM PROVIDER ABSTRACTION
// ============================================================

type LLMProvider = 'gemini' | 'claude';
const ACTIVE_PROVIDER: LLMProvider = 'gemini';
const FETCH_TIMEOUT_MS = 30000;

function createTimeoutSignal(): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return controller.signal;
}

async function callLLMText(prompt: string, text: string): Promise<string> {
  switch (ACTIVE_PROVIDER) {
    case 'gemini': return callGeminiText(prompt, text);
    case 'claude': return callClaudeText(prompt, text);
    default: throw new Error(`Unknown provider: ${ACTIVE_PROVIDER}`);
  }
}

async function callGeminiText(prompt: string, text: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment variables');

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${prompt}\n\nDocument text:\n${text.substring(0, 30000)}` }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
      }),
      signal: createTimeoutSignal(),
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callClaudeText(prompt: string, text: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in environment variables');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: `${prompt}\n\nDocument text:\n${text.substring(0, 30000)}` }],
    }),
    signal: createTimeoutSignal(),
  });

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callGeminiVision(prompt: string, pdfBase64: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment variables');

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
      }),
      signal: createTimeoutSignal(),
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callClaudeVision(prompt: string, pdfBase64: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in environment variables');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
    signal: createTimeoutSignal(),
  });

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callLLMVision(prompt: string, pdfBase64: string): Promise<string> {
  switch (ACTIVE_PROVIDER) {
    case 'gemini': return callGeminiVision(prompt, pdfBase64);
    case 'claude': return callClaudeVision(prompt, pdfBase64);
    default: throw new Error(`Unknown provider: ${ACTIVE_PROVIDER}`);
  }
}

// ============================================================
// JSON PARSING (hardened: handles fences, nested objects)
// ============================================================

function parseJSON(text: string): any {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  try { return JSON.parse(cleaned); } catch {}

  let depth = 0;
  let start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(cleaned.substring(start, i + 1)); } catch {}
      }
    }
  }

  return null;
}

// ============================================================
// MAIN PARSING FUNCTIONS
// ============================================================

const MIN_TEXT_LENGTH = 100;

export async function classifyDocument(text: string): Promise<{ type: DocumentType; confidence: number }> {
  const response = await callLLMText(CLASSIFICATION_PROMPT, text);
  const parsed = parseJSON(response);
  if (!parsed) return { type: 'unknown', confidence: 0 };
  return { type: parsed.type || 'unknown', confidence: parsed.confidence || 0 };
}

export async function parseDocument(
  text: string,
  pdfBase64?: string,
  documentType?: DocumentType
): Promise<ParsedDocument> {
  const useVision = text.trim().length < MIN_TEXT_LENGTH && !!pdfBase64;

  if (useVision) {
    const combinedPrompt = buildCombinedVisionPrompt();
    const response = await callLLMVision(combinedPrompt, pdfBase64!);
    const parsed = parseJSON(response);

    if (!parsed) {
      return { documentType: 'unknown', confidence: 0, extractedFields: {}, mode: 'vision' };
    }

    return {
      documentType: parsed.classification?.type || 'unknown',
      confidence: parsed.classification?.confidence || 0,
      extractedFields: parsed.fields || {},
      mode: 'vision',
    };
  }

  // TEXT MODE: Two calls (classify then extract)
  let docType = documentType;
  let confidence = 1;

  if (!docType) {
    const classification = await classifyDocument(text);
    docType = classification.type;
    confidence = classification.confidence;
  }

  const prompt = EXTRACTION_PROMPTS[docType] || EXTRACTION_PROMPTS['loan_agreement'];
  const response = await callLLMText(prompt, text);
  const extractedFields = parseJSON(response) || {};

  return { documentType: docType, confidence, extractedFields, mode: 'text' };
}

export type { DocumentType, ParsedDocument };
