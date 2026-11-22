/**
 * Fork theme preferences — see `.fork/customizations.yaml#fork-cool-dark-theme` (the palette
 * machinery), `#fork-basic-theme`, `#fork-cool-darker-theme` and `#fork-inlet-theme`.
 *
 * The fork has three themes: Basic, Glass and Inlet. Each is a CSS palette overlay
 * (`data-fork-theme` over upstream's dark or light), not an upstream theme definition. Upstream
 * `t3code:theme` may contain a standard, built-in, or imported theme id; this module owns
 * `t3code:fork-theme` (`basic` | `cool-darker` | `inlet`) and the DOM attribute.
 *
 * Basic is the default: an absent, unknown or retired palette id reads as Basic, and it paints
 * whenever upstream is on its standard theme (Light / Dark / System). An imported or built-in
 * upstream theme turns every fork palette off.
 *
 * Glass is persisted as `cool-darker`: the id predates the label and is a preference already on
 * disk. Westworld (`cool-dark`), Neutral Dark and Neutral Darker were retired into Basic's tones.
 *
 * Basic is one colour with a tone (`t3code:fork-basic-tone-dark` / `-light`, stamped as
 * `data-fork-basic-tone`). It keeps a tone per appearance, so under System it follows the OS
 * between the user's light tone and their dark tone.
 *
 * Inlet is a template with a colour (`t3code:fork-inlet-color`, stamped as
 * `data-fork-inlet-color`): Cream (the default) or its inverse, Black. Each colour names the
 * upstream appearance it sits on: Cream is dark, Black is light (its panel is cream with dark ink, and Tailwind's
 * `dark:` variant reaches every descendant of a `.dark` root, so a light panel cannot live under
 * one). Glass is dark.
 */

import { useCallback, useSyncExternalStore } from "react";

import {
  readAppearanceModePreference,
  readThemeHalves,
  readThemePreference,
  setAppearanceMode,
  setForkDesktopThemeOverride,
  subscribeToThemeChanges,
  syncBrowserChromeTheme,
} from "../hooks/useTheme";
import { setActiveForkPalette, useActiveForkPalette, useIsInletActive } from "./forkActivePalette";
import { syncForkGlassFloorColor } from "./forkGlassFloorColor";
import { syncForkGlassPopupCutout } from "./forkGlassPopupCutout";
import {
  isForkSidebarLiquidGlassApplied,
  isForkSidebarVibrancyApplied,
  syncForkSidebarVibrancy,
} from "./forkSidebarVibrancy";
import { syncForkTopbarHeightFromRoot } from "./forkTopbarHeight";
import type { ThemePreference } from "../themePalette";

export const FORK_THEME_ATTRIBUTE = "data-fork-theme";
export const FORK_PALETTE_STORAGE_KEY = "t3code:fork-theme";
const UPSTREAM_THEME_STORAGE_KEY = "t3code:theme";

export const BASIC_THEME = "basic" as const;
const BASIC_LABEL = "Basic";

export const COOL_DARKER_THEME = "cool-darker" as const;
export const COOL_DARKER_LABEL = "Glass";
/** Pre-paint / overscroll colour for Glass — matches stage `--background`. */
export const COOL_DARKER_BACKGROUND = "#141618";

export const INLET_THEME = "inlet" as const;
export const INLET_LABEL = "Inlet";
/** Pre-paint / overscroll colour for Inlet's default colour (Cream): its frame. */
export const INLET_BACKGROUND = "#f8f3d8";

const BASIC_TONE_STORAGE_KEYS = {
  dark: "t3code:fork-basic-tone-dark",
  light: "t3code:fork-basic-tone-light",
} as const;
export const BASIC_TONE_ATTRIBUTE = "data-fork-basic-tone";
export const BASIC_TONES = [
  "light",
  "cream",
  "darkest-warm",
  "darker-warm",
  "dark-warm",
  "darkest-cool",
  "darker-cool",
  "dark-cool",
  "darkest-neutral",
  "darker-neutral",
  "dark-neutral",
] as const;
export type BasicTone = (typeof BASIC_TONES)[number];
/** `base` is the one colour the tone is built from (theme.custom.basic.css derives every other
    surface from it); index.html carries the same table for the pre-paint, so a new tone is a
    row there too. */
export const BASIC_TONE_OPTIONS: Readonly<
  Record<
    BasicTone,
    {
      readonly label: string;
      readonly base: string;
      /** The tone's text, as theme.custom.basic.css sets --basic-text. */
      readonly text: string;
      readonly appearance: "dark" | "light";
    }
  >
> = {
  light: { label: "Light", base: "#f7f7f7", text: "#1a1a1a", appearance: "light" },
  cream: { label: "Cream", base: "#f8f3d8", text: "#1f1c16", appearance: "light" },
  "darkest-warm": { label: "Darkest Warm", base: "#1b1714", text: "#e8e8e8", appearance: "dark" },
  "darker-warm": { label: "Darker Warm", base: "#2c2a28", text: "#e8e8e8", appearance: "dark" },
  "dark-warm": { label: "Dark Warm", base: "#3e3c3a", text: "#e8e8e8", appearance: "dark" },
  "darkest-cool": { label: "Darkest Cool", base: "#16181b", text: "#e8e8e8", appearance: "dark" },
  "darker-cool": { label: "Darker Cool", base: "#202226", text: "#e8e8e8", appearance: "dark" },
  "dark-cool": { label: "Dark Cool", base: "#2e3138", text: "#e8e8e8", appearance: "dark" },
  "darkest-neutral": {
    label: "Darkest Neutral",
    base: "#171717",
    text: "#e8e8e8",
    appearance: "dark",
  },
  "darker-neutral": {
    label: "Darker Neutral",
    base: "#232323",
    text: "#e8e8e8",
    appearance: "dark",
  },
  "dark-neutral": { label: "Dark Neutral", base: "#2b2b2b", text: "#e8e8e8", appearance: "dark" },
};
export const DEFAULT_BASIC_TONES = {
  dark: "dark-neutral",
  light: "light",
} as const satisfies Record<"dark" | "light", BasicTone>;

const INLET_COLOR_STORAGE_KEY = "t3code:fork-inlet-color";
export const INLET_COLOR_ATTRIBUTE = "data-fork-inlet-color";
export const INLET_COLORS = ["black", "cream"] as const;
export type InletColor = (typeof INLET_COLORS)[number];
/** Cream, the dark-page successor of Charcoal, the old default that was usually never stored. */
export const DEFAULT_INLET_COLOR: InletColor = "cream";
/** One entry per colour. `frame` is the pre-paint colour; index.html carries the same table, so
    a new colour is a row there too. `chrome` is the native window chrome's appearance, which
    follows the frame: both colours restyle it (Cream light chrome on a dark page, Black dark
    chrome on a light page). */
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
  // Inverses of each other: half frame, half panel.
  black: {
    label: "Black",
    frame: "#141414",
    swatch: "linear-gradient(90deg, #141414 50%, #f8f3d8 50%)",
    appearance: "light",
    chrome: "dark",
  },
  cream: {
    label: "Cream",
    frame: INLET_BACKGROUND,
    swatch: "linear-gradient(90deg, #f8f3d8 50%, #141414 50%)",
    appearance: "dark",
    chrome: "light",
  },
};

export const FORK_PALETTES = [BASIC_THEME, COOL_DARKER_THEME, INLET_THEME] as const;
export type ForkPalette = (typeof FORK_PALETTES)[number];
/** The palette painted now: null while an imported or built-in upstream theme is on. */
export type ForkPalettePreference = ForkPalette | null;

/** Settings derives its theme cards from this — one card per palette. */
export const FORK_PALETTE_LABELS = {
  [BASIC_THEME]: BASIC_LABEL,
  [COOL_DARKER_THEME]: COOL_DARKER_LABEL,
  [INLET_THEME]: INLET_LABEL,
} as const satisfies Record<ForkPalette, string>;

/** Retired Inlet colours and the remaining one on the same appearance, so nobody's light/dark
    flips: the dark ones become Cream, the light ones Black. `chrome` is the native chrome
    override the retired colour asked for, which decides whether migrating moves the mode. */
const RETIRED_INLET_COLORS = {
  charcoal: { color: "cream", chrome: null },
  jungle: { color: "cream", chrome: "light" },
  green: { color: "black", chrome: null },
  "jungle-light": { color: "black", chrome: null },
} as const satisfies Record<
  string,
  { readonly color: InletColor; readonly chrome: "dark" | "light" | null }
>;

function retiredInletColor(raw: string | null) {
  return raw !== null && Object.hasOwn(RETIRED_INLET_COLORS, raw)
    ? RETIRED_INLET_COLORS[raw as keyof typeof RETIRED_INLET_COLORS]
    : undefined;
}

/** A stored colour as it paints: a retired one as its successor, so a failed migration write
    still agrees with index.html's first paint. */
function resolveInletColor(raw: string | null): InletColor {
  if (isInletColor(raw)) return raw;
  return retiredInletColor(raw)?.color ?? DEFAULT_INLET_COLOR;
}

/** Retired dark looks and the Basic tone each became: palette ids and tone ids, which never
    collide, so the palette and the stored dark tone share one lookup. */
const RETIRED_DARK_LOOKS: Readonly<Record<string, BasicTone>> = {
  "cool-dark": "dark-cool",
  "neutral-dark": "dark-neutral",
  "neutral-darker": "darkest-neutral",
  cool: "dark-cool",
  neutral: "dark-neutral",
  darker: "darkest-neutral",
};

type AttributeRoot = {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

let listeners: Array<() => void> = [];
let initialized = false;

function emitChange() {
  for (const listener of listeners) listener();
}

function isForkPalette(value: string | null | undefined): value is ForkPalette {
  return value != null && (FORK_PALETTES as readonly string[]).includes(value);
}

function isInletColor(value: string | null | undefined): value is InletColor {
  return value != null && (INLET_COLORS as readonly string[]).includes(value);
}

function isBasicTone(value: string | null | undefined): value is BasicTone {
  return value != null && (BASIC_TONES as readonly string[]).includes(value);
}

/** Upstream's standard theme, which Basic paints over; any other id is a library theme. */
function isStandardUpstreamTheme(theme: ThemePreference): boolean {
  return theme === "light" || theme === "dark" || theme === "system";
}

/** The upstream appearance a palette sits on. Basic sits on either, so it never moves it. */
export function forkPaletteAppearance(
  palette: Exclude<ForkPalette, typeof BASIC_THEME>,
  inletColor: InletColor = DEFAULT_INLET_COLOR,
): "dark" | "light" {
  return palette === INLET_THEME ? INLET_COLOR_OPTIONS[inletColor].appearance : "dark";
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // The synchronization pass applies the value storage actually retained.
  }
}

function readInletColor(): InletColor {
  return resolveInletColor(readStorage(INLET_COLOR_STORAGE_KEY));
}

/** The user's Basic tone for one appearance. */
export function readBasicTone(appearance: "dark" | "light"): BasicTone {
  const raw = readStorage(BASIC_TONE_STORAGE_KEYS[appearance]);
  return isBasicTone(raw) && BASIC_TONE_OPTIONS[raw].appearance === appearance
    ? raw
    : DEFAULT_BASIC_TONES[appearance];
}

function readUpstreamTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    return readThemePreference();
  } catch {
    return "system";
  }
}

function hasThemeHalf(appearance: "dark" | "light"): boolean {
  try {
    return readThemeHalves()?.[appearance] !== undefined;
  } catch {
    return false;
  }
}

function isRenderedDark(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

/** One-time bridges: Westworld once lived in `t3code:theme`, and the retired palettes become the
    Basic tone that replaced them. So do the retired dark tones, and a retired Inlet colour
    becomes the one on its appearance. */
export function migrateLegacyForkPalettes(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(UPSTREAM_THEME_STORAGE_KEY) === "cool-dark") {
      window.localStorage.setItem(UPSTREAM_THEME_STORAGE_KEY, "dark");
      window.localStorage.setItem(FORK_PALETTE_STORAGE_KEY, "cool-dark");
    }
    const retiredTone =
      RETIRED_DARK_LOOKS[window.localStorage.getItem(BASIC_TONE_STORAGE_KEYS.dark) ?? ""];
    if (retiredTone !== undefined) {
      window.localStorage.setItem(BASIC_TONE_STORAGE_KEYS.dark, retiredTone);
    }
    const tone = RETIRED_DARK_LOOKS[window.localStorage.getItem(FORK_PALETTE_STORAGE_KEY) ?? ""];
    if (tone !== undefined) {
      window.localStorage.setItem(BASIC_TONE_STORAGE_KEYS.dark, tone);
      window.localStorage.setItem(FORK_PALETTE_STORAGE_KEY, BASIC_THEME);
    }
  } catch {
    // Match upstream theme reads: ignore storage failures during bootstrap.
  }
  migrateRetiredInletColor();
}

/** Rewrites a retired colour to its successor (under Inlet a missing one too: the old default,
    Charcoal, was rarely stored). Where Inlet shows under System and the successor restyles the
    native chrome where the old colour did not, the mode is pinned, as picking it would, once a
    record that leaving Inlet restores System has been kept. Reads resolve retired colours. */
function migrateRetiredInletColor(): void {
  const raw = readStorage(INLET_COLOR_STORAGE_KEY);
  const inletOn = readForkPalette() === INLET_THEME;
  const retired =
    raw === null ? (inletOn ? RETIRED_INLET_COLORS.charcoal : undefined) : retiredInletColor(raw);
  if (retired === undefined) return;
  writeStorage(INLET_COLOR_STORAGE_KEY, retired.color);
  const { appearance } = INLET_COLOR_OPTIONS[retired.color];
  const theme = readUpstreamTheme();
  if (
    !inletOn ||
    typeof document === "undefined" ||
    theme !== appearance ||
    isRenderedDark() !== (appearance === "dark") ||
    readAppearanceModePreference(theme) !== "system" ||
    inletChromeOverride(retired.color) === retired.chrome
  ) {
    return;
  }
  // The user is on System now, whatever an older record says.
  writeStorage(
    MODE_BEFORE_PALETTE_STORAGE_KEY,
    JSON.stringify({ before: "system", set: appearance }),
  );
  const saved = readModeBeforePalette();
  if (saved?.before === "system" && saved.set === appearance) setAppearanceMode(appearance);
}

/** Pure preference read: migration belongs to startup, never React render. */
export function readForkPalette(): ForkPalette {
  const raw = readStorage(FORK_PALETTE_STORAGE_KEY);
  return isForkPalette(raw) ? raw : BASIC_THEME;
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
  hasHalf = false,
}: {
  readonly theme: ThemePreference;
  readonly palette: ForkPalette;
  readonly isDark?: boolean;
  readonly inletColor?: InletColor;
  /** A mix half supplies the rendered appearance's theme, which Basic must not paint over. */
  readonly hasHalf?: boolean;
}): ForkPalettePreference {
  if (palette === BASIC_THEME) {
    return isStandardUpstreamTheme(theme) && !hasHalf ? BASIC_THEME : null;
  }
  const appearance = forkPaletteAppearance(palette, inletColor);
  return theme === appearance && isDark === (appearance === "dark") ? palette : null;
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
  // Glass and Inlet name an appearance; once upstream moves off it, the user has left them.
  if (
    palette !== BASIC_THEME &&
    theme !== forkPaletteAppearance(palette, inletColor) &&
    !isOtherWindowWrite()
  ) {
    writeStorage(FORK_PALETTE_STORAGE_KEY, null);
    palette = readForkPalette();
  }
  const isDark = isRenderedDark();
  const activePalette = resolveActiveForkPalette({
    theme,
    palette,
    isDark,
    inletColor,
    hasHalf: hasThemeHalf(isDark ? "dark" : "light"),
  });
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    applyForkPaletteAttribute(root, activePalette);
    if (activePalette === INLET_THEME) root.setAttribute(INLET_COLOR_ATTRIBUTE, inletColor);
    else root.removeAttribute(INLET_COLOR_ATTRIBUTE);
    if (activePalette === BASIC_THEME) {
      root.setAttribute(BASIC_TONE_ATTRIBUTE, readBasicTone(isDark ? "dark" : "light"));
    } else {
      root.removeAttribute(BASIC_TONE_ATTRIBUTE);
    }
    setForkDesktopThemeOverride(
      activePalette === INLET_THEME ? inletChromeOverride(inletColor) : null,
    );
    syncForkTopbarHeightFromRoot();
    // Synchronous, inside the suppressed-transition window: switching between
    // two fork palettes can keep upstream theme where it is, so applyTheme
    // no-ops and this is the only repaint of html/body overscroll and theme-color.
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
        syncForkGlassPopupCutout(
          glassOn ? "window" : isForkSidebarLiquidGlassApplied() ? "sidebar" : null,
        );
      })
      .catch(() => undefined);
  }
  setActiveForkPalette(activePalette);
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

/** The mode a palette moved the user off (`before`), and the one it set (`set`), so returning to
    Basic can put it back. */
const MODE_BEFORE_PALETTE_STORAGE_KEY = "t3code:fork-mode-before-palette";
type ThemePreferenceMode = ReturnType<typeof readAppearanceModePreference>;

function isPreferenceMode(value: unknown): value is ThemePreferenceMode {
  return value === "light" || value === "dark" || value === "system";
}

function readModeBeforePalette(): {
  readonly before: ThemePreferenceMode;
  readonly set: ThemePreferenceMode;
} | null {
  try {
    const raw: unknown = JSON.parse(readStorage(MODE_BEFORE_PALETTE_STORAGE_KEY) ?? "null");
    if (typeof raw !== "object" || raw === null) return null;
    const { before, set } = raw as Record<string, unknown>;
    return isPreferenceMode(before) && isPreferenceMode(set) ? { before, set } : null;
  } catch {
    return null;
  }
}

/** Upstream keeps the light/dark mode apart from the theme and setTheme preserves it, so a
    palette that sits on the other appearance has to move the mode as well. Only on a
    mismatch, so a palette chosen under System keeps following it, unless `pin`: a colour that
    restyles the native chrome cannot follow System, which that override flips (useTheme.ts).
    The first mode it moves the user off is kept, for restoreModeBeforePalette. */
function settleAppearance(
  wanted: "dark" | "light",
  setTheme: (theme: ThemePreference) => boolean,
  pin = false,
): void {
  setTheme(wanted);
  if (typeof document !== "undefined" && (pin || isRenderedDark() !== (wanted === "dark"))) {
    const before =
      readModeBeforePalette()?.before ?? readAppearanceModePreference(readUpstreamTheme());
    writeStorage(MODE_BEFORE_PALETTE_STORAGE_KEY, JSON.stringify({ before, set: wanted }));
    setAppearanceMode(wanted);
  }
}

/** Returning to Basic puts back the mode Glass or Inlet moved the user off, unless the user has
    changed it since: then theirs stands. */
function restoreModeBeforePalette(): void {
  const saved = readModeBeforePalette();
  if (saved === null) return;
  writeStorage(MODE_BEFORE_PALETTE_STORAGE_KEY, null);
  if (readAppearanceModePreference(readUpstreamTheme()) === saved.set) {
    setAppearanceMode(saved.before);
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

/** Basic sits on upstream's standard theme with no mix half; leave an imported theme or a mix for
    it, keeping the mode (setTheme clears the halves). */
function settleBasic(setTheme: (theme: ThemePreference) => boolean): void {
  const theme = readUpstreamTheme();
  if (!isStandardUpstreamTheme(theme)) setTheme("system");
  else if (hasThemeHalf("dark") || hasThemeHalf("light")) setTheme(theme);
}

/** Pick a fork theme and reconcile partial storage failures to one visible state. */
export function setForkAppearance(
  next: ForkPalette,
  setTheme: (theme: ThemePreference) => boolean,
): void {
  suppressAppearanceTransitions(() => {
    writeStorage(FORK_PALETTE_STORAGE_KEY, next);
    if (next === BASIC_THEME) {
      settleBasic(setTheme);
      restoreModeBeforePalette();
    } else if (next === INLET_THEME) {
      settleInletColor(readInletColor(), setTheme);
    } else {
      settleAppearance(forkPaletteAppearance(next), setTheme);
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
    writeStorage(INLET_COLOR_STORAGE_KEY, color);
    if (readForkPalette() === INLET_THEME) settleInletColor(color, setTheme);
    syncForkPaletteFromStorage();
  });
}

/** Puts both of Basic's tones back to their defaults, leaving the mode where it is. */
export function resetForkBasicTones(): void {
  suppressAppearanceTransitions(() => {
    writeStorage(BASIC_TONE_STORAGE_KEYS.dark, null);
    writeStorage(BASIC_TONE_STORAGE_KEYS.light, null);
    syncForkPaletteFromStorage();
  });
}

const readBasicDarkTone = () => readBasicTone("dark");
const readBasicLightTone = () => readBasicTone("light");

/** Pick a Basic tone: it becomes the tone for its appearance, and Basic shows it, moving the mode
    only when the tone sits on the other appearance (so System keeps following the OS). */
export function setForkBasicTone(
  tone: BasicTone,
  setTheme: (theme: ThemePreference) => boolean,
): void {
  suppressAppearanceTransitions(() => {
    const { appearance } = BASIC_TONE_OPTIONS[tone];
    writeStorage(BASIC_TONE_STORAGE_KEYS[appearance], tone);
    writeStorage(FORK_PALETTE_STORAGE_KEY, BASIC_THEME);
    settleBasic(setTheme);
    if (isRenderedDark() !== (appearance === "dark")) setAppearanceMode(appearance);
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
  migrateLegacyForkPalettes();
  syncForkPaletteFromStorage();
  subscribeToThemeChanges(syncForkPaletteFromStorage);
  window.addEventListener("storage", (event) => {
    if (
      event.key === FORK_PALETTE_STORAGE_KEY ||
      event.key === INLET_COLOR_STORAGE_KEY ||
      event.key === BASIC_TONE_STORAGE_KEYS.dark ||
      event.key === BASIC_TONE_STORAGE_KEYS.light
    ) {
      syncForkPaletteFromStorage();
    }
  });
}

/** Both of Basic's tones, and the one the rendered appearance (the root's `dark` class) shows. */
function useBasicTones() {
  const isDark = useSyncExternalStore(subscribePalette, isRenderedDark, () => true);
  const dark = useSyncExternalStore(
    subscribePalette,
    readBasicDarkTone,
    () => DEFAULT_BASIC_TONES.dark,
  );
  const light = useSyncExternalStore(
    subscribePalette,
    readBasicLightTone,
    () => DEFAULT_BASIC_TONES.light,
  );
  return { shown: isDark ? dark : light, dark, light } as const;
}

/** Fork theme adapter over the fork palette stores. `appearance` is the palette painted now (as
    the sync pass published it), or null while an imported or built-in upstream theme is on. */
export function useForkAppearance(setTheme: (theme: ThemePreference) => boolean) {
  const appearance = useActiveForkPalette();
  const inletColor = useSyncExternalStore(
    subscribePalette,
    readInletColor,
    () => DEFAULT_INLET_COLOR,
  );
  const basicTones = useBasicTones();

  const setAppearance = useCallback(
    (next: ForkPalette) => setForkAppearance(next, setTheme),
    [setTheme],
  );
  const setInletColor = (next: InletColor) => setForkInletColor(next, setTheme);
  const setBasicTone = (next: BasicTone) => setForkBasicTone(next, setTheme);

  return {
    appearance,
    setAppearance,
    inletColor,
    setInletColor,
    basicTone: basicTones.shown,
    setBasicTone,
    // Both appearances' tones, so Restore defaults sees the one not showing too.
    basicTonesChanged:
      basicTones.dark !== DEFAULT_BASIC_TONES.dark ||
      basicTones.light !== DEFAULT_BASIC_TONES.light,
    resetBasicTones: resetForkBasicTones,
  } as const;
}

/** Inlet's colour while Inlet is the palette painted, else null. */
export function useActiveInletColor(): InletColor | null {
  const inletActive = useIsInletActive();
  const color = useSyncExternalStore(subscribePalette, readInletColor, () => DEFAULT_INLET_COLOR);
  return inletActive ? color : null;
}

/** Basic's tone while Basic is the palette painted, else null. */
export function useActiveBasicTone(): BasicTone | null {
  const tone = useBasicTones().shown;
  return useActiveForkPalette() === BASIC_THEME ? tone : null;
}
