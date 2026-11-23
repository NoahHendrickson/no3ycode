// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-subagent-cards-after-reply`.
 *
 * A sync that drops the wiring compiles clean and quietly puts a folded turn's
 * finished subagent card back above its reply.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("fork guard: fork-subagent-cards-after-reply", () => {
  it("reorders the transcript's rows after the live-line fold", () => {
    const timeline = readSibling("../components/chat/MessagesTimeline.tsx");
    expect(timeline).toContain(
      "const foldedRows = forkLiveStatusRows(useStableRows(rawRows, listIdentityKey));",
    );
    expect(timeline).toContain("const rows = forkSubagentCardsAfterReply(foldedRows);");
  });

  it("still finds the reply row that carries the changed-files card", () => {
    expect(readSibling("../components/chat/TimelineAssistantRows.tsx")).toContain(
      "<AssistantChangedFilesSection",
    );
  });
});
