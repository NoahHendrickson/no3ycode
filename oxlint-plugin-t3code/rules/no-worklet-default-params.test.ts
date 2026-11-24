import { assert, describe } from "@effect/vitest";

import { createOxlintRuleHarness } from "../test/utils.ts";

const rule = createOxlintRuleHarness("t3code/no-worklet-default-params", {
  filename: "fixture.ts",
});

describe("t3code/no-worklet-default-params", () => {
  rule.valid(
    "allows a worklet that takes the value from its caller",
    `const STRETCH = 7; export function path(progress, stretch) { "worklet"; return progress * stretch; }`,
  );

  rule.valid(
    "allows defaults outside worklets",
    `const STRETCH = 7; export function path(progress, stretch = STRETCH) { return progress * stretch; }`,
  );

  rule.valid(
    "ignores a worklet string that is not a directive",
    `export function label(name = "ring") { const kind = "worklet"; return name + kind; }`,
  );

  rule.invalid(
    "reports a default parameter in a worklet function",
    `const STRETCH = 7; export function path(progress, stretch = STRETCH) { "worklet"; return progress * stretch; }`,
    (output) => {
      assert.match(output, /runs before the UI runtime unpacks its closure/);
    },
  );

  rule.invalid(
    "reports a destructured default in a worklet arrow",
    `export const ease = ({ depth = 0.6 }) => { "worklet"; return depth; };`,
  );
});
