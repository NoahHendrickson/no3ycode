// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-changed-files-card`.
 *
 * The restyle is CSS-only against upstream data attributes. Drop either the
 * attribute or the fork-scoped --card rule and Westworld silently falls back
 * to translucent bg-input/32 — the card compiles, ships, and looks wrong.
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
const theme = readSibling("../theme.custom.css");
const changedFiles = readSibling("../components/chat/ChangedFilesTree.tsx");

describe("fork guard: fork-changed-files-card", () => {
  it("keeps the upstream data attributes the stylesheet hangs off", () => {
    expect(changedFiles).toContain("data-changed-files-state=");
    expect(changedFiles).toContain('data-changed-files-header=""');
    // Upstream still ships the translucent wash the fork overrides.
    expect(changedFiles).toMatch(/dark:bg-input\/\d+/u);
    // Outline actions are Tooltip triggers — CSS must select `button`, not
    // data-slot="button" (TooltipTrigger wins the slot).
    expect(changedFiles).toContain("TooltipTrigger");
  });

  it("paints the card from --card under the fork dark marker", () => {
    const card = cssRules(theme).find(
      (rule) =>
        rule.selector.includes("[data-changed-files-state]") &&
        !rule.selector.includes("button") &&
        !rule.selector.includes("span.truncate") &&
        rule.body.includes("background"),
    );
    expect(card?.selector).toContain(MARKER);
    expect(card?.selector).toContain(".dark");
    expect(card?.body).toMatch(/background:\s*var\(--card\)/u);
    expect(card?.body).toMatch(/border-radius:\s*var\(--fork-card-radius\)/u);
    expect(card?.body).toMatch(/--fork-card-radius:\s*var\(--fork-composer-radius\)/u);
    expect(card?.body).toMatch(/border:\s*1px solid var\(--fork-composer-border\)/u);
  });

  it("draws the file tree under a loose header, parted by a rounded hairline", () => {
    // The rules hang off the header's following sibling divs: the tree's
    // root wrapper (a fragment or another tag would drop the well) and the
    // "N more files" footer.
    expect(changedFiles).toMatch(/<\/div>\s*<ChangedFilesTree\b/u);
    expect(changedFiles).toMatch(
      /function ChangedFilesRows[\s\S]*?return \(\s*<div className="p-2">/u,
    );
    expect(changedFiles).toMatch(/hiddenFileCount > 0 && \(\s*<div /u);
    const rules = cssRules(theme).map((rule) => ({
      ...rule,
      selector: rule.selector.replace(/\s+/gu, " "),
    }));
    // The tree under the header keeps the card's fill: no shared well fill (Basic paints its own).
    expect(
      rules.find((rule) => rule.selector.endsWith("[data-changed-files-header] ~ div")),
    ).toBeUndefined();
    const top = rules.find((rule) => rule.selector.endsWith("[data-changed-files-header] + div"));
    expect(top?.body).toMatch(/box-shadow:\s*inset 0 1px 0 var\(--fork-composer-border\)/u);
    // The tree's top corners round too, so its hairline curves into the card's sides.
    expect(top?.body).toMatch(/border-top-left-radius:\s*calc\(var\(--fork-card-radius\) - 1px\)/u);
    // The bottom rule rounds only the bottom, so it never competes with that top.
    const bottom = rules.find((rule) =>
      rule.selector.endsWith("[data-changed-files-header] ~ div:last-child"),
    );
    expect(bottom?.body).not.toMatch(/border-radius:/u);
    const basicRules = cssRules(readSibling("../theme.custom.basic.css")).map((rule) => ({
      ...rule,
      selector: rule.selector.replace(/\s+/gu, " "),
    }));
    expect(
      basicRules.find((rule) =>
        rule.selector.endsWith('[data-fork-theme="basic"] [data-changed-files-header] ~ div'),
      )?.body,
    ).toMatch(/background:\s*var\(--basic-raised\)/u);
    expect(top?.body).toMatch(
      /border-top-right-radius:\s*calc\(var\(--fork-card-radius\) - 1px\)/u,
    );
  });

  it("paints the user's sent bubble from --card too", () => {
    // The user row's bubble is `bg-message` → --message-surface, which
    // upstream aliases to --accent (one rung brighter than the card). The
    // fill has to be set on the element: --color-message is declared on
    // :root, so a token retarget computes var(--card) at the root, while the
    // card reads the --card rescoped under [data-sidebar-version="v2"].
    const bubble = cssRules(theme).find(
      (rule) => rule.selector === `${MARKER}:is(.dark, [data-fork-theme="basic"]) .bg-message`,
    );
    expect(bubble?.body).toMatch(/background-color:\s*var\(--card\)/u);
    expect(theme).not.toMatch(/--message-surface:/u);
    expect(readSibling("../components/chat/TimelineUserMessageRow.tsx")).toContain("bg-message ");
  });

  it("hovers as a 4% white lift, never a darker fill", () => {
    const rules = cssRules(theme);
    const hover = rules.find(
      (rule) =>
        rule.selector.replace(/\s+/gu, " ").includes("[data-changed-files-state] button:hover") &&
        rule.body.includes("--fork-outline-hover-bg"),
    );
    expect(hover?.selector).toContain(MARKER);
    expect(hover?.selector).toContain(".dark");
    expect(hover?.body).toMatch(/background-color:\s*var\(--fork-outline-hover-bg\)/u);
    const token = rules.find((rule) => rule.body.includes("--fork-outline-hover-bg:"));
    expect(token?.selector).toContain(".dark");
    expect(token?.body).toMatch(/--fork-outline-hover-bg:\s*rgb\(255 255 255 \/ 4%\)/u);
  });

  it("lifts path labels outside the header and keeps header action buttons borderless", () => {
    const label = cssRules(theme).find(
      (rule) =>
        rule.selector.includes("[data-changed-files-state]") &&
        rule.selector.includes("span.truncate") &&
        rule.selector.includes(":not([data-changed-files-header])"),
    );
    expect(label?.selector).toContain(MARKER);
    expect(label?.body).toMatch(/color:\s*var\(--foreground\)/u);
    // MiddleTruncate's tail half takes the same ink as its truncating head.
    expect(label?.selector).toContain("span.truncate + span.shrink-0");

    // The header actions are ghost-muted Buttons upstream: they keep the
    // foreground ink but must not be pulled into the outline recipe, which
    // would recolour their transparent border into a visible one.
    const button = cssRules(theme).find((rule) =>
      rule.selector.replace(/\s+/gu, " ").includes("[data-changed-files-header] > div button"),
    );
    expect(button?.selector).toContain(MARKER);
    expect(button?.selector).toContain(".dark");
    expect(button?.body).toMatch(/color:\s*var\(--foreground\)/u);
    for (const rule of cssRules(theme)) {
      if (!rule.selector.includes("[data-changed-files-header]")) continue;
      expect(rule.body).not.toMatch(/border-color:\s*var\(--fork-outline-border/u);
    }
    // Must not key off data-slot="button" — TooltipTrigger overwrites it.
    expect(theme).not.toMatch(/\[data-changed-files-state\][^{]*\[data-slot="button"\]/u);
  });
});
