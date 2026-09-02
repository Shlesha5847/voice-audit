import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/rubrics/update
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rubricId = body.rubricId || body.rubric_id || body.id;
    const tenantId = body.tenantId || body.tenant_id;
    const { title, criteria } = body;

    if (!rubricId) {
      return NextResponse.json({ error: 'rubricId is required' }, { status: 400 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    if (!Array.isArray(criteria) || criteria.length === 0) {
      return NextResponse.json({ error: 'criteria array is required' }, { status: 400 });
    }

    // UPDATE with strict tenant_id and rubric_id filters
    const { data: updatedRubric, error } = await supabase
      .from('rubrics')
      .update({
        title,
        config: { criteria },
      })
      .eq('id', rubricId)
      .eq('tenant_id', tenantId)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedRubric) {
      return NextResponse.json(
        { error: 'Rubric not found for the specified tenant' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      rubric: updatedRubric,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}
