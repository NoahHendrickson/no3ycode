import { shouldOfferResumeCompaction } from "@t3tools/client-runtime/state/context-window";
import { describe, expect, it } from "vite-plus/test";

import {
  dismissNo3yResumeCompaction,
  isNo3yResumeCompactionDismissed,
  resolveNo3yResumeCompaction,
} from "./no3yResumeCompaction";

const UPDATED = "2026-11-22T10:00:00.000Z";
const offer = (input: Partial<Parameters<typeof shouldOfferResumeCompaction>[0]>) =>
  shouldOfferResumeCompaction({
    provider: "claudeAgent",
    usedTokens: 525_000,
    updatedAt: UPDATED,
    promptCacheTtlMs: 60 * 60_000,
    now: "2026-11-22T11:00:00.000Z",
    ...input,
  });

describe("no3y Resume with less context", () => {
  it("offers on a large Claude thread once its prompt cache has lapsed, as the Mac does", () => {
    expect(offer({})).toBe(true);
    expect(offer({ now: "2026-11-22T10:59:00.000Z" })).toBe(false);
    expect(offer({ usedTokens: 150_000 })).toBe(false);
    expect(offer({ provider: "codex" })).toBe(false);
    // No reported cache lifetime: the 70-minute fallback.
    expect(offer({ promptCacheTtlMs: undefined, now: "2026-11-22T11:09:00.000Z" })).toBe(false);
    expect(offer({ promptCacheTtlMs: undefined, now: "2026-11-22T11:10:00.000Z" })).toBe(true);
  });

  it("keeps the full history for that thread and snapshot only, for the session", () => {
    const show = (threadKey: string | null, tokens: number | null) =>
      resolveNo3yResumeCompaction({
        threadKey,
        tokens,
        isDismissed: isNo3yResumeCompactionDismissed,
      });
    expect(show("env:t1", 525_000)).toEqual({ key: "env:t1:525000", tokens: 525_000 });
    expect(show("env:t1", null)).toBeNull();
    expect(show(null, 525_000)).toBeNull();

    dismissNo3yResumeCompaction("env:t1:525000");
    expect(show("env:t1", 525_000)).toBeNull();
    // A later snapshot, or another thread, offers again.
    expect(show("env:t1", 610_000)).toEqual({ key: "env:t1:610000", tokens: 610_000 });
    expect(show("env:t2", 525_000)).not.toBeNull();
  });
});
