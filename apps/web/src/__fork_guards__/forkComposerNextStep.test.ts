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
    expect(chatView).toMatch(
      /activeThread && !isDraftHeroState && !embedded \? \(\s*<ComposerNextStepPill/u,
    );
    expect(chatView).toMatch(/\{composerStatusChips\}\s*\{composerNextStepPill\}/u);
    expect(chatView).toMatch(
      /const sendNextStepStable = useStableCallback\(\(prompt: string\) => \{[\s\S]{0,300}onSend\(undefined, "auto", "foreground", undefined, \{/u,
    );
  });

  it("waits for an empty composer before offering a one-click send", () => {
    expect(read("../custom/ComposerNextStepPill.tsx")).toContain(
      "if (!props.settled || draftHasContent || props.messages === null) return null;",
    );
  });

  it("learns from every owner send in the composer, pill clicks included", () => {
    const chatView = read("../components/ChatView.tsx");
    expect(chatView).toMatch(
      /const onComposerSendStable = useStableCallback\(\(\.\.\.args: Parameters<typeof onSend>\) => \{\s*recordComposerHabitFor\(/u,
    );
    expect(chatView).toMatch(/if \(!sendContext\) return;\s*recordComposerHabitFor\(prompt\);/u);
    // Learned pills give way to the rules, and to a PR that is the owner's call.
    expect(read("../custom/ComposerNextStepPill.tsx")).toMatch(
      /if \(step === "hold"\) return null;\s*if \(step === null\) \{\s*if \(habit === null\) return null;/u,
    );
  });
});
