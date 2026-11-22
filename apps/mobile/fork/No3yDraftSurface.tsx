/**
 * What the no3y iPhone layout swaps into NewTaskDraftScreen: its header, the content in place of
 * the hero, and the controls above the composer — Chat's (No3yChatRouteScreen.tsx, through this
 * context) or New agent's project tiles — see `.fork/customizations.yaml#no3y-mobile-redesign`.
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

export const No3yChatDraftContext = createContext<No3yDraftSurface | null>(null);

/** Chat's surface on the Chat route, New agent's on the no3y iPhone layout, else null. */
export function useNo3yDraftSurface(): No3yDraftSurface | null {
  const chat = use(No3yChatDraftContext);
  const enabled = useNo3yBottomNavEnabled();
  return chat ?? (enabled ? NO3Y_NEW_AGENT_SURFACE : null);
}
