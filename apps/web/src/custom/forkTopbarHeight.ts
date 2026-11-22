/**
 * Basic's header height on the desktop — see `.fork/customizations.yaml#fork-basic-theme`. The
 * macOS window buttons sit on the header's axis, so the shell moves them with it; without the
 * bridge method (a browser, an older build) they stay where they are.
 */

/** Matches `--workspace-topbar-height` under Basic and Flat Glass. */
const COMPACT_TOPBAR_HEIGHT = 44;

type TopbarBridge = { readonly setTopbarHeight: (height: number | null) => Promise<boolean> };

function readBridge(): TopbarBridge | null {
  const bridge = (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge;
  if (typeof bridge !== "object" || bridge === null) return null;
  const candidate = bridge as { setTopbarHeight?: unknown };
  return typeof candidate.setTopbarHeight === "function" ? (bridge as TopbarBridge) : null;
}

let sent: number | null | undefined;

/** Names the header height the painted palette draws, null for the default. */
function syncForkTopbarHeight(height: number | null): void {
  if (height === sent) return;
  const bridge = readBridge();
  if (bridge === null) return;
  sent = height;
  void bridge.setTopbarHeight(height).catch(() => undefined);
}

/** Syncs the native topbar height from the root theme / Glass 3D markers. */
export function syncForkTopbarHeightFromRoot(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (typeof root?.getAttribute !== "function") return;
  const theme = root.getAttribute("data-fork-theme");
  const compact =
    theme === "basic" ||
    (theme === "cool-darker" && root.getAttribute("data-fork-glass-3d") === "off");
  syncForkTopbarHeight(compact ? COMPACT_TOPBAR_HEIGHT : null);
}
