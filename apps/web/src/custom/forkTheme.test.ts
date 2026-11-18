import { afterEach, describe, expect, it, vi } from "vite-plus/test";

function createStorage(
  initial: Record<string, string> = {},
  overrides: Partial<Storage> = {},
): { readonly storage: Storage; readonly values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    storage: {
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
      ...overrides,
    },
  };
}

function createDocumentRoot() {
  const attributes = new Map<string, string>();
  const classes = new Set<string>();
  return {
    attributes,
    classes,
    root: {
      classList: {
        add: (name: string) => classes.add(name),
        contains: (name: string) => classes.has(name),
        remove: (name: string) => classes.delete(name),
      },
      get offsetHeight() {
        return 0;
      },
      removeAttribute: (name: string) => attributes.delete(name),
      setAttribute: (name: string, value: string) => attributes.set(name, value),
    },
  };
}

/** A useTheme double whose mode moves the root's `dark` class, as upstream's applyTheme does. */
function mockUseTheme(
  storage: Storage,
  classes: Set<string>,
  options: { mode?: string; systemDark?: boolean } = {},
) {
  const state = { mode: options.mode ?? "system" };
  const setAppearanceMode = vi.fn((next: string) => {
    state.mode = next;
    const dark = next === "system" ? (options.systemDark ?? true) : next === "dark";
    if (dark) classes.add("dark");
    else classes.delete("dark");
    return true;
  });
  vi.doMock("../hooks/useTheme", () => ({
    readAppearanceModePreference: () => state.mode,
    readThemeHalves: () => JSON.parse(storage.getItem("t3code:theme-halves:v1") ?? "null"),
    readThemePreference: () => storage.getItem("t3code:theme") ?? "system",
    setAppearanceMode,
    subscribeToThemeChanges: vi.fn(() => () => {}),
    syncBrowserChromeTheme: vi.fn(),
    setForkDesktopThemeOverride: vi.fn(),
  }));
  return { state, setAppearanceMode };
}

function stubWindow(storage: Storage, extra: Record<string, unknown> = {}) {
  vi.stubGlobal("window", {
    localStorage: storage,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
    ...extra,
  });
}

afterEach(() => {
  vi.doUnmock("../hooks/useTheme");
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fork theme synchronization", () => {
  it("reads Basic by default and migrates the retired palettes to its tones", async () => {
    const setItem = vi.fn<(key: string, value: string) => void>();
    const { storage, values } = createStorage(
      { "t3code:theme": "cool-dark" },
      {
        setItem: (key, value) => {
          setItem(key, value);
          values.set(key, value);
        },
      },
    );
    vi.stubGlobal("window", { localStorage: storage });
    mockUseTheme(storage, new Set());

    const { migrateLegacyForkPalettes, readBasicTone, readForkPalette } =
      await import("./forkTheme");
    expect(readForkPalette()).toBe("basic");
    expect(setItem).not.toHaveBeenCalled();

    // Westworld, from when it lived in the upstream key.
    migrateLegacyForkPalettes();
    expect(values.get("t3code:theme")).toBe("dark");
    expect(values.get("t3code:fork-theme")).toBe("basic");
    expect(readBasicTone("dark")).toBe("dark-cool");

    values.set("t3code:fork-theme", "neutral-darker");
    migrateLegacyForkPalettes();
    expect(readForkPalette()).toBe("basic");
    expect(readBasicTone("dark")).toBe("darkest-neutral");
    expect(readBasicTone("light")).toBe("light");

    // A retired dark tone becomes the tone that replaced it.
    values.set("t3code:fork-basic-tone-dark", "cool");
    migrateLegacyForkPalettes();
    expect(readBasicTone("dark")).toBe("dark-cool");

    // A tone stored for the wrong appearance is not that appearance's tone.
    values.set("t3code:fork-basic-tone-light", "dark-cool");
    expect(readBasicTone("light")).toBe("light");
  });

  it("migrates a retired Inlet colour to the remaining one on its appearance", async () => {
    const { storage, values } = createStorage();
    vi.stubGlobal("window", { localStorage: storage });
    mockUseTheme(storage, new Set());

    const { INLET_THEME, forkPaletteAppearance, migrateLegacyForkPalettes } =
      await import("./forkTheme");
    for (const [retired, appearance, next] of [
      ["charcoal", "dark", "cream"],
      ["jungle", "dark", "cream"],
      ["green", "light", "black"],
      ["jungle-light", "light", "black"],
      ["cream", "dark", "cream"],
      ["black", "light", "black"],
    ] as const) {
      values.set("t3code:fork-inlet-color", retired);
      migrateLegacyForkPalettes();
      expect(values.get("t3code:fork-inlet-color")).toBe(next);
      expect(forkPaletteAppearance(INLET_THEME, next)).toBe(appearance);
    }
  });

  it("paints Basic on any standard upstream theme and steps aside for an imported one", async () => {
    const { storage, values } = createStorage({ "t3code:theme": "system" });
    const { attributes, classes, root } = createDocumentRoot();
    classes.add("dark");
    let themeChangeHandler: (() => void) | undefined;
    vi.stubGlobal("window", { addEventListener: () => {}, localStorage: storage });
    vi.stubGlobal("document", { documentElement: root });
    vi.doMock("../hooks/useTheme", () => ({
      readThemeHalves: () => null,
      readThemePreference: () => storage.getItem("t3code:theme") ?? "system",
      subscribeToThemeChanges: (listener: () => void) => {
        themeChangeHandler = listener;
        return () => {};
      },
      syncBrowserChromeTheme: vi.fn(),
      setForkDesktopThemeOverride: vi.fn(),
    }));

    const { BASIC_TONE_ATTRIBUTE, FORK_THEME_ATTRIBUTE, initializeForkTheme } =
      await import("./forkTheme");
    initializeForkTheme();
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("basic");
    expect(attributes.get(BASIC_TONE_ATTRIBUTE)).toBe("dark-neutral");

    // System turns light: Basic follows, onto the light tone.
    values.set("t3code:fork-basic-tone-light", "cream");
    classes.delete("dark");
    themeChangeHandler?.();
    expect(attributes.get(BASIC_TONE_ATTRIBUTE)).toBe("cream");

    // ThemeEditorHost writes through upstream's same-tab store, where the browser does not
    // emit a storage event; an imported theme turns every fork palette off.
    values.set("t3code:theme", "custom-theme");
    themeChangeHandler?.();
    expect(attributes.has(FORK_THEME_ATTRIBUTE)).toBe(false);
    expect(attributes.has(BASIC_TONE_ATTRIBUTE)).toBe(false);
  });

  it("reconciles Glass and Inlet for palette and upstream-theme storage events", async () => {
    const { storage, values } = createStorage({
      "t3code:theme": "dark",
      "t3code:fork-theme": "cool-darker",
    });
    const { attributes, classes, root } = createDocumentRoot();
    classes.add("dark");
    let storageHandler: ((event: StorageEvent) => void) | undefined;
    const syncBrowserChromeTheme = vi.fn();
    let themeChangeHandler: (() => void) | undefined;
    const win: { event?: Event } & Record<string, unknown> = {
      addEventListener: (type: string, listener: (event: StorageEvent) => void) => {
        if (type === "storage") storageHandler = listener;
      },
      localStorage: storage,
    };
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", { documentElement: root });
    vi.doMock("../hooks/useTheme", () => ({
      readThemeHalves: () => null,
      readThemePreference: () => storage.getItem("t3code:theme") ?? "system",
      subscribeToThemeChanges: (listener: () => void) => {
        themeChangeHandler = listener;
        return () => {};
      },
      syncBrowserChromeTheme,
      setForkDesktopThemeOverride: vi.fn(),
    }));

    const { FORK_THEME_ATTRIBUTE, initializeForkTheme } = await import("./forkTheme");
    initializeForkTheme();
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("cool-darker");

    // Leaving Glass's appearance leaves Glass: the stored preference falls back to Basic.
    values.set("t3code:theme", "light");
    classes.delete("dark");
    themeChangeHandler?.();
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("basic");
    expect(values.has("t3code:fork-theme")).toBe(false);

    values.set("t3code:theme", "dark");
    classes.add("dark");
    values.set("t3code:fork-theme", "cool-darker");
    storageHandler?.({ key: "t3code:fork-theme" } as StorageEvent);
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("cool-darker");
    expect(syncBrowserChromeTheme).toHaveBeenCalledTimes(3);

    // Another window's change lands one key at a time: its palette can arrive before its theme.
    // That window repairs its own state; this one only follows, or it clears the shared key.
    values.set("t3code:fork-theme", "inlet");
    values.set("t3code:fork-inlet-color", "black");
    win.event = { type: "storage" } as Event;
    storageHandler?.({ key: "t3code:fork-inlet-color" } as StorageEvent);
    themeChangeHandler?.();
    expect(values.get("t3code:fork-theme")).toBe("inlet");
    expect(attributes.has(FORK_THEME_ATTRIBUTE)).toBe(false);
    values.set("t3code:theme", "light");
    classes.delete("dark");
    themeChangeHandler?.();
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("inlet");
  });

  it("uses the retained storage value after a failed palette write and suppresses repaint", async () => {
    const { storage, values } = createStorage(
      { "t3code:theme": "system" },
      {
        setItem: (key, value) => {
          if (key === "t3code:fork-theme") throw new Error("palette write blocked");
          values.set(key, value);
        },
      },
    );
    const { attributes, classes, root } = createDocumentRoot();
    classes.add("dark");
    let animationFrame: FrameRequestCallback | undefined;
    vi.stubGlobal("window", {
      localStorage: storage,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        animationFrame = callback;
        return 1;
      },
    });
    vi.stubGlobal("document", { documentElement: root });
    mockUseTheme(storage, classes);

    const { FORK_THEME_ATTRIBUTE, readForkPalette, setForkAppearance } =
      await import("./forkTheme");
    setForkAppearance("cool-darker", (theme) => {
      storage.setItem("t3code:theme", theme);
      return true;
    });

    expect(values.get("t3code:theme")).toBe("dark");
    expect(readForkPalette()).toBe("basic");
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("basic");
    expect(classes.has("no-transitions")).toBe(true);

    animationFrame?.(0);
    expect(classes.has("no-transitions")).toBe(false);
  });

  it("stamps Glass on the shared palette key", async () => {
    const { storage, values } = createStorage({ "t3code:theme": "system" });
    const { attributes, classes, root } = createDocumentRoot();
    stubWindow(storage);
    vi.stubGlobal("document", { documentElement: root });
    mockUseTheme(storage, classes);

    const { FORK_THEME_ATTRIBUTE, readForkPalette, setForkAppearance } =
      await import("./forkTheme");
    setForkAppearance("cool-darker", (theme) => {
      storage.setItem("t3code:theme", theme);
      classes.add("dark");
      return true;
    });

    expect(values.get("t3code:theme")).toBe("dark");
    expect(values.get("t3code:fork-theme")).toBe("cool-darker");
    expect(readForkPalette()).toBe("cool-darker");
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("cool-darker");
  });

  it("keeps a Basic tone per appearance, moving the mode only for the other appearance", async () => {
    const { storage, values } = createStorage({ "t3code:theme": "custom-theme" });
    const { attributes, classes, root } = createDocumentRoot();
    classes.add("dark");
    stubWindow(storage);
    vi.stubGlobal("document", { documentElement: root });
    const { state, setAppearanceMode } = mockUseTheme(storage, classes);
    const setTheme = (theme: string) => {
      storage.setItem("t3code:theme", theme);
      return true;
    };

    const {
      BASIC_TONE_ATTRIBUTE,
      FORK_THEME_ATTRIBUTE,
      resetForkBasicTones,
      setForkAppearance,
      setForkBasicTone,
    } = await import("./forkTheme");
    // From an imported theme: Basic takes over upstream's standard theme, keeping the mode.
    setForkBasicTone("dark-cool", setTheme);
    expect(values.get("t3code:theme")).toBe("system");
    expect(values.get("t3code:fork-basic-tone-dark")).toBe("dark-cool");
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("basic");
    expect(attributes.get(BASIC_TONE_ATTRIBUTE)).toBe("dark-cool");
    expect(setAppearanceMode).not.toHaveBeenCalled();

    setForkBasicTone("cream", setTheme);
    expect(state.mode).toBe("light");
    expect(classes.has("dark")).toBe(false);
    expect(attributes.get(BASIC_TONE_ATTRIBUTE)).toBe("cream");
    // The dark tone is kept for when the user comes back to dark.
    expect(values.get("t3code:fork-basic-tone-dark")).toBe("dark-cool");

    // Restore defaults puts both tones back, the one not showing too, and leaves the mode.
    resetForkBasicTones();
    expect(values.has("t3code:fork-basic-tone-dark")).toBe(false);
    expect(attributes.get(BASIC_TONE_ATTRIBUTE)).toBe("light");
    expect(state.mode).toBe("light");

    // A mix on the standard theme hides Basic; picking Basic clears it.
    values.set("t3code:theme-halves:v1", JSON.stringify({ light: "t3-grove" }));
    setForkAppearance("basic", (theme) => {
      values.delete("t3code:theme-halves:v1");
      return setTheme(theme);
    });
    expect(values.has("t3code:theme-halves:v1")).toBe(false);
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("basic");
  });

  it("moves Inlet onto its colour's appearance, and Basic puts the mode back", async () => {
    const { storage, values } = createStorage({ "t3code:theme": "dark" });
    const { attributes, classes, root } = createDocumentRoot();
    classes.add("dark");
    stubWindow(storage);
    vi.stubGlobal("document", { documentElement: root });
    // Upstream's setTheme keeps the stored light/dark mode; only the mode moves the class. The
    // user follows the system, which is dark.
    const { state, setAppearanceMode } = mockUseTheme(storage, classes);
    const setTheme = (theme: string) => {
      storage.setItem("t3code:theme", theme);
      return true;
    };

    const { FORK_THEME_ATTRIBUTE, INLET_COLOR_ATTRIBUTE, setForkAppearance, setForkInletColor } =
      await import("./forkTheme");
    // Black, the default colour, sits on light.
    setForkAppearance("inlet", setTheme);
    expect(values.get("t3code:theme")).toBe("light");
    expect(classes.has("dark")).toBe(false);
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("inlet");
    expect(attributes.get(INLET_COLOR_ATTRIBUTE)).toBe("black");

    setForkInletColor("cream", setTheme);
    expect(values.get("t3code:theme")).toBe("dark");
    expect(values.get("t3code:fork-inlet-color")).toBe("cream");
    expect(classes.has("dark")).toBe(true);
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("inlet");
    expect(attributes.get(INLET_COLOR_ATTRIBUTE)).toBe("cream");

    // Leaving Inlet clears its colour from the DOM but keeps the preference, and puts back the
    // mode the palettes moved the user off: System, here, so the app follows the OS again.
    setForkAppearance("basic", setTheme);
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("basic");
    expect(attributes.has(INLET_COLOR_ATTRIBUTE)).toBe(false);
    expect(values.get("t3code:fork-inlet-color")).toBe("cream");
    expect(state.mode).toBe("system");
    expect(classes.has("dark")).toBe(true);

    // Both colours restyle the native chrome, so each pins the mode even when it already
    // matches (under System, the chrome override would flip the system appearance it follows),
    // and leaving puts System back too.
    setAppearanceMode.mockClear();
    setForkAppearance("inlet", setTheme);
    expect(setAppearanceMode).toHaveBeenCalledWith("dark");
    setForkAppearance("basic", setTheme);
    expect(state.mode).toBe("system");

    // A mode the user picks while on a palette is theirs: leaving leaves it alone.
    setForkAppearance("inlet", setTheme);
    setForkInletColor("black", setTheme);
    state.mode = "dark";
    setForkAppearance("basic", setTheme);
    expect(state.mode).toBe("dark");
  });
});
