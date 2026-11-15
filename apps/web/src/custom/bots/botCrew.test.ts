import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  botCrewMenuItems,
  botFromCrewMenuId,
  botWorkTagWrites,
  canJoinBotWork,
  isBotCrewMenuId,
} from "./botCrew";

const scout = ThreadId.make("bot-scout");
const mail = ThreadId.make("bot-mail");
const lineage = { parentThreadId: null, relationshipToParent: null, rootThreadId: scout };

describe("botWorkTagWrites", () => {
  it("tags the new bot before clearing the old, and leaves other tags alone", () => {
    expect(botWorkTagWrites({ tags: ["pinned-ish", "bot-work:bot-mail"] }, scout)).toEqual([
      { tag: "bot-work:bot-scout", tagged: true },
      { tag: "bot-work:bot-mail", tagged: false },
    ]);
    expect(botWorkTagWrites({ tags: ["bot-work:bot-scout"] }, scout)).toEqual([]);
    expect(botWorkTagWrites({ tags: ["bot-work:bot-scout"] }, null)).toEqual([
      { tag: "bot-work:bot-scout", tagged: false },
    ]);
    expect(botWorkTagWrites({}, null)).toEqual([]);
  });
});

describe("the Petal submenu", () => {
  it("offers listed threads only, never a bot, subagent or side chat", () => {
    expect(canJoinBotWork({ tags: [], lineage })).toBe(true);
    expect(canJoinBotWork({ tags: ["bot"], lineage })).toBe(false);
    expect(
      canJoinBotWork({ tags: [], lineage: { ...lineage, relationshipToParent: "subagent" } }),
    ).toBe(false);
    expect(canJoinBotWork({ tags: [], lineage: { ...lineage, sideChat: true } })).toBe(false);
  });

  it("ticks the thread's bot, or None, and reads a pick back", () => {
    const bots = [
      { id: scout, title: "Scout" },
      { id: mail, title: "Mail" },
    ];
    const [item] = botCrewMenuItems({ tags: ["bot-work:bot-mail"], lineage }, bots, true);
    expect(item?.children.map((child) => [child.label, child.checked])).toEqual([
      ["Scout", false],
      ["Mail", true],
      ["None", false],
    ]);
    expect(botCrewMenuItems({ tags: [], lineage }, bots, true)[0]?.children.at(-1)?.checked).toBe(
      true,
    );
    // Nothing to offer: no bot lists, or the thread is a bot itself.
    expect(botCrewMenuItems({ tags: [], lineage }, [], true)).toEqual([]);
    expect(botCrewMenuItems({ tags: ["bot"], lineage }, bots, true)).toEqual([]);
    const [scoutId, , noneId] = item!.children.map((child) => child.id);
    expect(isBotCrewMenuId(scoutId!)).toBe(true);
    expect(isBotCrewMenuId("bot-mascot:Classic")).toBe(false);
    expect(botFromCrewMenuId(scoutId!)).toBe(scout);
    expect(botFromCrewMenuId(noneId!)).toBeNull();
    expect(botFromCrewMenuId("bot-crew")).toBeUndefined();
  });
});
