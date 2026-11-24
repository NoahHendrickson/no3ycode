// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and
 * `.fork/customizations.yaml#fork-interface-size-text-only`.
 *
 * Interface font size is the root font size, so a rem geometry token would shrink controls with
 * it. Each token upstream defines in rem is pinned to its 16px value in px at the fork root.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const PINNED = {
  "--spacing": "4px",
  "--radius": "8px",
  "--radius-xs": "2px",
  "--radius-4xl": "32px",
  "--control-radius": "8px",
  "--sidebar-content-inset": "8px",
  "--sidebar-control-gap": "8px",
  "--sidebar-row-content-inset": "10px",
  "--command-shell-inset": "8px",
  "--command-content-inset": "16px",
  "--floating-content-inset": "12px",
};

describe("fork guard: interface size scales text only", () => {
  const sheet = readSibling("../theme.custom.css");
  const start = sheet.indexOf("Interface font size scales text only");
  const block = sheet.slice(sheet.indexOf("{", start), sheet.indexOf("}", start) + 1);

  it("pins every rem geometry token to its 16px value", () => {
    expect(sheet.slice(start, sheet.indexOf("{", start))).toContain(
      ':root[data-fork="noahhendrickson-t3code"]',
    );
    for (const [token, value] of Object.entries(PINNED)) {
      expect(block).toContain(`${token}: ${value};`);
    }
  });

  it("still finds the rem values it pins, so an upstream change is noticed", () => {
    const index = readSibling("../index.css");
    expect(index).toContain("--radius: 0.5rem;");
    expect(index).toContain("--control-radius: 0.5rem;");
    expect(index).toContain("--command-content-inset: 1rem;");
    expect(index).toContain("--floating-content-inset: 0.75rem;");
    expect(readSibling("../appearanceFonts.ts")).toContain("root.style.fontSize = `${");
  });
});
