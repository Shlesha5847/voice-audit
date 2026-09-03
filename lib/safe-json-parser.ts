/**
 * Safely extracts and parses JSON from raw LLM responses.
 * Handles markdown fences, preamble/postscript chatter, and trailing commas.
 * Throws a descriptive error if extraction or parsing fails.
 */
export function parseLlmJson<T = any>(rawResponse: string): T {
  if (!rawResponse || typeof rawResponse !== 'string') {
    throw new Error('Invalid LLM response: input is empty or not a string');
  }

  let text = rawResponse.trim();

  // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const fenceMatch = text.match(fenceRegex);
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim();
  }

  // 2. Extract outermost JSON structure ({ ... } or [ ... ])
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let startIndex = -1;
  let endIndex = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace;
    endIndex = text.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
    endIndex = text.lastIndexOf(']');
  }

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    text = text.substring(startIndex, endIndex + 1).trim();
  }

  // 3. Attempt direct parse
  try {
    return JSON.parse(text) as T;
  } catch (initialError: any) {
    // 4. Handle minor formatting issues (e.g. trailing commas before } or ])
    try {
      const sanitized = text.replace(/,\s*([\}\]])/g, '$1');
      return JSON.parse(sanitized) as T;
    } catch {
      throw new Error(
        `Failed to parse valid JSON from LLM output (${initialError.message}). Extracted text:\n${text.slice(0, 200)}...`
      );
    }
  }
}
