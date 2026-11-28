import type { ScopedThreadRef } from "@t3tools/contracts";
import { createContext } from "react";

/** Host panel ref provided by `EmbeddedThreadPullRequestsPanel` so PR and issue clicks inside a
 * foreign thread's list open in the visible host panel even after the child unmounts. */
export const RightPanelOwnerContext = createContext<ScopedThreadRef | null>(null);
