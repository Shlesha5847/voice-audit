import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    // Step 1: Mock Transcription
    const mockTranscript = [
      {
        speaker: 'Agent',
        timestamp: '00:02',
        text: 'Thank you for calling Acme Support, my name is Alex. How can I help you today?',
      },
      {
        speaker: 'Customer',
        timestamp: '00:08',
        text: 'Hi Alex, I noticed an unexpected charge of $49.00 on my billing statement this morning.',
      },
      {
        speaker: 'Agent',
        timestamp: '00:15',
        text: 'I completely understand your concern. Let me pull up your account and check that transaction immediately.',
      },
      {
        speaker: 'Agent',
        timestamp: '00:42',
        text: 'I found the duplicate charge from our recent system migration. I have issued a full refund to your card.',
      },
      {
        speaker: 'Customer',
        timestamp: '00:50',
        text: 'Oh great, that was really quick. Thank you!',
      },
      {
        speaker: 'Agent',
        timestamp: '00:55',
        text: 'You are very welcome! You will see the credit in 2-3 business days. Is there anything else I can assist with?',
      },
      {
        speaker: 'Customer',
        timestamp: '01:02',
        text: 'No, that was all. Have a great day!',
      },
      {
        speaker: 'Agent',
        timestamp: '01:05',
        text: 'Thank you for choosing Acme. Have a wonderful day!',
      },
    ];

    // Step 2: Mock Scoring Engine
    const mockScores = {
      overall: 94,
      categories: {
        greeting: { score: 95, feedback: 'Proper brand greeting and agent identification.' },
        empathy: { score: 92, feedback: 'Acknowledged customer frustration promptly.' },
        resolution: { score: 98, feedback: 'Identified root cause and resolved issue within 1 minute.' },
        compliance: { score: 90, feedback: 'Accurately stated 2-3 day refund timeline.' },
      },
      sentiment: 'Positive',
      summary:
        'Customer contacted support regarding an unexpected $49 charge. The agent identified a migration billing error, issued an immediate refund, and clearly communicated expected refund timelines.',
      actionItems: [
        'Ensure automated refund email notification was dispatched.',
        'Flag user account for billing reconciliation audit.',
      ],
    };

    // Return structured audit result
    return NextResponse.json({
      success: true,
      data: {
        id: `call_${Date.now()}`,
        fileName: file.name,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        processedAt: new Date().toISOString(),
        transcript: mockTranscript,
        audit: mockScores,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to process audio audit' },
      { status: 500 }
    );
  }
}
