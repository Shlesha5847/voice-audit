import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { transformDeepgramTranscript } from '@/lib/deepgram-transformer';

export async function POST(req: NextRequest) {
  try {
    const { audio_url, call_id, tenant_id } = await req.json();

    if (!audio_url) {
      return NextResponse.json({ error: 'audio_url is required' }, { status: 400 });
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'DEEPGRAM_API_KEY is not set in .env' }, { status: 500 });
    }

    // 1. Call Deepgram Nova-3 API
    const deepgramUrl = new URL('https://api.deepgram.com/v1/listen');
    deepgramUrl.searchParams.set('model', 'nova-3');
    deepgramUrl.searchParams.set('smart_format', 'true');
    deepgramUrl.searchParams.set('diarize', 'true');
    deepgramUrl.searchParams.set('punctuate', 'true');
    deepgramUrl.searchParams.set('utterances', 'true');

    const response = await fetch(deepgramUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: audio_url }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Deepgram API error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 2. Extract structured transcript with timestamps [{ time: "MM:SS", text: "..." }]
    const structuredTranscript = transformDeepgramTranscript(data);

    // 3. Update the calls table jsonb column using call_id
    let updatedCall = null;
    if (call_id) {
      let query = supabase
        .from('calls')
        .update({ transcript: structuredTranscript })
        .eq('id', call_id);

      if (tenant_id) {
        query = query.eq('tenant_id', tenant_id);
      }

      const { data: updatedData, error: updateError } = await query.select().single();

      if (updateError) {
        return NextResponse.json(
          { error: `Failed to update call in database: ${updateError.message}` },
          { status: 500 }
        );
      }
      updatedCall = updatedData;
    }

    return NextResponse.json({
      success: true,
      call_id: call_id || null,
      updated_in_db: Boolean(updatedCall),
      transcript: structuredTranscript,
      duration: data.metadata?.duration ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Transcription failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
