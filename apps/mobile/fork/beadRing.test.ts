import * as NodeModule from "node:module";
import { describe, expect, it } from "vite-plus/test";

import { beadRingPath } from "./beadRing";

type Worklet = ((...args: number[]) => unknown) & {
  __closure: unknown;
  __initData: { code: string };
};

const appRequire = NodeModule.createRequire(import.meta.url);
const babel = appRequire("@babel/core") as {
  transformFileSync(file: string, options: object): { code: string };
};

/** Each exported worklet as the UI runtime builds it: its code string, run with only `__closure`. */
function uiRuntimeWorklets() {
  const filename = new URL("./beadRing.ts", import.meta.url).pathname;
  const { code } = babel.transformFileSync(filename, {
    cwd: new URL("..", import.meta.url).pathname,
    envName: "production",
    caller: { name: "metro", platform: "ios", supportsStaticESM: false },
  });
  const exports: Record<string, unknown> = {};
  // The output needs only @babel/runtime helpers, which resolve from the preset that emits them.
  const presetRequire = NodeModule.createRequire(appRequire.resolve("babel-preset-expo"));
  new Function("require", "exports", code)(presetRequire, exports);
  return Object.fromEntries(
    Object.entries(exports)
      .filter((entry): entry is [string, Worklet] => typeof entry[1] === "function")
      .map(([name, fn]) => {
        const compiled = new Function(`return ${fn.__initData.code}`)() as Worklet;
        return [name, (...args: number[]) => compiled.call({ __closure: fn.__closure }, ...args)];
      }),
  );
}

describe("bead ring path", () => {
  it("draws the line and four beads as five arcs", () => {
    expect(beadRingPath(0.3).match(/M/g)).toHaveLength(5);
  });

  it("loops seamlessly: the last frame of a loop is the first of the next", () => {
    expect(beadRingPath(0.999_999)).toBe(beadRingPath(0));
    expect(beadRingPath(1.25)).toBe(beadRingPath(0.25));
  });

  // A worklet's default parameter runs before its closure is unpacked: a Release-only crash.
  it("runs on the UI runtime exactly as it does in JS", () => {
    const worklets = uiRuntimeWorklets();
    expect(worklets.beadRingPath!(0.3)).toBe(beadRingPath(0.3));
    expect(worklets.beadRingPath!(0.3, 0)).toBe(beadRingPath(0.3, 0));
  });
});
