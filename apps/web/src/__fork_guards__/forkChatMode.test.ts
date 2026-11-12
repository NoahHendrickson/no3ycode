// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-chat-mode`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("fork guard: fork-chat-mode", () => {
  it("lists the open mode's threads, flat in Chat, under the header's mode tabs", () => {
    const sidebar = read("../components/Sidebar.tsx");
    expect(sidebar).toContain("const threads = useSidebarModeThreads(allThreads, sidebarMode);");
    expect(sidebar).toContain('const grouping = sidebarMode === "chat" ? "none" : storedGrouping;');
    expect(sidebar).toContain("useChatTagSync(allThreads);");
    expect(sidebar).toContain(
      "modeTabs={<SidebarModeTabs mode={sidebarMode} onModeChange={switchSidebarMode} />}",
    );
    expect(sidebar).toContain("chatModeMoveMenuItem(sidebarMode)");
    expect(read("../components/sidebar/SidebarChrome.tsx")).toContain("{modeTabs ?");
    expect(read("../main.tsx")).toContain("initializeForkSidebarMode();");
  });

  it("tags a chat through the client's thread.tag.set command", () => {
    expect(read("../../../../packages/client-runtime/src/operations/commands.ts")).toContain(
      'type: "thread.tag.set"',
    );
    expect(read("../../../../packages/client-runtime/src/state/threadCommands.ts")).toContain(
      "execute: setThreadTag",
    );
  });
});
