import { parseLlmJson } from './safe-json-parser';

export interface TranscriptSegment {
  time: string;
  text: string;
  speaker?: string;
}

export interface RubricCriterion {
  name: string;
  weight: number;
}

export interface EvaluatedCriterion {
  name: string;
  weight?: number;
  score: number; // 0 to 10
  reason: string; // short explanation (1-2 lines)
  timestamp: string; // "MM:SS"
}

export interface JudgeResult {
  final_score: number; // Computed weighted sum: sum(score * weight / 100)
  criteria: EvaluatedCriterion[];
}

/**
 * Formats a rubric JSON object or criteria array into a clean prompt string:
 * - Greeting & Verification (15%)
 * - Empathy (25%)
 */
export function formatRubricForPrompt(
  rubric: { criteria: RubricCriterion[] } | RubricCriterion[]
): string {
  const list = Array.isArray(rubric) ? rubric : rubric?.criteria || [];
  return list.map((c) => `- ${c.name} (${c.weight}%)`).join('\n');
}

/**
 * Strict Call Quality Evaluator (LLM Judge)
 */
export async function evaluateTranscriptWithJudge(params: {
  transcript: TranscriptSegment[] | string;
  criteria: RubricCriterion[];
  apiKey: string;
  model?: string;
}): Promise<JudgeResult> {
  const {
    transcript,
    criteria,
    apiKey,
    model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  } = params;

  // 1. Format timestamped transcript
  const formattedTranscript = Array.isArray(transcript)
    ? transcript
        .map((seg) => `[${seg.time || '00:00'}] ${seg.speaker ? `${seg.speaker}: ` : ''}${seg.text}`)
        .join('\n')
    : String(transcript);

  // 2. Format rubric specification
  const formattedRubric = formatRubricForPrompt(criteria);

  // 3. Exact System Prompt
  const systemPrompt = `You are a strict call quality evaluator for a bank.

You are given:
1. A call transcript with timestamps
2. A scoring rubric with criteria and weights

Your task:
- Evaluate the call ONLY based on the rubric
- Score each criterion from 0 to 10
- Provide a short, specific reason (1–2 lines)
- Reference an exact timestamp from the transcript as evidence

STRICT RULES:
- Be critical and realistic (do NOT give high scores by default)
- Use only evidence from transcript
- If a criterion is missing, give a low score (0–4)
- Do NOT hallucinate timestamps
- Keep reasoning concise and factual

Return ONLY valid JSON in this format:

{
  "criteria": [
    {
      "name": "criterion name",
      "score": number,
      "reason": "short explanation",
      "timestamp": "MM:SS"
    }
  ]
}`;

  // 4. User Prompt
  const userPrompt = `### SCORING RUBRIC:
${formattedRubric}

### CALL TRANSCRIPT WITH TIMESTAMPS:
${formattedTranscript}

Return ONLY the valid JSON object.`;

  // 5. Call LLM with zero temperature for deterministic grading
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.0,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM Judge API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('Empty response from LLM Judge');
  }

  const parsed: { criteria: EvaluatedCriterion[] } = parseLlmJson<{ criteria: EvaluatedCriterion[] }>(rawContent);

  // Map weights back and compute overall weighted final_score
  const criteriaWeightMap = new Map(criteria.map((c) => [c.name.toLowerCase().trim(), c.weight]));

  let weightedSum = 0;
  let totalWeightFound = 0;

  const evaluatedCriteria: EvaluatedCriterion[] = (parsed.criteria || []).map((item) => {
    const weight = criteriaWeightMap.get(item.name.toLowerCase().trim()) ?? 0;
    const score = Number(item.score) || 0;

    weightedSum += score * (weight / 100);
    totalWeightFound += weight;

    return {
      name: item.name,
      weight,
      score,
      reason: item.reason,
      timestamp: item.timestamp,
    };
  });

  const finalScore = totalWeightFound > 0
    ? Math.round(weightedSum * 10) / 10
    : Math.round(((evaluatedCriteria.reduce((acc, c) => acc + c.score, 0) / (evaluatedCriteria.length || 1))) * 10) / 10;

  return {
    final_score: finalScore,
    criteria: evaluatedCriteria,
  };
}
