// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-inline-code-chip`.
 *
 * The chip overrides upstream's inline code rule; a sync that renames the
 * markdown root, the user-bubble class or the file-link class silently brings
 * the grey chip back.
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

describe("fork guard: fork-inline-code-chip", () => {
  it("wears reply code and file links as a link-blue chip", () => {
    // The formatter wraps long selectors, so compare them on single spaces.
    const chip = cssRules(readSibling("../theme.custom.css"))
      .map((rule) => ({ ...rule, selector: rule.selector.replace(/\s+/gu, " ") }))
      .find(
        (rule) =>
          rule.selector.includes(
            ':is([data-message-role="assistant"], [data-timeline-row-kind="sent-message"]) .chat-markdown :not(pre) > code',
          ) && rule.selector.includes(".chat-markdown-file-link"),
      );
    expect(chip?.selector.startsWith(MARKER)).toBe(true);
    expect(chip?.body).toContain("color: var(--info-foreground)");
    expect(chip?.body).toContain("background: var(--fork-inline-code-wash)");
    expect(chip?.body).toContain("line-height: 1.3");
  });

  it("still finds the hooks upstream owns", () => {
    const index = readSibling("../index.css");
    expect(index).toContain(".chat-markdown :not(pre) > code {");
    const timeline = readSibling("../components/chat/MessagesTimeline.tsx");
    expect(timeline).toContain("data-timeline-row-kind={row.kind}");
    expect(timeline).toContain(
      'data-message-role={row.kind === "message" ? row.message.role : undefined}',
    );
    expect(readSibling("../components/chat/MarkdownFileLink.tsx")).toContain(
      '"chat-markdown-file-link"',
    );
  });
});
