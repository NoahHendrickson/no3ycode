/**
 * Words the live status line rotates through instead of "Thinking" — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. Web keeps the same list in
 * `apps/web/src/custom/forkThinkingWords.ts`.
 */
export const NO3Y_THINKING_WORDS = [
  "Yapping",
  "Mogging",
  "Yearning",
  "Making it pop",
  "Cooking",
  "Locking in",
  "Glazing",
  "Rizzing",
  "Aura farming",
  "Gaslighting",
  "Gatekeeping",
  "Manifesting",
  "Delulu-ing",
  "Vibe checking",
  "Sending it",
  "Lowkey thinking",
  "Main charactering",
  "Understanding the assignment",
  "Slaying",
  "Serving",
  "Eating",
  "Mewing",
  "Looksmaxxing",
  "Brainmaxxing",
] as const;

const ROTATE_MS = 4_000;

/** The turn's start picks its first word, so turns don't all open on the same one. */
export function no3yThinkingWord(startedAt: string, nowMs: number): string {
  let hash = 0;
  for (const char of startedAt) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const startedAtMs = Date.parse(startedAt);
  const elapsedMs = Number.isFinite(startedAtMs) ? Math.max(0, nowMs - startedAtMs) : 0;
  const index = (Math.abs(hash) + Math.floor(elapsedMs / ROTATE_MS)) % NO3Y_THINKING_WORDS.length;
  return NO3Y_THINKING_WORDS[index] ?? "Thinking";
}
