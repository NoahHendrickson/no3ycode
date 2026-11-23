/**
 * Words the live status line rotates through instead of "Thinking" — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. Web keeps the same list in
 * `apps/web/src/custom/forkThinkingWords.ts`.
 */
const NO3Y_THINKING_WORDS = [
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

/** One word per seed: the line keeps its word until what sits above it changes. */
export function no3yThinkingWord(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const index = Math.abs(hash) % NO3Y_THINKING_WORDS.length;
  return NO3Y_THINKING_WORDS[index] ?? "Thinking";
}
