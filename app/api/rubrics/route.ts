import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/rubrics?tenantId=bank_1
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const { data: rubrics, error } = await supabase
      .from('rubrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rubrics: rubrics || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch rubrics';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
