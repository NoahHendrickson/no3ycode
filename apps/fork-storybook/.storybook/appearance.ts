// Each preview keeps its own appearance. The app's theme code stores it in localStorage and follows
// other windows' writes through storage events, so two Storybook tabs would re-theme each other;
// pointing it at this tab's sessionStorage keeps every tab's theme (and the All tones sweep) local.
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: window.sessionStorage,
});

// The preferences a user on Basic has stored, written before any app module loads: useTheme
// applies the stored theme as it imports. They are the toolbar's default, Flat Glass, so a page with
// no story to run the toolbar's hook (Introduction) already paints it. The toolbar then moves the
// palette and the mode as Settings › Appearance does.
const PREFERENCES = {
  "t3code:theme": "system",
  "t3code:theme-appearance-mode": "dark",
  "t3code:theme-follow-system": "false",
  "t3code:fork-theme": "cool-darker",
  "t3code:fork:glass-3d:v1": '"off"',
};

for (const [key, value] of Object.entries(PREFERENCES)) {
  window.localStorage.setItem(key, value);
}

// Glass is see-through only once the desktop shell reports its window material
// (forkSidebarVibrancy.ts). A browser has none, so this stands in for a macOS 26+ main window:
// Liquid Glass under the docked sidebar only. preview-head.html paints the glass's colour where
// the sidebar goes clear. No draft-glass setter, so the New agent stage keeps its CSS backdrop.
(window as { forkDesktopBridge?: unknown }).forkDesktopBridge = {
  setSidebarVibrancy: async (enabled: boolean) => (enabled ? "liquid-glass" : "off"),
  sidebarLiquidGlass: { setWidth: async () => true },
};

// The app mounts into #root, and Glass's popup cutout (forkGlassPopupCutout.ts) masks that element
// when a popup opens over its trigger. Storybook mounts a story into #storybook-root and a docs page
// into #storybook-docs, so both sit inside a #root here, created before the theme turns Glass on.
const storyRoot = document.getElementById("storybook-root");
if (storyRoot !== null && document.getElementById("root") === null) {
  const appRoot = document.createElement("div");
  appRoot.id = "root";
  storyRoot.before(appRoot);
  const docsRoot = document.getElementById("storybook-docs");
  appRoot.append(storyRoot, ...(docsRoot === null ? [] : [docsRoot]));
}
