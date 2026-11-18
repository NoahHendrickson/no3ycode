import "./appearance.ts";
// The app's stylesheets, in main.tsx's order (__fork_guards__/forkStorybook.test.ts keeps them in step).
import "@fontsource-variable/inter";
import "~/index.css";
import "~/theme.custom.css";
import "~/theme.custom.palettes.css";
import "~/theme.custom.glass-surfaces.css";
import "~/theme.custom.glass-stage.css";
import "~/theme.custom.focus-rings.css";

import type { Decorator, Preview } from "@storybook/react-vite";

import { initializeForkGlass3d } from "~/custom/forkGlass3d";
import { applyForkMarker } from "~/custom/forkMarker";
import {
  COOL_DARKER_THEME,
  initializeForkTheme,
  INLET_THEME,
  setForkAppearance,
  setForkBasicTone,
  setForkInletColor,
} from "~/custom/forkTheme";
import { installInletMenuMorph } from "~/custom/inletMenuMorph";
import { setTheme } from "~/hooks/useTheme";

import { forceStateStyles } from "../stories/forcedStates.ts";
import { DEFAULT_STORY_THEME, STORY_THEME_ITEMS, storyTheme } from "../stories/storyTheme.ts";
import { StoryRouter } from "../stories/StoryRouter.tsx";
import { DocsPage } from "./DocsPage.tsx";
import { Surface, type SurfaceName } from "../stories/Surface.tsx";

// main.tsx's theme startup, unchanged.
applyForkMarker(document.documentElement);
initializeForkTheme();
initializeForkGlass3d();
installInletMenuMorph();

const withSurface: Decorator = (Story, context) => {
  const surface = (
    <Surface
      name={(context.parameters["surface"] as SurfaceName | undefined) ?? "stage"}
      inline={context.viewMode === "docs"}
    >
      <Story />
    </Surface>
  );
  // `parameters.router`: a path (or true for "/") mounts the story under a memory router.
  const router: unknown = context.parameters["router"];
  if (router === undefined || router === false) return surface;
  return <StoryRouter path={typeof router === "string" ? router : "/"}>{surface}</StoryRouter>;
};

const preview: Preview = {
  decorators: [withSurface],
  globalTypes: {
    theme: {
      description: "Theme: a Basic tone, Glass, or an Inlet colour",
      toolbar: { title: "Theme", icon: "paintbrush", dynamicTitle: true, items: STORY_THEME_ITEMS },
    },
  },
  initialGlobals: { theme: DEFAULT_STORY_THEME },
  // The theme moves the way Settings › Appearance moves it, so the root carries exactly the
  // attributes and classes the app would. State grids force hover and focus
  // through selectors extended in place, once per sheet rather than from a render.
  beforeEach: ({ globals }) => {
    const theme = storyTheme(globals);
    if (theme.palette === "basic") setForkBasicTone(theme.tone, setTheme);
    else if (theme.palette === "glass") setForkAppearance(COOL_DARKER_THEME, setTheme);
    else {
      setForkInletColor(theme.color, setTheme);
      setForkAppearance(INLET_THEME, setTheme);
    }
    forceStateStyles();
  },
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    options: {
      storySort: {
        order: ["Introduction", "Foundations", "Components", "Fork", "Blocks"],
      },
    },
    docs: { page: DocsPage, story: { inline: true }, source: { type: "code" } },
  },
};

export default preview;
