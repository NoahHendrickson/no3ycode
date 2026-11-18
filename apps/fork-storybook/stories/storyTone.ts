import { BASIC_TONES, type BasicTone, DEFAULT_BASIC_TONES } from "~/custom/forkTheme";

/** The toolbar's tone, the one reader of `globals.tone` for the preview and the stories. */
export function storyTone(globals: Readonly<Record<string, unknown>>): BasicTone {
  const tone = globals["tone"];
  return (BASIC_TONES as ReadonlyArray<unknown>).includes(tone)
    ? (tone as BasicTone)
    : DEFAULT_BASIC_TONES.dark;
}
