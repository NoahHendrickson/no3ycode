import { describe, expect, it } from "vite-plus/test";

import { BOT_RULES_MARKER, botSeedFiles } from "./botSeedFiles";
import { BOT_PREVIOUS_RULES_FILE, refreshBotRules } from "./refreshBotRules";

function folder(initial: Record<string, string>, failOn?: string) {
  const files = new Map(Object.entries(initial));
  const writes: string[] = [];
  return {
    files,
    writes,
    io: {
      read: async (path: string) => files.get(path) ?? null,
      write: async (path: string, contents: string) => {
        if (path === failOn) throw new Error("denied");
        writes.push(path);
        files.set(path, contents);
      },
    },
  };
}

const bot = { name: "Scout", threadId: "thread-scout" };

describe("refreshBotRules", () => {
  it("replaces an old bot's rules, keeps a copy, and adds only the files it lacks", async () => {
    const old = folder({
      "CLAUDE.md": "# Scout\n\nOld rules.",
      "JOB.md": "# Job\n\nWatch the repo.",
      "STATE.md": "# State",
      "DIGEST.md": "# Digest\n\n## Needs you\n\n- Already written by the bot",
    });
    expect(await refreshBotRules(old.io, bot)).toBe(true);
    expect(old.files.get(BOT_PREVIOUS_RULES_FILE)).toBe("# Scout\n\nOld rules.");
    expect(old.files.get("CLAUDE.md")?.startsWith(BOT_RULES_MARKER)).toBe(true);
    expect(old.files.get("CLAUDE.md")).toContain("thread id `thread-scout`");
    expect(old.files.get("CREW.md")).toContain("Do not push");
    // What the bot and its owner keep is never overwritten.
    expect(old.files.get("DIGEST.md")).toContain("Already written by the bot");
    expect(old.files.get("JOB.md")).toBe("# Job\n\nWatch the repo.");
    expect(old.files.get("STATE.md")).toBe("# State");
    expect(old.writes.at(-1)).toBe("CLAUDE.md");

    // Current rules: nothing to do.
    const writes = old.writes.length;
    expect(await refreshBotRules(old.io, bot)).toBe(false);
    expect(old.writes).toHaveLength(writes);
  });

  it("leaves CLAUDE.md old when a write fails, so the next attempt starts over", async () => {
    const old = folder({ "CLAUDE.md": "# Scout" }, "AGENTS.md");
    await expect(refreshBotRules(old.io, bot)).rejects.toThrow("denied");
    expect(old.files.get("CLAUDE.md")).toBe("# Scout");
  });

  it("matches what a new bot is seeded with", async () => {
    const fresh = folder({});
    await refreshBotRules(fresh.io, bot);
    const seeded = new Map(
      botSeedFiles({ ...bot, today: "2026-11-15" }).map((file) => [
        file.relativePath,
        file.contents,
      ]),
    );
    for (const path of ["CLAUDE.md", "AGENTS.md", "CREW.md", "DIGEST.md"]) {
      expect(fresh.files.get(path)).toBe(seeded.get(path));
    }
    expect(fresh.files.has(BOT_PREVIOUS_RULES_FILE)).toBe(false);
  });
});
