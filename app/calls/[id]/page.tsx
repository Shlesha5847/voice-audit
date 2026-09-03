'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface EvaluatedCriterion {
  name: string;
  weight?: number;
  score: number;
  reason: string;
  timestamp: string;
}

interface CallDetailData {
  call: {
    id: string;
    audio_url: string | null;
    tenant_id: string;
    created_at: string;
  };
  transcript: Array<{
    time?: string;
    speaker?: string;
    text: string;
  }>;
  score: {
    final_score: number;
    criteria: EvaluatedCriterion[];
  } | null;
  rubric: {
    id: string;
    title: string;
    config?: any;
  } | null;
}

export default function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const callId = resolvedParams.id;
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenantId') || 'bank_1';

  const [data, setData] = useState<CallDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCallDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/calls/${callId}?tenantId=${tenantId}`);
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to load call details');
        setData(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error fetching call');
      } finally {
        setLoading(false);
      }
    };

    fetchCallDetail();
  }, [callId, tenantId]);

  // Score color helper
  const getScoreColor = (score: number) => {
    if (score > 8) return { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' };
    if (score >= 5) return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
    return { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' };
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 840, margin: '60px auto', padding: '0 20px', textAlign: 'center', color: '#6b7280', fontFamily: 'system-ui, sans-serif' }}>
        Loading call details...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 840, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
        <Link href={`/?tenantId=${tenantId}`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
          ← Back to Call Reviews
        </Link>
        <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 8, marginTop: 16 }}>
          {error || 'Call record not found'}
        </div>
      </div>
    );
  }

  const { call, transcript, score, rubric } = data;
  const scoreColors = score ? getScoreColor(score.final_score) : { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' };

  return (
    <div style={{ maxWidth: 840, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Back Navigation */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/?tenantId=${tenantId}`}
          style={{
            color: '#2563eb',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ← Back to Call Reviews
        </Link>
      </div>

      {/* Main Call Header Card */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: 24,
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#111827' }}>
                Call #{call.id.slice(0, 8)}
              </h1>
              <span style={{ fontSize: 12, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 4 }}>
                {call.tenant_id}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              Recorded on {new Date(call.created_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
            </p>
          </div>

          {/* Large Final Score */}
          {score ? (
            <div
              style={{
                textAlign: 'center',
                padding: '12px 20px',
                borderRadius: 8,
                background: scoreColors.bg,
                border: `1px solid ${scoreColors.border}`,
                color: scoreColors.text,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Final Score
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
                {score.final_score} <span style={{ fontSize: 16, fontWeight: 500 }}>/ 10</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '8px 16px', background: '#f3f4f6', borderRadius: 6, color: '#6b7280', fontSize: 13, fontWeight: 600 }}>
              Not Scored
            </div>
          )}
        </div>

        {/* 1. Audio Player Section */}
        {call.audio_url ? (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4b5563', marginBottom: 8 }}>
              Audio Recording:
            </label>
            <audio controls style={{ width: '100%', borderRadius: 8 }} src={call.audio_url}>
              Your browser does not support audio playback.
            </audio>
          </div>
        ) : (
          <div style={{ marginTop: 16, fontSize: 13, color: '#9ca3af' }}>
            No audio file attached (Direct transcript evaluation).
          </div>
        )}
      </div>

      {/* 2. Criteria Breakdown Section */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: 24,
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111827' }}>
            Evaluation Criteria Breakdown
          </h2>
          {rubric && (
            <span style={{ fontSize: 12, background: '#eff6ff', color: '#1e40af', padding: '3px 8px', borderRadius: 4, fontWeight: 500 }}>
              Rubric: {rubric.title}
            </span>
          )}
        </div>

        {!score || !score.criteria || score.criteria.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>No criteria evaluation available for this call.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {score.criteria.map((c, index) => {
              const cColors = getScoreColor(c.score);
              return (
                <div
                  key={index}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 8,
                    background: '#f9fafb',
                    border: '1px solid #f3f4f6',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: '#1f2937' }}>{c.name}</span>
                      {c.timestamp && (
                        <span style={{ fontSize: 12, background: '#e0e7ff', color: '#3730a3', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                          ⏱ {c.timestamp}
                        </span>
                      )}
                    </div>

                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 13,
                        fontWeight: 700,
                        background: cColors.bg,
                        color: cColors.text,
                        border: `1px solid ${cColors.border}`,
                      }}
                    >
                      {c.score} / 10
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: 14, color: '#4b5563', lineHeight: 1.5 }}>
                    {c.reason}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Transcript Section */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#111827' }}>
          Call Transcript ({transcript.length} turns)
        </h2>

        {transcript.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>No transcript available.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {transcript.map((seg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 6,
                  background: seg.speaker === 'Agent' ? '#f8fafc' : '#ffffff',
                  border: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 60 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                    {seg.speaker || 'Speaker'}
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    {seg.time || '00:00'}
                  </span>
                </div>
                <div style={{ flex: 1, fontSize: 14, color: '#334155', lineHeight: 1.5 }}>
                  {seg.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
