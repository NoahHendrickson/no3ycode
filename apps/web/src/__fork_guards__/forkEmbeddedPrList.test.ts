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
  pullRequestSurface,
  pullRequestSurfaceId,
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

    expect(selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, hostRef)).toEqual(
      {
        isOpen: true,
        activeSurfaceId: "pull-requests",
        surfaces: [{ id: "pull-requests", kind: "pull-requests" }],
      },
    );
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
    } finally {
      unhostA();
      unhostB();
      unhostRemote();
    }
  });

  it("persists, migrates, and reopens closed host/child PR lists and listThreadRef PR tabs after unhosting", async () => {
    const store = useRightPanelStore.getState();
    const unhostA = hostRightPanel(childARef, hostRef);
    store.open(hostRef, "pull-requests");
    store.open(childARef, "pull-requests");
    unhostA();

    const childSurfaceId = `pull-requests:${scopedThreadKey(childARef)}`;
    const pr = {
      projectId: "project-a",
      repository: "noahhendrickson/no3ycode",
      number: 202,
      listThreadRef: childARef,
    };
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
            pullRequestSurface(pr),
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
        pullRequestSurface(pr),
      ],
    });
    expect(decodePullRequestsSurface({ id: "diff", kind: "diff" })).toBeNull();

    // Closing the child's PR list tab and reopening it AFTER unhosting restores it in hostRef.
    store.closeSurface(hostRef, childSurfaceId);
    const closedEntry = useClosedViewStore.getState().entries[0];
    expect(closedEntry).toMatchObject({
      kind: "panel-tab",
      threadRef: hostRef,
      surface: { id: childSurfaceId, kind: "pull-requests", threadRef: childARef },
    });

    const closedMigrated = useClosedViewStore.persist
      .getOptions()
      .migrate?.({ entries: [closedEntry] }, 3) as { entries: unknown[] };
    expect(closedMigrated.entries).toEqual([closedEntry]);

    expect(
      await reopenClosedView(closedEntry!, {
        workspaceAvailable: true,
        openPreview: () => {
          throw new Error("A PR list tab must not create a browser session");
        },
      }),
    ).toBe(true);
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

    // Closing and reopening host's own PR list restores the plain singleton surface.
    store.closeSurface(hostRef, "pull-requests");
    const hostClosedEntry = useClosedViewStore.getState().entries[0];
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

    // openIssue strips redundant same-environment environmentId and keeps foreign ones.
    store.openIssue(hostRef, {
      environmentId: hostRef.environmentId,
      projectId: "project-a",
      tracker: "github",
      scope: "noahhendrickson/no3ycode",
      key: "12",
    });
    expect(
      selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, hostRef),
    ).not.toHaveProperty("environmentId");
    store.openIssue(hostRef, {
      environmentId: remoteChildRef.environmentId,
      projectId: "project-a",
      tracker: "github",
      scope: "noahhendrickson/no3ycode",
      key: "13",
    });
    expect(
      selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, hostRef),
    ).toMatchObject({ environmentId: remoteChildRef.environmentId });

    // PR tab preserves listThreadRef across openPullRequest and closed-view reopen.
    store.openPullRequest(hostRef, {
      ...pr,
      url: "https://github.com/noahhendrickson/no3ycode/pull/202",
    });
    expect(
      selectActiveRightPanelSurface(useRightPanelStore.getState().byThreadKey, hostRef),
    ).toMatchObject({ id: pullRequestSurfaceId(pr), listThreadRef: childARef });
  });

  it("removes the nullable list opener workaround from ThreadStatusIndicators", () => {
    const indicators = readSibling("../components/ThreadStatusIndicators.tsx");
    expect(indicators).not.toContain("(() => void) | null");
  });
});
