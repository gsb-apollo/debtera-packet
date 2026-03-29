// src/app/packet/[id]/intake/page.tsx
'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

const colors: any = {
  bg: "#FAF8F5", card: "#FFFFFF", accent: "#2D6A4F", accentLight: "#D8F3DC",
  accentMuted: "#95D5B2", warm: "#E8DDD3", warmDark: "#8B7E74", text: "#2C2C2C",
  textMuted: "#6B6B6B", border: "#E8E2DB", danger: "#C1524A", dangerLight: "#FDE8E6",
};

const docTypeLabels: Record<string, string> = {
  loan_agreement: '📄 Loan Agreement',
  tax_return_personal: '🧾 Personal Tax Return',
  tax_return_business: '🏢 Business Tax Return',
  articles_of_incorporation: '📜 Articles of Incorporation',
  operating_agreement: '📋 Operating Agreement',
  lease_agreement: '🏠 Lease Agreement',
  financial_statement: '📊 Financial Statement',
  unknown: '❓ Unknown Document',
};

const docTypeRouting: Record<string, string> = {
  loan_agreement: 'Populates your Debt Schedule',
  tax_return_personal: 'Populates Personal Finances and Income',
  tax_return_business: 'Populates Company Info and Financials',
  articles_of_incorporation: 'Populates Company Info and Ownership',
  operating_agreement: 'Populates Company Info and Ownership',
  lease_agreement: 'Populates Business History (lease details)',
  financial_statement: 'Populates Bank Accounts and Financials',
  unknown: 'Will be stored for manual review',
};

interface ParsedFile {
  fileName: string;
  fileSize: number;
  status: 'uploading' | 'parsed' | 'error';
  documentType?: string;
  confidence?: number;
  mode?: string;
  extractedFields?: Record<string, any>;
  error?: string;
}

export default function IntakePage() {
  const params = useParams();
  const router = useRouter();
  const loanAppId = params.id as string;

  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setProcessing(true);

    const newFiles: ParsedFile[] = Array.from(fileList).map(f => ({
      fileName: f.name,
      fileSize: f.size,
      status: 'uploading' as const,
    }));

    setFiles(prev => [...prev, ...newFiles]);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileIndex = files.length + i;

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/parse-document', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        setFiles(prev => {
          const updated = [...prev];
          if (response.ok) {
            updated[fileIndex] = {
              ...updated[fileIndex],
              status: 'parsed',
              documentType: data.documentType,
              confidence: data.confidence,
              mode: data.mode,
              extractedFields: data.extractedFields,
            };
          } else {
            updated[fileIndex] = {
              ...updated[fileIndex],
              status: 'error',
              error: data.error,
            };
          }
          return updated;
        });
      } catch (err: any) {
        setFiles(prev => {
          const updated = [...prev];
          updated[fileIndex] = {
            ...updated[fileIndex],
            status: 'error',
            error: err.message || 'Upload failed',
          };
          return updated;
        });
      }
    }

    setProcessing(false);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const parsedFiles = files.filter(f => f.status === 'parsed');
  const errorFiles = files.filter(f => f.status === 'error');
  const uploadingFiles = files.filter(f => f.status === 'uploading');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleContinue = async () => {
    // Store extracted data in Supabase via the packet builder
    // For now, we store in sessionStorage and the wizard picks it up
    if (parsedFiles.length > 0) {
      const extractedData = parsedFiles.map(f => ({
        documentType: f.documentType,
        fields: f.extractedFields,
      }));
      sessionStorage.setItem(`intake-${loanAppId}`, JSON.stringify(extractedData));
    }
    router.push(`/packet/${loanAppId}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: colors.card, borderBottom: `1px solid ${colors.border}`,
        padding: '16px 24px',
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: colors.accent, fontFamily: "'DM Serif Display', serif" }}>debtera</h1>
            <p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>Financial Packet Builder</p>
          </div>
          <button
            onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: colors.textMuted }}
          >← Dashboard</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px 100px' }}>

        {/* Welcome card */}
        <div style={{
          textAlign: 'center' as const, marginBottom: 32,
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 700, color: colors.text, fontFamily: "'DM Serif Display', serif" }}>
            Upload Your Documents
          </h2>
          <p style={{ margin: '0 auto', fontSize: 15, color: colors.textMuted, lineHeight: 1.6, maxWidth: 500 }}>
            Drop all your relevant documents here: loan agreements, tax returns, articles of incorporation, financial statements, leases. All in PDF format.
          </p>
          <p style={{ margin: '12px auto 0', fontSize: 14, color: colors.accent, fontWeight: 600 }}>
            Debtera will read each document and pre-fill your application.
          </p>
        </div>

        {/* Upload area */}
        <label style={{
          display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
          justifyContent: 'center', padding: '48px 24px', borderRadius: 16,
          border: `3px dashed ${colors.accent}`, background: colors.accentLight,
          cursor: processing ? 'wait' : 'pointer', minHeight: 160,
          marginBottom: 24, transition: 'all 0.2s',
          opacity: processing ? 0.7 : 1,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {processing ? '🔍' : '📄'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: colors.accent, marginBottom: 4 }}>
            {processing ? 'Processing documents...' : 'Drop PDFs here or click to upload'}
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted }}>
            You can upload multiple files at once. PDF format only.
          </div>
          <input
            type="file"
            accept=".pdf"
            multiple
            disabled={processing}
            style={{ display: 'none' }}
            onChange={e => handleUpload(e.target.files)}
          />
          {processing && (
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
          )}
        </label>

        {/* Processing queue */}
        {uploadingFiles.length > 0 && (
          <div style={{
            background: colors.card, borderRadius: 12, padding: '16px 20px',
            border: `1px solid ${colors.border}`, marginBottom: 16,
          }}>
            {uploadingFiles.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              }}>
                <div style={{ fontSize: 18, animation: 'pulse 1.5s infinite' }}>🔍</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{f.fileName}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>Reading document...</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Parsed files */}
        {parsedFiles.length > 0 && (
          <div style={{
            background: colors.card, borderRadius: 12, padding: '20px 24px',
            border: `1px solid ${colors.accent}`, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.accent }}>
                {parsedFiles.length} Document{parsedFiles.length !== 1 ? 's' : ''} Processed
              </h3>
            </div>
            {parsedFiles.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: i < parsedFiles.length - 1 ? `1px solid ${colors.border}` : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{f.fileName}</span>
                    <span style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      background: f.mode === 'vision' ? colors.warm : colors.accentLight,
                      color: f.mode === 'vision' ? colors.warmDark : colors.accent,
                      textTransform: 'uppercase' as const,
                    }}>{f.mode === 'vision' ? 'OCR' : 'Text'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: colors.accent, fontWeight: 500 }}>
                    {docTypeLabels[f.documentType || 'unknown']}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>
                    {docTypeRouting[f.documentType || 'unknown']} · {Math.round((f.confidence || 0) * 100)}% confidence · {formatSize(f.fileSize)}
                  </div>
                </div>
                <button onClick={() => removeFile(files.indexOf(f))} style={{
                  padding: '4px 10px', background: colors.dangerLight, color: colors.danger,
                  border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>Remove</button>
              </div>
            ))}
          </div>
        )}

        {/* Error files */}
        {errorFiles.length > 0 && (
          <div style={{
            background: colors.card, borderRadius: 12, padding: '16px 20px',
            border: `1px solid ${colors.danger}`, marginBottom: 16,
          }}>
            {errorFiles.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.danger }}>{f.fileName}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>{f.error}</div>
                </div>
                <button onClick={() => removeFile(files.indexOf(f))} style={{
                  padding: '4px 10px', background: 'transparent',
                  border: `1px solid ${colors.danger}`, borderRadius: 6,
                  fontSize: 12, color: colors.danger, cursor: 'pointer',
                }}>Dismiss</button>
              </div>
            ))}
          </div>
        )}

        {/* Summary of what will be pre-filled */}
        {parsedFiles.length > 0 && (
          <div style={{
            background: colors.accentLight, borderRadius: 12, padding: '16px 20px',
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.accent, marginBottom: 8 }}>
              What Debtera will pre-fill for you:
            </div>
            <div style={{ fontSize: 13, color: colors.accent, lineHeight: 1.8 }}>
              {parsedFiles.some(f => f.documentType === 'loan_agreement') && '✓ Debt Schedule entries from your loan agreements\n'}
              {parsedFiles.some(f => f.documentType === 'tax_return_personal') && '✓ Personal income from your tax returns\n'}
              {parsedFiles.some(f => f.documentType === 'tax_return_business') && '✓ Company financials from business tax returns\n'}
              {parsedFiles.some(f => f.documentType === 'articles_of_incorporation' || f.documentType === 'operating_agreement') && '✓ Company info and ownership from org documents\n'}
              {parsedFiles.some(f => f.documentType === 'lease_agreement') && '✓ Lease details for business history\n'}
              {parsedFiles.some(f => f.documentType === 'financial_statement') && '✓ Financial data from your statements\n'}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed' as const, bottom: 0, left: 0, right: 0,
        background: colors.card, borderTop: `1px solid ${colors.border}`,
        padding: '12px 24px', zIndex: 100,
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={handleContinue}
            style={{
              padding: '10px 24px', background: 'transparent',
              border: `1px solid ${colors.border}`, borderRadius: 8,
              fontSize: 14, color: colors.textMuted, cursor: 'pointer',
            }}
          >
            Skip, I'll fill in manually
          </button>
          <button
            onClick={handleContinue}
            disabled={processing}
            style={{
              padding: '10px 32px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: processing ? 'wait' : 'pointer',
              background: parsedFiles.length > 0 ? colors.accent : colors.warm,
              border: 'none',
              color: parsedFiles.length > 0 ? '#fff' : colors.warmDark,
            }}
          >
            {parsedFiles.length > 0
              ? `Continue with ${parsedFiles.length} document${parsedFiles.length !== 1 ? 's' : ''} →`
              : 'Continue →'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
