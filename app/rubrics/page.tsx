'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Criterion {
  name: string;
  weight: number;
}

interface Rubric {
  id: string;
  name?: string;
  title: string;
  tenant_id: string;
  config: {
    criteria: Criterion[];
  };
  created_at: string;
}

const SAMPLE_TEMPLATES = [
  {
    name: 'Customer Support QA',
    criteria: [
      { name: 'Greeting & Verification', weight: 15 },
      { name: 'Active Listening & Empathy', weight: 25 },
      { name: 'Problem Resolution', weight: 40 },
      { name: 'Call Closing & Next Steps', weight: 20 },
    ],
  },
  {
    name: 'Sales Discovery Call',
    criteria: [
      { name: 'Introduction & Agenda', weight: 15 },
      { name: 'Pain Point Discovery', weight: 35 },
      { name: 'Value Proposition & Pitch', weight: 30 },
      { name: 'Objection Handling & Next Steps', weight: 20 },
    ],
  },
  {
    name: 'Compliance & Verification',
    criteria: [
      { name: 'Caller ID & KYC Check', weight: 30 },
      { name: 'Disclosure & Consent', weight: 30 },
      { name: 'Accurate Information Given', weight: 40 },
    ],
  },
];

export default function RubricsPage() {
  const [tenantId, setTenantId] = useState<string>('bank_1');
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal / Form state
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rubricName, setRubricName] = useState<string>('');
  const [formTenantId, setFormTenantId] = useState<string>('bank_1');
  const [criteria, setCriteria] = useState<Criterion[]>([
    { name: 'Greeting', weight: 20 },
    { name: 'Closing', weight: 30 },
  ]);

  // Fetch rubrics for active tenant
  const fetchRubrics = async (activeTenant: string = tenantId) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/rubrics?tenantId=${activeTenant}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load rubrics');
      setRubrics(data.rubrics || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching rubrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRubrics(tenantId);
  }, [tenantId]);

  const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  const handleOpenCreate = () => {
    setEditingId(null);
    setRubricName('');
    setFormTenantId(tenantId);
    setCriteria([
      { name: 'Greeting', weight: 20 },
      { name: 'Closing', weight: 30 },
    ]);
    setError(null);
    setIsOpen(true);
  };

  const handleOpenEdit = (rubric: Rubric) => {
    setEditingId(rubric.id);
    setRubricName(rubric.title || rubric.name || '');
    setFormTenantId(rubric.tenant_id || tenantId);
    setCriteria(
      rubric.config?.criteria && rubric.config.criteria.length > 0
        ? rubric.config.criteria.map((c) => ({ name: c.name, weight: Number(c.weight) || 0 }))
        : [{ name: '', weight: 0 }]
    );
    setError(null);
    setIsOpen(true);
  };

  const handleApplyTemplate = (template: typeof SAMPLE_TEMPLATES[0]) => {
    setRubricName(template.name);
    setCriteria(template.criteria.map((c) => ({ ...c })));
  };

  const handleAddCriterion = () => {
    setCriteria([...criteria, { name: '', weight: 0 }]);
  };

  const handleRemoveCriterion = (index: number) => {
    if (criteria.length <= 1) {
      alert('A rubric must have at least one criterion.');
      return;
    }
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const handleCriterionChange = (index: number, field: keyof Criterion, value: string | number) => {
    const updated = [...criteria];
    if (field === 'weight') {
      updated[index].weight = Number(value) || 0;
    } else {
      updated[index].name = String(value);
    }
    setCriteria(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rubricName.trim()) {
      setError('Please provide a rubric name.');
      return;
    }

    const filteredCriteria = criteria.filter((c) => c.name.trim() !== '');
    if (filteredCriteria.length === 0) {
      setError('Please add at least one criterion with a name.');
      return;
    }

    // Strict validation: Reject save if total weight is not 100%
    const currentTotalWeight = filteredCriteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
    if (currentTotalWeight !== 100) {
      setError(`Total criteria weight must equal exactly 100%. Current total is ${currentTotalWeight}%. Please adjust weights before saving.`);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      let res: Response;
      if (editingId) {
        // Edit via update API
        res = await fetch('/api/rubrics/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rubricId: editingId,
            tenantId: formTenantId,
            title: rubricName.trim(),
            criteria: filteredCriteria,
          }),
        });
      } else {
        // Create via create API
        res = await fetch('/api/rubrics/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: formTenantId,
            title: rubricName.trim(),
            criteria: filteredCriteria,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save rubric');

      setIsOpen(false);
      setSuccessMsg(editingId ? 'Rubric updated successfully!' : 'Rubric created successfully!');
      setTimeout(() => setSuccessMsg(null), 3500);
      fetchRubrics(tenantId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save rubric');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete rubric "${title}"?`)) {
      return;
    }

    try {
      const res = await fetch('/api/rubrics/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rubricId: id, tenantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete rubric');

      setSuccessMsg(`Rubric "${title}" deleted successfully.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      fetchRubrics(tenantId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header & Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#111827' }}>Scoring Rubrics</h1>
            <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 999 }}>
              JSONB PostgreSQL
            </span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#4b5563' }}>
            Trainers can define custom criteria and weighted scoring matrices for call auditing.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link
            href="/"
            style={{
              padding: '8px 14px',
              fontSize: 14,
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            ← Back to Audits
          </Link>
          <button
            onClick={handleOpenCreate}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 6,
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            + New Rubric
          </button>
        </div>
      </div>

      {/* Tenant Selector Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontWeight: 600, fontSize: 14, color: '#334155' }}>Active Bank / Tenant:</label>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            disabled={loading}
            style={{ padding: '6px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
          >
            <option value="bank_1">First National Bank (bank_1)</option>
            <option value="bank_2">Apex Horizon Bank (bank_2)</option>
          </select>
        </div>
        <span style={{ fontSize: 13, color: '#64748b' }}>
          Data is strictly isolated to <code>{tenantId}</code>
        </span>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 6, marginBottom: 20 }}>
          ✓ {successMsg}
        </div>
      )}
      {error && !isOpen && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 6, marginBottom: 20 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Rubrics List */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>Loading rubrics for {tenantId}...</div>
      ) : rubrics.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', background: '#f9fafb', borderRadius: 8, border: '1px dashed #d1d5db' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#374151' }}>No Rubrics Configured for {tenantId}</h3>
          <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>
            Create your first scoring rubric to customize how calls are evaluated.
          </p>
          <button
            onClick={handleOpenCreate}
            style={{
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 6,
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Create Rubric
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rubrics.map((rubric) => {
            const sumWeight = (rubric.config?.criteria || []).reduce((acc, c) => acc + (Number(c.weight) || 0), 0);
            return (
              <div
                key={rubric.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 20,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#111827' }}>
                        {rubric.title || rubric.name}
                      </h3>
                      <span style={{ fontSize: 12, background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                        tenant: {rubric.tenant_id}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: sumWeight === 100 ? '#ecfdf5' : '#fef3c7',
                          color: sumWeight === 100 ? '#065f46' : '#92400e',
                        }}
                      >
                        Total Weight: {sumWeight}%
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginTop: 4 }}>
                      ID: {rubric.id} • Created: {new Date(rubric.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleOpenEdit(rubric)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 13,
                        fontWeight: 500,
                        borderRadius: 4,
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        color: '#374151',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rubric.id, rubric.title || rubric.name || '')}
                      style={{
                        padding: '6px 12px',
                        fontSize: 13,
                        fontWeight: 500,
                        borderRadius: 4,
                        border: '1px solid #fecaca',
                        background: '#fff',
                        color: '#dc2626',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Criteria Pill List */}
                <div style={{ background: '#f9fafb', borderRadius: 6, padding: '10px 14px', border: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#4b5563', marginBottom: 8 }}>
                    Criteria Breakdown ({rubric.config?.criteria?.length || 0} items):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(rubric.config?.criteria || []).map((c, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 13,
                        }}
                      >
                        <span style={{ color: '#1f2937', fontWeight: 500 }}>{c.name}</span>
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 12, padding: '2px 6px', borderRadius: 4 }}>
                          {c.weight}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create / Edit Form */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              width: '100%',
              maxWidth: 580,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#111827' }}>
                {editingId ? 'Edit Scoring Rubric' : 'Create Scoring Rubric'}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}
              >
                ✕
              </button>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                {error}
              </div>
            )}

            {/* Quick Templates */}
            {!editingId && (
              <div style={{ marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Quick Fill Template:
                </span>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {SAMPLE_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyTemplate(tmpl)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        background: '#fff',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: '#374151',
                      }}
                    >
                      {tmpl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Rubric Name */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Rubric Name *
                </label>
                <input
                  type="text"
                  value={rubricName}
                  onChange={(e) => setRubricName(e.target.value)}
                  placeholder="e.g. Inbound Support Quality Rubric"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 14,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Tenant Isolation */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Target Bank / Tenant
                </label>
                <select
                  value={formTenantId}
                  onChange={(e) => setFormTenantId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 14,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: '#fff',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="bank_1">First National Bank (bank_1)</option>
                  <option value="bank_2">Apex Horizon Bank (bank_2)</option>
                </select>
              </div>

              {/* Criteria Section */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                    Criteria & Weights (JSONB)
                  </label>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: totalWeight === 100 ? '#059669' : '#d97706',
                    }}
                  >
                    Total Weight: {totalWeight}% {totalWeight !== 100 && '(Recommended: 100%)'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {criteria.map((c, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Criterion name (e.g. Greeting)"
                        value={c.name}
                        onChange={(e) => handleCriterionChange(idx, 'name', e.target.value)}
                        required
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          fontSize: 14,
                          border: '1px solid #d1d5db',
                          borderRadius: 6,
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 110 }}>
                        <input
                          type="number"
                          placeholder="Weight"
                          value={c.weight}
                          onChange={(e) => handleCriterionChange(idx, 'weight', e.target.value)}
                          min="0"
                          max="100"
                          required
                          style={{
                            width: '100%',
                            padding: '7px 8px',
                            fontSize: 14,
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                          }}
                        />
                        <span style={{ fontSize: 13, color: '#6b7280' }}>%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCriterion(idx)}
                        disabled={criteria.length <= 1}
                        style={{
                          padding: '7px 10px',
                          fontSize: 14,
                          color: criteria.length <= 1 ? '#d1d5db' : '#ef4444',
                          background: 'none',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          cursor: criteria.length <= 1 ? 'not-allowed' : 'pointer',
                        }}
                        title="Remove criterion"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddCriterion}
                  style={{
                    marginTop: 10,
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#2563eb',
                    background: '#eff6ff',
                    border: '1px dashed #93c5fd',
                    borderRadius: 6,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  + Add Criterion
                </button>
              </div>

              {/* JSONB preview */}
              <div style={{ marginBottom: 20 }}>
                <details style={{ fontSize: 12, color: '#6b7280' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Preview JSONB Structure</summary>
                  <pre style={{ background: '#f3f4f6', padding: 10, borderRadius: 6, marginTop: 6, overflowX: 'auto', color: '#111827' }}>
                    {JSON.stringify({ criteria: criteria.filter((c) => c.name.trim() !== '') }, null, 2)}
                  </pre>
                </details>
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={saving}
                  style={{
                    padding: '8px 16px',
                    fontSize: 14,
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    color: '#374151',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '8px 20px',
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 6,
                    background: saving ? '#93c5fd' : '#2563eb',
                    color: '#fff',
                    border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving...' : editingId ? 'Update Rubric' : 'Create Rubric'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
