import {
  BASIC_TONE_OPTIONS,
  BASIC_TONES,
  type BasicTone,
  COOL_DARKER_LABEL,
  DEFAULT_BASIC_TONES,
  INLET_COLOR_OPTIONS,
  INLET_COLORS,
  INLET_LABEL,
  type InletColor,
} from "~/custom/forkTheme";

/** What the toolbar's Theme picks: a Basic tone, Glass, or an Inlet colour. */
export type StoryTheme =
  | { readonly palette: "basic"; readonly tone: BasicTone }
  | { readonly palette: "glass" }
  | { readonly palette: "inlet"; readonly color: InletColor };

/** The toolbar's choices, in Settings › Appearance's order: Basic's tones, Glass, Inlet's colours. */
export const STORY_THEME_ITEMS = [
  ...BASIC_TONES.map((tone) => ({
    value: `basic_${tone}`,
    title: `Basic · ${BASIC_TONE_OPTIONS[tone].label}`,
    right: BASIC_TONE_OPTIONS[tone].appearance,
  })),
  { value: "glass", title: COOL_DARKER_LABEL, right: "dark" },
  ...INLET_COLORS.map((color) => ({
    value: `inlet_${color}`,
    title: `${INLET_LABEL} · ${INLET_COLOR_OPTIONS[color].label}`,
    right: INLET_COLOR_OPTIONS[color].appearance,
  })),
];

export const DEFAULT_STORY_THEME = `basic_${DEFAULT_BASIC_TONES.dark}`;

/** The toolbar's theme, the one reader of `globals.theme` for the preview and the stories. */
export function storyTheme(globals: Readonly<Record<string, unknown>>): StoryTheme {
  const raw = globals["theme"];
  const value = STORY_THEME_ITEMS.some((item) => item.value === raw)
    ? (raw as string)
    : DEFAULT_STORY_THEME;
  if (value === "glass") return { palette: "glass" };
  const [palette, choice] = value.split("_");
  if (palette === "inlet" && (INLET_COLORS as ReadonlyArray<string>).includes(choice ?? "")) {
    return { palette: "inlet", color: choice as InletColor };
  }
  if (palette === "basic" && (BASIC_TONES as ReadonlyArray<string>).includes(choice ?? "")) {
    return { palette: "basic", tone: choice as BasicTone };
  }
  return { palette: "basic", tone: DEFAULT_BASIC_TONES.dark };
}

/** A key that changes with every theme, for stories that read computed tokens once on mount. */
export function storyThemeKey(globals: Readonly<Record<string, unknown>>): string {
  const theme = storyTheme(globals);
  return theme.palette === "basic"
    ? `basic_${theme.tone}`
    : theme.palette === "inlet"
      ? `inlet_${theme.color}`
      : "glass";
}

/** Basic's tone for the Basic-only stories (the ramp, the tone table); null under Glass or Inlet. */
export function storyBasicTone(globals: Readonly<Record<string, unknown>>): BasicTone | null {
  const theme = storyTheme(globals);
  return theme.palette === "basic" ? theme.tone : null;
}
