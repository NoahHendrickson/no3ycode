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
    // One policy decides; the roster stays whole and one visibility rule applies the mode.
    expect(sidebar).toContain("const threads = useQuietThreadShells();");
    expect(sidebar).toContain("const modePolicy = useSidebarModePolicy();");
    expect(sidebar).toMatch(
      /delegatedUnderParent,\s*\/\* fork:begin fork-chat-mode[^*]*\*\/\s*modePolicy\.listsThread,/u,
    );
    expect(read("../components/Sidebar.logic.ts")).toContain("listedInMode(thread) &&");
    expect(sidebar).toContain(".filter((row) => modePolicy.listsThread(row.shell))");
    expect(read("../custom/sidebarV2DraftRows.ts")).toContain("if (isChatDraft(draft)) continue;");
    expect(sidebar).toContain("const grouping = modePolicy.grouping(storedGrouping);");
    expect(sidebar).toContain(
      "<SidebarModeTabs mode={modePolicy.mode} onModeChange={modePolicy.switchMode} />",
    );
    expect(sidebar).toContain("<SidebarV2ChatActionRows />");
    // The server cannot count chats apart: Chat's Settled shelf counts and pages what it lists.
    expect(sidebar).toContain(
      "(modePolicy.chat ? 0 : olderSettledShelf.unloadedCount(visibleThreads))",
    );
    expect(sidebar).toContain(
      "useChatSettledShelfPaging(olderSettledShelf, listedSettledThreads.length, modePolicy.chat)",
    );
    // Code's project scope stays chosen but does not filter Chat.
    expect(sidebar).toMatch(
      /!modePolicy\.projectControls \|\|\s*\/\* fork:end fork-chat-mode \*\/\s*scopedProjectGroups\.length === 0/u,
    );
    expect(sidebar).toContain("chatThreadMenuItem(");
    expect(read("../components/sidebar/SidebarChrome.tsx")).toContain("{modeTabs ?");
    expect(read("../main.tsx")).toContain("initializeForkSidebarMode();");
  });

  it("tags a sent chat from the app root, not from a view", () => {
    expect(read("../appInit.tsx")).toContain("startAppChatThreadTagging();");
  });

  it("draws a chat as the composer alone, under its own headline", () => {
    // A bot's conversation (fork-bots) reads the same way.
    expect(read("../components/ChatView.tsx")).toContain(
      'data-fork-chat-thread={isForkChatThread || isForkBotThread ? "" : undefined}',
    );
    expect(read("../theme.custom.css")).toMatch(
      /\[data-fork-chat-thread\]\s*\[data-fork-composer-context-row\] \{\s*display: none;/u,
    );
    expect(read("../overrides/components/chat/DraftHeroHeadline.tsx")).toContain(`"What's up?"`);
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
