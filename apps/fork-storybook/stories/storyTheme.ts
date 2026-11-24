import { FORK_GLASS_3D_MODE_LABELS, type ForkGlass3dMode } from "~/custom/forkGlass3d";
import {
  BASIC_APPEARANCES,
  BASIC_OPTIONS,
  type BasicAppearance,
  COOL_DARKER_LABEL,
  INLET_COLOR_OPTIONS,
  INLET_COLORS,
  INLET_LABEL,
  type InletColor,
} from "~/custom/forkTheme";

/** What the toolbar's Theme picks: Basic at an appearance, Glass (Full 3D or Flat), or an Inlet
    colour. */
export type StoryTheme =
  | { readonly palette: "basic"; readonly appearance: BasicAppearance }
  | { readonly palette: "glass"; readonly glass3d: ForkGlass3dMode }
  | { readonly palette: "inlet"; readonly color: InletColor };

/** The toolbar's choices, in Settings › Appearance's order: Basic's tones, Glass, Inlet's colours. */
export const STORY_THEME_ITEMS = [
  ...BASIC_APPEARANCES.map((appearance) => ({
    value: `basic_${appearance}`,
    title: `Basic · ${BASIC_OPTIONS[appearance].label}`,
    right: appearance,
  })),
  {
    value: "glass",
    title: `${COOL_DARKER_LABEL} · ${FORK_GLASS_3D_MODE_LABELS.full}`,
    right: "dark",
  },
  {
    value: "glass_off",
    title: `${COOL_DARKER_LABEL} · ${FORK_GLASS_3D_MODE_LABELS.off}`,
    right: "dark",
  },
  ...INLET_COLORS.map((color) => ({
    value: `inlet_${color}`,
    title: `${INLET_LABEL} · ${INLET_COLOR_OPTIONS[color].label}`,
    right: INLET_COLOR_OPTIONS[color].appearance,
  })),
];

/** Flat Glass, the primary theme: what the library opens on. */
export const DEFAULT_STORY_THEME = "glass_off";

/** The toolbar's theme, the one reader of `globals.theme` for the preview and the stories. */
export function storyTheme(globals: Readonly<Record<string, unknown>>): StoryTheme {
  const raw = globals["theme"];
  const value = STORY_THEME_ITEMS.some((item) => item.value === raw)
    ? (raw as string)
    : DEFAULT_STORY_THEME;
  if (value === "glass") return { palette: "glass", glass3d: "full" };
  if (value === "glass_off") return { palette: "glass", glass3d: "off" };
  const [palette, choice] = value.split("_");
  if (palette === "inlet" && (INLET_COLORS as ReadonlyArray<string>).includes(choice ?? "")) {
    return { palette: "inlet", color: choice as InletColor };
  }
  if (palette === "basic" && (BASIC_APPEARANCES as ReadonlyArray<string>).includes(choice ?? "")) {
    return { palette: "basic", appearance: choice as BasicAppearance };
  }
  return { palette: "basic", appearance: "dark" };
}

/** A key that changes with every theme, for stories that read computed tokens once on mount. */
export function storyThemeKey(globals: Readonly<Record<string, unknown>>): string {
  const theme = storyTheme(globals);
  return theme.palette === "basic"
    ? `basic_${theme.appearance}`
    : theme.palette === "inlet"
      ? `inlet_${theme.color}`
      : theme.glass3d === "off"
        ? "glass_off"
        : "glass";
}

/** Basic's appearance for the Basic-only stories (the ramp, the tone table); null under Glass or
    Inlet. */
export function storyBasicAppearance(
  globals: Readonly<Record<string, unknown>>,
): BasicAppearance | null {
  const theme = storyTheme(globals);
  return theme.palette === "basic" ? theme.appearance : null;
}
