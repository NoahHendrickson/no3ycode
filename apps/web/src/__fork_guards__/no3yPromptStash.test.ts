// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#no3y-prompt-stash`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function read(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("no3y-prompt-stash", () => {
  it("reaches the stash from the composer's + menu, its sheet route and the queue banner", () => {
    const attach = read("../../../mobile/src/features/threads/ComposerAttachmentButton.tsx");
    const composer = read("../../../mobile/src/features/threads/ThreadComposer.tsx");
    const stack = read("../../../mobile/src/Stack.tsx");
    const banner = read("../../../mobile/fork/No3yQueuedRunsBanner.tsx");
    expect(attach).toContain("const stashMenu = useNo3yStashMenu(props.no3yStash);");
    expect(composer).toContain("no3yStash={");
    expect(stack).toContain("No3yPromptStash: createNativeStackScreen({");
    expect(banner).toContain("stashPromptText(entry.text, null)");
  });
});
