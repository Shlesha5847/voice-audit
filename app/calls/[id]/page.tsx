'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// ============================================================================
// 🟢 2. Timestamp → Seconds Converter Utility
// ============================================================================
export function timestampToSeconds(timestamp: string): number {
  if (!timestamp) return 0;
  // Clean brackets or whitespace, e.g. "[02:15]" -> "02:15"
  const clean = timestamp.replace(/[\[\]]/g, '').trim();
  const parts = clean.split(':').map((p) => parseInt(p, 10));

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return (isNaN(minutes) ? 0 : minutes) * 60 + (isNaN(seconds) ? 0 : seconds);
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (
      (isNaN(hours) ? 0 : hours) * 3600 +
      (isNaN(minutes) ? 0 : minutes) * 60 +
      (isNaN(seconds) ? 0 : seconds)
    );
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

// ============================================================================
// Types
// ============================================================================
interface EvaluatedCriterion {
  name: string;
  weight?: number;
  score: number;
  reason: string;
  timestamp: string;
}

interface TranscriptSegment {
  time?: string;
  speaker?: string;
  text: string;
}

interface CallDetailData {
  call: {
    id: string;
    audio_url: string | null;
    tenant_id: string;
    created_at: string;
  };
  transcript: TranscriptSegment[];
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

// ============================================================================
// 🟢 1. Audio Player Component
// ============================================================================
interface AudioPlayerProps {
  audioUrl: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  activeSeekTime: number | null;
}

export function AudioPlayer({ audioUrl, audioRef, activeSeekTime }: AudioPlayerProps) {
  if (!audioUrl) {
    return (
      <div style={{ marginTop: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 6, fontSize: 13, color: '#64748b', border: '1px dashed #cbd5e1' }}>
        No audio recording attached to this call record.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#4b5563' }}>
          Audio Playback:
        </label>
        {activeSeekTime !== null && (
          <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>
            ▶ Jumped to {Math.floor(activeSeekTime / 60).toString().padStart(2, '0')}:{(activeSeekTime % 60).toString().padStart(2, '0')}
          </span>
        )}
      </div>
      <audio
        ref={audioRef}
        controls
        style={{ width: '100%', borderRadius: 8, outline: 'none' }}
        src={audioUrl}
      >
        Your browser does not support audio playback.
      </audio>
    </div>
  );
}

// ============================================================================
// 🟢 3. Clickable Criteria List Component
// ============================================================================
interface CriteriaListProps {
  criteria: EvaluatedCriterion[];
  onSeek: (seconds: number) => void;
  getScoreColor: (score: number) => { bg: string; text: string; border: string };
}

export function CriteriaList({ criteria, onSeek, getScoreColor }: CriteriaListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {criteria.map((c, index) => {
        const cColors = getScoreColor(c.score);
        const seconds = timestampToSeconds(c.timestamp);

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

                {/* Clickable Timestamp Badge */}
                {c.timestamp && (
                  <button
                    type="button"
                    onClick={() => onSeek(seconds)}
                    title={`Click to seek audio to ${c.timestamp}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      background: '#e0e7ff',
                      color: '#3730a3',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 600,
                      border: '1px solid #c7d2fe',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#c7d2fe';
                      e.currentTarget.style.color = '#1e1b4b';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#e0e7ff';
                      e.currentTarget.style.color = '#3730a3';
                    }}
                  >
                    <span>⏱</span> {c.timestamp}
                  </button>
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
  );
}

// ============================================================================
// 🟢 4. Combined Call Detail Page with Synchronized Audio Seeking
// ============================================================================
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
  const [activeSeekTime, setActiveSeekTime] = useState<number | null>(null);

  // Single Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Seek Function: Jumps audio player to exact second & plays
  const seekTo = (seconds: number) => {
    setActiveSeekTime(seconds);
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play().catch(() => {
        // Handled gracefully if browser blocks initial autoplay
      });
    }
  };

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
      {/* Back Button */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/?tenantId=${tenantId}`}
          style={{ color: '#2563eb', textDecoration: 'none', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          ← Back to Call Reviews
        </Link>
      </div>

      {/* Header & Audio Player Card */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
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

          {/* Final Score Badge */}
          {score ? (
            <div style={{ textAlign: 'center', padding: '12px 20px', borderRadius: 8, background: scoreColors.bg, border: `1px solid ${scoreColors.border}`, color: scoreColors.text }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Final Score</div>
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

        {/* Audio Player Component with useRef */}
        <AudioPlayer
          audioUrl={call.audio_url}
          audioRef={audioRef}
          activeSeekTime={activeSeekTime}
        />
      </div>

      {/* Criteria Breakdown with Clickable Timestamps */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
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
          <CriteriaList
            criteria={score.criteria}
            onSeek={seekTo}
            getScoreColor={getScoreColor}
          />
        )}
      </div>

      {/* Synchronized Transcript */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111827' }}>
            Call Transcript ({transcript.length} turns)
          </h2>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Click any timestamp to seek
          </span>
        </div>

        {transcript.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>No transcript available.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {transcript.map((seg, idx) => {
              const segSeconds = timestampToSeconds(seg.time || '00:00');

              return (
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
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 68 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                      {seg.speaker || 'Speaker'}
                    </span>
                    <button
                      type="button"
                      onClick={() => seekTo(segSeconds)}
                      title={`Seek audio to ${seg.time}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: 11,
                        color: '#2563eb',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        textDecoration: 'underline',
                      }}
                    >
                      {seg.time || '00:00'}
                    </button>
                  </div>
                  <div style={{ flex: 1, fontSize: 14, color: '#334155', lineHeight: 1.5 }}>
                    {seg.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
