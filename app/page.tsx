'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CallItem {
  call_id: string;
  audio_url: string | null;
  created_at: string;
  final_score: number | null;
  rubric_id: string | null;
  rubric_title?: string;
}

interface RubricItem {
  id: string;
  title: string;
  config: {
    criteria: Array<{ name: string; weight: number }>;
  };
}

const TENANTS = [
  { id: 'bank_1', name: 'First National Bank (bank_1)' },
  { id: 'bank_2', name: 'Apex Horizon Bank (bank_2)' },
];

const SAMPLE_TRANSCRIPTS = [
  {
    label: 'Sample: Fee Dispute Resolution (High QA)',
    text: `[00:00] Agent: Thank you for calling First National Bank, my name is Sarah. May I please have your full name and account number?
[00:07] Customer: Hi Sarah, this is John Doe, account ending in 4821.
[00:12] Agent: Thank you Mr. Doe, I have verified your account details. How can I assist you today?
[00:18] Customer: I noticed an unfamiliar fee of $25 on my statement last Tuesday.
[00:23] Agent: I completely understand how concerning unexpected charges can be. Let me look into that transaction right away for you.
[00:32] Agent: I see that was an automated monthly maintenance fee. Since you maintain a direct deposit with us, I have processed an immediate full waiver of the $25 fee.
[00:44] Customer: That is wonderful news, thank you so much!
[00:48] Agent: You are very welcome! Is there anything else I can help you with today? Thank you for banking with First National Bank, and have a wonderful day.`,
  },
  {
    label: 'Sample: Abrupt & Incomplete Call (Low QA)',
    text: `[00:00] Agent: Yeah, what do you need?
[00:05] Customer: Hi, I wanted to know my current account balance.
[00:10] Agent: Your balance is $420.
[00:14] Customer: Okay, and when is my next payment due?
[00:18] Agent: Next Tuesday.
[00:21] Customer: Great, thanks...`,
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>('bank_1');
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [rubrics, setRubrics] = useState<RubricItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // New Audit Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [inputMode, setInputMode] = useState<'audio' | 'transcript'>('audio');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualTranscript, setManualTranscript] = useState<string>('');
  const [selectedRubricId, setSelectedRubricId] = useState<string>('');
  const [auditStep, setAuditStep] = useState<string>('');
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Fetch calls & rubrics for active tenant
  const loadTenantData = async (activeTenant: string = tenantId) => {
    try {
      setLoading(true);
      setError(null);

      const [callsRes, rubricsRes] = await Promise.all([
        fetch(`/api/calls?tenantId=${activeTenant}`),
        fetch(`/api/rubrics?tenantId=${activeTenant}`),
      ]);

      const callsData = await callsRes.json();
      const rubricsData = await rubricsRes.json();

      if (!callsRes.ok) throw new Error(callsData.error || 'Failed to fetch calls');

      setCalls(Array.isArray(callsData) ? callsData : []);
      const rList = Array.isArray(rubricsData.rubrics) ? rubricsData.rubrics : [];
      setRubrics(rList);
      if (rList.length > 0) {
        setSelectedRubricId(rList[0].id);
      } else {
        setSelectedRubricId('');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tenant data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenantData(tenantId);
  }, [tenantId]);

  // Run End-to-End Audit Pipeline (Supports Audio & Manual Transcript with Retry)
  const handleRunAudit = async () => {
    try {
      setIsAuditing(true);
      setAuditError(null);

      let finalAudioUrl: string | null = null;
      let finalTranscript: any = null;

      if (inputMode === 'audio') {
        if (!selectedFile) {
          throw new Error('Please select an audio file (MP3/WAV)');
        }

        // Step 1: Upload to Supabase Storage
        setAuditStep('1/3 Uploading audio to secure storage...');
        const formData = new FormData();
        formData.append('file', selectedFile);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Audio upload failed');
        finalAudioUrl = uploadData.audio_url;

        // Step 2: Transcribe via Deepgram Nova-3
        setAuditStep('2/3 Transcribing speech with timestamps (Deepgram)...');
        const transcribeRes = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_url: finalAudioUrl,
            tenant_id: tenantId,
          }),
        });
        const transcribeData = await transcribeRes.json();
        if (!transcribeRes.ok) {
          throw new Error(
            `${transcribeData.error || 'Transcription failed'}. You can retry or switch to manual transcript.`
          );
        }
        finalTranscript = transcribeData.transcript;
      } else {
        // Manual Transcript mode
        if (!manualTranscript.trim()) {
          throw new Error('Please enter or paste a call transcript.');
        }

        setAuditStep('Formatting manual transcript...');
        // Convert text lines to segments if entered with timestamps [00:00]
        const lines = manualTranscript.trim().split('\n').filter((l) => l.trim().length > 0);
        finalTranscript = lines.map((line) => {
          const match = line.match(/^\[(\d{2}:\d{2})\]\s*(?:(Agent|Customer|Speaker\s*\d+):)?\s*(.*)$/i);
          if (match) {
            return {
              time: match[1],
              speaker: match[2] || 'Speaker',
              text: match[3] || line,
            };
          }
          return {
            time: '00:00',
            text: line,
          };
        });
      }

      // Step 3: LLM Judge Evaluation with selected rubric
      setAuditStep('3/3 Evaluating call quality against rubric (LLM Judge)...');
      const scoreRes = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          audio_url: finalAudioUrl,
          transcript: finalTranscript,
          rubric_id: selectedRubricId || null,
        }),
      });
      const scoreData = await scoreRes.json();
      if (!scoreRes.ok) throw new Error(scoreData.error || 'Scoring evaluation failed');

      // Success - Navigate to Call Detail Page
      setShowModal(false);
      setSelectedFile(null);
      setManualTranscript('');
      setIsAuditing(false);
      router.push(`/calls/${scoreData.call_id}?tenantId=${tenantId}`);
    } catch (err: unknown) {
      setAuditError(err instanceof Error ? err.message : 'Audit pipeline failed');
      setIsAuditing(false);
    }
  };

  // Score badge helper: >8 green, 5-8 yellow, <5 red
  const getScoreBadge = (score: number | null) => {
    if (score === null || score === undefined) {
      return (
        <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: '#f3f4f6', color: '#6b7280' }}>
          Not Scored
        </span>
      );
    }

    if (score > 8) {
      return (
        <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 700, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
          ★ {score} / 10
        </span>
      );
    }

    if (score >= 5) {
      return (
        <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 700, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
          ● {score} / 10
        </span>
      );
    }

    return (
      <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 700, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
        ▲ {score} / 10
      </span>
    );
  };

  return (
    <div style={{ maxWidth: 880, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Heading & Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#111827' }}>Call Reviews</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>
            Audited customer support & sales calls with AI quality scores.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => {
              setAuditError(null);
              setShowModal(true);
            }}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 6,
              background: '#059669',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            + Audit New Call
          </button>
          <Link
            href="/rubrics"
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 6,
              background: '#2563eb',
              color: '#fff',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            📋 Manage Rubrics
          </Link>
        </div>
      </div>

      {/* Tenant Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '12px 16px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontWeight: 600, fontSize: 14, color: '#334155' }}>Active Bank / Tenant:</label>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            disabled={loading}
            style={{ padding: '6px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
          >
            {TENANTS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <span style={{ fontSize: 13, color: '#64748b' }}>
          Data is isolated to <code>{tenantId}</code>
        </span>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 6, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Calls List */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>Loading calls for {tenantId}...</div>
      ) : calls.length === 0 ? (
        /* Empty State */
        <div style={{ padding: 48, textAlign: 'center', background: '#fff', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#374151' }}>No calls yet</h3>
          <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>
            There are no audited calls recorded for {tenantId} yet.
          </p>
          <button
            onClick={() => {
              setAuditError(null);
              setShowModal(true);
            }}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 6,
              background: '#059669',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + Upload & Audit First Call
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {calls.map((call) => (
            <Link
              key={call.call_id}
              href={`/calls/${call.call_id}?tenantId=${tenantId}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                textDecoration: 'none',
                color: 'inherit',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 15, color: '#1f2937' }}>
                    Call #{call.call_id.slice(0, 8)}
                  </span>
                  <span style={{ fontSize: 12, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 4 }}>
                    {call.rubric_title || (call.rubric_id ? `Rubric: ${call.rubric_id.slice(0, 8)}` : 'Standard QA')}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                  {new Date(call.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div>{getScoreBadge(call.final_score)}</div>
                <span style={{ fontSize: 18, color: '#9ca3af' }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal: Audit Call (Supports Audio Upload & Manual Transcript + Retry Prompt) */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 540,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111827' }}>
                Audit Call Recording
              </h2>
              <button
                onClick={() => { if (!isAuditing) setShowModal(false); }}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af' }}
              >
                ✕
              </button>
            </div>

            {/* Input Mode Selector Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setInputMode('audio')}
                disabled={isAuditing}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: inputMode === 'audio' ? '2px solid #059669' : '2px solid transparent',
                  color: inputMode === 'audio' ? '#059669' : '#64748b',
                }}
              >
                🎧 Upload Audio File
              </button>
              <button
                type="button"
                onClick={() => setInputMode('transcript')}
                disabled={isAuditing}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: inputMode === 'transcript' ? '2px solid #059669' : '2px solid transparent',
                  color: inputMode === 'transcript' ? '#059669' : '#64748b',
                }}
              >
                📝 Manual Transcript
              </button>
            </div>

            {/* Error Banner with Retry Prompt */}
            {auditError && (
              <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Audit Error:</div>
                <div style={{ marginBottom: 8 }}>{auditError}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleRunAudit}
                    style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    🔄 Retry Audit
                  </button>
                  {inputMode === 'audio' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuditError(null);
                        setInputMode('transcript');
                      }}
                      style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, background: '#fff', color: '#b91c1c', border: '1px solid #b91c1c', borderRadius: 4, cursor: 'pointer' }}
                    >
                      ✏️ Switch to Manual Transcript
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Mode 1: File Upload */}
            {inputMode === 'audio' ? (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  1. Select Audio Recording (MP3 / WAV):
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  disabled={isAuditing}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6 }}
                />
              </div>
            ) : (
              /* Mode 2: Manual Transcript Input */
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                    1. Enter Call Transcript (with [MM:SS] timestamps):
                  </label>
                </div>
                {/* Sample Fill Helper */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {SAMPLE_TRANSCRIPTS.map((st, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={isAuditing}
                      onClick={() => setManualTranscript(st.text)}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        borderRadius: 4,
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        cursor: 'pointer',
                        color: '#475569',
                      }}
                    >
                      Fill {i === 0 ? 'High QA Sample' : 'Low QA Sample'}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={6}
                  value={manualTranscript}
                  onChange={(e) => setManualTranscript(e.target.value)}
                  disabled={isAuditing}
                  placeholder={`[00:00] Agent: Thank you for calling...
[00:05] Customer: Hi, I need help with...`}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'monospace' }}
                />
              </div>
            )}

            {/* 2. Select Rubric */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                2. Select Scoring Rubric:
              </label>
              <select
                value={selectedRubricId}
                onChange={(e) => setSelectedRubricId(e.target.value)}
                disabled={isAuditing}
                style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' }}
              >
                <option value="">Default Customer Support QA (Built-in)</option>
                {rubrics.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.config?.criteria?.length || 0} criteria)
                  </option>
                ))}
              </select>
            </div>

            {/* Pipeline Execution Progress */}
            {isAuditing && (
              <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1e40af', fontSize: 13, fontWeight: 600 }}>
                  <span>⏳</span> {auditStep}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={isAuditing}
                style={{ padding: '8px 16px', fontSize: 14, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunAudit}
                disabled={isAuditing || (inputMode === 'audio' ? !selectedFile : !manualTranscript.trim())}
                style={{
                  padding: '8px 18px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  background: isAuditing ? '#9ca3af' : '#059669',
                  color: '#fff',
                  cursor: isAuditing ? 'not-allowed' : 'pointer',
                }}
              >
                {isAuditing ? 'Processing Audit...' : 'Start Call Audit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}