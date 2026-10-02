import type { Citation, Evidence } from "./types";

export const WINDOW_RADIUS = 120;

interface NormalizedText {
  normalized: string;
  origOffsets: number[];
}

function isWhitespace(ch: string): boolean {
  return (
    ch === " " ||
    ch === "\t" ||
    ch === "\n" ||
    ch === "\r" ||
    ch === "\f" ||
    ch === "\v" ||
    ch === "\u00a0"
  );
}

function normalizeWithMap(text: string): NormalizedText {
  const normalized: string[] = [];
  const origOffsets: number[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === undefined) break;
    if (isWhitespace(ch)) {
      const runStart = i;
      while (i < n) {
        const c = text[i];
        if (c === undefined || !isWhitespace(c)) break;
        i += 1;
      }
      normalized.push(" ");
      origOffsets.push(runStart);
    } else {
      normalized.push(ch);
      origOffsets.push(i);
      i += 1;
    }
  }
  while (normalized.length > 0 && normalized[normalized.length - 1] === " ") {
    normalized.pop();
    origOffsets.pop();
  }
  while (normalized.length > 0 && normalized[0] === " ") {
    normalized.shift();
    origOffsets.shift();
  }
  return { normalized: normalized.join(""), origOffsets };
}

function normalize(text: string): string {
  return normalizeWithMap(text).normalized;
}

export function captureWindow(
  quote: string,
  pageText: string,
  radius: number = WINDOW_RADIUS,
): string {
  const { normalized: normPage, origOffsets } = normalizeWithMap(pageText);
  const { normalized: normQuote } = normalizeWithMap(quote);
  if (normQuote.length === 0) return "";
  const matchStart = normPage.indexOf(normQuote);
  if (matchStart === -1) return "";
  const matchEnd = matchStart + normQuote.length;
  const startNormIdx = matchStart;
  const endNormIdx = matchEnd - 1;
  const origStart = origOffsets[startNormIdx] ?? 0;
  const origEndExclusive = (origOffsets[endNormIdx] ?? pageText.length - 1) + 1;
  const winStart = Math.max(0, origStart - radius);
  const winEnd = Math.min(pageText.length, origEndExclusive + radius);
  return pageText.slice(winStart, winEnd);
}

export function verifyCitation(citation: Citation, pageText: string): Evidence | null {
  const normQuote = normalize(citation.quote);
  if (normQuote.length === 0) return null;
  const normPage = normalize(pageText);
  if (!normPage.includes(normQuote)) return null;
  return {
    documentId: citation.documentId,
    page: citation.page,
    quote: citation.quote,
    surroundingWindow: captureWindow(citation.quote, pageText),
  };
}
