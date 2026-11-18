// Each preview keeps its own appearance. The app's theme code stores it in localStorage and follows
// other windows' writes through storage events, so two Storybook tabs would re-theme each other;
// pointing it at this tab's sessionStorage keeps every tab's tone (and the All tones sweep) local.
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: window.sessionStorage,
});

// The preferences a user on Basic has stored, written before any app module loads: useTheme
// applies the stored theme as it imports, and forkTheme.ts derives the tone from these. The
// toolbar's tone then moves through setForkBasicTone, as Settings › Appearance does.
const PREFERENCES = {
  "t3code:theme": "system",
  "t3code:theme-appearance-mode": "dark",
  "t3code:theme-follow-system": "false",
  "t3code:fork-theme": "basic",
  "t3code:fork-basic-tone-dark": "dark-neutral",
  "t3code:fork-basic-tone-light": "light",
};

for (const [key, value] of Object.entries(PREFERENCES)) {
  window.localStorage.setItem(key, value);
}

// Glass is see-through only once the desktop shell reports its window material
// (forkSidebarVibrancy.ts). A browser has none, so this stands in for the bridge: the app's own
// palette sync asks for the material when Glass is picked, and preview-head.html paints a
// wallpaper where the desktop would show through.
(window as { forkDesktopBridge?: unknown }).forkDesktopBridge = {
  setSidebarVibrancy: async (enabled: boolean) => enabled,
};

// The app mounts into #root, and Glass's popup cutout (forkGlassPopupCutout.ts) masks that element
// when a popup opens over its trigger. Storybook mounts into #storybook-root, so it sits inside a
// #root here, created before the theme turns Glass on.
const storyRoot = document.getElementById("storybook-root");
if (storyRoot !== null && document.getElementById("root") === null) {
  const appRoot = document.createElement("div");
  appRoot.id = "root";
  storyRoot.before(appRoot);
  appRoot.append(storyRoot);
}
