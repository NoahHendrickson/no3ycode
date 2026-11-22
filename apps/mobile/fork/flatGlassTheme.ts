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
  /** Open pull request number. */
  readonly prOpen: string;
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
}

const DARK_FLAT_GLASS: FlatGlassPalette = {
  stageBackground: NO3Y_PAGE_COLOR,
  panelTint: "rgba(30, 30, 30, 0.72)",
  panelFallback: "rgba(24, 27, 30, 0.88)",
  panelBorder: "rgba(255, 255, 255, 0.13)",
  hairline: "rgba(255, 255, 255, 0.12)",
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
  prOpen: "rgba(94, 233, 181, 0.9)",
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
};

const LIGHT_FLAT_GLASS: FlatGlassPalette = {
  stageBackground: "#F5F6F8",
  panelTint: "rgba(248, 249, 251, 0.78)",
  panelFallback: "rgba(248, 249, 251, 0.92)",
  panelBorder: "rgba(20, 22, 24, 0.10)",
  hairline: "rgba(20, 22, 24, 0.10)",
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
  prOpen: "#059669",
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
