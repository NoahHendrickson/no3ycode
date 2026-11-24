// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-composer-next-step`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("fork guard: fork-composer-next-step", () => {
  it("mounts the next-step pill in the composer's chip row, outside side chats", () => {
    const chatView = read("../components/ChatView.tsx");
    const chips = chatView.slice(chatView.indexOf("const composerStatusChips ="));
    expect(chips).toMatch(/\{embedded \? null : \(\s*<ComposerNextStepPill/u);
    expect(chatView).toContain("statusChips={composerStatusChips}");
    expect(chatView).toMatch(
      /const sendNextStepStable = useStableCallback\(\(prompt: string\) => \{[\s\S]{0,300}onSend\(undefined, "auto", "foreground", undefined, \{/u,
    );
  });

  it("waits for an empty composer before offering a one-click send", () => {
    expect(read("../custom/ComposerNextStepPill.tsx")).toContain(
      "if (!props.settled || draftHasContent || props.messages === null) return null;",
    );
  });

  it("learns only from owner turns the send path committed, outside side chats", () => {
    const send = read("../components/chat/useComposerSend.ts");
    expect(send).toMatch(
      /setOptimisticUserMessages\(\(existing\) => \[\.\.\.existing, optimisticMessage\]\);\s*\/\* fork:begin fork-composer-next-step[^\n]*\*\/\s*onOwnerTurnDispatched\?\.\(promptAtSend\);/u,
    );
    expect(read("../components/ChatView.tsx")).toMatch(
      /onOwnerTurnDispatched: embedded\s*\? undefined\s*: \(prompt: string\) =>\s*recordComposerHabit\(/u,
    );
  });

  it("offers the same step on iOS, last in the no3y pill row, through the owner send", () => {
    const screen = read("../../../mobile/src/features/threads/ThreadDetailScreen.tsx");
    expect(screen).toContain("const nextStep = useNo3yNextStep({");
    expect(screen).toContain("no3yNextStepSettled(props, {");
    expect(screen).toContain("nextStep.step !== null");
    expect(screen).toMatch(
      /nextStep\.send\(async \(prompt\) => \{[\s\S]{0,200}flushPendingInput\(\);\s*return handleSendMessage\(undefined, undefined, prompt\);/u,
    );
    expect(screen).toMatch(/\},\s*prompt,\s*\);/u);
    expect(read("../../../mobile/fork/No3yStatusPill.tsx")).toMatch(
      /\{pills\.map\(renderPill\)\}\s*\{nextStep === null \? null : \(\s*<NextStepPill/u,
    );
  });

  it("learns iOS sends, typed or the pill's, where they enter the outbox", () => {
    const state = read("../../../mobile/src/state/use-thread-composer-state.ts");
    expect(state).toContain(
      "const draft = prompt === undefined ? storedDraft : { ...storedDraft, text: prompt };",
    );
    expect(state).toMatch(
      /onWillEnqueue\?\.\(\);\s*\/\* fork:begin fork-composer-next-step[\s\S]*?recordNo3yComposerHabit\(lastOwnerPrompt\(/u,
    );
  });
});
