// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#no3y-media-attachment-no-chip`.
 *
 * Mobile media shows only as its strip thumbnail. Every reference-inserting
 * append in the attachment actions is counted, so a new upstream path that
 * chips media again turns this red.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

const actions = read("../../../mobile/src/state/use-composer-attachment-actions.ts");
const composer = read("../../../mobile/src/features/threads/ThreadComposer.tsx");
const delivery = read("../../../mobile/src/state/threadOutboxDelivery.ts");

describe("no3y-media-attachment-no-chip", () => {
  it("appends strip media without an inline chip", () => {
    expect(actions).toContain(
      "const shown = new Set(composerStripAttachments(attachments, () => undefined));",
    );
    expect(actions).toContain("const rejectedMedia = appendComposerDraftAttachments(key, media);");
    expect(actions).toMatch(
      /appendComposerDraftAttachments\(key, chipped, \{\s*appendReference: true,\s*insertion,\s*\}\)/u,
    );
    expect(actions.match(/appendReference: true/gu)).toHaveLength(1);
    // A selection the media replaces is still cleared, as upstream's chip insertion did.
    expect(actions).toContain('insertComposerDraftText(key, "", insertion);');
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

  it("draws the thread composer's strip thumbnails at 88pt", () => {
    expect(composer).toMatch(
      /<ComposerAttachmentStrip\s+environmentId=\{props\.environmentId\}\s+attachments=\{stripAttachments\}\s+\/\* fork:begin no3y-media-attachment-no-chip[^\n]*\*\/\s+imageSize=\{88\}/u,
    );
  });
});
