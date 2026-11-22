/**
 * Flat Glass visual tokens for no3y Code mobile — translated from
 * `apps/web/src/theme.custom.palettes.css` (`cool-darker`, Glass 3D off) and
 * `apps/web/src/theme.custom.css` (`sidebar-v2-status-*`).
 * See `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import type { SidebarV2CardStatusKind } from "./forkStatusGrouping";

export const NO3Y_BOTTOM_NAV_BAR_HEIGHT = 60;
export const NO3Y_BOTTOM_NAV_BOTTOM_MARGIN = 8;
/** Extra clearance below scrollable lists and the prompt bar so content sits cleanly above the nav bar. */
export const NO3Y_BOTTOM_NAV_CLEARANCE =
  NO3Y_BOTTOM_NAV_BAR_HEIGHT + NO3Y_BOTTOM_NAV_BOTTOM_MARGIN + 12;

export interface FlatGlassPalette {
  readonly stageBackground: string;
  readonly panelTint: string;
  readonly panelFallback: string;
  readonly panelBorder: string;
  readonly hairline: string;
  readonly foreground: string;
  readonly quietInk: string;
  readonly faintInk: string;
  readonly rowPressed: string;
  readonly rowSelected: string;
  readonly controlSurface: string;
  readonly controlBorder: string;
  readonly activePillSurface: string;
  readonly activePillBorder: string;
  readonly centerButtonSurface: string;
  readonly centerButtonActiveSurface: string;
  readonly centerButtonActiveInk: string;
  readonly peekBackdrop: string;
  readonly statusWorking: string;
  readonly statusDone: string;
  readonly statusAttention: string;
  readonly statusFailed: string;
  readonly statusMonitoring: string;
  readonly statusIdleBorder: string;
}

const DARK_FLAT_GLASS: FlatGlassPalette = {
  stageBackground: "#141618",
  panelTint: "rgba(30, 30, 30, 0.72)",
  panelFallback: "rgba(24, 27, 30, 0.88)",
  panelBorder: "rgba(255, 255, 255, 0.13)",
  hairline: "rgba(255, 255, 255, 0.12)",
  foreground: "#E8E8E8",
  quietInk: "rgba(255, 255, 255, 0.65)",
  faintInk: "rgba(255, 255, 255, 0.42)",
  rowPressed: "rgba(255, 255, 255, 0.05)",
  rowSelected: "rgba(255, 255, 255, 0.08)",
  controlSurface: "rgba(255, 255, 255, 0.08)",
  controlBorder: "rgba(255, 255, 255, 0.12)",
  activePillSurface: "rgba(255, 255, 255, 0.12)",
  activePillBorder: "rgba(255, 255, 255, 0.18)",
  centerButtonSurface: "rgba(255, 255, 255, 0.14)",
  centerButtonActiveSurface: "#FFFFFF",
  centerButtonActiveInk: "#141618",
  peekBackdrop: "rgba(0, 0, 0, 0.42)",
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
  quietInk: "rgba(20, 22, 24, 0.60)",
  faintInk: "rgba(20, 22, 24, 0.40)",
  rowPressed: "rgba(20, 22, 24, 0.04)",
  rowSelected: "rgba(20, 22, 24, 0.07)",
  controlSurface: "rgba(20, 22, 24, 0.06)",
  controlBorder: "rgba(20, 22, 24, 0.10)",
  activePillSurface: "rgba(20, 22, 24, 0.09)",
  activePillBorder: "rgba(20, 22, 24, 0.14)",
  centerButtonSurface: "rgba(20, 22, 24, 0.10)",
  centerButtonActiveSurface: "#141618",
  centerButtonActiveInk: "#FFFFFF",
  peekBackdrop: "rgba(0, 0, 0, 0.24)",
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
