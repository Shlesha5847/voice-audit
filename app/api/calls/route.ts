import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/calls?tenant_id=bank_1  (or Header: x-tenant-id: bank_1)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Read tenantId from query params OR headers
    const tenantId =
      searchParams.get('tenant_id') ||
      searchParams.get('tenantId') ||
      req.headers.get('x-tenant-id');

    // Strict guard: Never execute a query without tenant_id
    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenant_id is required in query params or x-tenant-id header' },
        { status: 400 }
      );
    }

    // SELECT with mandatory tenant_id filter
    const { data: calls, error } = await supabase
      .from('calls')
      .select(`
        id,
        tenant_id,
        audio_url,
        transcript,
        created_at,
        scores (
          id,
          tenant_id,
          result,
          created_at
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      tenant_id: tenantId,
      total: calls?.length || 0,
      calls: calls || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch calls';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
