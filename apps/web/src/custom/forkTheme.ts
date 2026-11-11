/**
 * Fork dark-palette preferences — see `.fork/customizations.yaml#fork-cool-dark-theme`,
 * `#fork-cool-darker-theme`, `#fork-neutral-dark-theme`, `#fork-neutral-darker-theme`, and
 * `#fork-inlet-theme`.
 *
 * Westworld / Glass / Neutral Dark / Neutral Darker / Inlet are CSS palette overlays
 * (`data-fork-theme` over upstream's dark or light), not upstream theme definitions. Upstream
 * `t3code:theme` may contain a standard, built-in, or imported theme id; this
 * module owns `t3code:fork-theme`
 * (`cool-dark` | `cool-darker` | `neutral-dark` | `neutral-darker` | `inlet` | absent)
 * and the DOM attribute.
 *
 * The storage ids predate the labels: Westworld is persisted as `cool-dark`
 * and Glass as `cool-darker`. They are user preferences already on disk and
 * the fence ids across index.html / SettingsPanels are named after them, so
 * renaming the label never renames the key.
 *
 * Inlet is a template with a colour (`t3code:fork-inlet-color`, stamped as
 * `data-fork-inlet-color`). Each colour names the upstream appearance it sits
 * on: Charcoal is dark, Green is light (its panel is cream with dark ink, and
 * Tailwind's `dark:` variant reaches every descendant of a `.dark` root, so a
 * light panel cannot live under one). Every other palette is dark.
 */

import { useCallback, useSyncExternalStore } from "react";

import {
  readThemePreference,
  setAppearanceMode,
  setForkDesktopThemeOverride,
  subscribeToThemeChanges,
  syncBrowserChromeTheme,
} from "../hooks/useTheme";
import { setActiveForkPalette } from "./forkActivePalette";
import { syncForkGlassFloorColor } from "./forkGlassFloorColor";
import { syncForkGlassPopupCutout } from "./forkGlassPopupCutout";
import { isForkSidebarVibrancyApplied, syncForkSidebarVibrancy } from "./forkSidebarVibrancy";
import type { ThemePreference } from "../themePalette";

export const FORK_THEME_ATTRIBUTE = "data-fork-theme";
export const FORK_PALETTE_STORAGE_KEY = "t3code:fork-theme";
const UPSTREAM_THEME_STORAGE_KEY = "t3code:theme";

export const COOL_DARK_THEME = "cool-dark" as const;
export const COOL_DARK_LABEL = "Westworld";
/** Pre-paint / overscroll colour for Westworld — matches stage `--background`. */
export const COOL_DARK_BACKGROUND = "#26272c";

export const COOL_DARKER_THEME = "cool-darker" as const;
export const COOL_DARKER_LABEL = "Glass";
/** Pre-paint / overscroll colour for Glass — matches stage `--background`. */
export const COOL_DARKER_BACKGROUND = "#141618";

export const NEUTRAL_DARK_THEME = "neutral-dark" as const;
export const NEUTRAL_DARK_LABEL = "Neutral Dark";
/** Pre-paint / overscroll colour for Neutral Dark — matches stage `--background`. */
export const NEUTRAL_DARK_BACKGROUND = "#2c2a27";

export const NEUTRAL_DARKER_THEME = "neutral-darker" as const;
export const NEUTRAL_DARKER_LABEL = "Neutral Darker";
/** Pre-paint / overscroll colour for Neutral Darker — matches stage `--background`. */
export const NEUTRAL_DARKER_BACKGROUND = "#1a1a1a";

export const INLET_THEME = "inlet" as const;
export const INLET_LABEL = "Inlet";
/** Pre-paint / overscroll colour for Inlet's default colour — the frame, stage `--background`. */
export const INLET_BACKGROUND = "#232322";

const INLET_COLOR_STORAGE_KEY = "t3code:fork-inlet-color";
export const INLET_COLOR_ATTRIBUTE = "data-fork-inlet-color";
export const INLET_COLORS = [
  "charcoal",
  "green",
  "jungle",
  "jungle-light",
  "cream",
  "black",
] as const;
export type InletColor = (typeof INLET_COLORS)[number];
export const DEFAULT_INLET_COLOR: InletColor = "charcoal";
/** One entry per colour. `frame` is the pre-paint colour; index.html carries the same table, so
    a new colour is a row there too. `chrome` is the native window chrome's appearance, which
    differs from `appearance` where the frame is light on a dark page. */
export const INLET_COLOR_OPTIONS: Readonly<
  Record<
    InletColor,
    {
      readonly label: string;
      readonly frame: string;
      readonly swatch: string;
      readonly appearance: "dark" | "light";
      readonly chrome: "dark" | "light";
    }
  >
> = {
  charcoal: {
    label: "Charcoal",
    frame: INLET_BACKGROUND,
    swatch: INLET_BACKGROUND,
    appearance: "dark",
    chrome: "dark",
  },
  green: {
    label: "Green",
    frame: "#21835c",
    swatch: "#21835c",
    appearance: "light",
    chrome: "light",
  },
  // The panel is a picture, so the swatch shows the cream frame beside its green.
  jungle: {
    label: "Jungle Art",
    frame: "#f2f0d8",
    swatch: "linear-gradient(135deg, #f2f0d8 50%, #248f6b 50%)",
    appearance: "dark",
    chrome: "light",
  },
  // Jungle Art turned inside out: Green's stage, the art behind the frame.
  "jungle-light": {
    label: "Jungle Light",
    frame: "#21835c",
    swatch: "linear-gradient(135deg, #21835c 50%, #f1f0e0 50%)",
    appearance: "light",
    chrome: "light",
  },
  // Inverses of each other: half frame, half panel.
  cream: {
    label: "Cream",
    frame: "#f8f3d8",
    swatch: "linear-gradient(90deg, #f8f3d8 50%, #141414 50%)",
    appearance: "dark",
    chrome: "light",
  },
  black: {
    label: "Black",
    frame: "#141414",
    swatch: "linear-gradient(90deg, #141414 50%, #f8f3d8 50%)",
    appearance: "light",
    chrome: "light",
  },
};

export const FORK_PALETTES = [
  COOL_DARK_THEME,
  COOL_DARKER_THEME,
  NEUTRAL_DARK_THEME,
  NEUTRAL_DARKER_THEME,
  INLET_THEME,
] as const;
export type ForkPalette = (typeof FORK_PALETTES)[number];
export type ForkPalettePreference = ForkPalette | null;
export type AppearanceOption = "light" | "dark" | ForkPalette | "system";
export type ResolvedAppearanceOption = AppearanceOption | ThemePreference;

/** Settings derives its fork Appearance options from this — one row per palette. */
export const FORK_PALETTE_LABELS = {
  [COOL_DARK_THEME]: COOL_DARK_LABEL,
  [COOL_DARKER_THEME]: COOL_DARKER_LABEL,
  [NEUTRAL_DARK_THEME]: NEUTRAL_DARK_LABEL,
  [NEUTRAL_DARKER_THEME]: NEUTRAL_DARKER_LABEL,
  [INLET_THEME]: INLET_LABEL,
} as const satisfies Record<ForkPalette, string>;

type AttributeRoot = {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

let listeners: Array<() => void> = [];
let lastPalette: ForkPalettePreference | undefined;
let initialized = false;

function emitChange() {
  for (const listener of listeners) listener();
}

export function isForkPalette(value: string | null | undefined): value is ForkPalette {
  return value != null && (FORK_PALETTES as readonly string[]).includes(value);
}

function isInletColor(value: string | null | undefined): value is InletColor {
  return value != null && (INLET_COLORS as readonly string[]).includes(value);
}

/** The upstream appearance a palette sits on. */
export function forkPaletteAppearance(
  palette: ForkPalette,
  inletColor: InletColor = DEFAULT_INLET_COLOR,
): "dark" | "light" {
  return palette === INLET_THEME ? INLET_COLOR_OPTIONS[inletColor].appearance : "dark";
}

function readInletColor(): InletColor {
  if (typeof window === "undefined") return DEFAULT_INLET_COLOR;
  try {
    const raw = window.localStorage.getItem(INLET_COLOR_STORAGE_KEY);
    return isInletColor(raw) ? raw : DEFAULT_INLET_COLOR;
  } catch {
    return DEFAULT_INLET_COLOR;
  }
}

function writeInletColor(color: InletColor): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INLET_COLOR_STORAGE_KEY, color);
  } catch {
    // The synchronization pass applies the value storage actually retained.
  }
}

function readUpstreamTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    return readThemePreference();
  } catch {
    return "system";
  }
}

/** One-time bridge for builds that stored Westworld (then Cool Dark) in `t3code:theme`. */
export function migrateLegacyCoolDarkTheme(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(UPSTREAM_THEME_STORAGE_KEY) !== COOL_DARK_THEME) {
      return;
    }
    window.localStorage.setItem(UPSTREAM_THEME_STORAGE_KEY, "dark");
    window.localStorage.setItem(FORK_PALETTE_STORAGE_KEY, COOL_DARK_THEME);
  } catch {
    // Match upstream theme reads: ignore storage failures during bootstrap.
  }
}

/** Pure preference read: migration belongs to startup, never React render. */
export function readForkPalette(): ForkPalettePreference {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FORK_PALETTE_STORAGE_KEY);
    return isForkPalette(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeForkPalette(palette: ForkPalettePreference): void {
  if (typeof window === "undefined") return;
  try {
    if (palette === null) {
      window.localStorage.removeItem(FORK_PALETTE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(FORK_PALETTE_STORAGE_KEY, palette);
    }
  } catch {
    // The synchronization pass below applies the value storage actually retained.
  }
}

export function applyForkPaletteAttribute(
  root: AttributeRoot,
  palette: ForkPalettePreference,
): void {
  if (palette !== null) {
    root.setAttribute(FORK_THEME_ATTRIBUTE, palette);
    return;
  }
  root.removeAttribute(FORK_THEME_ATTRIBUTE);
}

/** `isDark` is the rendered appearance (the root's `dark` class), which System can turn away
    from `theme`; without it, the theme's own. */
export function resolveActiveForkPalette({
  theme,
  palette,
  isDark = theme === "dark",
  inletColor = DEFAULT_INLET_COLOR,
}: {
  readonly theme: ThemePreference;
  readonly palette: ForkPalettePreference;
  readonly isDark?: boolean;
  readonly inletColor?: InletColor;
}): ForkPalettePreference {
  if (palette === null) return null;
  const appearance = forkPaletteAppearance(palette, inletColor);
  return theme === appearance && isDark === (appearance === "dark") ? palette : null;
}

export function resolveAppearanceOption(
  theme: ThemePreference,
  palette: ForkPalettePreference,
  inletColor: InletColor = DEFAULT_INLET_COLOR,
): ResolvedAppearanceOption {
  return resolveActiveForkPalette({ theme, palette, inletColor }) ?? theme;
}

function getPaletteSnapshot(): ForkPalettePreference {
  const palette = readForkPalette();
  if (lastPalette === palette) return lastPalette ?? null;
  lastPalette = palette;
  return palette;
}

function subscribePalette(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
  };
}

/** A storage event reports another window's writes one key at a time, so mid-change it can see a
    palette beside the theme it is leaving. Only this window's own writes may clear the palette. */
function isOtherWindowWrite(): boolean {
  return typeof window !== "undefined" && window.event?.type === "storage";
}

/** Reconcile the DOM and React subscribers to values storage actually retained. */
function syncForkPaletteFromStorage(): void {
  const theme = readUpstreamTheme();
  const inletColor = readInletColor();
  let palette = readForkPalette();
  if (
    palette !== null &&
    theme !== forkPaletteAppearance(palette, inletColor) &&
    !isOtherWindowWrite()
  ) {
    writeForkPalette(null);
    palette = readForkPalette();
  }
  const activePalette = resolveActiveForkPalette({
    theme,
    palette,
    isDark: typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
    inletColor,
  });
  if (typeof document !== "undefined") {
    applyForkPaletteAttribute(document.documentElement, activePalette);
    if (activePalette === INLET_THEME) {
      document.documentElement.setAttribute(INLET_COLOR_ATTRIBUTE, inletColor);
    } else {
      document.documentElement.removeAttribute(INLET_COLOR_ATTRIBUTE);
    }
    setForkDesktopThemeOverride(
      activePalette === INLET_THEME ? inletChromeOverride(inletColor) : null,
    );
    // Synchronous, inside the suppressed-transition window: switching between
    // two fork palettes keeps upstream theme at "dark", so applyTheme no-ops
    // and this is the only repaint of html/body overscroll and theme-color.
    syncBrowserChromeTheme();
    // Native window glass rides an async IPC round trip, so it deliberately
    // lands outside the synchronous repaint above. The helper stamps its own
    // marker from the resolved answer; nothing here waits on it.
    //
    // Which palettes want glass is decided here rather than in the helper: this
    // module owns palette semantics, and keeping the knowledge on this side is
    // what lets the helper import nothing back from it.
    // The overlays' floor colour and the popup cutout follow whether the
    // window actually got the material. They read the marker, not this call's
    // answer: a superseded sync resolves with its own stale result, and only
    // the newest may stamp. Started independently, so one failing never
    // skips the other.
    // Both are cosmetic: a failure in either must never surface as an
    // unhandled rejection out of a palette change.
    void syncForkSidebarVibrancy(activePalette === COOL_DARKER_THEME)
      .then(() => {
        const glassOn = isForkSidebarVibrancyApplied();
        void syncForkGlassFloorColor(glassOn).catch(() => undefined);
        syncForkGlassPopupCutout(glassOn);
      })
      .catch(() => undefined);
  }
  setActiveForkPalette(activePalette);
  lastPalette = palette;
  emitChange();
}

function suppressAppearanceTransitions(update: () => void): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    update();
    return;
  }

  const root = document.documentElement;
  root.classList.add("no-transitions");
  update();
  // Force a reflow so every palette-driven property changes while suppression is active.
  // oxlint-disable-next-line no-unused-expressions
  root.offsetHeight;
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => root.classList.remove("no-transitions"));
  } else {
    root.classList.remove("no-transitions");
  }
}

/** Upstream keeps the light/dark mode apart from the theme and setTheme preserves it, so a
    palette that sits on the other appearance has to move the mode as well. Only on a
    mismatch, so a palette chosen under System keeps following it, unless `pin`: a colour that
    restyles the native chrome cannot follow System, which that override flips (useTheme.ts). */
function settleAppearance(
  wanted: "dark" | "light",
  setTheme: (theme: ThemePreference) => boolean,
  pin = false,
): void {
  setTheme(wanted);
  if (
    typeof document !== "undefined" &&
    (pin || document.documentElement.classList.contains("dark") !== (wanted === "dark"))
  ) {
    setAppearanceMode(wanted);
  }
}

/** The native chrome a colour asks for, where it differs from the page's appearance. */
function inletChromeOverride(color: InletColor): "dark" | "light" | null {
  const { appearance, chrome } = INLET_COLOR_OPTIONS[color];
  return chrome === appearance ? null : chrome;
}

function settleInletColor(color: InletColor, setTheme: (theme: ThemePreference) => boolean) {
  settleAppearance(
    INLET_COLOR_OPTIONS[color].appearance,
    setTheme,
    inletChromeOverride(color) !== null,
  );
}

/** Apply an Appearance option and reconcile partial storage failures to one visible state. */
export function setForkAppearance(
  next: AppearanceOption,
  setTheme: (theme: ThemePreference) => boolean,
): void {
  suppressAppearanceTransitions(() => {
    const leaving = readForkPalette();
    const inletColor = readInletColor();
    writeForkPalette(isForkPalette(next) ? next : null);
    if (next === INLET_THEME) {
      settleInletColor(inletColor, setTheme);
    } else if (isForkPalette(next)) {
      settleAppearance(forkPaletteAppearance(next, inletColor), setTheme);
    } else if (
      next === "dark" &&
      leaving !== null &&
      forkPaletteAppearance(leaving, inletColor) === "light"
    ) {
      // Default Dark after a light Inlet colour: undo the mode that colour moved.
      settleAppearance("dark", setTheme);
    } else {
      setTheme(next);
    }
    syncForkPaletteFromStorage();
  });
}

/** Pick Inlet's colour; while Inlet is on, move upstream to the colour's appearance with it. */
export function setForkInletColor(
  color: InletColor,
  setTheme: (theme: ThemePreference) => boolean,
): void {
  suppressAppearanceTransitions(() => {
    writeInletColor(color);
    if (readForkPalette() === INLET_THEME) settleInletColor(color, setTheme);
    syncForkPaletteFromStorage();
  });
}

/**
 * Start the document-level palette owner after the fork marker is stamped.
 * React subscriptions only report state; this listener keeps every route and tab painted.
 */
export function initializeForkTheme(): void {
  if (initialized || typeof window === "undefined" || typeof document === "undefined") return;
  initialized = true;
  migrateLegacyCoolDarkTheme();
  syncForkPaletteFromStorage();
  subscribeToThemeChanges(syncForkPaletteFromStorage);
  window.addEventListener("storage", (event) => {
    if (event.key === FORK_PALETTE_STORAGE_KEY || event.key === INLET_COLOR_STORAGE_KEY) {
      syncForkPaletteFromStorage();
    }
  });
}

/** Appearance adapter over the upstream theme and fork palette stores. */
export function useForkAppearance(
  theme: ThemePreference,
  setTheme: (theme: ThemePreference) => boolean,
) {
  const palette = useSyncExternalStore(subscribePalette, getPaletteSnapshot, () => null);
  const inletColor = useSyncExternalStore(
    subscribePalette,
    readInletColor,
    () => DEFAULT_INLET_COLOR,
  );
  const appearance = resolveAppearanceOption(theme, palette, inletColor);

  const setAppearance = useCallback(
    (next: AppearanceOption) => setForkAppearance(next, setTheme),
    [setTheme],
  );
  const setInletColor = (next: InletColor) => setForkInletColor(next, setTheme);

  return { appearance, setAppearance, palette, inletColor, setInletColor } as const;
}
