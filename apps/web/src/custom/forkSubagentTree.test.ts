import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import {
  forkSubagentMembers,
  forkSubagentRowFromAgent,
  formatForkSubagentModel,
  resolveForkSubagentTree,
  type ForkSubagentItem,
} from "./forkSubagentTree";

const item = (overrides: Partial<Record<keyof ForkSubagentItem, unknown>> = {}): ForkSubagentItem =>
  ({
    id: "item-1",
    type: "subagent",
    threadId: "thread-1",
    subagentId: "node-1",
    status: "running",
    origin: "app_owned",
    driver: "claude",
    providerInstanceId: "claude",
    childThreadId: null,
    prompt: "",
    result: null,
    startedAt: null,
    completedAt: null,
    title: "Subagent: /root/octopus_research",
    ...overrides,
  }) as unknown as ForkSubagentItem;

const at = (iso: string) => DateTime.makeUnsafe(iso);

describe("resolveForkSubagentTree", () => {
  it("leads with the kicked-off wording while a member works, and ran once settled", () => {
    const live = resolveForkSubagentTree(
      [item(), item({ id: "item-2", subagentId: "node-2", status: "completed" })],
      null,
    );
    expect(live.lead).toBe("Kicked off 2 subagents");
    expect(live.summary).toBe("1 working · 1 done");
    expect(live.active).toBe(true);
    const settled = resolveForkSubagentTree([item({ status: "completed" })], null);
    expect(settled.lead).toBe("Ran 1 subagent");
    expect(settled.active).toBe(false);
  });

  it("prefers the live roster over the item for status, activity, model, timing and thread", () => {
    const tree = resolveForkSubagentTree(
      [item({ progress: "Reading files" })],
      [
        {
          id: "node-1",
          status: "completed",
          title: "Octopus research",
          model: "claude-opus-5-5",
          progress: "Reading files",
          result: "Found [three leads](https://x) in `src`",
          childThreadId: "thread-child",
          startedAt: at("2026-10-05T12:00:00Z"),
          completedAt: at("2026-10-05T12:00:30Z"),
        } as never,
      ],
    );
    const row = tree.rows[0]!;
    expect(row.status).toBe("completed");
    expect(row.mark).toBe("done");
    expect(row.activity).toEqual({
      label: "Result",
      text: "Found three leads in src",
      shape: "prose",
    });
    expect(row.model).toBe("claude-opus-5-5");
    expect(row.childThreadId).toBe("thread-child");
    expect(
      resolveForkSubagentTree(
        [item()],
        [
          {
            id: "node-1",
            status: "running",
            model: null,
            modelSelection: { model: "claude-sonnet-5-5" },
          } as never,
        ],
      ).rows[0]!.model,
    ).toBe("claude-sonnet-5-5");
    // A deduped live record carries an empty prompt; the item's own task still shows.
    expect(
      resolveForkSubagentTree(
        [item({ prompt: "Check the tabs" })],
        [{ id: "node-1", status: "running", prompt: "", promptOmitted: true } as never],
      ).rows[0]!.prompt,
    ).toBe("Check the tabs");
    expect(row.startedAt).toBe("2026-10-05T12:00:00.000Z");
    expect(row.completedAt).toBe("2026-10-05T12:00:30.000Z");
  });

  it("builds a completion notice's card from the live record alone", () => {
    const row = forkSubagentRowFromAgent({
      id: "node-9",
      status: "completed",
      title: "Lionfish research",
      prompt: "Research lionfish",
      model: "gpt-6-luna",
      result: "## Lionfish brief **What they are.**",
      childThreadId: "thread-child",
      driver: "codex",
      providerInstanceId: "codex",
      startedAt: at("2026-11-18T17:00:00Z"),
      completedAt: at("2026-11-18T17:11:00Z"),
    } as never);
    expect(row).toMatchObject({
      id: "node-9",
      mark: "done",
      statusLabel: "Completed",
      prompt: "Research lionfish",
      childThreadId: "thread-child",
      activity: { label: "Result", text: "Lionfish brief What they are.", shape: "prose" },
    });
    // Emphasis is stripped at word edges outside code; dunders, globs and code spans keep theirs.
    expect(
      forkSubagentRowFromAgent({
        id: "node-9",
        status: "completed",
        prompt: "Fix `__init__` and `src/*.ts`, then check __tests__ and lib/*.js",
        result: "*Done*: kept `**kwargs`",
      } as never),
    ).toMatchObject({
      prompt: "Fix __init__ and src/*.ts, then check __tests__ and lib/*.js",
      activity: { text: "Done: kept **kwargs" },
    });
  });

  it("gives each card its status word, its task, and what it is doing or what it found", () => {
    const working = resolveForkSubagentTree(
      [item({ progress: "Running tests", prompt: "Check the [tabs](https://x)\n- under `Basic`" })],
      null,
    ).rows[0]!;
    expect(working.mark).toBe("working");
    expect(working.statusLabel).toBe("Running");
    expect(working.prompt).toBe("Check the tabs under Basic");
    expect(working.activity).toEqual({ label: "Now", text: "Running tests", shape: "prose" });
    expect(
      resolveForkSubagentTree([item({ progress: "Reading apps/web/src/theme.css" })], null).rows[0]!
        .activity?.shape,
    ).toBe("prose");
    expect(
      resolveForkSubagentTree([item({ progress: "apps/web/src/theme.custom.basic.css" })], null)
        .rows[0]!.activity?.shape,
    ).toBe("path");
    expect(resolveForkSubagentTree([item()], null).rows[0]!.activity).toBeNull();
    const failed = resolveForkSubagentTree(
      [item({ status: "failed", result: "Child task ended with status failed" })],
      null,
    ).rows[0]!;
    expect(failed.mark).toBe("failed");
    expect(failed.statusLabel).toBe("Failed");
    expect(failed.activity).toBeNull();
    // Never one field standing in for the other.
    const settledNoResult = resolveForkSubagentTree(
      [item({ status: "completed", progress: "Reading files", result: null })],
      null,
    ).rows[0]!;
    expect(settledNoResult.activity).toBeNull();
    expect(
      resolveForkSubagentTree([item({ progress: undefined, result: "An earlier answer" })], null)
        .rows[0]!.activity,
    ).toBeNull();
    expect(resolveForkSubagentTree([item({ status: "idle" })], null).rows[0]!.statusLabel).toBe(
      "Idle · resumable",
    );
    const stopped = resolveForkSubagentTree([item({ status: "interrupted" })], null).rows[0]!;
    expect(stopped.mark).toBe("stopped");
    expect(stopped.statusLabel).toBe("Stopped");
  });

  it("title-cases Codex task paths through the shared display title", () => {
    expect(resolveForkSubagentTree([item()], null).rows[0]!.title).toBe("Octopus Research");
  });

  it("spans the batch from first launch to last settle, ticking while any member works", () => {
    const members = [
      item({
        status: "completed",
        startedAt: at("2026-10-05T12:00:10Z"),
        completedAt: at("2026-10-05T12:00:40Z"),
      }),
      item({
        id: "item-2",
        subagentId: "node-2",
        status: "completed",
        startedAt: at("2026-10-05T12:00:00Z"),
        completedAt: at("2026-10-05T12:01:00Z"),
      }),
    ];
    expect(resolveForkSubagentTree(members, null).timing).toEqual({
      status: "completed",
      startedAt: "2026-10-05T12:00:00.000Z",
      completedAt: "2026-10-05T12:01:00.000Z",
    });
    // Still working: the end is open.
    expect(
      resolveForkSubagentTree(
        [
          members[0]!,
          item({ id: "item-3", subagentId: "node-3", startedAt: at("2026-10-05T12:00:20Z") }),
        ],
        null,
      ).timing,
    ).toEqual({ status: "running", startedAt: "2026-10-05T12:00:10.000Z", completedAt: null });
    // A settled member with no completion time leaves the end unknown.
    expect(
      resolveForkSubagentTree(
        [members[0]!, item({ id: "item-3", subagentId: "node-3", status: "cancelled" })],
        null,
      ).timing,
    ).toEqual({ status: "completed", startedAt: "2026-10-05T12:00:10.000Z", completedAt: null });
    // No member reports a start: no span (the provider-native case).
    expect(resolveForkSubagentTree([item(), item({ id: "item-2" })], null).timing).toBeNull();
  });
});

describe("forkSubagentMembers", () => {
  it("takes the batch, or the row's own subagent when the batch is empty", () => {
    const own = item();
    const other = item({ id: "item-2", subagentId: "node-2" });
    expect(
      forkSubagentMembers({
        subagents: [{ item: own }, { item: other }],
        projectedItem: { item: own },
      }),
    ).toEqual([own, other]);
    expect(forkSubagentMembers({ subagents: [], projectedItem: { item: own } })).toEqual([own]);
    expect(forkSubagentMembers({ projectedItem: { item: own } })).toEqual([own]);
  });
});

describe("formatForkSubagentModel", () => {
  it("spells slugs with upstream's name, vendor word and snapshot date dropped", () => {
    expect(formatForkSubagentModel("claude-opus-5-5")).toBe("Opus 5.5");
    expect(formatForkSubagentModel("claude-sonnet-5")).toBe("Sonnet 5");
    // Claude subagents report the API's dated snapshot id.
    expect(formatForkSubagentModel("claude-sonnet-4-5-20250929")).toBe("Sonnet 4.5");
    expect(formatForkSubagentModel("claude-opus-4-6[1m]")).toBe("Opus 4.6[1m]");
    expect(formatForkSubagentModel("gpt-6-astra")).toBe("GPT-6-Astra");
    expect(formatForkSubagentModel("default")).toBe("default");
    expect(formatForkSubagentModel(null)).toBeNull();
    expect(formatForkSubagentModel("  ")).toBeNull();
  });
});
