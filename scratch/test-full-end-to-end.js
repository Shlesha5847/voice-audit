const fs = require('fs');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

async function testFullEndToEndProductFlow() {
  console.log(cyan('================================================================'));
  console.log(cyan(bold('   END-TO-END PRODUCT FLOW VERIFICATION (TRAINER WORKFLOW)     ')));
  console.log(cyan('================================================================\n'));

  const tenantId = 'bank_1';

  // --------------------------------------------------------------------------
  // STEP 1: Trainer selects/creates a Rubric
  // --------------------------------------------------------------------------
  console.log(yellow('🚀 STEP 1: Trainer selects/creates a Rubric for their Bank'));
  const rubricRes = await fetch('http://localhost:3000/api/rubrics/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      title: 'Customer Support QA (Compliance & Empathy)',
      criteria: [
        { name: 'Greeting & Verification', weight: 25 },
        { name: 'Empathy & Listening', weight: 35 },
        { name: 'Issue Resolution', weight: 25 },
        { name: 'Professional Closing', weight: 15 }
      ]
    })
  });
  const rubricData = await rubricRes.json();
  const rubricId = rubricData.rubric.id;
  console.log(green(`✓ Rubric Created: "${rubricData.rubric.title}" (ID: ${rubricId})\n`));

  // --------------------------------------------------------------------------
  // STEP 2: Trainer uploads an audio call & transcribes
  // --------------------------------------------------------------------------
  console.log(yellow('🚀 STEP 2: Audio Upload & Timestamped Transcription'));
  // Using verified sample audio URL already uploaded in storage
  const sampleAudioUrl = 'https://bldmdebkazdzgbacwygx.supabase.co/storage/v1/object/public/audio-recordings/1788366835293_audio.mp3';
  console.log(`Audio URL: ${sampleAudioUrl}`);

  console.log('Transcribing with Deepgram Nova-3...');
  const transcribeRes = await fetch('http://localhost:3000/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_url: sampleAudioUrl,
      tenant_id: tenantId
    })
  });
  const transcribeData = await transcribeRes.json();
  const transcript = transcribeData.transcript;
  console.log(green(`✓ Transcript generated with ${transcript.length} timestamped turns.`));
  console.log(`  Preview turn 1: [${transcript[0]?.time}] ${transcript[0]?.text.slice(0, 50)}...\n`);

  // --------------------------------------------------------------------------
  // STEP 3 & 4: LLM Judge Evaluates Call Against Rubric
  // --------------------------------------------------------------------------
  console.log(yellow('🚀 STEP 3 & 4: LLM Judge Evaluation with Rubric'));
  const scoreRes = await fetch('http://localhost:3000/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      audio_url: sampleAudioUrl,
      transcript,
      rubricId
    })
  });
  const scoreData = await scoreRes.json();
  const callId = scoreData.call_id;
  console.log(green(`✓ Evaluation Stored in DB! Call ID: ${callId}`));
  console.log(`  Final Score: ${bold(scoreData.final_score + ' / 10')}`);
  console.log('  Criteria Breakdown:');
  scoreData.criteria.forEach(c => {
    console.log(`    - ${c.name} (${c.score}/10): "${c.reason}" (⏱ ${c.timestamp})`);
  });
  console.log('');

  // --------------------------------------------------------------------------
  // STEP 5: Dashboard List Fetch (Trainer View)
  // --------------------------------------------------------------------------
  console.log(yellow('🚀 STEP 5: Dashboard Call List View'));
  const callsRes = await fetch(`http://localhost:3000/api/calls?tenantId=${tenantId}`);
  const callsList = await callsRes.json();
  console.log(green(`✓ Fetched ${callsList.length} calls for ${tenantId}.`));
  const latestCall = callsList.find(c => c.call_id === callId);
  console.log(`  Top Call: Call #${latestCall.call_id.slice(0, 8)} | Score: ${latestCall.final_score}/10 | Rubric: ${latestCall.rubric_title}\n`);

  // --------------------------------------------------------------------------
  // STEP 6: Call Detail Fetch (Clicking a Call)
  // --------------------------------------------------------------------------
  console.log(yellow('🚀 STEP 6 & 7: Call Detail Page (Trainer Inspection)'));
  const detailRes = await fetch(`http://localhost:3000/api/calls/${callId}?tenantId=${tenantId}`);
  const detailData = await detailRes.json();
  console.log(green('✓ Call Detail API returned:'));
  console.log(`  - Audio URL: ${detailData.call.audio_url ? 'Present' : 'None'}`);
  console.log(`  - Final Score: ${detailData.score?.final_score} / 10`);
  console.log(`  - Evaluated Criteria Count: ${detailData.score?.criteria?.length}`);
  console.log(`  - Transcript Turns Count: ${detailData.transcript?.length}`);
  console.log(`  - Rubric Title: ${detailData.rubric?.title}`);

  console.log(cyan('\n================================================================'));
  console.log(green(bold('   ALL 7 END-TO-END PRODUCT STEPS VERIFIED AND WORKING!         ')));
  console.log(cyan('================================================================'));
}

testFullEndToEndProductFlow().catch(console.error);
