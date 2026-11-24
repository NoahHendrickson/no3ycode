/**
 * One page colour for the no3y iOS app — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * Every dark theme's page tokens become the mocks' #191817 on iOS, in both the Uniwind CSS
 * variables (class names) and the JS theme variables (native headers, sheets, inline styles), so
 * Threads, a thread, Chat, Automations, New agent and sheets share one background.
 */
import { BUILT_IN_THEME_IDS } from "@t3tools/shared/themePalettes";

export const NO3Y_PAGE_COLOR = "#191817";
/** rgba(255, 255, 255, 0.04) over the page, flattened. */
export const NO3Y_CARD_COLOR = "#222120";

/** The page-colour and card tokens, with the alpha each theme gives them. */
const NO3Y_DARK_PAGE_VARIABLES = {
  "--color-screen": NO3Y_PAGE_COLOR,
  "--color-sheet": "rgba(25, 24, 23, 0.98)",
  "--color-sheet-solid": NO3Y_PAGE_COLOR,
  "--color-thread-canvas": NO3Y_PAGE_COLOR,
  "--color-composer-panel": "rgba(25, 24, 23, 0.92)",
  "--color-header": "rgba(25, 24, 23, 0.97)",
  "--color-status-bar": NO3Y_PAGE_COLOR,
  "--color-sidebar-search": NO3Y_PAGE_COLOR,
  // Grouped cards: the composite of a 4% white wash on the page, not the themes' cool grey.
  // Opaque, because rows nest in these cards and lift out of them while dragged.
  "--color-grouped-card": NO3Y_CARD_COLOR,
  "--color-glass-fallback": "rgba(34, 33, 32, 0.9)",
  // A selected row reads one more 4% step up.
  "--color-thread-selected": "#2b2a29",
} as const;

/** The Uniwind theme names whose dark page tokens the override replaces. */
export const NO3Y_DARK_UNIWIND_THEMES = [
  "dark",
  ...BUILT_IN_THEME_IDS.map((themeId) => `${themeId}-dark` as const),
] as const;

export function no3yDarkPageVariables(): Readonly<Record<string, string>> {
  return NO3Y_DARK_PAGE_VARIABLES;
}

/** A theme's JS variables with the shared page colour, for a dark theme on iOS. */
export function withNo3yPageColor<V extends Readonly<Record<string, string>>>(
  variables: V,
  appearance: "light" | "dark",
  platform: string,
): V {
  return platform === "ios" && appearance === "dark"
    ? { ...variables, ...NO3Y_DARK_PAGE_VARIABLES }
    : variables;
}
