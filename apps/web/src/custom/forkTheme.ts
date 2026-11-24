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
 * disk.
 *
 * Basic has one tone per appearance (BASIC_OPTIONS), picked by upstream's light/dark mode, so
 * under System it follows the OS.
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
import { isForkSidebarVibrancyApplied, syncForkSidebarVibrancy } from "./forkSidebarVibrancy";
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

export const BASIC_APPEARANCES = ["light", "dark"] as const;
export type BasicAppearance = (typeof BASIC_APPEARANCES)[number];
/** Basic's tone for each appearance. `base` is the one colour every other surface derives from
    (theme.custom.basic.css); index.html pre-paints the same two. */
export const BASIC_OPTIONS: Readonly<
  Record<
    BasicAppearance,
    {
      readonly label: string;
      readonly base: string;
      /** As theme.custom.basic.css sets --basic-text. */
      readonly text: string;
    }
  >
> = {
  light: { label: "Light", base: "#f7f7f7", text: "#1a1a1a" },
  dark: { label: "Darker Neutral", base: "#232323", text: "#e8e8e8" },
};

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

/** One-time bridges: Westworld once lived in `t3code:theme` and paints as dark Basic, and a
    retired Inlet colour becomes the one on its appearance. A retired palette id needs none: it
    reads as Basic. */
export function migrateLegacyForkPalettes(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(UPSTREAM_THEME_STORAGE_KEY) === "cool-dark") {
      window.localStorage.setItem(UPSTREAM_THEME_STORAGE_KEY, "dark");
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
        // Sidebar-only Liquid Glass stamps its marker one more IPC round trip later, so
        // the cutout runs for the Glass palette and reads that marker per popup. The palette
        // is read off the root, not this call, so a superseded answer cannot start it.
        syncForkGlassPopupCutout(
          glassOn
            ? "window"
            : document.documentElement.getAttribute(FORK_THEME_ATTRIBUTE) === COOL_DARKER_THEME
              ? "sidebar"
              : null,
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

/** Upstream keeps the mode apart from the theme (setTheme preserves it), so a palette on the
    other appearance moves the mode too, only on a mismatch so one picked under System keeps
    following it; `pin` moves it anyway, as a colour restyling the native chrome cannot follow
    System (useTheme.ts). The first mode moved off is kept for restoreModeBeforePalette. */
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
    if (event.key === FORK_PALETTE_STORAGE_KEY || event.key === INLET_COLOR_STORAGE_KEY) {
      syncForkPaletteFromStorage();
    }
  });
}

/** The rendered appearance (the root's `dark` class), which picks Basic's tone. */
function useRenderedAppearance(): BasicAppearance {
  return useSyncExternalStore(subscribePalette, isRenderedDark, () => true) ? "dark" : "light";
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
  const basicAppearance = useRenderedAppearance();

  const setAppearance = useCallback(
    (next: ForkPalette) => setForkAppearance(next, setTheme),
    [setTheme],
  );
  const setInletColor = (next: InletColor) => setForkInletColor(next, setTheme);

  return {
    appearance,
    setAppearance,
    inletColor,
    setInletColor,
    basicAppearance,
  } as const;
}

/** Inlet's colour while Inlet is the palette painted, else null. */
export function useActiveInletColor(): InletColor | null {
  const inletActive = useIsInletActive();
  const color = useSyncExternalStore(subscribePalette, readInletColor, () => DEFAULT_INLET_COLOR);
  return inletActive ? color : null;
}

/** The appearance Basic paints at while Basic is the palette painted, else null. */
export function useActiveBasicAppearance(): BasicAppearance | null {
  const appearance = useRenderedAppearance();
  return useActiveForkPalette() === BASIC_THEME ? appearance : null;
}
