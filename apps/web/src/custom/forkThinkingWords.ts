/**
 * Words the live status line rotates through instead of "Thinking" — see
 * `.fork/customizations.yaml#fork-working-row-last`. Mobile keeps a copy in
 * `apps/mobile/fork/no3yThinkingWords.ts`.
 */
export const FORK_THINKING_WORDS = [
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
export function forkThinkingWord(startedAt: string, nowMs: number): string {
  let hash = 0;
  for (const char of startedAt) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const startedAtMs = Date.parse(startedAt);
  const elapsedMs = Number.isFinite(startedAtMs) ? Math.max(0, nowMs - startedAtMs) : 0;
  const index = (Math.abs(hash) + Math.floor(elapsedMs / ROTATE_MS)) % FORK_THINKING_WORDS.length;
  return FORK_THINKING_WORDS[index] ?? "Thinking";
}
