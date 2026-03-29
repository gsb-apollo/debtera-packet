// src/app/api/parse-document/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { parseDocument } from '@/lib/document-parser';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // File size limit
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // PDF only
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Please upload a PDF file. Other formats are not currently supported.' },
        { status: 400 }
      );
    }

    // Get the raw PDF buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Try text extraction first
    let text = '';
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const pdfData = await pdfParse(buffer);
      text = pdfData.text || '';
    } catch {
      text = '';
    }

    // Convert PDF to base64 for vision fallback
    const pdfBase64 = buffer.toString('base64');

    const result = await parseDocument(
      text,
      pdfBase64,
      (documentType as any) || undefined
    );

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      ...result,
    });
  } catch (error: any) {
    console.error('Document parsing error:', error);

    // Friendly message for timeouts
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Document processing took too long. Please try again or upload a smaller file.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to parse document' },
      { status: 500 }
    );
  }
}
