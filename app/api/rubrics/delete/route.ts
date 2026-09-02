import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// DELETE or POST /api/rubrics/delete
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const rubricId = body.rubricId || body.rubric_id || body.id;
    const tenantId = body.tenantId || body.tenant_id;

    if (!rubricId) {
      return NextResponse.json({ error: 'rubricId is required' }, { status: 400 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Delete with strict tenant_id and id match
    const { data, error } = await supabase
      .from('rubrics')
      .delete()
      .eq('id', rubricId)
      .eq('tenant_id', tenantId)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Rubric not found for the specified tenant' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rubric deleted successfully',
      deletedRubricId: rubricId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return DELETE(req);
}
