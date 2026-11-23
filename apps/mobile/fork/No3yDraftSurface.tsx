/**
 * What the no3y iPhone layout swaps into NewTaskDraftScreen: its header, the content in place of
 * the hero, and the controls above the composer — Chat's or New agent's, given by their Home tabs
 * (fork/No3yHomePanes.tsx) through this context; a draft thread route gets New agent's — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import { createContext, use, type ReactNode } from "react";

import { useNo3yBottomNavEnabled } from "./No3yBottomNav";
import { NO3Y_NEW_AGENT_SURFACE } from "./No3yNewAgent";

export interface No3yDraftSurface {
  readonly header: ReactNode;
  readonly content: (headerInset: number, bottomInset: number) => ReactNode;
  /** Above the composer, in place of the context and workspace controls; a clone banner stays. */
  readonly controls: ReactNode;
  /** Where a sent draft goes instead of turning this route into its thread. */
  readonly onSubmitted?: (environmentId: string, threadId: string) => void;
}

export const No3yDraftSurfaceContext = createContext<No3yDraftSurface | null>(null);

/** A Home tab's surface, New agent's on another no3y iPhone draft, else null. */
export function useNo3yDraftSurface(): No3yDraftSurface | null {
  const tab = use(No3yDraftSurfaceContext);
  const enabled = useNo3yBottomNavEnabled();
  return tab ?? (enabled ? NO3Y_NEW_AGENT_SURFACE : null);
}
