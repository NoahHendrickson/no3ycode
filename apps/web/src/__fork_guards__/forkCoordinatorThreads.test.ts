// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-coordinator-threads`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { ThreadId } from "@t3tools/contracts";
import { FORK_BOT_THREAD_TAG } from "@t3tools/shared/forkBotTags";
import { describe, expect, it } from "vite-plus/test";

import {
  coordinatorMenuItems,
  coordinatorMenuTurnsOn,
  FORK_COORDINATOR_TAG,
  isCoordinatorMenuId,
} from "../custom/coordinator/coordinatorThreads";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

const root = { rootThreadId: ThreadId.make("t"), parentThreadId: null, relationshipToParent: null };

describe("fork guard: fork-coordinator-threads", () => {
  it("switches a listed thread on and off, and never a Petal or a subagent", () => {
    const [on] = coordinatorMenuItems({ tags: [], lineage: root }, true);
    expect(on?.label).toBe("Make coordinator");
    expect(on !== undefined && coordinatorMenuTurnsOn(on.id)).toBe(true);
    const [off] = coordinatorMenuItems({ tags: [FORK_COORDINATOR_TAG], lineage: root }, true);
    expect(off?.label).toBe("Stop coordinating");
    expect(off !== undefined && coordinatorMenuTurnsOn(off.id)).toBe(false);
    expect(coordinatorMenuItems({ tags: [FORK_BOT_THREAD_TAG], lineage: root }, true)).toEqual([]);
    const subagent = {
      ...root,
      parentThreadId: ThreadId.make("p"),
      relationshipToParent: "subagent" as const,
    };
    expect(coordinatorMenuItems({ tags: [], lineage: subagent }, true)).toEqual([]);
    expect(isCoordinatorMenuId("pin")).toBe(false);
  });

  it("offers the switch in the sidebar's thread menu and the chat header's", () => {
    for (const path of ["../components/Sidebar.tsx", "../hooks/useThreadActionMenu.ts"]) {
      const source = read(path);
      expect(source).toContain("...coordinatorMenuItems(");
      expect(source).toContain("if (isCoordinatorMenuId(clicked.value)) {");
    }
  });
});
