/** Fork guard — see `.fork/customizations.yaml#fork-details-card-closed`. */

import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { type EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { selectThreadPanelOpen, useRightPanelStore } from "../rightPanelStore";

const ref = scopeThreadRef("env-1" as EnvironmentId, ThreadId.make("thread-A"));

describe("fork guard: fork-details-card-closed", () => {
  it("starts a thread's details card closed and persists only the threads it was opened on", () => {
    useRightPanelStore.setState(useRightPanelStore.getInitialState());
    const persisted = () =>
      (
        useRightPanelStore.persist.getOptions().partialize?.(useRightPanelStore.getState()) as
          | { readonly threadPanelVisibilityByThreadKey: unknown }
          | undefined
      )?.threadPanelVisibilityByThreadKey;

    expect(selectThreadPanelOpen({}, ref, "inline")).toBe(false);
    expect(persisted()).toEqual({});

    useRightPanelStore.getState().setThreadPanelOpen(ref, "inline", true);
    expect(persisted()).toEqual({ "env-1:thread-A": { inlineOpen: true, popoverOpen: false } });

    useRightPanelStore.getState().setThreadPanelOpen(ref, "inline", false);
    expect(persisted()).toEqual({});
  });
});
