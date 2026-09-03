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

export default function DashboardPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>('bank_1');
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [rubrics, setRubrics] = useState<RubricItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // New Audit Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  // Run End-to-End Audit Pipeline
  const handleRunAudit = async () => {
    if (!selectedFile) {
      setAuditError('Please select an audio file (MP3/WAV)');
      return;
    }

    try {
      setIsAuditing(true);
      setAuditError(null);

      // Step 1: Upload to Supabase Storage
      setAuditStep('Uploading audio to secure storage...');
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Audio upload failed');
      const audioUrl = uploadData.audio_url;

      // Step 2: Transcribe via Deepgram Nova-3
      setAuditStep('Transcribing speech with timestamps (Deepgram)...');
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: audioUrl,
          tenant_id: tenantId,
        }),
      });
      const transcribeData = await transcribeRes.json();
      if (!transcribeRes.ok) throw new Error(transcribeData.error || 'Transcription failed');
      const transcript = transcribeData.transcript;

      // Step 3: LLM Judge Evaluation with selected rubric
      setAuditStep('Evaluating call quality against rubric (LLM Judge)...');
      const scoreRes = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          audio_url: audioUrl,
          transcript,
          rubric_id: selectedRubricId || null,
        }),
      });
      const scoreData = await scoreRes.json();
      if (!scoreRes.ok) throw new Error(scoreData.error || 'Scoring evaluation failed');

      // Step 4: Success - Navigate to Call Detail Page
      setShowModal(false);
      setSelectedFile(null);
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
            onClick={() => setShowModal(true)}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
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
        <div style={{ padding: 48, textAlign: 'center', background: '#f9fafb', borderRadius: 8, border: '1px dashed #d1d5db' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#374151' }}>No calls yet</h3>
          <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>
            There are no audited calls recorded for {tenantId} yet.
          </p>
          <button
            onClick={() => setShowModal(true)}
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
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
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

      {/* Modal: Upload & Audit New Call */}
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
              maxWidth: 500,
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

            {auditError && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                {auditError}
              </div>
            )}

            {/* 1. File Upload Picker */}
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
                disabled={isAuditing || !selectedFile}
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