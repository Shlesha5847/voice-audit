'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const TENANTS = [
  { id: 'bank_1', name: 'First National Bank (bank_1)' },
  { id: 'bank_2', name: 'Apex Horizon Bank (bank_2)' },
];

export default function HomePage() {
  const [tenantId, setTenantId] = useState<string>('bank_1');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tenantCalls, setTenantCalls] = useState<any[]>([]);
  const [loadingCalls, setLoadingCalls] = useState<boolean>(false);
  const [rubrics, setRubrics] = useState<any[]>([]);
  const [selectedRubricId, setSelectedRubricId] = useState<string>('');

  // Fetch calls & rubrics whenever active tenant changes
  const fetchTenantCalls = async (selectedTenant: string) => {
    try {
      setLoadingCalls(true);
      const res = await fetch(`/api/calls?tenant_id=${selectedTenant}`);
      const data = await res.json();
      if (res.ok) {
        setTenantCalls(data.calls || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingCalls(false);
    }
  };

  const fetchRubrics = async (selectedTenant: string) => {
    try {
      const res = await fetch(`/api/rubrics?tenant_id=${selectedTenant}`);
      const data = await res.json();
      if (res.ok) {
        setRubrics(data.rubrics || []);
        if (data.rubrics?.length > 0) {
          setSelectedRubricId(data.rubrics[0].id);
        } else {
          setSelectedRubricId('');
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchTenantCalls(tenantId);
    fetchRubrics(tenantId);
    setResult(null);
  }, [tenantId]);

  const handleUploadAndAnalyze = async () => {
    if (!file) {
      alert('Please select an audio file first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      // 1. Upload audio file
      setStatus('Uploading audio...');
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');
      const audioUrl = uploadData.audio_url;

      // 2. Transcribe audio
      setStatus('Transcribing audio (Deepgram)...');
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: audioUrl }),
      });
      const transcribeData = await transcribeRes.json();
      if (!transcribeRes.ok) throw new Error(transcribeData.error || 'Transcription failed');
      const transcript = transcribeData.transcript;

      // 3. Score transcript with Tenant ID and optional Rubric ID
      setStatus('Scoring with AI & Saving to DB...');
      const scoreRes = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: audioUrl,
          transcript,
          tenant_id: tenantId,
          rubric_id: selectedRubricId || null,
        }),
      });
      const scoreData = await scoreRes.json();
      if (!scoreRes.ok) throw new Error(scoreData.error || 'Scoring failed');

      // 4. Set final result
      setResult({
        tenant_id: tenantId,
        audio_url: audioUrl,
        transcript,
        score: scoreData,
      });

      // Refresh calls list for current tenant
      fetchTenantCalls(tenantId);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div style={{ maxWidth: 840, margin: '40px auto', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header & Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#111827' }}>Call Review & Multi-Tenant Audit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>
            Upload and audit customer service & sales calls with AI scoring.
          </p>
        </div>
        <div>
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
      <div style={{ marginBottom: 20, padding: 14, background: '#f8f9fa', borderRadius: 8, border: '1px solid #ddd' }}>
        <label style={{ fontWeight: 'bold', marginRight: 10 }}>Active Bank / Tenant:</label>
        <select
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          disabled={loading}
          style={{ padding: '6px 12px', fontSize: 14, borderRadius: 4 }}
        >
          {TENANTS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span style={{ marginLeft: 12, fontSize: 13, color: '#666' }}>
          (Data is strictly isolated to <code>{tenantId}</code>)
        </span>
      </div>

      {/* Rubric Selector */}
      <div style={{ marginBottom: 20, padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontWeight: 600, fontSize: 14, color: '#334155' }}>
            Select Scoring Rubric:
          </label>
          <Link href="/rubrics" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>
            + Create New Rubric
          </Link>
        </div>
        {rubrics.length === 0 ? (
          <div style={{ fontSize: 13, color: '#64748b' }}>
            No custom rubrics found for this tenant. Default QA standard rubric will be used.{' '}
            <Link href="/rubrics" style={{ color: '#2563eb', textDecoration: 'underline' }}>
              Create a custom rubric here
            </Link>.
          </div>
        ) : (
          <select
            value={selectedRubricId}
            onChange={(e) => setSelectedRubricId(e.target.value)}
            disabled={loading}
            style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
          >
            {rubrics.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name || r.title} ({r.criteria?.length || 0} criteria: {r.criteria?.map((c: any) => `${c.name} ${c.weight}%`).join(', ')})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* File input */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold' }}>Upload Call Audio:</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={loading}
        />
      </div>

      {/* Action button */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={handleUploadAndAnalyze}
          disabled={!file || loading}
          style={{
            padding: '10px 20px',
            fontSize: 16,
            cursor: file && !loading ? 'pointer' : 'not-allowed',
            background: file && !loading ? '#0066cc' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
          }}
        >
          {loading ? status : `Audit Call for ${tenantId}`}
        </button>
      </div>

      {error && <div style={{ color: 'red', marginBottom: 16 }}>Error: {error}</div>}

      {/* Latest Result */}
      {result && (
        <div style={{ marginTop: 24, marginBottom: 32 }}>
          <h3>Latest Audit Result ({result.tenant_id}):</h3>
          <pre style={{ background: '#f4f4f4', color: '#111', padding: 16, borderRadius: 6, overflowX: 'auto' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {/* Tenant Isolated Call History */}
      <div style={{ marginTop: 32, borderTop: '2px solid #eee', paddingTop: 20 }}>
        <h3>Stored Calls for {tenantId} ({tenantCalls.length} records)</h3>
        {loadingCalls ? (
          <p>Loading {tenantId} records...</p>
        ) : tenantCalls.length === 0 ? (
          <p style={{ color: '#888' }}>No audited calls yet for this bank.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tenantCalls.map((call) => (
              <div
                key={call.id}
                style={{
                  padding: 14,
                  borderRadius: 6,
                  border: '1px solid #e0e0e0',
                  background: '#fafafa',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong>Call ID: {call.id.slice(0, 8)}...</strong>
                  <span style={{ fontSize: 12, color: '#666' }}>{new Date(call.created_at).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Tenant:</strong> <code>{call.tenant_id}</code> |{' '}
                  <strong>Score:</strong> {call.scores?.[0]?.result?.final_score ?? 'N/A'} / 10
                </div>
                <div style={{ fontSize: 13, color: '#444' }}>
                  <strong>Summary:</strong> {call.scores?.[0]?.result?.summary || 'No summary'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}