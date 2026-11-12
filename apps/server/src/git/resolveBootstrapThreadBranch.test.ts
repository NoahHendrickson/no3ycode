import { assert, describe, it } from "@effect/vitest";
import * as Schema from "effect/Schema";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { ProjectId, ThreadId } from "@t3tools/contracts";
import { buildTemporaryWorktreeBranchName } from "@t3tools/shared/git";
import { vi } from "vite-plus/test";

import {
  type BootstrapThreadBranchDeps,
  type BootstrapThreadBranchInput,
  resolveBootstrapThreadBranch,
} from "./resolveBootstrapThreadBranch.ts";

class TestFailure extends Schema.TaggedError<TestFailure>()("TestFailure", {
  detail: Schema.String,
}) {}

type Deps = BootstrapThreadBranchDeps<TestFailure, TestFailure>;

const projectId = ProjectId.make("project-1");

const makeInput = (
  overrides: Partial<BootstrapThreadBranchInput> = {},
): BootstrapThreadBranchInput => ({
  threadId: ThreadId.make("thread-1"),
  projectId,
  branch: null,
  worktreePath: null,
  preparingWorktree: false,
  ...overrides,
});

const makeDeps = (overrides: Partial<Deps> = {}) => {
  const getProjectShellById = vi.fn(
    (requested: ProjectId): ReturnType<Deps["getProjectShellById"]> =>
      Effect.succeed(
        requested === projectId ? Option.some({ workspaceRoot: "/repo" }) : Option.none(),
      ),
  );
  const currentBranch = vi.fn((_cwd: string): ReturnType<Deps["currentBranch"]> =>
    Effect.succeed("feature/from-phone"),
  );
  return {
    getProjectShellById,
    currentBranch,
    deps: { getProjectShellById, currentBranch, ...overrides } satisfies Deps,
  };
};

describe("resolveBootstrapThreadBranch", () => {
  it.effect("keeps an explicit client branch without touching git", () =>
    Effect.gen(function* () {
      const { deps, getProjectShellById, currentBranch } = makeDeps();
      const branch = yield* resolveBootstrapThreadBranch(makeInput({ branch: "picked" }), deps);
      assert.strictEqual(branch, "picked");
      assert.strictEqual(getProjectShellById.mock.calls.length, 0);
      assert.strictEqual(currentBranch.mock.calls.length, 0);
    }),
  );

  it.effect("leaves a worktree being prepared to name its own branch", () =>
    Effect.gen(function* () {
      const { deps, currentBranch } = makeDeps();
      const branch = yield* resolveBootstrapThreadBranch(
        makeInput({ preparingWorktree: true }),
        deps,
      );
      assert.isNull(branch);
      assert.strictEqual(currentBranch.mock.calls.length, 0);
    }),
  );

  it.effect("reads the project root when the thread has no worktree", () =>
    Effect.gen(function* () {
      const { deps, currentBranch } = makeDeps();
      const branch = yield* resolveBootstrapThreadBranch(makeInput(), deps);
      assert.strictEqual(branch, "feature/from-phone");
      assert.deepEqual(
        currentBranch.mock.calls.map((call) => call[0]),
        ["/repo"],
      );
    }),
  );

  it.effect("reads an existing worktree instead of the project root", () =>
    Effect.gen(function* () {
      const { deps, getProjectShellById, currentBranch } = makeDeps();
      const branch = yield* resolveBootstrapThreadBranch(
        makeInput({ worktreePath: "/repo-wt" }),
        deps,
      );
      assert.strictEqual(branch, "feature/from-phone");
      assert.strictEqual(getProjectShellById.mock.calls.length, 0);
      assert.deepEqual(
        currentBranch.mock.calls.map((call) => call[0]),
        ["/repo-wt"],
      );
    }),
  );

  it.effect("stays null for an unknown project", () =>
    Effect.gen(function* () {
      const { deps, currentBranch } = makeDeps();
      const branch = yield* resolveBootstrapThreadBranch(
        makeInput({ projectId: ProjectId.make("project-missing") }),
        deps,
      );
      assert.isNull(branch);
      assert.strictEqual(currentBranch.mock.calls.length, 0);
    }),
  );

  it.effect("stays null on a detached HEAD or non-repository checkout", () =>
    Effect.gen(function* () {
      const { deps } = makeDeps({ currentBranch: () => Effect.succeed(null) });
      assert.isNull(yield* resolveBootstrapThreadBranch(makeInput(), deps));
    }),
  );

  it.effect("never adopts a temporary worktree placeholder branch", () =>
    Effect.gen(function* () {
      const { deps } = makeDeps({
        currentBranch: () => Effect.succeed(buildTemporaryWorktreeBranchName(() => "0123abcd")),
      });
      assert.isNull(yield* resolveBootstrapThreadBranch(makeInput({ worktreePath: "/wt" }), deps));
    }),
  );

  it.effect("stays null when the branch lookup fails or defects", () =>
    Effect.gen(function* () {
      const failing = makeDeps({
        currentBranch: () => Effect.fail(new TestFailure({ detail: "git exploded" })),
      });
      assert.isNull(yield* resolveBootstrapThreadBranch(makeInput(), failing.deps));
      const dying = makeDeps({ currentBranch: () => Effect.die(new Error("git exploded")) });
      assert.isNull(yield* resolveBootstrapThreadBranch(makeInput(), dying.deps));
      const lookupFailing = makeDeps({
        getProjectShellById: () =>
          Effect.fail(new TestFailure({ detail: "projection unavailable" })),
      });
      assert.isNull(yield* resolveBootstrapThreadBranch(makeInput(), lookupFailing.deps));
    }),
  );
});
