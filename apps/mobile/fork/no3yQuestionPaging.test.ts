import { describe, expect, it } from "vite-plus/test";

import { no3yQuestionAfterSelect, no3yQuestionFooter } from "./no3yQuestionPaging";

describe("no3y question paging", () => {
  it("moves on after a single-select pick, stays for multi-select, and stops at the last", () => {
    expect(no3yQuestionAfterSelect({ index: 0, count: 3, multiSelect: false })).toBe(1);
    expect(no3yQuestionAfterSelect({ index: 0, count: 3, multiSelect: true })).toBe(0);
    expect(no3yQuestionAfterSelect({ index: 2, count: 3, multiSelect: false })).toBe(2);
  });

  it("offers Previous after the first question and Submit on the last", () => {
    expect(no3yQuestionFooter(0, 1)).toEqual({ previous: false, primary: "submit" });
    expect(no3yQuestionFooter(0, 3)).toEqual({ previous: false, primary: "next" });
    expect(no3yQuestionFooter(2, 3)).toEqual({ previous: true, primary: "submit" });
  });
});
