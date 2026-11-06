// @effect-diagnostics nodeBuiltinImport:off
// Fork guard — see `.fork/customizations.yaml#fork-outset-focus-rings`.
// A renamed upstream class, slot or attribute silently brings an inward ring
// back, so every hook in the sheet's selectors must still appear in source.

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { FORK_MARKER_ATTRIBUTE, FORK_MARKER_VALUE } from "../custom/forkMarker";
import { cssRules } from "./cssRules";

const SRC = NodeURL.fileURLToPath(new URL("..", import.meta.url));
const SHEET = "theme.custom.focus-rings.css";
const read = (relativePath: string) =>
  NodeFS.readFileSync(NodePath.join(SRC, relativePath), "utf8");
const rules = cssRules(read(SHEET));

function upstreamSources(): string {
  return NodeFS.readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.(tsx?|css)$/u.test(entry.name) &&
        entry.name !== SHEET &&
        !entry.parentPath.includes("__fork_guards__"),
    )
    .map((entry) => NodeFS.readFileSync(NodePath.join(entry.parentPath, entry.name), "utf8"))
    .join("\n");
}

describe("fork-outset-focus-rings", () => {
  it("loads the sheet with every rule scoped under the fork marker", () => {
    expect(read("main.tsx")).toContain('import "./theme.custom.focus-rings.css"');
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.selector).toContain(`[${FORK_MARKER_ATTRIBUTE}="${FORK_MARKER_VALUE}"]`);
    }
    expect(rules.some((rule) => rule.body.includes("--tw-ring-shadow: 0 0 #0000"))).toBe(true);
  });

  it("still finds every upstream hook the selectors key off", () => {
    const hooks = new Set(
      rules.flatMap((rule) =>
        [
          ...rule.selector.matchAll(
            /\[class\*="([^"]+)"\]|\[data-slot="([^"]+)"\]|\[(data-[\w-]+)\]|\.([a-z][\w-]*)/gu,
          ),
        ].map((match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? ""),
      ),
    );
    hooks.delete("");
    expect(hooks.size).toBeGreaterThan(10);
    const sources = upstreamSources();
    expect([...hooks].filter((hook) => !sources.includes(hook))).toEqual([]);
    // The slider rules copy the thumb's resting shadow from upstream.
    expect(read("index.css")).toContain(
      "box-shadow: 0 1px 2px color-mix(in srgb, var(--contrast-foreground) 12%, transparent);",
    );
  });
});
