/**
 * The header height each window's palette draws, when it is not the default — see
 * `.fork/customizations.yaml#fork-basic-theme`. Its own module so DesktopWindow (which reads it to
 * place the macOS window buttons) and the IPC handler (which writes it) do not import each other.
 */
import type * as Electron from "electron";

const heights = new WeakMap<Electron.BrowserWindow, number>();

export function forkTopbarHeight(window: Electron.BrowserWindow): number | undefined {
  return heights.get(window);
}

export function setForkTopbarHeightFor(
  window: Electron.BrowserWindow,
  height: number | null,
): void {
  if (height === null) heights.delete(window);
  else heights.set(window, height);
}
