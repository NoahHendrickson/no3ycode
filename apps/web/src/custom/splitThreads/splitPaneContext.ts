/**
 * Which split pane a ChatView is in — see `.fork/customizations.yaml#fork-split-threads`.
 *
 * Every ChatView reads this. Outside a split it is the one focused pane, so
 * nothing changes. Inside a split, or under a floating window, only the
 * focused pane may answer window-level input. Shortcuts, paste-to-focus, menu
 * actions and dictation listen on the window, and two panes answering would
 * act twice. The route's thread is focused until the user presses into the
 * floating window, which then holds focus until a press back in the column.
 */
import { createContext, use, useContext } from "react";
import { BackgroundThreadContext } from "~/components/chat/backgroundThread";

/** A header control that moves the pane's thread somewhere else. */
export interface PaneAction<K extends string> {
  readonly kind: K;
  readonly run: () => void;
}

/** Moves a pane between the column and the window. */
export type PaneWindowAction = PaneAction<"float" | "dock">;
/** Docks a thread as the column's right pane, or undocks the one docked there. */
export type PaneDockAction = PaneAction<"dock" | "undock">;

export interface SplitPaneState {
  /** True while two panes share the column. */
  readonly split: boolean;
  /** This pane owns window-level input. */
  readonly focused: boolean;
  /** The left pane, the only one that can sit under the macOS traffic lights. */
  readonly leading: boolean;
  /** The window is wide enough for two panes and no docked thread owns the column. */
  readonly canSplit: boolean;
  /** Hands the route to the other pane's thread, so this one can close.
      Resolves false when the route could not leave this pane. */
  readonly focusPartner: () => Promise<boolean>;
  /** This pane is the window floating over the column. */
  readonly floating: boolean;
  /** Float lifts a started thread into the window; the column keeps its split
      partner, or goes back to the route's previous thread. Dock lands the
      window beside the column's thread. Null when neither applies. */
  readonly windowAction: PaneWindowAction | null;
  readonly dockAction: PaneDockAction | null;
}

export const SINGLE_PANE: SplitPaneState = {
  split: false,
  focused: true,
  leading: true,
  canSplit: false,
  focusPartner: async () => true,
  floating: false,
  windowAction: null,
  dockAction: null,
};

export const SplitPaneContext = createContext<SplitPaneState>(SINGLE_PANE);

export function useSplitPane(): SplitPaneState {
  return useContext(SplitPaneContext);
}

/** This pane takes window-level input: focused in a split, and not behind Settings or Usage. */
export function useOwnsGlobalInput(): boolean {
  return useSplitPane().focused && !use(BackgroundThreadContext);
}
