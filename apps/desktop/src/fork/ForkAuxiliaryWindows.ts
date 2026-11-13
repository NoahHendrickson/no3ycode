import type * as Electron from "electron";

/**
 * Windows the fork opens beside the main one (the side chat — see
 * `.fork/customizations.yaml#fork-side-chat`). ElectronWindow's "main or
 * first window" fallback skips them, so with the main window closed a dock
 * click or a menu action reopens the app instead of surfacing the side chat.
 * Its own module so ElectronWindow can read it without importing the side
 * chat, which imports ElectronWindow.
 */
const auxiliaryWindows = new WeakSet<Electron.BrowserWindow>();
const auxiliaryContents = new Map<number, Electron.WebContents>();

export function markForkAuxiliaryWindow(window: Electron.BrowserWindow): void {
  auxiliaryWindows.add(window);
  const contents = window.webContents;
  auxiliaryContents.set(contents.id, contents);
  window.once("closed", () => auxiliaryContents.delete(contents.id));
}

export function isForkAuxiliaryWindow(window: Electron.BrowserWindow): boolean {
  return auxiliaryWindows.has(window);
}

// DesktopIpc answers only the main window's top frame; the side chat runs the same preload.
export function isForkAuxiliaryMainFrame(event: {
  readonly sender: { readonly id: number };
  readonly senderFrame?: unknown;
}): boolean {
  const contents = auxiliaryContents.get(event.sender.id);
  return contents !== undefined && contents.mainFrame === event.senderFrame;
}
