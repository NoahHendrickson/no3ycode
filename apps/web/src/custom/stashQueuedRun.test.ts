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
import { queuedRunStashContent } from "./stashQueuedRun";

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
