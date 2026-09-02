export interface FormattedTranscriptItem {
  time: string; // "MM:SS" (or "HH:MM:SS" for long calls)
  text: string;
}

/**
 * Formats seconds (e.g. 75.4) into standard timestamp "MM:SS" or "HH:MM:SS".
 */
export function formatSecondsToTimestamp(totalSeconds: number = 0): string {
  const rounded = Math.floor(Math.max(0, totalSeconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}

/**
 * Transforms any Deepgram API response into a structured timestamped array:
 * [
 *   { "time": "00:01", "text": "Hello, how are you?" },
 *   { "time": "00:15", "text": "I can help with that." }
 * ]
 *
 * Guarantees timestamps are never lost by falling back across:
 * 1. results.utterances (Natural speech / turn boundaries)
 * 2. results.paragraphs (Sentence boundaries)
 * 3. results.words (Grouped word boundaries)
 * 4. results.channels.transcript (Fallback)
 */
export function transformDeepgramTranscript(deepgramResponse: any): FormattedTranscriptItem[] {
  if (!deepgramResponse?.results) {
    return [];
  }

  // 1. Primary: Utterances (most natural chunks with precise start timestamps)
  const utterances = deepgramResponse.results.utterances;
  if (Array.isArray(utterances) && utterances.length > 0) {
    const items = utterances
      .map((u: any) => ({
        time: formatSecondsToTimestamp(u.start ?? 0),
        text: (u.transcript || '').trim(),
      }))
      .filter((item: FormattedTranscriptItem) => item.text.length > 0);

    if (items.length > 0) return items;
  }

  // 2. Secondary: Paragraphs and Sentences
  const paragraphs =
    deepgramResponse.results.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs;
  if (Array.isArray(paragraphs) && paragraphs.length > 0) {
    const sentences: FormattedTranscriptItem[] = [];
    for (const p of paragraphs) {
      if (Array.isArray(p.sentences)) {
        for (const s of p.sentences) {
          const text = (s.text || '').trim();
          if (text) {
            sentences.push({
              time: formatSecondsToTimestamp(s.start ?? p.start ?? 0),
              text,
            });
          }
        }
      }
    }
    if (sentences.length > 0) return sentences;
  }

  // 3. Tertiary: Words grouped into sentences
  const words = deepgramResponse.results.channels?.[0]?.alternatives?.[0]?.words;
  if (Array.isArray(words) && words.length > 0) {
    const wordSentences: FormattedTranscriptItem[] = [];
    let currentWords: string[] = [];
    let startTime = words[0]?.start ?? 0;

    for (const w of words) {
      const punctuated = w.punctuated_word || w.word || '';
      currentWords.push(punctuated);

      // Sentence ending punctuation
      if (/[.!?]$/.test(punctuated)) {
        wordSentences.push({
          time: formatSecondsToTimestamp(startTime),
          text: currentWords.join(' ').trim(),
        });
        currentWords = [];
        startTime = w.end ?? startTime;
      }
    }

    if (currentWords.length > 0) {
      wordSentences.push({
        time: formatSecondsToTimestamp(startTime),
        text: currentWords.join(' ').trim(),
      });
    }

    if (wordSentences.length > 0) return wordSentences;
  }

  // 4. Final Fallback: Plain channel transcript
  const fallbackText =
    deepgramResponse.results.channels?.[0]?.alternatives?.[0]?.transcript;
  if (fallbackText && fallbackText.trim().length > 0) {
    return [{ time: '00:00', text: fallbackText.trim() }];
  }

  return [];
}
