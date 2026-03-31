// src/components/SmartUpload.tsx
'use client'

import { useState } from 'react'

const colors: any = {
  bg: "#FAF8F5", card: "#FFFFFF", accent: "#2D6A4F", accentLight: "#D8F3DC",
  accentMuted: "#95D5B2", warm: "#E8DDD3", warmDark: "#8B7E74", text: "#2C2C2C",
  textMuted: "#6B6B6B", border: "#E8E2DB", danger: "#C1524A", dangerLight: "#FDE8E6",
};

const docTypeLabels: Record<string, string> = {
  loan_agreement: 'Loan Agreement',
  debt_schedule: 'Debt Schedule',
  tax_return_personal: 'Personal Tax Return',
  tax_return_business: 'Business Tax Return',
  articles_of_incorporation: 'Articles of Incorporation',
  operating_agreement: 'Operating Agreement',
  lease_agreement: 'Lease Agreement',
  financial_statement: 'Financial Statement',
  bank_statement: 'Bank Statement',
  k1_schedule: 'Schedule K-1',
  pfs_form: 'Personal Financial Statement',
  unknown: 'Unknown Document',
};

interface SmartUploadProps {
  onFieldsExtracted: (documentType: string, fields: Record<string, any>) => void;
}

export default function SmartUpload({ onFieldsExtracted }: SmartUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setFileName(file.name);
    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/parse-document', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to parse document');
        return;
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onFieldsExtracted(result.documentType, result.extractedFields);
      setResult(null);
      setFileName('');
    }
  };

  return (
    <div style={{
      background: colors.card, borderRadius: 12, padding: '24px 28px',
      border: `2px solid ${colors.accent}`, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>🧠</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.accent }}>
          Smart Document Upload
        </h3>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textMuted, lineHeight: 1.5 }}>
        Upload a PDF (including scanned documents). Debtera will read it and auto-fill the relevant fields for you to review.
      </p>

      {!uploading && !result && !error && (
        <label style={{
          display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
          justifyContent: 'center', padding: '32px 16px', borderRadius: 10,
          border: `2px dashed ${colors.accent}`, background: colors.accentLight,
          cursor: 'pointer', minHeight: 100,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.accent, marginBottom: 4 }}>
            Drop a PDF here or click to upload
          </div>
          <div style={{ fontSize: 12, color: colors.textMuted }}>
            Works with text-based and scanned PDFs
          </div>
          <input
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={e => handleUpload(e.target.files)}
          />
        </label>
      )}

      {uploading && (
        <div style={{
          display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
          padding: '32px', background: colors.bg, borderRadius: 10,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: 'pulse 1.5s infinite' }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.accent, marginBottom: 4 }}>
            Reading {fileName}...
          </div>
          <div style={{ fontSize: 12, color: colors.textMuted }}>
            Extracting fields from your document
          </div>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 16px', background: colors.dangerLight, borderRadius: 8,
          color: colors.danger, fontSize: 13, marginBottom: 12,
        }}>
          {error}
          <button
            onClick={() => { setError(''); setFileName(''); }}
            style={{
              marginLeft: 12, padding: '4px 10px', background: 'transparent',
              border: `1px solid ${colors.danger}`, borderRadius: 4, color: colors.danger,
              fontSize: 12, cursor: 'pointer',
            }}
          >Try Again</button>
        </div>
      )}

      {result && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12, padding: '8px 12px', background: colors.accentLight, borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>✅</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: colors.accent }}>
                  Detected: {docTypeLabels[result.documentType] || result.documentType}
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted }}>
                  {Math.round(result.confidence * 100)}% confidence · {fileName}
                </div>
              </div>
            </div>
            <div style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
              background: result.mode === 'vision' ? '#E8DDD3' : '#D8F3DC',
              color: result.mode === 'vision' ? '#8B7E74' : '#2D6A4F',
              textTransform: 'uppercase' as const,
            }}>
              {result.mode === 'vision' ? '👁 OCR' : '📝 Text'}
            </div>
          </div>

          <div style={{
            background: colors.bg, borderRadius: 8, padding: '12px 16px',
            marginBottom: 12, maxHeight: 300, overflow: 'auto',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' as const }}>
              Extracted Fields
            </div>
            {Object.entries(result.extractedFields).map(([key, value]: [string, any]) => {
              if (value === null || value === undefined || value === '') return null;
              if (Array.isArray(value)) {
                return (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase())}:
                    </span>
                    {value.map((item: any, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: colors.textMuted, marginLeft: 12 }}>
                        {typeof item === 'object' ? Object.entries(item).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(', ') : String(item)}
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div key={key} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '4px 0',
                  borderBottom: `1px solid ${colors.border}`,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase())}
                  </span>
                  <span style={{ fontSize: 12, color: colors.textMuted }}>
                    {typeof value === 'number' ? value.toLocaleString() : String(value)}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleApply}
              style={{
                flex: 1, padding: '10px 16px', background: colors.accent, color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >Apply to Form</button>
            <button
              onClick={() => { setResult(null); setFileName(''); }}
              style={{
                padding: '10px 16px', background: 'transparent',
                border: `1px solid ${colors.border}`, borderRadius: 8,
                fontSize: 14, color: colors.textMuted, cursor: 'pointer',
              }}
            >Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
