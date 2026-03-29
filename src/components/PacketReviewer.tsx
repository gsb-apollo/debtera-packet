// src/components/PacketReviewer.tsx
'use client'

import { useState } from 'react'

const colors: any = {
  bg: "#FAF8F5", card: "#FFFFFF", accent: "#2D6A4F", accentLight: "#D8F3DC",
  accentMuted: "#95D5B2", warm: "#E8DDD3", warmDark: "#8B7E74", text: "#2C2C2C",
  textMuted: "#6B6B6B", border: "#E8E2DB", danger: "#C1524A", dangerLight: "#FDE8E6",
  warning: "#D4A017", warningLight: "#FFF8E1",
};

interface ReviewItem {
  type: 'error' | 'warning' | 'suggestion' | 'pass';
  section: string;
  message: string;
}

interface PacketReviewerProps {
  company: any;
  owners: any[];
  debts: any[];
  banks: any[];
  loan: any;
  history: any[];
  eligibility: any[];
  documents: any;
}

export default function PacketReviewer({
  company, owners, debts, banks, loan, history, eligibility, documents
}: PacketReviewerProps) {
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<ReviewItem[] | null>(null);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');

  const runReview = async () => {
    setReviewing(true);
    setError('');
    setReview(null);
    setSummary('');

    try {
      const packetData = {
        company,
        owners,
        debts,
        banks,
        loan,
        history,
        eligibility,
        documents: Object.keys(documents).reduce((acc: any, key) => {
          acc[key] = (documents[key] || []).length;
          return acc;
        }, {}),
      };

      const response = await fetch('/api/review-packet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packetData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Review failed');
        return;
      }

      setReview(data.items || []);
      setSummary(data.summary || '');
    } catch (err: any) {
      setError(err.message || 'Review failed');
    } finally {
      setReviewing(false);
    }
  };

  const errorCount = review?.filter(r => r.type === 'error').length || 0;
  const warningCount = review?.filter(r => r.type === 'warning').length || 0;
  const suggestionCount = review?.filter(r => r.type === 'suggestion').length || 0;
  const passCount = review?.filter(r => r.type === 'pass').length || 0;

  const iconMap: Record<string, string> = {
    error: '🔴',
    warning: '🟡',
    suggestion: '💡',
    pass: '✅',
  };

  const bgMap: Record<string, string> = {
    error: colors.dangerLight,
    warning: colors.warningLight,
    suggestion: colors.bg,
    pass: colors.accentLight,
  };

  const colorMap: Record<string, string> = {
    error: colors.danger,
    warning: colors.warning,
    suggestion: colors.textMuted,
    pass: colors.accent,
  };

  return (
    <div style={{
      background: colors.card, borderRadius: 12, padding: '24px 28px',
      border: `2px solid ${colors.accent}`, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>🔍</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.accent }}>
          Smart Packet Review
        </h3>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textMuted, lineHeight: 1.5 }}>
        Debtera will review your entire application for completeness, consistency, and common issues before you submit to your lender.
      </p>

      {/* Run review button */}
      {!reviewing && !review && (
        <button
          onClick={runReview}
          style={{
            width: '100%', padding: '14px', background: colors.accent, color: '#fff',
            border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>🔍</span>
          Review My Packet
        </button>
      )}

      {/* Reviewing state */}
      {reviewing && (
        <div style={{
          display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
          padding: '32px', background: colors.bg, borderRadius: 10,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: 'pulse 1.5s infinite' }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.accent, marginBottom: 4 }}>
            Reviewing your packet...
          </div>
          <div style={{ fontSize: 12, color: colors.textMuted }}>
            Checking for completeness, consistency, and common issues
          </div>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', background: colors.dangerLight, borderRadius: 8,
          color: colors.danger, fontSize: 13, marginBottom: 12,
        }}>
          {error}
          <button onClick={() => { setError(''); }} style={{
            marginLeft: 12, padding: '4px 10px', background: 'transparent',
            border: `1px solid ${colors.danger}`, borderRadius: 4, color: colors.danger,
            fontSize: 12, cursor: 'pointer',
          }}>Try Again</button>
        </div>
      )}

      {/* Review results */}
      {review && (
        <div>
          {/* Summary stats */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' as const }}>
            {errorCount > 0 && (
              <div style={{ padding: '6px 12px', background: colors.dangerLight, borderRadius: 8, fontSize: 13, fontWeight: 600, color: colors.danger }}>
                🔴 {errorCount} Issue{errorCount !== 1 ? 's' : ''}
              </div>
            )}
            {warningCount > 0 && (
              <div style={{ padding: '6px 12px', background: colors.warningLight, borderRadius: 8, fontSize: 13, fontWeight: 600, color: colors.warning }}>
                🟡 {warningCount} Warning{warningCount !== 1 ? 's' : ''}
              </div>
            )}
            {suggestionCount > 0 && (
              <div style={{ padding: '6px 12px', background: colors.bg, borderRadius: 8, fontSize: 13, fontWeight: 600, color: colors.textMuted }}>
                💡 {suggestionCount} Suggestion{suggestionCount !== 1 ? 's' : ''}
              </div>
            )}
            {passCount > 0 && (
              <div style={{ padding: '6px 12px', background: colors.accentLight, borderRadius: 8, fontSize: 13, fontWeight: 600, color: colors.accent }}>
                ✅ {passCount} Passed
              </div>
            )}
          </div>

          {/* Summary text */}
          {summary && (
            <div style={{
              padding: '12px 16px', background: colors.bg, borderRadius: 8,
              marginBottom: 16, fontSize: 14, color: colors.text, lineHeight: 1.6,
            }}>
              {summary}
            </div>
          )}

          {/* Individual items */}
          {review.map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, padding: '10px 12px',
              background: bgMap[item.type], borderRadius: 8, marginBottom: 6,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{iconMap[item.type]}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: colorMap[item.type], textTransform: 'uppercase' as const, marginBottom: 2 }}>
                  {item.section}
                </div>
                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.5 }}>
                  {item.message}
                </div>
              </div>
            </div>
          ))}

          {/* Re-run button */}
          <button
            onClick={runReview}
            style={{
              marginTop: 16, padding: '10px 20px', background: 'transparent',
              border: `1px solid ${colors.accent}`, borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: colors.accent, cursor: 'pointer',
            }}
          >
            Run Review Again
          </button>
        </div>
      )}
    </div>
  );
}
