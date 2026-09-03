import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/calls?tenantId=bank_1
export async function GET(req: NextRequest) {
  try {
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

    // Fetch calls and joined scores for tenant
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select(`
        id,
        tenant_id,
        audio_url,
        created_at,
        scores (
          id,
          rubric_id,
          result,
          created_at
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (callsError) {
      return NextResponse.json({ error: callsError.message }, { status: 500 });
    }

    // Fetch rubrics to attach human-readable title
    const { data: rubrics } = await supabase
      .from('rubrics')
      .select('id, title')
      .eq('tenant_id', tenantId);

    const rubricMap = new Map((rubrics || []).map((r) => [r.id, r.title]));

    // Format response matching the required structure
    const formattedCalls = (calls || []).map((call) => {
      const latestScore = Array.isArray(call.scores) && call.scores.length > 0
        ? call.scores[0]
        : null;

      const rubricId = latestScore?.rubric_id || null;
      const rubricTitle = rubricId ? rubricMap.get(rubricId) || 'Custom Rubric' : 'Default QA Rubric';

      return {
        call_id: call.id,
        audio_url: call.audio_url || null,
        created_at: call.created_at,
        final_score: latestScore?.result?.final_score ?? null,
        rubric_id: rubricId,
        rubric_title: rubricTitle,
      };
    });

    return NextResponse.json(formattedCalls);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch calls';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
