import { describe, expect, it } from "vite-plus/test";

import { CHAT_THREAD_TAG, threadsForSidebarMode } from "./chatMode";

const thread = (id: string, tags?: readonly string[]) =>
  ({
    environmentId: "env",
    id,
    source: tags === undefined ? {} : { tags },
  }) as unknown as Parameters<typeof threadsForSidebarMode>[0][number];

describe("threadsForSidebarMode", () => {
  const tagged = thread("tagged", [CHAT_THREAD_TAG, "other"]);
  const pending = thread("pending");
  const code = thread("code", ["other"]);
  const untagged = thread("untagged");
  const threads = [tagged, pending, code, untagged];
  const pendingChats = new Set(["env:pending"]);

  it("lists a chat (tagged, or started in Chat and not yet sent) only in Chat", () => {
    expect(threadsForSidebarMode(threads, "chat", pendingChats)).toEqual([tagged, pending]);
    expect(threadsForSidebarMode(threads, "code", pendingChats)).toEqual([code, untagged]);
  });
});
