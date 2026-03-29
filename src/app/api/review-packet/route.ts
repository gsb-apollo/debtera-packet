// src/app/api/review-packet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const FETCH_TIMEOUT_MS = 45000; // 45 seconds (reviews take longer)

function createTimeoutSignal(): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return controller.signal;
}

const REVIEW_PROMPT = `You are a senior SBA loan analyst reviewing a loan application packet for completeness and consistency. Review the following application data and return ONLY valid JSON, no markdown fences, no commentary.

Return this exact format:
{
  "summary": "A 2-3 sentence overall assessment of the packet's readiness",
  "items": [
    {
      "type": "error|warning|suggestion|pass",
      "section": "Section name (e.g. Company Info, Debt Schedule, Ownership)",
      "message": "Specific finding"
    }
  ]
}

Rules for your review:
- "error": Critical missing info that will prevent approval (missing EIN, no ownership, loan amount is zero)
- "warning": Issues that could delay processing (ownership doesn't total 100%, use of proceeds doesn't match loan amount, missing required documents)
- "suggestion": Best practices that would strengthen the application
- "pass": Sections that look complete and consistent

Check for:
1. Company info completeness (name, EIN, address, entity type, NAICS)
2. Ownership totaling 100%
3. At least one debt if purpose is refinance
4. Use of proceeds summing to loan amount
5. All eligibility questions answered
6. Required documents uploaded (tax returns, financials, org docs, loan agreements)
7. Business history questions answered
8. Consistency between sections (entity type matches org docs, debt schedule matches loan agreements)
9. Personal financial statement completed for each 20%+ owner
10. Loan amount being reasonable relative to stated purpose

Be specific and actionable in every finding.`;

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const packetData = await request.json();

    // Call LLM for review
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

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
            parts: [{
              text: `${REVIEW_PROMPT}\n\nApplication data:\n${JSON.stringify(packetData, null, 2)}`
            }],
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
        }),
        signal: createTimeoutSignal(),
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response
    let cleaned = responseText.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try extracting JSON with brace matching
      let depth = 0;
      let start = -1;
      for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') { if (depth === 0) start = i; depth++; }
        else if (cleaned[i] === '}') { depth--; if (depth === 0 && start !== -1) { try { parsed = JSON.parse(cleaned.substring(start, i + 1)); break; } catch {} } }
      }
    }

    if (!parsed) {
      return NextResponse.json({ error: 'Failed to parse review results' }, { status: 500 });
    }

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Packet review error:', error);

    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Review took too long. Please try again.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to review packet' },
      { status: 500 }
    );
  }
}
