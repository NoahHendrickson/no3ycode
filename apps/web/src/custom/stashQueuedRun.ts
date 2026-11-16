import { resolveAssetUrl } from "@t3tools/client-runtime/state/assets";
import {
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import type {
  AssetCreateUrlInput,
  AssetCreateUrlResult,
  ChatAttachment,
  ChatImageAttachment,
  ComposerContextRecord,
  EnvironmentId,
} from "@t3tools/contracts";
import {
  stripAttachmentOnlyBootstrapPrompt,
  toKindScopedComposerContextId,
} from "@t3tools/shared/composerContextReferences";

import type { PersistedComposerImageAttachment } from "~/composerDraftStore";
import { collectComposerPromptInlineTokens } from "~/composer-editor-mentions";
import { extractTrailingDesignChanges } from "~/custom/designMode/designChangeTranscript";
import { releasePersistedAttachmentUpload } from "~/lib/attachmentUploadQueue";
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
import { readPreparedConnection } from "~/state/session";

/** Stash entries hold images inline; a queued file lives on the server and cannot be re-sent. */
export function queuedRunStashBlockReason(input: {
  readonly text: string;
  readonly attachments: ReadonlyArray<ChatAttachment>;
  readonly guest: boolean;
}): string | null {
  if (input.guest) return "A guest's message can be removed, not stashed";
  if (input.attachments.some((attachment) => attachment.type !== "image")) {
    return "Messages with attached files cannot be stashed";
  }
  // The stash has no place to hold the run aside, so it would restore as editable markup.
  if (extractTrailingDesignChanges(input.text).blocks.length > 0) {
    return "Messages with design changes cannot be stashed";
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

export async function loadQueuedImage(input: {
  readonly image: ChatImageAttachment;
  readonly environmentId: EnvironmentId;
  readonly createAssetUrl: (query: {
    environmentId: EnvironmentId;
    input: AssetCreateUrlInput;
  }) => Promise<AtomCommandResult<AssetCreateUrlResult, unknown>>;
}): Promise<File> {
  const { image } = input;
  const connection = readPreparedConnection(input.environmentId);
  if (!connection) throw new Error("The environment is not connected.");
  const result = await input.createAssetUrl({
    environmentId: input.environmentId,
    input: {
      resource: {
        _tag: "attachment",
        attachmentId: image.id,
        fileName: image.name,
        mimeType: image.mimeType,
      },
    },
  });
  if (result._tag === "Failure") throw squashAtomCommandFailure(result);
  const url = resolveAssetUrl(connection.httpBaseUrl, result.value.relativeUrl);
  if (url === null) throw new Error("The environment returned an invalid attachment URL.");
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Could not load ${image.name}`);
  return new File([await response.blob()], image.name, { type: image.mimeType });
}

// Removing the run deletes the server's copy, so an image the stash cannot keep keeps the run queued.
async function queuedRunStashEntry(input: {
  readonly text: string;
  readonly records: ReadonlyArray<ComposerContextRecord>;
  readonly attachments: ReadonlyArray<ChatAttachment>;
  readonly loadImage: (image: ChatImageAttachment) => Promise<File>;
}): Promise<
  | { readonly entry: PromptStashEntry; readonly unsavedImageNames?: never }
  | { readonly entry?: never; readonly unsavedImageNames: ReadonlyArray<string> }
> {
  const { prompt, records, imageIdByAttachmentId } = queuedRunStashContent(input);
  const images = input.attachments.filter(
    (attachment): attachment is ChatImageAttachment => attachment.type === "image",
  );
  const results = await Promise.all(
    images.map(async (image) => {
      const file = await input.loadImage(image).catch(() => null);
      return { image, result: file ? await compressImageForStash(file) : null };
    }),
  );
  const candidates: PersistedComposerImageAttachment[] = [];
  const unsavedImageNames: string[] = [];
  for (const { image, result } of results) {
    if (!result?.ok) {
      unsavedImageNames.push(image.name);
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
  unsavedImageNames.push(...droppedNames);
  if (unsavedImageNames.length > 0) return { unsavedImageNames };
  return {
    entry: {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      prompt,
      attachments: kept,
      droppedImageNames: [],
      unreadableImageNames: [],
      ...(records.length > 0 ? { records: [...records] } : {}),
    },
  };
}

export type QueuedRunStashOutcome =
  | { readonly _tag: "ImagesFailed"; readonly imageNames: ReadonlyArray<string> }
  | { readonly _tag: "WriteFailed" }
  | { readonly _tag: "CancelFailed" }
  | { readonly _tag: "Moved"; readonly durable: boolean; readonly evicted: boolean };

/** Stash first, then remove: a run that starts in between keeps its message and the stash is restored. */
export async function moveQueuedRunToStash(input: {
  readonly text: string;
  readonly records: ReadonlyArray<ComposerContextRecord>;
  readonly attachments: ReadonlyArray<ChatAttachment>;
  readonly loadImage: (image: ChatImageAttachment) => Promise<File>;
  /** Resolves true once the run has left the queue. */
  readonly cancel: () => Promise<boolean>;
}): Promise<QueuedRunStashOutcome> {
  const { entry, unsavedImageNames } = await queuedRunStashEntry(input);
  if (!entry) return { _tag: "ImagesFailed", imageNames: unsavedImageNames };
  const { written, durable, evicted } = usePromptStashStore.getState().stashEntry(entry);
  if (!written) return { _tag: "WriteFailed" };
  if (!(await input.cancel())) {
    usePromptStashStore.getState().unstashEntry(entry.id, evicted);
    return { _tag: "CancelFailed" };
  }
  for (const file of evicted?.files ?? []) releasePersistedAttachmentUpload(file);
  return { _tag: "Moved", durable, evicted: evicted !== null };
}
