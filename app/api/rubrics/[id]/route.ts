import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/rubrics/[id] - Fetch single rubric
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('rubrics')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Rubric not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: data.id,
      name: data.title || data.name || 'Untitled Rubric',
      title: data.title || data.name || 'Untitled Rubric',
      tenant_id: data.tenant_id,
      criteria: data.config?.criteria || data.criteria || [],
      created_at: data.created_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch rubric';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/rubrics/[id] - Update a rubric
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const title = (body.name || body.title || '').trim();
    const criteria = Array.isArray(body.criteria) ? body.criteria : [];
    const tenantId = body.tenant_id !== undefined ? body.tenant_id : undefined;

    if (!title) {
      return NextResponse.json({ error: 'Rubric name is required' }, { status: 400 });
    }

    if (!criteria.length) {
      return NextResponse.json({ error: 'At least one criterion is required' }, { status: 400 });
    }

    const sanitizedCriteria = criteria.map((c: any) => ({
      name: String(c.name || '').trim(),
      weight: Number(c.weight) || 0,
    }));

    for (const c of sanitizedCriteria) {
      if (!c.name) {
        return NextResponse.json({ error: 'Criterion name cannot be empty' }, { status: 400 });
      }
      if (c.weight < 0) {
        return NextResponse.json({ error: 'Criterion weight cannot be negative' }, { status: 400 });
      }
    }

    const totalWeight = sanitizedCriteria.reduce(
      (sum: number, c: { name: string; weight: number }) => sum + c.weight,
      0
    );
    if (totalWeight !== 100) {
      return NextResponse.json(
        { error: `Total criteria weight must equal 100%. Current total: ${totalWeight}%` },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, any> = {
      title,
      config: { criteria: sanitizedCriteria },
    };

    if (tenantId !== undefined) {
      updatePayload.tenant_id = tenantId;
    }

    const { data, error } = await supabase
      .from('rubrics')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Rubric not found or failed to update' }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      name: data.title || data.name,
      title: data.title || data.name,
      tenant_id: data.tenant_id,
      criteria: data.config?.criteria || [],
      created_at: data.created_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update rubric';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/rubrics/[id] - Delete a rubric
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('rubrics')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete rubric';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
