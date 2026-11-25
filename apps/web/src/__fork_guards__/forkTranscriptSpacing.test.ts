// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-transcript-spacing`.
 *
 * The gap pass tops up the padding upstream's rows already draw. A sync that
 * drops the wiring, or changes those paddings, compiles clean and quietly
 * brings the uneven gaps back (or doubles them).
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("fork guard: fork-transcript-spacing", () => {
  it("spaces the folded rows and pads each row's root", () => {
    const timeline = readSibling("../components/chat/MessagesTimeline.tsx");
    expect(timeline).toMatch(/const foldedRows = forkLiveStatusRows\(\s*stableRows,/u);
    expect(timeline).toContain("const rows = forkSpaceTranscript(foldedRows);");
    expect(timeline).toMatch(
      /style=\{forkTranscriptGapStyle\(row\)\}[\s\S]{0,120}data-timeline-row-id=\{row\.id\}/u,
    );
  });

  it("still finds every padding boxOf reads", () => {
    const timeline = readSibling("../components/chat/MessagesTimeline.tsx");
    expect(timeline).toMatch(
      /row\.kind === "turn-fold" \|\| row\.kind === "working"\s*\?\s*"pb-1\.5"/u,
    );
    expect(timeline).toMatch(/row\.kind === "message" && row\.groupedWithNext\s*\?\s*"pb-1"/u);
    // boxOf gives these kinds pb-2 and every kind outside the chain pb-4; a kind
    // added to or dropped from upstream's pb-2 list changes its gap.
    const pb2 = /!row\.showAssistantMeta\)\s*\|\|([\s\S]*?)\?\s*"pb-2"\s*:\s*"pb-4"/u.exec(
      timeline,
    );
    expect([...(pb2?.[1] ?? "").matchAll(/row\.kind === "([a-z-]+)"/gu)].map((m) => m[1])).toEqual([
      "worktree-setup",
      "event",
      "attempt-fold",
      "html-render",
      "sent-message",
      "mcp-app",
      "viewed-images",
    ]);
    const workLog = readSibling("../components/chat/WorkLog.tsx");
    // A reasoning trace is one WorkLogDetails of the default "text" kind.
    expect(workLog).toContain('kind = "text",');
    expect(workLog).toContain(
      '"ms-7 flex max-h-96 flex-col gap-3 overflow-auto px-0.5 py-1 select-text"',
    );
    expect(readSibling("../components/chat/TimelineWorkEntryRow.tsx")).toMatch(
      /function ReasoningTraceContent[\s\S]{0,400}<WorkLogDetails followLive=/u,
    );
    expect(readSibling("../components/chat/WorkLog.tsx")).toMatch(
      /\? "pb-0"\s*: layout === "group-content"\s*\? "pb-1"\s*: "pb-2"/u,
    );
    expect(readSibling("../components/chat/WorkLog.tsx")).toContain('grouped ? "py-0" : "py-0.5"');
    const assistant = readSibling("../components/chat/TimelineAssistantRows.tsx");
    const reply = assistant.slice(
      assistant.indexOf("export function AssistantTimelineRow"),
      assistant.indexOf("export function SentMessageTimelineRow"),
    );
    expect(reply).toContain('<div className="relative min-w-0 px-1 py-0.5">');
    const sent = assistant.slice(assistant.indexOf("export function SentMessageTimelineRow"));
    expect(sent).toContain('<div className="min-w-0 px-1 py-0.5">');
    expect(readSibling("../custom/ForkSubagentGroup.tsx")).toContain(
      "flex w-full min-w-0 flex-col items-start gap-2 py-1 text-sm leading-5",
    );
    expect(readSibling("../custom/ForkLiveStatusLine.tsx")).toContain(
      '"flex min-w-0 items-center gap-2 pb-2 pt-1"',
    );
  });
});
