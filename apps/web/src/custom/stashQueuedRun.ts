import type {
  ChatAttachment,
  ChatImageAttachment,
  ComposerContextRecord,
} from "@t3tools/contracts";
import {
  stripAttachmentOnlyBootstrapPrompt,
  toKindScopedComposerContextId,
} from "@t3tools/shared/composerContextReferences";

import type { PersistedComposerImageAttachment } from "~/composerDraftStore";
import { collectComposerPromptInlineTokens } from "~/composer-editor-mentions";
import { isResponseContextRecord } from "~/lib/composerContextRecords";
import {
  collectInlineContextIds,
  removeInlineContextReference,
} from "~/lib/composerContextReferences";
import { compressImageForStash } from "~/lib/imageCompression";
import { resizeSnapShotSource } from "~/lib/snapShotSource";
import { randomUUID } from "~/lib/utils";
import {
  partitionStashAttachments,
  usePromptStashStore,
  type PromptStashEntry,
} from "~/promptStashStore";

/** Stash entries hold images inline; a queued file lives on the server and cannot be re-sent. */
export function queuedRunStashBlockReason(input: {
  readonly attachments: ReadonlyArray<ChatAttachment>;
  readonly guest: boolean;
}): string | null {
  if (input.guest) return "A guest's message can be removed, not stashed";
  if (input.attachments.some((attachment) => attachment.type !== "image")) {
    return "Messages with attached files cannot be stashed";
  }
  return null;
}

/** Shapes a queued message like a stashed composer draft: the reply rides as a record, not a chip. */
export function queuedRunStashContent(input: {
  readonly text: string;
  readonly records: ReadonlyArray<ComposerContextRecord>;
}): {
  readonly prompt: string;
  readonly records: ReadonlyArray<ComposerContextRecord>;
  readonly imageIdByAttachmentId: ReadonlyMap<string, string>;
} {
  const sentText = stripAttachmentOnlyBootstrapPrompt(input.text);
  const referenced = new Set(collectInlineContextIds(sentText));
  // Restored images are the attachments themselves, so their records stay out like a composer stash.
  const records = input.records.filter(
    (record) =>
      referenced.has(record.contextId) && record.kind !== "image" && record.kind !== "file",
  );
  // Image chips and annotation screenshots point at the composer image id the record was keyed by.
  const imageIdByAttachmentId = new Map<string, string>();
  for (const record of input.records) {
    if (record.kind !== "image" || !("attachmentId" in record)) continue;
    const imageId = record.contextId.replace(/^image_/, "");
    if (toKindScopedComposerContextId("image", imageId) === record.contextId) {
      imageIdByAttachmentId.set(record.attachmentId, imageId);
    }
  }
  const reply = records.find(isResponseContextRecord);
  const text = (
    reply ? removeInlineContextReference(sentText, reply.contextId).prompt : sentText
  ).trim();
  // A trailing chip only parses with whitespace after it.
  const endsWithChip = collectComposerPromptInlineTokens(text).at(-1)?.end === text.length;
  return { prompt: endsWithChip ? `${text} ` : text, records, imageIdByAttachmentId };
}

export async function stashQueuedRun(input: {
  readonly text: string;
  readonly records: ReadonlyArray<ComposerContextRecord>;
  readonly attachments: ReadonlyArray<ChatAttachment>;
  readonly loadImage: (image: ChatImageAttachment) => Promise<File>;
}): Promise<
  | { readonly written: false }
  | {
      readonly written: true;
      readonly entryId: string;
      readonly durable: boolean;
      readonly evicted: PromptStashEntry | null;
    }
> {
  const { prompt, records, imageIdByAttachmentId } = queuedRunStashContent(input);
  const candidates: PersistedComposerImageAttachment[] = [];
  const oversizedImageNames: string[] = [];
  const unreadableImageNames: string[] = [];
  const images = input.attachments.filter(
    (attachment): attachment is ChatImageAttachment => attachment.type === "image",
  );
  for (const image of images) {
    const file = await input.loadImage(image).catch(() => null);
    const result = file ? await compressImageForStash(file) : null;
    if (!result?.ok) {
      (result?.reason === "too-large" ? oversizedImageNames : unreadableImageNames).push(
        image.name,
      );
      continue;
    }
    candidates.push({
      id: imageIdByAttachmentId.get(image.id) ?? randomUUID(),
      name: image.name,
      mimeType: result.image.mimeType,
      sizeBytes: result.image.sizeBytes,
      dataUrl: result.image.dataUrl,
      ...(image.source
        ? { source: resizeSnapShotSource(image.source, result.image.imageSize) }
        : {}),
    });
  }
  const { kept, droppedNames } = partitionStashAttachments(candidates);
  const entryId = randomUUID();
  const { written, durable, evicted } = usePromptStashStore.getState().stashEntry({
    id: entryId,
    createdAt: new Date().toISOString(),
    prompt,
    attachments: kept,
    droppedImageNames: [...oversizedImageNames, ...droppedNames],
    unreadableImageNames,
    ...(records.length > 0 ? { records: [...records] } : {}),
  });
  return written ? { written, entryId, durable, evicted } : { written };
}
