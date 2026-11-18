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

import { applyForkMarker } from "~/custom/forkMarker";
import {
  BASIC_TONE_OPTIONS,
  BASIC_TONES,
  DEFAULT_BASIC_TONES,
  type BasicTone,
  initializeForkTheme,
  setForkBasicTone,
} from "~/custom/forkTheme";
import { installInletMenuMorph } from "~/custom/inletMenuMorph";
import { setTheme } from "~/hooks/useTheme";

import { StoryRouter } from "../stories/StoryRouter.tsx";
import { DocsPage } from "./DocsPage.tsx";
import { Surface, type SurfaceName } from "../stories/Surface.tsx";

// main.tsx's theme startup, unchanged.
applyForkMarker(document.documentElement);
initializeForkTheme();
installInletMenuMorph();

const isBasicTone = (value: unknown): value is BasicTone =>
  typeof value === "string" && (BASIC_TONES as ReadonlyArray<string>).includes(value);

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
    tone: {
      description: "Basic tone",
      toolbar: {
        title: "Tone",
        icon: "paintbrush",
        dynamicTitle: true,
        items: BASIC_TONES.map((tone) => ({
          value: tone,
          title: BASIC_TONE_OPTIONS[tone].label,
          right: BASIC_TONE_OPTIONS[tone].appearance,
        })),
      },
    },
  },
  initialGlobals: { tone: DEFAULT_BASIC_TONES.dark },
  // The tone moves the way Settings › Appearance moves it, so the root carries exactly the
  // attributes and classes the app would.
  beforeEach: ({ globals }) => {
    const tone: unknown = globals["tone"];
    setForkBasicTone(isBasicTone(tone) ? tone : DEFAULT_BASIC_TONES.dark, setTheme);
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
