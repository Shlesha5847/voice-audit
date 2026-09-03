import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { evaluateTranscriptWithJudge, RubricCriterion, JudgeResult } from '@/lib/llm-judge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const tenantId = body.tenantId || body.tenant_id || req.headers.get('x-tenant-id');
    const callId = body.callId || body.call_id;
    const rubricId = body.rubricId || body.rubric_id;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    let transcript = body.transcript;
    let targetCallId = callId;

    // 1. Fetch transcript from DB using callId (if provided)
    if (callId) {
      const { data: callRecord, error: callError } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (callError || !callRecord) {
        return NextResponse.json({ error: 'Call not found for the specified tenant' }, { status: 404 });
      }

      transcript = callRecord.transcript;
      targetCallId = callRecord.id;
    } else if (!transcript) {
      return NextResponse.json({ error: 'callId or transcript is required' }, { status: 400 });
    } else {
      // If direct transcript provided without callId, create a call record
      const { data: newCall, error: createCallErr } = await supabase
        .from('calls')
        .insert({
          tenant_id: tenantId,
          audio_url: body.audio_url || null,
          transcript,
        })
        .select()
        .single();

      if (createCallErr) throw new Error(`Failed to create call: ${createCallErr.message}`);
      targetCallId = newCall.id;
    }

    // 2. Fetch rubric criteria from DB using rubricId
    let criteriaToEvaluate: RubricCriterion[] = [
      { name: 'Greeting & Verification', weight: 20 },
      { name: 'Active Listening & Empathy', weight: 30 },
      { name: 'Problem Resolution', weight: 30 },
      { name: 'Professional Closing', weight: 20 },
    ];

    if (rubricId) {
      const { data: rubricRecord, error: rubricError } = await supabase
        .from('rubrics')
        .select('*')
        .eq('id', rubricId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (rubricError || !rubricRecord) {
        return NextResponse.json({ error: 'Rubric not found for the specified tenant' }, { status: 404 });
      }

      if (rubricRecord?.config?.criteria && Array.isArray(rubricRecord.config.criteria)) {
        criteriaToEvaluate = rubricRecord.config.criteria;
      }
    }

    // 3, 4, 5, 6, 7. Format transcript & rubric, call LLM judge, parse JSON & compute weighted final_score
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    const scoringResult: JudgeResult = await evaluateTranscriptWithJudge({
      transcript,
      criteria: criteriaToEvaluate,
      apiKey: groqApiKey,
    });

    // 8. Store result in scores table
    const { data: scoreRecord, error: scoreError } = await supabase
      .from('scores')
      .insert({
        tenant_id: tenantId,
        call_id: targetCallId,
        rubric_id: rubricId || null,
        result: scoringResult,
      })
      .select()
      .single();

    if (scoreError) {
      throw new Error(`Failed to insert score: ${scoreError.message}`);
    }

    // Return final result
    return NextResponse.json({
      score_id: scoreRecord.id,
      call_id: targetCallId,
      rubric_id: rubricId || null,
      tenant_id: tenantId,
      final_score: scoringResult.final_score,
      criteria: scoringResult.criteria,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Scoring failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
