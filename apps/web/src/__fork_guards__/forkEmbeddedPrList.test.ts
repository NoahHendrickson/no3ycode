// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard & tests for `fork-embedded-pr-list` (.fork/customizations.yaml#fork-embedded-pr-list). */

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { useClosedViewStore } from "../closedViewStore";
import { reopenClosedView } from "../reopenClosedView";
import {
  decodePullRequestsSurface,
  hostRightPanel,
  migratePersistedRightPanelState,
  selectActiveRightPanelSurface,
  selectThreadRightPanelState,
  useRightPanelStore,
} from "../rightPanelStore";

const readSibling = (relativePath: string) =>
  NodeFS.readFileSync(
    NodePath.resolve(NodeURL.fileURLToPath(new URL(".", import.meta.url)), relativePath),
    "utf8",
  );

const hostRef = scopeThreadRef(EnvironmentId.make("env-1"), ThreadId.make("sprint-host"));
const childARef = scopeThreadRef(EnvironmentId.make("env-1"), ThreadId.make("child-a"));
const childBRef = scopeThreadRef(EnvironmentId.make("env-1"), ThreadId.make("child-b"));
const remoteChildRef = scopeThreadRef(EnvironmentId.make("env-2"), ThreadId.make("child-remote"));

beforeEach(() => {
  useClosedViewStore.setState({ entries: [] });
  useRightPanelStore.setState({
    byThreadKey: {},
    threadPanelVisibilityByThreadKey: {},
    userActionRevisionByThreadKey: {},
    closeRevisionByThreadKey: {},
  });
});

describe("fork-embedded-pr-list", () => {
  it("keeps normal threads on the upstream singleton pull-requests surface", () => {
    const store = useRightPanelStore.getState();
    store.open(hostRef, "pull-requests");

    const state = selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, hostRef);
    expect(state).toEqual({
      isOpen: true,
      activeSurfaceId: "pull-requests",
      surfaces: [{ id: "pull-requests", kind: "pull-requests" }],
    });

    store.toggle(hostRef, "pull-requests");
    expect(
      selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, hostRef).isOpen,
    ).toBe(false);

    store.toggle(hostRef, "pull-requests");
    expect(
      selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, hostRef),
    ).toEqual({ id: "pull-requests", kind: "pull-requests" });
  });

  it("remembers the embedded child's threadRef in the host panel without colliding with host or siblings", () => {
    const store = useRightPanelStore.getState();
    const unhostA = hostRightPanel(childARef, hostRef);
    const unhostB = hostRightPanel(childBRef, hostRef);
    const unhostRemote = hostRightPanel(remoteChildRef, hostRef);
    try {
      store.open(hostRef, "pull-requests");
      store.open(childARef, "pull-requests");
      store.open(childBRef, "pull-requests");
      store.open(remoteChildRef, "pull-requests");

      const hostState = selectThreadRightPanelState(
        useRightPanelStore.getState().byThreadKey,
        hostRef,
      );
      expect(hostState.isOpen).toBe(true);
      expect(hostState.activeSurfaceId).toBe(`pull-requests:${scopedThreadKey(remoteChildRef)}`);
      expect(hostState.surfaces).toEqual([
        { id: "pull-requests", kind: "pull-requests" },
        {
          id: `pull-requests:${scopedThreadKey(childARef)}`,
          kind: "pull-requests",
          threadRef: childARef,
        },
        {
          id: `pull-requests:${scopedThreadKey(childBRef)}`,
          kind: "pull-requests",
          threadRef: childBRef,
        },
        {
          id: `pull-requests:${scopedThreadKey(remoteChildRef)}`,
          kind: "pull-requests",
          threadRef: remoteChildRef,
        },
      ]);
      // Child panels themselves remain empty while hosted.
      expect(
        selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, childARef).surfaces,
      ).toEqual([]);

      // Re-opening childA activates its existing tab instead of duplicating it.
      store.open(childARef, "pull-requests");
      const afterReactivate = selectThreadRightPanelState(
        useRightPanelStore.getState().byThreadKey,
        hostRef,
      );
      expect(afterReactivate.surfaces).toHaveLength(4);
      expect(afterReactivate.activeSurfaceId).toBe(`pull-requests:${scopedThreadKey(childARef)}`);

      // Toggling host switches to host's own list instead of closing childA's; toggling again closes.
      store.toggle(hostRef, "pull-requests");
      expect(
        selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, hostRef),
      ).toEqual({ id: "pull-requests", kind: "pull-requests" });
      store.toggle(hostRef, "pull-requests");
      expect(
        selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, hostRef).isOpen,
      ).toBe(false);

      // Toggling childA opens childA's list, and toggling childA again closes it.
      store.toggle(childARef, "pull-requests");
      expect(
        selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, hostRef),
      ).toEqual({
        id: `pull-requests:${scopedThreadKey(childARef)}`,
        kind: "pull-requests",
        threadRef: childARef,
      });
      store.toggle(childARef, "pull-requests");
      expect(
        selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, hostRef).isOpen,
      ).toBe(false);
    } finally {
      unhostA();
      unhostB();
      unhostRemote();
    }
  });

  it("persists, migrates, and reopens closed host and child pull-requests tabs after unhosting", async () => {
    const store = useRightPanelStore.getState();
    const unhostA = hostRightPanel(childARef, hostRef);
    store.open(hostRef, "pull-requests");
    store.open(childARef, "pull-requests");
    unhostA();

    // Persisted migration preserves valid host and child surfaces and drops malformed ones.
    const childSurfaceId = `pull-requests:${scopedThreadKey(childARef)}`;
    const migrated = migratePersistedRightPanelState({
      byThreadKey: {
        [scopedThreadKey(hostRef)]: {
          isOpen: true,
          activeSurfaceId: childSurfaceId,
          surfaces: [
            { id: "pull-requests", kind: "pull-requests" },
            { id: "pull-requests:stale-id", kind: "pull-requests", threadRef: childARef },
            { id: "pull-requests:bad", kind: "pull-requests" },
            { id: "pull-requests:empty", kind: "pull-requests", threadRef: { environmentId: "" } },
          ],
        },
      },
    });
    expect(selectThreadRightPanelState(migrated.byThreadKey, hostRef)).toEqual({
      isOpen: true,
      activeSurfaceId: childSurfaceId,
      surfaces: [
        { id: "pull-requests", kind: "pull-requests" },
        { id: childSurfaceId, kind: "pull-requests", threadRef: childARef },
      ],
    });
    expect(decodePullRequestsSurface({ id: "diff", kind: "diff" })).toBeNull();

    // Closing the child's PR list tab and reopening it AFTER unhosting still restores it in hostRef.
    store.closeSurface(hostRef, childSurfaceId);
    const closedEntry = useClosedViewStore.getState().entries[0];
    expect(closedEntry).toMatchObject({
      kind: "panel-tab",
      threadRef: hostRef,
      surface: { id: childSurfaceId, kind: "pull-requests", threadRef: childARef },
    });

    // Simulate closed-view persistence migration to verify closedViewStore accepts the shape.
    const closedMigrated = useClosedViewStore.persist
      .getOptions()
      .migrate?.({ entries: [closedEntry] }, 3) as { entries: unknown[] };
    expect(closedMigrated.entries).toEqual([closedEntry]);

    const reopened = await reopenClosedView(closedEntry!, {
      workspaceAvailable: true,
      openPreview: () => {
        throw new Error("A PR list tab must not create a browser session");
      },
    });
    expect(reopened).toBe(true);
    expect(
      selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, hostRef),
    ).toEqual({
      id: childSurfaceId,
      kind: "pull-requests",
      threadRef: childARef,
    });
    expect(
      selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, childARef).surfaces,
    ).toEqual([]);

    // Closing and reopening host's own PR list tab still restores the plain singleton surface.
    store.closeSurface(hostRef, "pull-requests");
    const hostClosedEntry = useClosedViewStore.getState().entries[0];
    expect(hostClosedEntry).toMatchObject({
      kind: "panel-tab",
      threadRef: hostRef,
      surface: { id: "pull-requests", kind: "pull-requests" },
    });
    expect(
      await reopenClosedView(hostClosedEntry!, {
        workspaceAvailable: true,
        openPreview: () => {
          throw new Error("A PR list tab must not create a browser session");
        },
      }),
    ).toBe(true);
    expect(
      selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, hostRef),
    ).toEqual({ id: "pull-requests", kind: "pull-requests" });
  });

  it("wires RightPanelSurfaceContent, ThreadPullRequestsPanel, and RightPanelTabs to the surface threadRef", () => {
    const content = readSibling("../components/chat/RightPanelSurfaceContent.tsx");
    const panel = readSibling("../components/pullRequest/ThreadPullRequestsPanel.tsx");
    const tabs = readSibling("../components/RightPanelTabs.tsx");
    const openLink = readSibling("../lib/openPullRequestLink.ts");
    const issues = readSibling("../components/chat/ThreadDetailsIssueRows.tsx");
    const indicators = readSibling("../components/ThreadStatusIndicators.tsx");

    expect(content).toContain("threadRef={surface.threadRef ?? threadRef}");
    expect(content).toContain("panelRef={threadRef}");
    expect(panel).toContain("useOpenPrLink(threadRef, panelRef)");
    expect(panel).toContain("panelRef={panelRef}");
    expect(openLink).toContain("useOpenChangeRequestLink(threadRef, panelRef)");
    expect(issues).toContain("openIssue(panelRef,");
    expect(tabs).toContain('surface.kind === "pull-requests" ? (surface.threadRef ?? null) : null');
    // ThreadStatusIndicators requires a real list opener again.
    expect(indicators).not.toContain("(() => void) | null");
  });
});
