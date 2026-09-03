import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/calls/[id]?tenantId=bank_1
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const tenantId =
      searchParams.get('tenantId') ||
      searchParams.get('tenant_id') ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required in query params or x-tenant-id header' },
        { status: 400 }
      );
    }

    // 1. Fetch call record
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (callError || !callRecord) {
      return NextResponse.json(
        { error: 'Call not found for the specified tenant' },
        { status: 404 }
      );
    }

    // 2. Fetch score record
    const { data: scoreRecord } = await supabase
      .from('scores')
      .select('*')
      .eq('call_id', id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Fetch rubric (if rubric_id is present)
    let rubricRecord = null;
    if (scoreRecord?.rubric_id) {
      const { data: rubric } = await supabase
        .from('rubrics')
        .select('*')
        .eq('id', scoreRecord.rubric_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      rubricRecord = rubric || null;
    }

    return NextResponse.json({
      call: {
        id: callRecord.id,
        audio_url: callRecord.audio_url || null,
        tenant_id: callRecord.tenant_id,
        created_at: callRecord.created_at,
      },
      transcript: callRecord.transcript || [],
      score: scoreRecord?.result || null,
      rubric: rubricRecord
        ? {
            id: rubricRecord.id,
            title: rubricRecord.title,
            config: rubricRecord.config,
          }
        : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch call details';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
