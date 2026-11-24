/**
 * Flat Glass visual tokens for no3y Code mobile — translated from
 * `apps/web/src/theme.custom.palettes.css` (`cool-darker`, Glass 3D off) and
 * `apps/web/src/theme.custom.css` (`sidebar-v2-status-*`).
 * See `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";
import { NO3Y_PAGE_COLOR } from "./no3yPageColor";

/** The dock is an 80pt band from the screen bottom on a home-indicator iPhone, items centred in it. */
export const NO3Y_DOCK_HEIGHT = 80;
/** How much of the dock band sits inside the bottom safe area (the home indicator's 34pt). */
const NO3Y_DOCK_SAFE_AREA_SINK = 34;
/** Room above the bottom safe area that bars and lists keep so they sit 20pt above the dock. */
export const NO3Y_BOTTOM_NAV_CLEARANCE = NO3Y_DOCK_HEIGHT - NO3Y_DOCK_SAFE_AREA_SINK + 20;
/** The top of the soft fade behind the dock and the bottom bars. */
export const NO3Y_BOTTOM_FADE_HEIGHT = 20;

/** Round buttons and pills on the no3y screens: header buttons, filter/sort, composer controls. */
export const NO3Y_CONTROL_SIZE = 44;
/** Status marks at card size (thread cards, peeks, runs, chat rows, bot tiles, subagent sheets). */
export const NO3Y_STATUS_MARK_SIZE = 20;
/** The controls inside the composer card (+, model chip, mic, send/stop/resume): a step smaller. */
export const NO3Y_COMPOSER_CONTROL_SIZE = 40;

/** Weights for the no3y screens; the family is the app's, the system font (SF Pro) on iOS. */
export const NO3Y_FONT = {
  regular: { fontWeight: "400" },
  medium: { fontWeight: "500" },
} as const;

export function no3yDockBottom(bottomSafeArea: number): number {
  return Math.max(bottomSafeArea - NO3Y_DOCK_SAFE_AREA_SINK, 0);
}

/**
 * The thread composer's bottom inset: over the dock on New agent, which keeps it, and 20pt
 * from the screen bottom inside a thread, which has no dock.
 */
export function no3yComposerBottomInset(inset: number, draft: boolean): number {
  return draft ? inset + NO3Y_BOTTOM_NAV_CLEARANCE : Math.max(inset - 20, 8);
}

export interface FlatGlassPalette {
  readonly stageBackground: string;
  readonly panelTint: string;
  readonly panelFallback: string;
  readonly panelBorder: string;
  readonly hairline: string;
  /** The rim under the small pills above the composer (fork/No3yStatusPill.tsx). */
  readonly pillShadow: string;
  readonly foreground: string;
  /** Every thread title, whatever its status, read state or shelf: pure white in dark. */
  readonly titleInk: string;
  readonly quietInk: string;
  readonly faintInk: string;
  readonly rowPressed: string;
  readonly rowSelected: string;
  readonly controlSurface: string;
  readonly controlBorder: string;
  readonly activePillSurface: string;
  readonly peekRing: string;
  readonly centerButtonActiveSurface: string;
  readonly centerButtonActiveInk: string;
  readonly peekBackdrop: string;
  /** Section labels. */
  readonly sectionInk: string;
  /** Thread card meta (model, project). */
  readonly metaInk: string;
  /** Pull request marks by state, the Mac's PR tones (fork/no3yPullRequestTone.ts). */
  readonly prOpen: string;
  readonly prMerged: string;
  readonly prClosed: string;
  readonly prDraft: string;
  /** The pull request pill above the composer: tinted glass and ink per state (Figma 60:2786). */
  readonly prPill: Readonly<
    Record<
      "open" | "merged" | "closed" | "draft",
      { readonly tint?: string | undefined; readonly ink: string }
    >
  >;
  /** The stacked pull request pill's purple-to-green inner glow, as a box shadow. */
  readonly prStackGlow: string;
  /** The effort slider's track. */
  readonly circleFill: string;
  /** Primary (send) button and its glyph. */
  readonly primaryFill: string;
  readonly primaryInk: string;
  readonly usageRingTrack: string;
  readonly usageRingRemaining: string;
  readonly statusWorking: string;
  readonly statusDone: string;
  readonly statusAttention: string;
  readonly statusFailed: string;
  readonly statusMonitoring: string;
  readonly statusIdleBorder: string;
  /** The user's sent bubble: a translucent wash over the page, like the Mac's glass bubble. */
  readonly userBubble: string;
  /** A card on the page: a 4% wash. */
  readonly cardWash: string;
  /** Inline code in a reply: link-blue ink on a blue-tinted chip. */
  readonly inlineCodeInk: string;
  readonly inlineCodeWash: string;
}

const DARK_FLAT_GLASS: FlatGlassPalette = {
  stageBackground: NO3Y_PAGE_COLOR,
  panelTint: "rgba(30, 30, 30, 0.72)",
  panelFallback: "rgba(24, 27, 30, 0.88)",
  panelBorder: "rgba(255, 255, 255, 0.13)",
  hairline: "rgba(255, 255, 255, 0.12)",
  pillShadow: "0px 0px 2px 1px rgba(0, 0, 0, 0.4)",
  foreground: "#E8E8E8",
  titleInk: "#FFFFFF",
  quietInk: "rgba(255, 255, 255, 0.65)",
  faintInk: "rgba(255, 255, 255, 0.42)",
  rowPressed: "rgba(255, 255, 255, 0.05)",
  rowSelected: "rgba(255, 255, 255, 0.08)",
  controlSurface: "rgba(255, 255, 255, 0.08)",
  controlBorder: "rgba(255, 255, 255, 0.12)",
  activePillSurface: "rgba(255, 255, 255, 0.12)",
  peekRing: "#2498FE",
  centerButtonActiveSurface: "#FFFFFF",
  centerButtonActiveInk: "#141618",
  peekBackdrop: "rgba(0, 0, 0, 0.28)",
  sectionInk: "#737373",
  metaInk: "#8A8A8A",
  // Tailwind emerald-300/90, violet-300/90, red-300/90, zinc-400/80 (the Mac's dark PR tones).
  prOpen: "rgba(94, 233, 181, 0.9)",
  prMerged: "rgba(196, 180, 255, 0.9)",
  prClosed: "rgba(255, 162, 162, 0.9)",
  prDraft: "rgba(159, 159, 169, 0.8)",
  prPill: {
    open: { tint: "rgba(14, 127, 82, 0.6)", ink: "#75F1A1" },
    merged: { tint: "rgba(51, 38, 116, 0.6)", ink: "#A38FFA" },
    closed: { tint: "rgba(127, 29, 29, 0.6)", ink: "#FFA2A2" },
    draft: { ink: "rgba(159, 159, 169, 0.8)" },
  },
  prStackGlow:
    "inset -1px -1px 2px 0px rgba(18, 199, 69, 0.2), inset 1px 1px 2px 0px rgba(119, 56, 236, 0.7), inset -1px -1px 12px 0px rgba(9, 183, 61, 0.6), inset 1px 1px 12px 1px rgba(87, 35, 185, 0.8)",
  circleFill: "rgba(255, 255, 255, 0.1)",
  primaryFill: "#FFFFFF",
  primaryInk: "#191817",
  usageRingTrack: "rgba(255, 255, 255, 0.145)",
  usageRingRemaining: "#29F086",
  statusWorking: "#24FE8A",
  statusDone: "#2498FE",
  statusAttention: "#FFCD59",
  statusFailed: "#FF6B60",
  statusMonitoring: "rgba(255, 255, 255, 0.45)",
  statusIdleBorder: "rgba(255, 255, 255, 0.55)",
  userBubble: "rgba(255, 255, 255, 0.09)",
  cardWash: "rgba(255, 255, 255, 0.04)",
  inlineCodeInk: "#7CC2FF",
  inlineCodeWash: "rgba(36, 152, 254, 0.16)",
};

const LIGHT_FLAT_GLASS: FlatGlassPalette = {
  stageBackground: "#F5F6F8",
  panelTint: "rgba(248, 249, 251, 0.78)",
  panelFallback: "rgba(248, 249, 251, 0.92)",
  panelBorder: "rgba(20, 22, 24, 0.10)",
  hairline: "rgba(20, 22, 24, 0.10)",
  pillShadow: "0px 0px 2px 1px rgba(0, 0, 0, 0.08)",
  foreground: "#141618",
  titleInk: "#141618",
  quietInk: "rgba(20, 22, 24, 0.60)",
  faintInk: "rgba(20, 22, 24, 0.40)",
  rowPressed: "rgba(20, 22, 24, 0.04)",
  rowSelected: "rgba(20, 22, 24, 0.07)",
  controlSurface: "rgba(20, 22, 24, 0.06)",
  controlBorder: "rgba(20, 22, 24, 0.10)",
  activePillSurface: "rgba(20, 22, 24, 0.09)",
  peekRing: "#2498FE",
  centerButtonActiveSurface: "#141618",
  centerButtonActiveInk: "#FFFFFF",
  peekBackdrop: "rgba(0, 0, 0, 0.16)",
  sectionInk: "rgba(20, 22, 24, 0.50)",
  metaInk: "rgba(20, 22, 24, 0.55)",
  // Emerald, violet and red 600 and zinc 500 (the Mac's light PR tones).
  prOpen: "#059669",
  prMerged: "#7f22fe",
  prClosed: "#e7000b",
  prDraft: "#71717b",
  prPill: {
    open: { tint: "rgba(5, 150, 105, 0.16)", ink: "#059669" },
    merged: { tint: "rgba(127, 34, 254, 0.12)", ink: "#7f22fe" },
    closed: { tint: "rgba(231, 0, 11, 0.10)", ink: "#e7000b" },
    draft: { ink: "#71717b" },
  },
  prStackGlow:
    "inset -1px -1px 2px 0px rgba(18, 199, 69, 0.2), inset 1px 1px 2px 0px rgba(119, 56, 236, 0.45), inset -1px -1px 10px 0px rgba(9, 183, 61, 0.25), inset 1px 1px 10px 0px rgba(87, 35, 185, 0.3)",
  circleFill: "rgba(20, 22, 24, 0.07)",
  primaryFill: "#141618",
  primaryInk: "#FFFFFF",
  usageRingTrack: "rgba(20, 22, 24, 0.12)",
  usageRingRemaining: "#059669",
  statusWorking: "#059669",
  statusDone: "#2498FE",
  statusAttention: "#D97706",
  statusFailed: "#DC2626",
  statusMonitoring: "rgba(20, 22, 24, 0.40)",
  statusIdleBorder: "rgba(20, 22, 24, 0.42)",
  userBubble: "rgba(20, 22, 24, 0.06)",
  cardWash: "rgba(20, 22, 24, 0.04)",
  inlineCodeInk: "#0A64C2",
  inlineCodeWash: "rgba(36, 152, 254, 0.12)",
};

export function flatGlassPalette(appearance: "dark" | "light"): FlatGlassPalette {
  return appearance === "dark" ? DARK_FLAT_GLASS : LIGHT_FLAT_GLASS;
}

export function flatGlassStatusColor(
  kind: SidebarV2CardStatusKind | null,
  palette: FlatGlassPalette,
): string {
  switch (kind) {
    case "working":
      return palette.statusWorking;
    case "done":
      return palette.statusDone;
    case "approval":
    case "input":
    case "request":
    case "limited":
    case "woke":
      return palette.statusAttention;
    case "failed":
      return palette.statusFailed;
    case "waiting":
    case "monitoring":
      return palette.statusMonitoring;
    case null:
      return palette.statusIdleBorder;
  }
}
