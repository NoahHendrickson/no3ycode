import {
  EnvironmentId,
  MessageId,
  ThreadId,
  TurnItemId,
  type ImageContextRecord,
} from "@t3tools/contracts";
import { toKindScopedComposerContextId } from "@t3tools/shared/composerContextReferences";
import { describe, expect, it } from "vite-plus/test";

import {
  environmentContextRecord,
  environmentContextReference,
  responseContextRecord,
  responseContextReference,
} from "~/lib/composerContextRecords";
import { formatInlineContextReference } from "~/lib/composerContextReferences";
import {
  MAX_STASH_ENTRIES,
  usePromptStashStore,
  writePromptStashStorageForTest,
} from "~/promptStashStore";
import {
  moveQueuedRunToStash,
  queuedRunStashBlockReason,
  queuedRunStashContent,
} from "./stashQueuedRun";

describe("queuedRunStashContent", () => {
  it("moves the reply chip to a record, keeps image chips on their composer id, and keeps a trailing chip parseable", () => {
    const reply = responseContextRecord({
      citation: {
        version: 1,
        environmentId: EnvironmentId.make("environment-1"),
        threadId: ThreadId.make("thread-1"),
        messageId: MessageId.make("message-1"),
        text: "Done.",
        start: 0,
        end: 5,
        prefix: "",
        suffix: "",
      },
      itemId: TurnItemId.make("item-1"),
      subagents: [],
    });
    const machine = environmentContextRecord(EnvironmentId.make("environment-2"), "Mac");
    const orphan = environmentContextRecord(EnvironmentId.make("environment-3"), "Box");
    const machineChip = formatInlineContextReference(environmentContextReference(machine));
    const image: ImageContextRecord = {
      version: 1,
      kind: "image",
      contextId: toKindScopedComposerContextId("image", "composer-image-1"),
      label: "shot.png",
      attachmentId: "thread-1-attachment-1",
      name: "shot.png",
      mimeType: "image/png",
      sizeBytes: 10,
    };
    const imageChip = formatInlineContextReference({
      kind: "image",
      contextId: image.contextId,
      label: image.label,
    });
    const text = `${formatInlineContextReference(responseContextReference(reply))} See ${imageChip} and run it on ${machineChip}`;

    expect(queuedRunStashContent({ text, records: [reply, machine, orphan, image] })).toEqual({
      prompt: `See ${imageChip} and run it on ${machineChip} `,
      records: [reply, machine],
      imageIdByAttachmentId: new Map([["thread-1-attachment-1", "composer-image-1"]]),
    });
  });
});

describe("queuedRunStashBlockReason", () => {
  it("keeps a message with design changes queued", () => {
    expect(
      queuedRunStashBlockReason({
        text: "Tweak it\n\n<design_change_request>\nMake the button blue\n</design_change_request>",
        attachments: [],
        guest: false,
      }),
    ).toBe("Messages with design changes cannot be stashed");
  });
});

describe("moveQueuedRunToStash", () => {
  it("restores a full stash, evicted entry included, when the run cannot be removed", async () => {
    const entries = Array.from({ length: MAX_STASH_ENTRIES }, (_, index) => ({
      id: `entry-${index}`,
      createdAt: "2026-11-16T00:00:00.000Z",
      prompt: `prompt ${index}`,
      attachments: [],
      droppedImageNames: [],
    }));
    writePromptStashStorageForTest(JSON.stringify({ version: 2, state: { entries } }));

    const outcome = await moveQueuedRunToStash({
      text: "queued",
      records: [],
      attachments: [],
      loadImage: () => Promise.reject(new Error("no images")),
      cancel: () => Promise.resolve(false),
    });

    expect(outcome).toEqual({ _tag: "CancelFailed" });
    expect(usePromptStashStore.getState().entries.map((entry) => entry.id)).toEqual(
      entries.map((entry) => entry.id),
    );
  });
});
