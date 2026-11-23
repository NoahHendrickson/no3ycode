// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#no3y-mobile-redesign`. */

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const forkDir = NodeURL.fileURLToPath(new URL("../../../mobile/fork/", import.meta.url));

// Hermes lacks these ES2023 copy methods; vitest runs on Node, which has them, so only a scan catches a crash.
const UNSUPPORTED = /\.(toSorted|toReversed|toSpliced)\(/u;

describe("fork guard: no3y mobile code avoids array methods Hermes lacks", () => {
  it("uses no toSorted/toReversed/toSpliced in shipped fork files", () => {
    const offenders = NodeFS.readdirSync(forkDir, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.(ts|tsx|mts)$/u.test(file) && !/\.test\./u.test(file))
      .filter((file) =>
        UNSUPPORTED.test(NodeFS.readFileSync(NodePath.join(forkDir, file), "utf8")),
      );
    expect(offenders).toEqual([]);
  });
});
