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
    // Learned pills give way to the rules, and to a PR that is the owner's call.
    expect(read("../custom/ComposerNextStepPill.tsx")).toMatch(
      /if \(step === "hold"\) return null;\s*if \(step === null\) \{\s*if \(habit === null\) return null;/u,
    );
  });
});
