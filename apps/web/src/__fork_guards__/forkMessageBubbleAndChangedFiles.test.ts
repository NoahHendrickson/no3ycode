// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-message-bubble-shape` and
 * `#fork-changed-files-fold`.
 *
 * The bubble rules key on the classes and attribute upstream's sent bubble carries; a sync that
 * renames any of them silently brings back the 16px corners, p-3 and the card fill.
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
const BUBBLE = "[data-user-message-bubble]";

describe("fork guard: fork-message-bubble-shape", () => {
  const rules = cssRules(readSibling("../theme.custom.css"));

  it("rounds, pads and lightens the sent bubble", () => {
    expect(ruleBodyFor(rules, [MARKER, BUBBLE])).toContain("border-radius: var(--radius-xl)");
    expect(ruleBodyFor(rules, [MARKER, `${BUBBLE}.rounded-tr-md`])).toContain(
      "border-top-right-radius: var(--radius-md)",
    );
    expect(ruleBodyFor(rules, [MARKER, `${BUBBLE}.rounded-br-md`])).toContain(
      "border-bottom-right-radius: var(--radius-md)",
    );
    expect(ruleBodyFor(rules, [MARKER, `${BUBBLE}.p-3`])).toContain("padding: 8px 16px");
    const wash = rules.find((rule) => rule.selector.includes(`${BUBBLE}.bg-message`));
    expect(wash?.selector.startsWith(MARKER)).toBe(true);
    // Dark Flat Glass (not the whole-window vibrancy wash) and dark Basic only.
    const scope = wash?.selector.replace(/\s+/gu, "") ?? "";
    expect(scope).toContain(
      '[data-fork-glass-3d="off"][data-fork-theme="cool-darker"]:not([data-fork-sidebar-vibrancy="true"])',
    );
    expect(scope).toContain('[data-fork-theme="basic"]');
    expect(scope).toContain(").dark[data-user-message-bubble]");
    expect(wash?.body).toContain("color-mix(in srgb, #ffffff 3%, var(--card))");
  });

  it("still finds the classes upstream's bubble carries", () => {
    const row = readSibling("../components/chat/TimelineUserMessageRow.tsx");
    expect(row).toContain('data-user-message-bubble=""');
    expect(row).toContain('"relative min-w-0 max-w-[80%] rounded-2xl text-message-foreground"');
    expect(row).toContain('&& "rounded-tr-md"');
    expect(row).toContain('&& "rounded-br-md"');
    expect(row).toContain('&& "p-3"');
    expect(row).toContain('"bg-message"');
  });
});

describe("fork guard: fork-changed-files-fold", () => {
  it("folds the card until its title is clicked", () => {
    const card = readSibling("../components/chat/ChangedFilesTree.tsx");
    expect(card).toContain("const [forkOpen, setForkOpen] = useState(false);");
    expect(card).toContain("aria-expanded={forkOpen}");
  });

  it("draws one fill on Flat Glass", () => {
    const rules = cssRules(readSibling("../theme.custom.css"));
    const flat = `${MARKER}[data-fork-glass-3d="off"].dark[data-fork-theme="cool-darker"]`;
    expect(ruleBodyFor(rules, [flat, "[data-changed-files-header]", "+ div"])).toContain(
      "box-shadow: none",
    );
  });
});
