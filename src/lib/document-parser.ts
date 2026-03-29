// src/lib/document-parser.ts
// Abstraction layer with dual-mode: text for clean PDFs, vision for scanned docs
// Athena review fixes: combined vision prompt, 30s fetch timeout, hardened JSON parser

type DocumentType =
  | 'loan_agreement'
  | 'tax_return_personal'
  | 'tax_return_business'
  | 'articles_of_incorporation'
  | 'operating_agreement'
  | 'lease_agreement'
  | 'financial_statement'
  | 'unknown';

interface ParsedDocument {
  documentType: DocumentType;
  confidence: number;
  extractedFields: Record<string, any>;
  mode: 'text' | 'vision';
}

const EXTRACTION_PROMPTS: Record<string, string> = {
  loan_agreement: `Extract the following fields from this loan agreement. Return ONLY valid JSON, no markdown fences, no commentary. Just the JSON object:
{"lender":"name of lending institution","borrower":"borrower name","loanAmount":"original amount as number","interestRate":"annual rate as number","maturityDate":"YYYY-MM-DD","originationDate":"YYYY-MM-DD","monthlyPayment":"payment as number","collateral":"collateral description","loanType":"loan type"}
If a field is not found, use null.`,

  tax_return_personal: `Extract the following fields from this personal tax return. Return ONLY valid JSON, no markdown fences, no commentary. Just the JSON object:
{"taxYear":"year","filingStatus":"status","taxpayerName":"name","spouseName":"spouse or null","address":"address","totalIncome":"AGI as number","wagesAndSalary":"wages as number","businessIncome":"schedule C as number","rentalIncome":"rental as number","interestIncome":"interest as number","totalTax":"tax as number"}
NEVER extract SSN values. Always use null for SSN. If a field is not found, use null.`,

  tax_return_business: `Extract the following fields from this business tax return. Return ONLY valid JSON, no markdown fences, no commentary. Just the JSON object:
{"taxYear":"year","businessName":"name","ein":"EIN","entityType":"S-Corp/C-Corp/Partnership/etc","address":"address","naicsCode":"NAICS","totalRevenue":"revenue as number","costOfGoodsSold":"COGS as number","grossProfit":"gross profit as number","netIncome":"net income as number","officerCompensation":"officer comp as number","totalAssets":"assets as number","totalLiabilities":"liabilities as number"}
If a field is not found, use null.`,

  articles_of_incorporation: `Extract the following fields from these organizational documents. Return ONLY valid JSON, no markdown fences, no commentary. Just the JSON object:
{"entityName":"legal name","entityType":"LLC/Corporation/etc","stateOfFormation":"state","dateOfFormation":"YYYY-MM-DD","registeredAgent":"agent name","members":[{"name":"member name","title":"role","ownershipPct":"pct as number"}],"purpose":"business purpose"}
If a field is not found, use null.`,

  operating_agreement: `Extract the following fields from this operating agreement. Return ONLY valid JSON, no markdown fences, no commentary. Just the JSON object:
{"entityName":"legal name","entityType":"entity type","stateOfFormation":"state","effectiveDate":"YYYY-MM-DD","members":[{"name":"name","title":"role","ownershipPct":"pct as number","capitalContribution":"amount as number"}],"managementStructure":"member-managed or manager-managed"}
If a field is not found, use null.`,

  lease_agreement: `Extract the following fields from this lease agreement. Return ONLY valid JSON, no markdown fences, no commentary. Just the JSON object:
{"landlord":"landlord name","tenant":"tenant name","propertyAddress":"address","leaseStartDate":"YYYY-MM-DD","leaseEndDate":"YYYY-MM-DD","monthlyRent":"rent as number","securityDeposit":"deposit as number","leaseType":"gross/net/triple net/etc","squareFootage":"sqft as number"}
If a field is not found, use null.`,

  financial_statement: `Extract the following fields from this financial statement. Return ONLY valid JSON, no markdown fences, no commentary. Just the JSON object:
{"companyName":"name","statementDate":"YYYY-MM-DD","totalRevenue":"revenue as number","grossProfit":"gross profit as number","netIncome":"net income as number","totalAssets":"assets as number","totalLiabilities":"liabilities as number","totalEquity":"equity as number","cashAndEquivalents":"cash as number","accountsReceivable":"AR as number","accountsPayable":"AP as number"}
If a field is not found, use null.`,
};

const CLASSIFICATION_PROMPT = `Classify this document into exactly one category. Return ONLY valid JSON, no markdown fences, no commentary. Just the JSON object with "type" and "confidence" (0 to 1):
Categories: loan_agreement, tax_return_personal, tax_return_business, articles_of_incorporation, operating_agreement, lease_agreement, financial_statement, unknown`;

// Combined prompt for vision mode: classify AND extract in one call
// This avoids sending the full PDF base64 twice (Athena's optimization)
function buildCombinedVisionPrompt(): string {
  return `Analyze this document and do two things:

1. Classify it into one of these categories: loan_agreement, tax_return_personal, tax_return_business, articles_of_incorporation, operating_agreement, lease_agreement, financial_statement, unknown

2. Extract the relevant fields based on the document type.

Return ONLY valid JSON, no markdown fences, no commentary. Use this exact format:
{
  "classification": {"type": "the_category", "confidence": 0.95},
  "fields": {extracted fields object based on document type}
}

Field schemas by type:
- loan_agreement: {"lender":"","borrower":"","loanAmount":0,"interestRate":0,"maturityDate":"YYYY-MM-DD","originationDate":"YYYY-MM-DD","monthlyPayment":0,"collateral":"","loanType":""}
- tax_return_personal: {"taxYear":"","filingStatus":"","taxpayerName":"","spouseName":"","address":"","totalIncome":0,"wagesAndSalary":0,"businessIncome":0,"rentalIncome":0,"interestIncome":0,"totalTax":0}
- tax_return_business: {"taxYear":"","businessName":"","ein":"","entityType":"","address":"","naicsCode":"","totalRevenue":0,"costOfGoodsSold":0,"grossProfit":0,"netIncome":0,"officerCompensation":0,"totalAssets":0,"totalLiabilities":0}
- articles_of_incorporation: {"entityName":"","entityType":"","stateOfFormation":"","dateOfFormation":"YYYY-MM-DD","registeredAgent":"","members":[{"name":"","title":"","ownershipPct":0}],"purpose":""}
- operating_agreement: {"entityName":"","entityType":"","stateOfFormation":"","effectiveDate":"YYYY-MM-DD","members":[{"name":"","title":"","ownershipPct":0,"capitalContribution":0}],"managementStructure":""}
- lease_agreement: {"landlord":"","tenant":"","propertyAddress":"","leaseStartDate":"YYYY-MM-DD","leaseEndDate":"YYYY-MM-DD","monthlyRent":0,"securityDeposit":0,"leaseType":"","squareFootage":0}
- financial_statement: {"companyName":"","statementDate":"YYYY-MM-DD","totalRevenue":0,"grossProfit":0,"netIncome":0,"totalAssets":0,"totalLiabilities":0,"totalEquity":0,"cashAndEquivalents":0,"accountsReceivable":0,"accountsPayable":0}

NEVER extract SSN values. Use null for any field not found.`;
}

// ============================================================
// LLM PROVIDER ABSTRACTION
// ============================================================

type LLMProvider = 'gemini' | 'claude';
const ACTIVE_PROVIDER: LLMProvider = 'gemini';
const FETCH_TIMEOUT_MS = 30000; // 30 seconds

function createTimeoutSignal(): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return controller.signal;
}

// ---------- TEXT MODE ----------

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
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
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
      max_tokens: 2000,
      messages: [{ role: 'user', content: `${prompt}\n\nDocument text:\n${text.substring(0, 30000)}` }],
    }),
    signal: createTimeoutSignal(),
  });

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// ---------- VISION MODE ----------

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
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
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
      max_tokens: 2000,
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
  // Text-mode only classification (used when we have extractable text)
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
    // VISION MODE: Single combined call (classify + extract in one shot)
    // Sends the PDF only once instead of twice
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

  // TEXT MODE: Two calls (classify then extract) since text payloads are small
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
