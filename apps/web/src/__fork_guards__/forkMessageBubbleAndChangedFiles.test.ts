// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-message-bubble-shape` and
 * `#fork-changed-files-fold`.
 *
 * The bubble's shape lives in fenced classes, its lift in one per-theme token; the card's fold
 * reuses the persisted per-run folders flag and unmounts its tree while folded.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { FORK_MARKER_ATTRIBUTE, FORK_MARKER_VALUE } from "../custom/forkMarker";
import { cssRules, ruleBodyFor } from "./cssRules";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const MARKER = `:root[${FORK_MARKER_ATTRIBUTE}="${FORK_MARKER_VALUE}"]`;
const rules = cssRules(readSibling("../theme.custom.css"));

describe("fork guard: fork-message-bubble-shape", () => {
  it("rounds and pads the sent bubble in its classes", () => {
    const row = readSibling("../components/chat/TimelineUserMessageRow.tsx");
    expect(row).toContain('"relative min-w-0 max-w-[80%] rounded-xl text-message-foreground"');
    expect(row).toContain('"min-w-0 max-w-[80%] rounded-xl bg-message text-message-foreground"');
    expect(row).toContain('&& "px-4 py-2"');
  });

  it("lifts the bubble 3% on Flat Glass and dark Basic", () => {
    const lift = rules.find((rule) => rule.body.includes("--fork-message-bubble-lift:"));
    const scope = lift?.selector.replace(/\s+/gu, " ") ?? "";
    expect(scope).toContain(
      `${MARKER}[data-fork-glass-3d="off"].dark[data-fork-theme="cool-darker"]`,
    );
    expect(scope).toContain(`${MARKER}[data-fork-theme="basic"].dark`);
    expect(lift?.body).toMatch(/--fork-message-bubble-lift:\s*3%/u);
  });
});

describe("fork guard: fork-changed-files-fold", () => {
  it("opens from the persisted folders flag and unmounts the tree while folded", () => {
    const card = readSibling("../components/chat/ChangedFilesTree.tsx");
    expect(card).toContain("const forkOpen = allDirectoriesExpanded;");
    expect(card).toContain("onToggleAllDirectories();");
    expect(card).toMatch(/\{forkOpen && \(\s*<>/u);
  });

  it("rounds the folded header and draws one fill on Flat Glass", () => {
    const scope = `${MARKER}:is(.dark, [data-fork-theme="basic"])`;
    expect(ruleBodyFor(rules, [scope, "[data-changed-files-header]:last-child"])).toContain(
      "border-radius: calc(var(--fork-card-radius) - 1px)",
    );
    const hairline = rules.find((rule) =>
      rule.selector.replace(/\s+/gu, " ").endsWith("[data-changed-files-header] + div"),
    );
    expect(hairline?.selector.replace(/\s+/gu, "")).toContain(
      ':not([data-fork-glass-3d="off"][data-fork-theme="cool-darker"])',
    );
  });
});
