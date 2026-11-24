// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#no3y-media-attachment-no-chip`.
 *
 * Mobile media shows only as its strip thumbnail. The draft store's behaviour is
 * tested in apps/mobile/src/state/use-composer-drafts.test.ts; this pins the
 * fenced call sites an upstream sync could silently revert.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

const drafts = read("../../../mobile/src/state/use-composer-drafts.ts");
const composer = read("../../../mobile/src/features/threads/ThreadComposer.tsx");
const delivery = read("../../../mobile/src/state/threadOutboxDelivery.ts");
const pendingTitles = [
  read("../../../mobile/src/state/pending-thread-creation.ts"),
  read("../../../mobile/src/state/pending-new-tasks-model.ts"),
];

describe("no3y-media-attachment-no-chip", () => {
  it("adds strip media to the draft store without a chip", () => {
    expect(drafts).toContain(
      "draftWithInsertionSelectionRemoved(draftKey, draft, options.insertion)",
    );
  });

  // With no chip in the text, a media-only send would otherwise reach the agent as "".
  it("sends the attachment-only prompt for a media-only message", () => {
    expect(delivery).toMatch(
      /serializeComposerMessageForServer\(\s*\/\* fork:begin[^\n]*\*\/\s*restoreAttachmentOnlyBootstrapPrompt\(\s*queuedMessage\.text,\s*prepared\.attachments\.length > 0,\s*\)/u,
    );
    expect(delivery).toMatch(
      /serializeComposerMessageForServer\(\s*\/\* fork:begin[^\n]*\*\/\s*restoreAttachmentOnlyBootstrapPrompt\(\s*queuedMessage\.text\.trim\(\),\s*prepared\.attachments\.length > 0,\s*\)/u,
    );
  });

  it("titles a pending media-only thread from its attachments", () => {
    for (const source of pendingTitles) {
      expect(source).toContain(
        'deriveThreadTitleSeed({ text: "", attachments: message.attachments }, m)',
      );
    }
  });

  it("draws the thread composer's strip thumbnails at 88pt", () => {
    expect(composer).toMatch(
      /<ComposerAttachmentStrip\s+environmentId=\{props\.environmentId\}\s+attachments=\{stripAttachments\}\s+\/\* fork:begin no3y-media-attachment-no-chip[^\n]*\*\/\s+imageSize=\{88\}/u,
    );
  });
});
