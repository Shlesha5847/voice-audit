import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${Date.now()}_${sanitizedName}`;

    // Convert file to ArrayBuffer / Buffer for Supabase Storage upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const bucketName = 'audio-recordings';

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type || 'audio/mpeg',
        upsert: false,
      });

    if (uploadError) {
      // Helpful error if bucket hasn't been created yet in Supabase
      if (uploadError.message.toLowerCase().includes('bucket not found') || (uploadError as any).statusCode === '404') {
        return NextResponse.json(
          {
            error: `Supabase bucket '${bucketName}' not found. Please create a public bucket named '${bucketName}' in your Supabase dashboard.`,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: `Supabase Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL of the uploaded audio file
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(uploadData.path);

    return NextResponse.json({
      audio_url: urlData.publicUrl,
      file_path: uploadData.path,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
