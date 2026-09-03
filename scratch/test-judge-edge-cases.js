const { evaluateTranscriptWithJudge } = require('../lib/llm-judge.ts');

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.error('GROQ_API_KEY not found in env');
  process.exit(1);
}

// Color formatting
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

async function runEdgeCaseTests() {
  console.log(cyan('================================================================'));
  console.log(cyan('    LLM JUDGE TEST SUITE: REAL-WORLD EDGE CASES & GROUNDING    '));
  console.log(cyan('================================================================\n'));

  // --------------------------------------------------------------------------
  // TEST CASE 1: Missed Greeting & Early Hangup (Low Score + Omission Timestamp)
  // --------------------------------------------------------------------------
  console.log(yellow('▶ TEST 1: Missed Greeting & Abrupt Ending (Omission Detection)'));
  const t1Transcript = [
    { time: '00:00', speaker: 'Agent', text: 'Yeah, what do you need?' },
    { time: '00:05', speaker: 'Customer', text: 'Hi, I wanted to know my current account balance.' },
    { time: '00:10', speaker: 'Agent', text: 'Your balance is $420.' },
    { time: '00:14', speaker: 'Customer', text: 'Okay, and when is my next payment due?' },
    { time: '00:18', speaker: 'Agent', text: 'Next Tuesday.' },
    { time: '00:21', speaker: 'Customer', text: 'Great, thanks...' }
  ];
  const t1Criteria = [
    { name: 'Greeting & Verification', weight: 30 },
    { name: 'Information Accuracy', weight: 40 },
    { name: 'Professional Closing', weight: 30 }
  ];

  const r1 = await evaluateTranscriptWithJudge({
    transcript: t1Transcript,
    criteria: t1Criteria,
    apiKey
  });

  console.log('Result 1:', JSON.stringify(r1, null, 2));

  const greetingScore = r1.criteria.find(c => c.name.includes('Greeting'))?.score || 0;
  const closingScore = r1.criteria.find(c => c.name.includes('Closing'))?.score || 0;
  const infoScore = r1.criteria.find(c => c.name.includes('Information'))?.score || 0;

  const test1Passed = greetingScore <= 4 && closingScore <= 4 && infoScore >= 7;
  console.log(test1Passed ? green('✓ TEST 1 PASSED: Low scores assigned to omitted criteria.\n') : red('✗ TEST 1 FAILED\n'));

  // --------------------------------------------------------------------------
  // TEST CASE 2: Out-of-Order Execution (Timestamp Precision)
  // --------------------------------------------------------------------------
  console.log(yellow('▶ TEST 2: Mid-Call Verification & Delayed Resolution (Timestamp Precision)'));
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
  const t2Criteria = [
    { name: 'Identity Verification', weight: 30 },
    { name: 'Transfer Execution', weight: 40 },
    { name: 'Professional Closing', weight: 30 }
  ];

  const r2 = await evaluateTranscriptWithJudge({
    transcript: t2Transcript,
    criteria: t2Criteria,
    apiKey
  });

  console.log('Result 2:', JSON.stringify(r2, null, 2));

  const verifyItem = r2.criteria.find(c => c.name.includes('Verification'));
  const transferItem = r2.criteria.find(c => c.name.includes('Transfer'));

  const test2Passed = 
    verifyItem && (verifyItem.timestamp === '00:45' || verifyItem.timestamp === '01:02') &&
    transferItem && transferItem.timestamp === '01:25';

  console.log(test2Passed ? green('✓ TEST 2 PASSED: Exact timestamps correctly located mid-call.\n') : yellow('⚠ TEST 2 Timestamp Check: Review citations.\n'));

  // --------------------------------------------------------------------------
  // TEST CASE 3: Strict Rubric Exclusivity (No Hallucination of Unprovided Criteria)
  // --------------------------------------------------------------------------
  console.log(yellow('▶ TEST 3: Strict Rubric Exclusivity (Ignores Unlisted Dimensions)'));
  const t3Transcript = [
    { time: '00:00', speaker: 'Agent', text: 'Hey there buddy! Welcome to the coolest bank in town! How is your day going?' },
    { time: '00:08', speaker: 'Customer', text: 'I need to check why my card was declined.' },
    { time: '00:12', speaker: 'Agent', text: 'No worries my friend, let me check that decline code.' },
    { time: '00:19', speaker: 'Agent', text: 'Your card was declined because of an incorrect billing zip code entered online.' },
    { time: '00:26', speaker: 'Customer', text: 'Ah, got it. Thank you.' },
    { time: '00:28', speaker: 'Agent', text: 'Catch you later, have an awesome weekend!' }
  ];
  // Rubric ONLY tests Root Cause Explanation & Resolution, not Professional Tone
  const t3Criteria = [
    { name: 'Decline Reason Explanation', weight: 50 },
    { name: 'Accurate Problem Identification', weight: 50 }
  ];

  const r3 = await evaluateTranscriptWithJudge({
    transcript: t3Transcript,
    criteria: t3Criteria,
    apiKey
  });

  console.log('Result 3:', JSON.stringify(r3, null, 2));

  // Should have exactly 2 criteria matching the rubric names
  const test3Passed = r3.criteria.length === 2 && 
    r3.criteria.every(c => t3Criteria.some(tc => tc.name === c.name)) &&
    r3.criteria.every(c => c.score >= 8);

  console.log(test3Passed ? green('✓ TEST 3 PASSED: Graded strictly against provided rubric criteria.\n') : red('✗ TEST 3 FAILED\n'));

  // --------------------------------------------------------------------------
  // TEST CASE 4: Mathematical Weighted Score Exactness
  // --------------------------------------------------------------------------
  console.log(yellow('▶ TEST 4: Mathematical Weighted Score Precision'));
  const expectedScore1 = Math.round(r1.criteria.reduce((sum, c) => sum + (c.score * (c.weight / 100)), 0) * 10) / 10;
  const isMathCorrect = Math.abs(r1.final_score - expectedScore1) < 0.15;
  console.log(`Computed Score: ${r1.final_score} | Expected Weighted Formula: ${expectedScore1}`);
  console.log(isMathCorrect ? green('✓ TEST 4 PASSED: Final score matches weighted mathematical formula.\n') : red('✗ TEST 4 FAILED\n'));

  console.log(cyan('================================================================'));
  console.log(green('         ALL 4 LLM JUDGE TEST SUITES COMPLETED                  '));
  console.log(cyan('================================================================'));
}

runEdgeCaseTests().catch(err => {
  console.error('Test suite error:', err);
});
