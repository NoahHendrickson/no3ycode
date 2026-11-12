import { describe, expect, it } from "vite-plus/test";

import { settleTexture } from "./paintPixelTexture";

describe("settleTexture", () => {
  it("animates only until the first build's deadline", () => {
    const first = settleTexture(null, 1000, 2500, false);
    expect(first).toEqual({ settleAt: 3500, animateUntil: 3500 });
    // A rebuild inside the window keeps the original deadline rather than restarting it.
    expect(settleTexture(first.settleAt, 3000, 2500, false)).toEqual({
      settleAt: 3500,
      animateUntil: 3500,
    });
    expect(settleTexture(first.settleAt, 3500, 2500, false).animateUntil).toBeNull();
    expect(settleTexture(first.settleAt, 9000, 2500, false).animateUntil).toBeNull();
    expect(settleTexture(null, 1000, 0, false).animateUntil).toBeNull();
  });

  it("never animates under reduced motion", () => {
    expect(settleTexture(null, 1000, 2500, true)).toEqual({ settleAt: 3500, animateUntil: null });
  });
});
