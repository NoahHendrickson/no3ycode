import { describe, expect, it } from "vite-plus/test";

import { no3yCompactBannerCopy } from "./no3yCompactCopy";

describe("no3y compaction banner", () => {
  it("dismisses to keep the full history, and offers Compact once it is kept", () => {
    expect(no3yCompactBannerCopy(false)).toEqual({
      message: "Next message compacts history",
      action: { kind: "dismiss", label: "Keep the full history" },
    });
    expect(no3yCompactBannerCopy(true)).toEqual({
      message: "Next message keeps full history",
      action: { kind: "pill", label: "Compact" },
    });
  });
});
