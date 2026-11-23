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
    expect(timeline).toContain(
      "const foldedRows = forkLiveStatusRows(useStableRows(rawRows, listIdentityKey));",
    );
    expect(timeline).toContain("const rows = forkSpaceTranscript(foldedRows);");
    expect(timeline).toMatch(
      /style=\{forkTranscriptGapStyle\(row\)\}[\s\S]{0,120}data-timeline-row-id=\{row\.id\}/u,
    );
  });

  it("still finds the paddings the gaps top up", () => {
    const timeline = readSibling("../components/chat/MessagesTimeline.tsx");
    expect(timeline).toMatch(/row\.kind === "message" && row\.groupedWithNext\s*\?\s*"pb-1"/u);
    expect(timeline).toMatch(/!row\.showAssistantMeta\)[\s\S]{0,600}\? "pb-2"\s*: "pb-4"/u);
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
