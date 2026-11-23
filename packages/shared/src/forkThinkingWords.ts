/**
 * The word the fork's live status line shows where upstream says "Thinking", on web and on the
 * no3y iOS line — see `.fork/customizations.yaml#fork-working-row-last`.
 */
const FORK_THINKING_WORDS = [
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

/** One word per seed: callers seed from what last landed, so the word holds until something does. */
export function forkThinkingWord(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return FORK_THINKING_WORDS[Math.abs(hash) % FORK_THINKING_WORDS.length] ?? "Thinking";
}
