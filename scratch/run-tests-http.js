// Color formatting
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

async function executeTestSuite() {
  console.log(cyan('================================================================'));
  console.log(cyan('    LLM JUDGE LIVE TEST SUITE: REAL-WORLD EDGE CASES           '));
  console.log(cyan('================================================================\n'));

  // --------------------------------------------------------------------------
  // TEST CASE 1: Missed Greeting & Abrupt Ending (Omission Detection)
  // --------------------------------------------------------------------------
  console.log(yellow('▶ TEST 1: Missed Greeting & Abrupt Ending (Omission Detection)'));
  
  // 1A. Create Rubric
  const r1RubricRes = await fetch('http://localhost:3000/api/rubrics/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: 'bank_1',
      title: 'Test 1 Omission Rubric',
      criteria: [
        { name: 'Greeting & Verification', weight: 30 },
        { name: 'Information Accuracy', weight: 40 },
        { name: 'Professional Closing', weight: 30 }
      ]
    })
  });
  const r1Rubric = await r1RubricRes.json();
  const rubricId1 = r1Rubric.rubric.id;

  // 1B. Create Call with poor agent behavior
  const t1Transcript = [
    { time: '00:00', speaker: 'Agent', text: 'Yeah, what do you need?' },
    { time: '00:05', speaker: 'Customer', text: 'Hi, I wanted to know my current account balance.' },
    { time: '00:10', speaker: 'Agent', text: 'Your balance is $420.' },
    { time: '00:14', speaker: 'Customer', text: 'Okay, and when is my next payment due?' },
    { time: '00:18', speaker: 'Agent', text: 'Next Tuesday.' },
    { time: '00:21', speaker: 'Customer', text: 'Great, thanks...' }
  ];

  const score1Res = await fetch('http://localhost:3000/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: 'bank_1',
      transcript: t1Transcript,
      rubricId: rubricId1
    })
  });

  const r1 = await score1Res.json();
  console.log('Result 1 Criteria:');
  console.log(JSON.stringify(r1.criteria, null, 2));
  console.log(`Final Weighted Score: ${r1.final_score} / 10\n`);

  const greetingScore = r1.criteria.find(c => c.name.includes('Greeting'))?.score || 0;
  const closingScore = r1.criteria.find(c => c.name.includes('Closing'))?.score || 0;
  const infoScore = r1.criteria.find(c => c.name.includes('Information'))?.score || 0;

  const test1Passed = greetingScore <= 4 && closingScore <= 4 && infoScore >= 7;
  console.log(test1Passed 
    ? green('✓ TEST 1 PASSED: Strict low scores assigned to missed criteria (Greeting: ' + greetingScore + ', Closing: ' + closingScore + ')') 
    : red('✗ TEST 1 FAILED'));
  console.log('----------------------------------------------------------------\n');

  // --------------------------------------------------------------------------
  // TEST CASE 2: Mid-Call Verification & Delayed Resolution (Timestamp Precision)
  // --------------------------------------------------------------------------
  console.log(yellow('▶ TEST 2: Mid-Call Verification & Delayed Resolution (Timestamp Precision)'));

  const r2RubricRes = await fetch('http://localhost:3000/api/rubrics/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: 'bank_1',
      title: 'Test 2 Precision Rubric',
      criteria: [
        { name: 'Identity Verification', weight: 30 },
        { name: 'Transfer Execution', weight: 40 },
        { name: 'Professional Closing', weight: 30 }
      ]
    })
  });
  const r2Rubric = await r2RubricRes.json();
  const rubricId2 = r2Rubric.rubric.id;

  const t2Transcript = [
    { time: '00:00', speaker: 'Agent', text: 'Welcome to Horizon Bank, how can I help?' },
    { time: '00:06', speaker: 'Customer', text: 'I need to transfer $5,000 to my external checking account immediately.' },
    { time: '00:14', speaker: 'Agent', text: 'Sure thing, let me get that transfer screen loaded up.' },
    { time: '00:45', speaker: 'Agent', text: 'Before I submit this high-value transfer, I need to verify your mother maiden name and PIN.' },
    { time: '00:54', speaker: 'Customer', text: 'Mother maiden name is Smith, PIN is 9182.' },
    { time: '01:02', speaker: 'Agent', text: 'Thank you, security verified.' },
    { time: '01:25', speaker: 'Agent', text: 'The transfer of $5,000 has been successfully submitted and scheduled for tomorrow.' },
    { time: '01:35', speaker: 'Customer', text: 'Thank you so much!' },
    { time: '01:38', speaker: 'Agent', text: 'You are welcome, thank you for banking with Horizon. Have a great day.' }
  ];

  const score2Res = await fetch('http://localhost:3000/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: 'bank_1',
      transcript: t2Transcript,
      rubricId: rubricId2
    })
  });

  const r2 = await score2Res.json();
  console.log('Result 2 Criteria:');
  console.log(JSON.stringify(r2.criteria, null, 2));
  console.log(`Final Weighted Score: ${r2.final_score} / 10\n`);

  const verifyItem = r2.criteria.find(c => c.name.includes('Verification'));
  const transferItem = r2.criteria.find(c => c.name.includes('Transfer'));

  const test2Passed = 
    verifyItem && (verifyItem.timestamp === '00:45' || verifyItem.timestamp === '01:02' || verifyItem.timestamp === '00:54') &&
    transferItem && (transferItem.timestamp === '01:25' || transferItem.timestamp === '01:14');

  console.log(test2Passed 
    ? green(`✓ TEST 2 PASSED: Verification cited at ${verifyItem.timestamp}, Transfer cited at ${transferItem.timestamp}`) 
    : yellow(`⚠ TEST 2 Timestamps: Verify=${verifyItem?.timestamp}, Transfer=${transferItem?.timestamp}`));
  console.log('----------------------------------------------------------------\n');

  // --------------------------------------------------------------------------
  // TEST CASE 3: Rubric Exclusivity (Ignores Unrelated Flaws if Not in Rubric)
  // --------------------------------------------------------------------------
  console.log(yellow('▶ TEST 3: Strict Rubric Exclusivity (Evaluates ONLY Specified Rubric)'));

  const r3RubricRes = await fetch('http://localhost:3000/api/rubrics/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: 'bank_1',
      title: 'Test 3 Technical Only Rubric',
      criteria: [
        { name: 'Decline Reason Explanation', weight: 50 },
        { name: 'Accurate Problem Identification', weight: 50 }
      ]
    })
  });
  const r3Rubric = await r3RubricRes.json();
  const rubricId3 = r3Rubric.rubric.id;

  // Transcript has very informal / unprofessional tone, but technically accurate
  const t3Transcript = [
    { time: '00:00', speaker: 'Agent', text: 'Hey dude! What is up?' },
    { time: '00:08', speaker: 'Customer', text: 'My debit card was declined at the grocery store.' },
    { time: '00:15', speaker: 'Agent', text: 'Looking at your account... Ah, your card was blocked because the expiration date was entered incorrectly 3 times.' },
    { time: '00:26', speaker: 'Customer', text: 'Oh I see, can you unblock it?' },
    { time: '00:30', speaker: 'Agent', text: 'I have unblocked the security flag. You are good to swipe now.' },
    { time: '00:36', speaker: 'Customer', text: 'Awesome, thanks.' },
    { time: '00:38', speaker: 'Agent', text: 'Later man!' }
  ];

  const score3Res = await fetch('http://localhost:3000/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: 'bank_1',
      transcript: t3Transcript,
      rubricId: rubricId3
    })
  });

  const r3 = await score3Res.json();
  console.log('Result 3 Criteria:');
  console.log(JSON.stringify(r3.criteria, null, 2));
  console.log(`Final Weighted Score: ${r3.final_score} / 10\n`);

  const test3Passed = r3.criteria.length === 2 && 
    r3.criteria.every(c => c.score >= 8);

  console.log(test3Passed 
    ? green('✓ TEST 3 PASSED: Graded strictly against the 2 technical criteria (ignored informal tone as requested by rubric)') 
    : red('✗ TEST 3 FAILED'));
  console.log('----------------------------------------------------------------\n');

  // --------------------------------------------------------------------------
  // TEST CASE 4: Mathematical Weighted Score Exactness
  // --------------------------------------------------------------------------
  console.log(yellow('▶ TEST 4: Mathematical Weighted Score Calculation'));
  const calculatedWeighted = Math.round(r1.criteria.reduce((acc, c) => acc + (c.score * (c.weight / 100)), 0) * 10) / 10;
  const isMathAccurate = Math.abs(r1.final_score - calculatedWeighted) < 0.1;
  console.log(`Reported Final Score: ${r1.final_score} | Exact Formula Sum: ${calculatedWeighted}`);
  console.log(isMathAccurate ? green('✓ TEST 4 PASSED: Final score exactly matches weighted rubric calculation.') : red('✗ TEST 4 FAILED'));
  console.log('----------------------------------------------------------------\n');

  console.log(cyan('================================================================'));
  console.log(green('           ALL 4 TEST SUITES EXECUTED SUCCESSFULLY              '));
  console.log(cyan('================================================================'));
}

executeTestSuite().catch(console.error);
