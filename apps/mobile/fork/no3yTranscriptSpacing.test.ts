import { describe, expect, it } from "vite-plus/test";

import { NO3Y_TRANSCRIPT_GAP as GAP, no3yTranscriptGaps } from "./no3yTranscriptSpacing";

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
  });
});
