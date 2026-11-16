/**
 * Basic's header height on the desktop — see `.fork/customizations.yaml#fork-basic-theme`. The
 * macOS window buttons sit on the header's axis, so the shell moves them with it; without the
 * bridge method (a browser, an older build) they stay where they are.
 */

/** Matches `--workspace-topbar-height` under Basic in theme.custom.basic.css. */
export const BASIC_TOPBAR_HEIGHT = 44;

type TopbarBridge = { readonly setTopbarHeight: (height: number | null) => Promise<boolean> };

function readBridge(): TopbarBridge | null {
  const bridge = (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge;
  if (typeof bridge !== "object" || bridge === null) return null;
  const candidate = bridge as { setTopbarHeight?: unknown };
  return typeof candidate.setTopbarHeight === "function" ? (bridge as TopbarBridge) : null;
}

let sent: number | null | undefined;

/** Names the header height the painted palette draws, null for the default. */
export function syncForkTopbarHeight(height: number | null): void {
  if (height === sent) return;
  const bridge = readBridge();
  if (bridge === null) return;
  sent = height;
  void bridge.setTopbarHeight(height).catch(() => undefined);
}
