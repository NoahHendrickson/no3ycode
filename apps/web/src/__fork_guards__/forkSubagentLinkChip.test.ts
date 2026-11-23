// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#no3y-subagent-link-chip`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import * as web from "../custom/forkSubagentLinkLogic";

function readRepoFile(relativePath: string): string {
  return NodeFS.readFileSync(
    NodeURL.fileURLToPath(new URL(`../../../../${relativePath}`, import.meta.url)),
    "utf8",
  );
}

const HREF = "t3-thread://v2/env/thread:delegated-task:a%3Ab";
type Shell = Parameters<typeof web.forkSubagentLinkKind>[0];
const base: Shell = {
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  runtime: null,
  blockedOnThreadWait: false,
  latestRun: null,
};
const runtime = (status: string) => ({ status }) as NonNullable<Shell["runtime"]>;
const run = (status: string) => ({ status }) as NonNullable<Shell["latestRun"]>;

// Mobile keeps its own copy of the logic; both must answer every case the same way. Loaded by
// path because the web project does not typecheck mobile sources.
const mobile = (await import(
  /* @vite-ignore */ NodeURL.fileURLToPath(
    new URL("../../../mobile/fork/no3ySubagentLinkChip.ts", import.meta.url),
  )
)) as {
  readonly no3ySubagentChipKind: typeof web.forkSubagentLinkKind;
  readonly no3ySubagentChipLabel: typeof web.forkSubagentLinkLabel;
  readonly dropPeriodAfterSubagentChips: typeof web.dropPeriodAfterSubagentLinks;
};
const implementations = [
  {
    name: "web",
    kind: web.forkSubagentLinkKind,
    label: web.forkSubagentLinkLabel,
    drop: web.dropPeriodAfterSubagentLinks,
  },
  {
    name: "mobile",
    kind: mobile.no3ySubagentChipKind,
    label: mobile.no3ySubagentChipLabel,
    drop: mobile.dropPeriodAfterSubagentChips,
  },
];

describe.each(implementations)("fork guard: no3y-subagent-link-chip ($name)", (impl) => {
  it("reads a child's status the way the sidebar does", () => {
    expect(impl.kind({ ...base, hasPendingApprovals: true })).toBe("approval");
    expect(impl.kind({ ...base, hasPendingUserInput: true })).toBe("input");
    expect(impl.kind({ ...base, runtime: runtime("running") })).toBe("working");
    expect(impl.kind({ ...base, runtime: runtime("running"), blockedOnThreadWait: true })).toBe(
      "waiting",
    );
    // Parked at idle on its own background work.
    expect(impl.kind({ ...base, runtime: runtime("idle"), latestRun: run("completed") })).toBe(
      "waiting",
    );
    expect(impl.kind({ ...base, runtime: runtime("completed"), latestRun: run("completed") })).toBe(
      "done",
    );
    expect(impl.kind({ ...base, runtime: runtime("failed"), latestRun: run("failed") })).toBe(
      "failed",
    );
    expect(impl.kind({ ...base, latestRun: run("interrupted") })).toBeNull();
  });

  it("shortens a titled task to its head", () => {
    expect(impl.label("Sol review r2: composer status chips")).toBe("Sol review r2");
    expect(impl.label("a: b")).toBe("a: b");
    expect(impl.label("Explore the router")).toBe("Explore the router");
  });

  it("drops only the period that closes the chip's line", () => {
    expect(impl.drop(`Round 2 is running: [r2](${HREF}).\n\nNext.`, [HREF])).toBe(
      `Round 2 is running: [r2](${HREF})\n\nNext.`,
    );
    expect(impl.drop(`See [r2](<${HREF}>).`, [HREF])).toBe(`See [r2](<${HREF}>)`);
    expect(impl.drop(`[r2](${HREF}). Then more.`, [HREF])).toBe(`[r2](${HREF}). Then more.`);
    expect(impl.drop(`[x](${HREF}2).`, [HREF])).toBe(`[x](${HREF}2).`);
  });
});

describe("fork guard: no3y-subagent-link-chip wiring", () => {
  it("renders the capsule for assistant messages on web", () => {
    expect(readRepoFile("apps/web/src/components/chat/MarkdownThreadLink.tsx")).toContain(
      "<ForkSubagentLinkChip",
    );
    const chatMarkdown = readRepoFile("apps/web/src/components/ChatMarkdown.tsx");
    expect(chatMarkdown).toContain("useForkSubagentLinkText(");
    expect(chatMarkdown).toContain("<ForkSubagentLinkScope value={subagentScope}>");
  });

  it("renders the capsule for assistant messages on mobile", () => {
    expect(readRepoFile("apps/mobile/src/features/threads/ThreadFeed.tsx")).toContain(
      "subagentChips.customization(href) ??",
    );
    expect(readRepoFile("apps/mobile/src/native/useEnrichedLinkVariants.ts")).toContain(
      "if (link.capsule) {",
    );
  });
});
