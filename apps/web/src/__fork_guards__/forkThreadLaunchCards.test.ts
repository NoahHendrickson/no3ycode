// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-thread-launch-cards`.
 * A `t3_thread_launch` call leaves the work stream for its own card row, outside the turn's fold.
 * A sync that drops one of the three hook points sends launches back into "Worked for".
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("fork guard: fork-thread-launch-cards", () => {
  it("lifts launch calls out of the work stream before they become work rows", () => {
    const sessionLogic = readSibling("../session-logic.ts");
    const lift = sessionLogic.indexOf("forkThreadLaunchFromToolItem(item)");
    expect(lift).toBeGreaterThan(-1);
    expect(lift).toBeLessThan(sessionLogic.indexOf("STANDALONE_V2_ITEM_TYPES.has(item.type)"));
  });

  it("keeps launch rows out of the superseded-attempt fold and draws them", () => {
    const logic = readSibling("../components/chat/MessagesTimeline.logic.ts");
    expect(logic).toContain('entry.kind === "fork-thread-launch" ||');
    expect(logic).toContain('case "fork-thread-launch":');
    expect(readSibling("../components/chat/MessagesTimeline.tsx")).toContain(
      "<ForkThreadLaunchList launches={row.launches} />",
    );
  });

  it("shows each pull request's stage beside its chip", () => {
    expect(readSibling("../custom/threadLaunchCards/ForkThreadLaunchCards.tsx")).toContain(
      "THREAD_PULL_REQUEST_STAGE_LABELS[link.stage]",
    );
  });

  it("draws a work report's notice as the reporting thread's row", () => {
    const row = readSibling("../components/chat/TimelineWorkEntryRow.tsx");
    expect(row).toContain("forkWorkReportOf(item)");
    expect(row).toContain("<ForkWorkReportRow");
  });

  it("drops a launched thread's turn reports, so its row shows once", () => {
    const logic = readSibling("../components/chat/MessagesTimeline.logic.ts");
    expect(logic).toContain("forkLaunchedThreads(timelineEntries, forkKeepRequestReports)");
    expect(logic).toContain("if (forkUnshownEntryIds.has(timelineEntry.id)) continue;");
  });

  it("hangs a turn's launches under its last reply, or the latest reply about the thread", () => {
    const logic = readSibling("../components/chat/MessagesTimeline.logic.ts");
    expect(logic).toContain("const result = placeLaunchesUnderReplies(");
    expect(logic).toContain("forkLaunched.referringRuns,");
    expect(readSibling("../components/chat/TimelineAssistantRows.tsx")).toContain(
      "<ForkThreadLaunchList launches={row.forkLaunches}",
    );
    // Launch rows (including moved ones) keep kind="launch" so ForkThreadReadyToMerge moves with them.
    const cards = readSibling("../custom/threadLaunchCards/ForkThreadLaunchCards.tsx");
    expect(cards).toContain('const ready = props.kind === "launch" ? live.ready : null;');
    expect(cards).toContain("<ForkThreadReadyToMerge");
  });

  it("answers a thread's open question or approval inline, and only inline in a sprint", () => {
    const rows = readSibling("../custom/threadLaunchCards/ForkThreadLaunchCards.tsx");
    expect(rows).toContain("<ForkThreadRequestCard");
    expect(rows).toContain("<host.AnsweredRequest");
    // Only a host answers inline (a sprint's timeline); a Petal asks above its composer.
    expect(rows).toContain("request === null || host === null ? (");
    expect(readSibling("../components/chat/ThreadTimeline.tsx")).toContain(
      "<ForkThreadHostContext value={forkThreadHost}>",
    );
    expect(readSibling("../custom/bots/BotDigest.tsx")).toContain("|| isSprintThread(bot.source)");
    expect(readSibling("../custom/bots/quietBotWakes.ts")).toContain(
      "(keepRequestReports && isForkWorkRequestReport(entry))",
    );
    expect(readSibling("../components/chat/MessagesTimeline.tsx")).toContain(
      "forkKeepRequestReports: forkThreadHost !== null,",
    );
  });
});
