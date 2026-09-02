import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Read tenantId from body OR header
    const tenantId =
      body.tenant_id ||
      body.tenantId ||
      req.headers.get('x-tenant-id');

    // Strict guard: Never allow an INSERT without tenant_id
    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenant_id is required in request body or x-tenant-id header' },
        { status: 400 }
      );
    }

    const { audio_url, transcript, rubric_id = null } = body;

    if (!transcript || (Array.isArray(transcript) && transcript.length === 0)) {
      return NextResponse.json(
        { error: 'transcript is required' },
        { status: 400 }
      );
    }

    const groqApiKey = process.env.GROQ_API_KEY;

    let scoringResult: any;

    if (groqApiKey) {
      // 1. Format transcript into text for LLM
      const formattedTranscript = Array.isArray(transcript)
        ? transcript
            .map((t: any) => `[${t.time || '00:00'}] ${t.speaker ? `${t.speaker}: ` : ''}${t.text}`)
            .join('\n')
        : String(transcript);

      // 2. Call Groq API for QA Scoring
      const systemPrompt = `You are an expert QA auditor for customer support, sales, and product demo calls.
Analyze the provided transcript and evaluate it against standard quality assurance criteria.

You MUST return a valid JSON object matching this exact structure:
{
  "final_score": number,
  "sentiment": string,
  "summary": string,
  "criteria": [
    {
      "name": string,
      "score": number,
      "reason": string,
      "timestamp": string
    }
  ],
  "action_items": [string]
}`;

      const modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

      const groqResponse = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: `Here is the call transcript to audit:\n\n${formattedTranscript}`,
              },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
        }
      );

      if (!groqResponse.ok) {
        const errText = await groqResponse.text();
        throw new Error(`Groq API error: ${errText}`);
      }

      const groqData = await groqResponse.json();
      const content = groqData.choices?.[0]?.message?.content;
      scoringResult = JSON.parse(content);
    } else {
      // Fallback mock
      scoringResult = {
        final_score: 8.5,
        sentiment: 'Positive',
        summary: 'Call handled professionally with clear product walkthrough.',
        criteria: [
          {
            name: 'Greeting',
            score: 9,
            reason: 'Clear greeting and overview.',
            timestamp: '00:00',
          },
        ],
        action_items: ['Follow up with customer.'],
      };
    }

    // 3. INSERT with mandatory tenant_id
    // Step A: Insert into 'calls'
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .insert({
        tenant_id: tenantId,
        audio_url: audio_url || null,
        transcript,
      })
      .select()
      .single();

    if (callError) {
      throw new Error(`Failed to insert call: ${callError.message}`);
    }

    // Step B: Insert into 'scores'
    const { data: scoreRecord, error: scoreError } = await supabase
      .from('scores')
      .insert({
        tenant_id: tenantId,
        call_id: callRecord.id,
        rubric_id: rubric_id || null,
        result: scoringResult,
      })
      .select()
      .single();

    if (scoreError) {
      throw new Error(`Failed to insert score: ${scoreError.message}`);
    }

    return NextResponse.json({
      ...scoringResult,
      tenant_id: tenantId,
      call_id: callRecord.id,
      score_id: scoreRecord.id,
      saved_to_db: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Scoring failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
