// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-outset-focus-rings`.
 *
 * The rules key off upstream's class strings (`focus-visible:ring-inset`,
 * `focus-visible:-outline-offset-2`). A sync that renames those utilities or
 * moves focus rings to another mechanism brings the inward ring back quietly.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { FORK_MARKER_ATTRIBUTE, FORK_MARKER_VALUE } from "../custom/forkMarker";
import { cssRules } from "./cssRules";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const MARKER = `:root[${FORK_MARKER_ATTRIBUTE}="${FORK_MARKER_VALUE}"]`;
const rules = cssRules(readSibling("../theme.custom.css"));

describe("fork-outset-focus-rings", () => {
  it("draws focus as a thin outline with a gap outside the control", () => {
    const tokens = rules.find(
      (rule) => rule.selector === MARKER && rule.body.includes("--fork-focus-ring-gap"),
    );
    expect(tokens?.body).toContain("--fork-focus-ring-width: 1.5px");
    expect(tokens?.body).toContain("--fork-focus-ring-gap: 2px");

    const ring = rules.find((rule) => rule.body.includes("--tw-ring-shadow: 0 0 #0000"));
    expect(ring?.selector.startsWith(MARKER)).toBe(true);
    expect(ring?.selector).toContain('[class*="focus-visible:ring-inset"]:focus-visible');
    expect(ring?.selector).toContain('[data-slot="scroll-area-viewport"]');
    expect(ring?.selector).toContain('[class*="focus-visible:ring-0"]');
    expect(ring?.body).toContain("outline-offset: var(--fork-focus-ring-gap)");

    const outline = rules.find(
      (rule) =>
        rule.body.includes("outline-offset: var(--fork-focus-ring-gap)") &&
        rule.selector.includes('[class*="focus-visible:-outline-offset-2"]:focus-visible'),
    );
    expect(outline?.selector.startsWith(MARKER)).toBe(true);
  });

  it("still finds the upstream hooks the rules key off", () => {
    expect(readSibling("../components/ui/button.tsx")).toContain(
      "focus-visible:ring-2 focus-visible:ring-inset",
    );
    expect(readSibling("../components/ui/checkbox.tsx")).toContain(
      "focus-visible:-outline-offset-2",
    );
    expect(readSibling("../components/ui/checkbox.tsx")).toContain(
      'data-slot="checkbox-indicator"',
    );
    expect(readSibling("../index.css")).toContain("outline-offset: -2px;");
  });
});
