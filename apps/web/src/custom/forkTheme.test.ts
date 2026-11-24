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
    expect(readBasicTone("dark")).toBe("darker-neutral");

    values.set("t3code:fork-theme", "neutral-darker");
    migrateLegacyForkPalettes();
    expect(readForkPalette()).toBe("basic");
    expect(readBasicTone("dark")).toBe("darker-neutral");
    expect(readBasicTone("light")).toBe("light");

    // Every retired dark tone and look becomes Darker Neutral, and stays written that way.
    for (const retired of [
      "cool",
      "dark-cool",
      "darkest-warm",
      "dark-neutral",
      "darkest-neutral",
    ]) {
      values.set("t3code:fork-basic-tone-dark", retired);
      migrateLegacyForkPalettes();
      expect(values.get("t3code:fork-basic-tone-dark")).toBe("darker-neutral");
    }

    // Cream, the retired light tone, becomes Light.
    values.set("t3code:fork-basic-tone-light", "cream");
    migrateLegacyForkPalettes();
    expect(values.get("t3code:fork-basic-tone-light")).toBe("light");

    // A tone stored for the wrong appearance is not that appearance's tone.
    values.set("t3code:fork-basic-tone-light", "darker-neutral");
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

    // Only the table's own keys migrate: a prototype name is left alone.
    for (const garbage of ["__proto__", "constructor", "toString"]) {
      values.set("t3code:fork-inlet-color", garbage);
      migrateLegacyForkPalettes();
      expect(values.get("t3code:fork-inlet-color")).toBe(garbage);
    }

    // A missing colour is the old default, Charcoal, only where Inlet is the palette.
    values.delete("t3code:fork-inlet-color");
    migrateLegacyForkPalettes();
    expect(values.has("t3code:fork-inlet-color")).toBe(false);
    values.set("t3code:fork-theme", "inlet");
    migrateLegacyForkPalettes();
    expect(values.get("t3code:fork-inlet-color")).toBe("cream");
  });

  it("paints a retired, missing or unknown Inlet colour as its successor when storage refuses the rewrite", async () => {
    for (const [stored, theme, painted] of [
      ["charcoal", "dark", "cream"],
      [undefined, "dark", "cream"],
      ["__proto__", "dark", "cream"],
      ["green", "light", "black"],
      ["jungle-light", "light", "black"],
    ] as const) {
      vi.resetModules();
      const { storage, values } = createStorage(
        {
          "t3code:theme": theme,
          "t3code:fork-theme": "inlet",
          "t3code:theme-appearance-mode": theme,
          ...(stored === undefined ? {} : { "t3code:fork-inlet-color": stored }),
        },
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
      );
      const { attributes, classes, root } = createDocumentRoot();
      if (theme === "dark") classes.add("dark");
      stubWindow(storage, { addEventListener: vi.fn() });
      vi.stubGlobal("document", { documentElement: root });
      mockUseTheme(storage, classes, { mode: theme });

      const { FORK_THEME_ATTRIBUTE, INLET_COLOR_ATTRIBUTE, initializeForkTheme } =
        await import("./forkTheme");
      initializeForkTheme();
      expect(values.get("t3code:fork-inlet-color"), String(stored)).toBe(stored);
      expect(attributes.get(FORK_THEME_ATTRIBUTE), String(stored)).toBe("inlet");
      expect(attributes.get(INLET_COLOR_ATTRIBUTE), String(stored)).toBe(painted);
      vi.doUnmock("../hooks/useTheme");
      vi.unstubAllGlobals();
    }
  });

  it("pins the mode when migrating an active Inlet colour onto one that restyles the chrome", async () => {
    for (const [stored, theme, pinned] of [
      [undefined, "dark", "dark"],
      ["charcoal", "dark", "dark"],
      ["green", "light", "light"],
      ["jungle-light", "light", "light"],
      // Jungle Art already asked for light chrome, as Cream does: a System it was left on stands.
      ["jungle", "dark", null],
    ] as const) {
      vi.resetModules();
      const { storage, values } = createStorage({
        "t3code:theme": theme,
        "t3code:fork-theme": "inlet",
        ...(stored === undefined ? {} : { "t3code:fork-inlet-color": stored }),
      });
      const { attributes, classes, root } = createDocumentRoot();
      if (theme === "dark") classes.add("dark");
      stubWindow(storage, { addEventListener: vi.fn() });
      vi.stubGlobal("document", { documentElement: root });
      // System follows an OS that already shows the colour's appearance.
      const { state, setAppearanceMode } = mockUseTheme(storage, classes, {
        systemDark: theme === "dark",
      });

      const { FORK_THEME_ATTRIBUTE, initializeForkTheme, setForkAppearance } =
        await import("./forkTheme");
      initializeForkTheme();
      expect(attributes.get(FORK_THEME_ATTRIBUTE), String(stored)).toBe("inlet");
      if (pinned === null) {
        expect(setAppearanceMode, String(stored)).not.toHaveBeenCalled();
      } else {
        expect(setAppearanceMode, String(stored)).toHaveBeenCalledWith(pinned);
        expect(values.get("t3code:fork-mode-before-palette"), String(stored)).toBe(
          JSON.stringify({ before: "system", set: pinned }),
        );
      }
      // Leaving Inlet puts System back.
      setForkAppearance("basic", (next) => {
        storage.setItem("t3code:theme", next);
        return true;
      });
      expect(state.mode, String(stored)).toBe("system");
      vi.doUnmock("../hooks/useTheme");
      vi.unstubAllGlobals();
    }

    // An older record from a Light the user has since left for System is replaced, so leaving
    // Inlet restores System, not Light.
    {
      vi.resetModules();
      const { storage, values } = createStorage({
        "t3code:theme": "dark",
        "t3code:fork-theme": "inlet",
        "t3code:fork-inlet-color": "charcoal",
        "t3code:fork-mode-before-palette": JSON.stringify({ before: "light", set: "dark" }),
      });
      const { classes, root } = createDocumentRoot();
      classes.add("dark");
      stubWindow(storage, { addEventListener: vi.fn() });
      vi.stubGlobal("document", { documentElement: root });
      const { state } = mockUseTheme(storage, classes);
      const { initializeForkTheme, setForkAppearance } = await import("./forkTheme");
      initializeForkTheme();
      expect(values.get("t3code:fork-mode-before-palette")).toBe(
        JSON.stringify({ before: "system", set: "dark" }),
      );
      setForkAppearance("basic", (next) => {
        storage.setItem("t3code:theme", next);
        return true;
      });
      expect(state.mode).toBe("system");
      vi.doUnmock("../hooks/useTheme");
      vi.unstubAllGlobals();
    }

    // No pin: a mode the user chose; a page System renders light, where Inlet Cream is not
    // showing; or a restore record storage refuses, without which leaving could not put System
    // back.
    for (const [name, options] of [
      ["explicit dark", { mode: "dark", renderedDark: true, refuseRecord: false }],
      ["rendered light", { mode: "system", renderedDark: false, refuseRecord: false }],
      ["record refused", { mode: "system", renderedDark: true, refuseRecord: true }],
    ] as const) {
      vi.resetModules();
      const { storage, values } = createStorage({
        "t3code:theme": "dark",
        "t3code:fork-theme": "inlet",
        "t3code:fork-inlet-color": "charcoal",
      });
      if (options.refuseRecord) {
        storage.setItem = (key, value) => {
          if (key === "t3code:fork-mode-before-palette") throw new Error("quota");
          values.set(key, value);
        };
      }
      const { classes, root } = createDocumentRoot();
      if (options.renderedDark) classes.add("dark");
      stubWindow(storage, { addEventListener: vi.fn() });
      vi.stubGlobal("document", { documentElement: root });
      const { setAppearanceMode } = mockUseTheme(storage, classes, {
        mode: options.mode,
        systemDark: options.renderedDark,
      });
      const { initializeForkTheme } = await import("./forkTheme");
      initializeForkTheme();
      expect(setAppearanceMode, name).not.toHaveBeenCalled();
      expect(values.has("t3code:fork-mode-before-palette"), name).toBe(false);
      vi.doUnmock("../hooks/useTheme");
      vi.unstubAllGlobals();
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
    expect(attributes.get(BASIC_TONE_ATTRIBUTE)).toBe("darker-neutral");

    // System turns light: Basic follows, onto the light tone (a retired one reads as Light).
    values.set("t3code:fork-basic-tone-light", "cream");
    classes.delete("dark");
    themeChangeHandler?.();
    expect(attributes.get(BASIC_TONE_ATTRIBUTE)).toBe("light");

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
    setForkBasicTone("darker-neutral", setTheme);
    expect(values.get("t3code:theme")).toBe("system");
    expect(values.get("t3code:fork-basic-tone-dark")).toBe("darker-neutral");
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("basic");
    expect(attributes.get(BASIC_TONE_ATTRIBUTE)).toBe("darker-neutral");
    expect(setAppearanceMode).not.toHaveBeenCalled();

    setForkBasicTone("light", setTheme);
    expect(state.mode).toBe("light");
    expect(classes.has("dark")).toBe(false);
    expect(attributes.get(BASIC_TONE_ATTRIBUTE)).toBe("light");
    // The dark tone is kept for when the user comes back to dark.
    expect(values.get("t3code:fork-basic-tone-dark")).toBe("darker-neutral");

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
    // Cream, the default colour, sits on dark. Both colours restyle the native chrome, so each
    // pins the mode even when it already matches (under System, the chrome override would flip
    // the system appearance it follows).
    setForkAppearance("inlet", setTheme);
    expect(values.get("t3code:theme")).toBe("dark");
    expect(classes.has("dark")).toBe(true);
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("inlet");
    expect(attributes.get(INLET_COLOR_ATTRIBUTE)).toBe("cream");
    expect(setAppearanceMode).toHaveBeenCalledWith("dark");

    setForkInletColor("black", setTheme);
    expect(values.get("t3code:theme")).toBe("light");
    expect(values.get("t3code:fork-inlet-color")).toBe("black");
    expect(classes.has("dark")).toBe(false);
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("inlet");
    expect(attributes.get(INLET_COLOR_ATTRIBUTE)).toBe("black");

    // Leaving Inlet clears its colour from the DOM but keeps the preference, and puts back the
    // mode the palettes moved the user off: System, here, so the app follows the OS again.
    setForkAppearance("basic", setTheme);
    expect(attributes.get(FORK_THEME_ATTRIBUTE)).toBe("basic");
    expect(attributes.has(INLET_COLOR_ATTRIBUTE)).toBe(false);
    expect(values.get("t3code:fork-inlet-color")).toBe("black");
    expect(state.mode).toBe("system");
    expect(classes.has("dark")).toBe(true);

    // A mode the user picks while on a palette is theirs: leaving leaves it alone.
    setForkAppearance("inlet", setTheme);
    state.mode = "dark";
    setForkAppearance("basic", setTheme);
    expect(state.mode).toBe("dark");
  });
});
