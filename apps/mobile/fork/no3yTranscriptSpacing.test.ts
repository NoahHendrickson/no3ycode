import { describe, expect, it } from "vite-plus/test";

import type { ThreadFeedRow } from "../src/features/threads/pending-thread-feed";
import {
  NO3Y_TRANSCRIPT_GAP as GAP,
  no3yRowKind,
  no3yTranscriptGaps,
  type No3yRowKind,
} from "./no3yTranscriptSpacing";

describe("no3y transcript spacing", () => {
  it("spaces reply text evenly from tool rows on both sides", () => {
    expect(no3yTranscriptGaps(["reply", "work", "reply"])).toEqual([
      { top: 0, bottom: GAP - 4 },
      null,
      { top: GAP, bottom: 0 },
    ]);
  });

  it("tops up the margin a tool block already draws", () => {
    expect(no3yTranscriptGaps(["work-block", "reply"])[1]).toEqual({ top: GAP - 4, bottom: 0 });
  });

  it("centres a settled turn's fold between the footer above it and its reply", () => {
    expect(no3yTranscriptGaps(["reply", "fold", "reply"])).toEqual([
      { top: 0, bottom: 0, footer: 6 },
      null,
      { top: 3, bottom: 0 },
    ]);
  });

  it("leaves consecutive tool rows, user bubbles and back-to-back replies alone", () => {
    expect(no3yTranscriptGaps(["user", "work", "work-block", "user", "reply", "reply"])).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("puts the gap above the live line itself, never below the reply over it", () => {
    expect(no3yTranscriptGaps(["reply", "live"])).toEqual([null, { top: GAP - 4, bottom: 0 }]);
    expect(no3yTranscriptGaps(["work", "live"])).toEqual([null, { top: GAP, bottom: 0 }]);
    expect(no3yTranscriptGaps(["live"])).toEqual([null]);
    // A prompt grouped with its response draws mb-1, so the live line tops up more.
    expect(no3yTranscriptGaps(["user-grouped", "live"])[1]).toEqual({ top: GAP - 4, bottom: 0 });
  });

  it("never gives a tool row a gap, whatever surrounds it, so its fixed list size holds", () => {
    const kinds: No3yRowKind[] = [
      "reply",
      "user",
      "user-grouped",
      "work",
      "work-block",
      "fold",
      "live",
      "other",
    ];
    for (const before of kinds) {
      for (const after of kinds) {
        for (const work of ["work", "work-block"] as const) {
          expect(no3yTranscriptGaps([before, work, after])[1]).toBeNull();
        }
      }
    }
  });

  it("treats a reply with nothing to show yet as no reply, so it leaves no blank gap", () => {
    const reply = (text: string) =>
      ({
        type: "message",
        id: "a",
        message: { role: "assistant", text },
      }) as unknown as ThreadFeedRow;
    expect([no3yRowKind(reply("")), no3yRowKind(reply("Done"))]).toEqual(["other", "reply"]);
  });
});
