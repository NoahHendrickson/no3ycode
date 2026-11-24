/**
 * The fork's theme cards — see `.fork/customizations.yaml#fork-basic-theme`. Settings leads with
 * these: Basic, Glass or Inlet, each a wireframe of its own surfaces, then the picked theme's own
 * options below.
 */

import { ThemeWireframe } from "../components/settings/ThemeWireframe";
import type { ThemeCardPreviewColors } from "../components/settings/ThemePreviewCircles";
import { cn } from "../lib/utils";
import {
  BASIC_OPTIONS,
  BASIC_THEME,
  type BasicAppearance,
  COOL_DARKER_THEME,
  FORK_PALETTE_LABELS,
  FORK_PALETTES,
  type ForkPalette,
  type ForkPalettePreference,
  INLET_COLOR_OPTIONS,
  INLET_THEME,
  type InletColor,
} from "./forkTheme";
import type { ForkGlass3dMode } from "./forkGlass3d";

const FORK_PALETTE_DESCRIPTIONS = {
  [BASIC_THEME]: "One colour, light borders.",
  [COOL_DARKER_THEME]: "The desktop shows through.",
  [INLET_THEME]: "The chat set into a frame.",
} as const satisfies Record<ForkPalette, string>;

/** Basic's ladder in miniature: the base with its ink laid over it, as theme.custom.basic.css. */
function basicPreview(appearance: BasicAppearance): ThemeCardPreviewColors {
  const { base } = BASIC_OPTIONS[appearance];
  const ink = appearance === "dark" ? "#ffffff" : "#000000";
  const lift = (percent: number) => `color-mix(in srgb, ${ink} ${percent}%, ${base})`;
  return {
    sidebar: base,
    canvas: base,
    surface: appearance === "dark" ? lift(8) : `color-mix(in srgb, #ffffff 80%, ${base})`,
    accentSurface: lift(8),
    accent: lift(16),
    messageSurface: lift(12),
    messageAction: appearance === "dark" ? "#ffffff" : "#000000",
  };
}

function previewFor(
  palette: ForkPalette,
  basicAppearance: BasicAppearance,
  inletColor: InletColor,
  glass3d: ForkGlass3dMode,
) {
  if (palette === BASIC_THEME) return basicPreview(basicAppearance);
  if (palette === COOL_DARKER_THEME) {
    if (glass3d === "off") {
      const base = "#1d1d1d";
      const lift = (percent: number) => `color-mix(in srgb, #ffffff ${percent}%, ${base})`;
      return {
        sidebar: base,
        canvas: base,
        surface: lift(8),
        accentSurface: lift(8),
        accent: lift(16),
        messageSurface: lift(4),
        messageAction: "#ffffff",
      };
    }
    return {
      sidebar: "#181b1e",
      canvas: "#141618",
      surface: "#222629",
      accentSurface: "#282d30",
      accent: "#2c3134",
      messageSurface: "#282d30",
      messageAction: "#ffffff",
    };
  }
  const { frame } = INLET_COLOR_OPTIONS[inletColor];
  return {
    sidebar: frame,
    canvas: frame,
    surface: "#37393c",
    accentSurface: "#3a3c3f",
    accent: "#3a3c3f",
    messageSurface: "#303235",
    messageAction: "#ffffff",
  };
}

export function ForkThemePicker(props: {
  readonly value: ForkPalettePreference;
  readonly basicAppearance: BasicAppearance;
  readonly inletColor: InletColor;
  readonly glass3d?: ForkGlass3dMode;
  readonly onChange: (palette: ForkPalette) => void;
}) {
  return (
    <div aria-label="Theme" className="grid w-full grid-cols-3 gap-3" role="group">
      {FORK_PALETTES.map((palette) => {
        const isActive = props.value === palette;
        return (
          <button
            aria-pressed={isActive}
            className={cn(
              "flex cursor-pointer flex-col items-stretch gap-2 rounded-xl border p-2 text-left outline-none transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-7 focus-visible:outline-foreground/60",
              // The pick is the most solid card, never the most see-through (accent is a faint tint
              // in Basic and Glass, so a fill built from it vanished); hover lifts the outline,
              // which reads in every palette because it follows the foreground.
              isActive
                ? "border-transparent bg-card ring-2 ring-inset ring-ring"
                : "border-border/70 bg-card/60 hover:border-foreground/24",
            )}
            key={palette}
            onClick={() => props.onChange(palette)}
            type="button"
          >
            <ThemeWireframe
              className="h-[7.5rem]"
              panes={[
                {
                  colors: previewFor(
                    palette,
                    props.basicAppearance,
                    props.inletColor,
                    props.glass3d ?? "full",
                  ),
                },
              ]}
            />
            <span className="flex flex-col gap-0.5 px-0.5 pb-0.5">
              <span
                className={cn(
                  "text-sm font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {FORK_PALETTE_LABELS[palette]}
              </span>
              <span className="text-xs text-muted-foreground">
                {FORK_PALETTE_DESCRIPTIONS[palette]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
