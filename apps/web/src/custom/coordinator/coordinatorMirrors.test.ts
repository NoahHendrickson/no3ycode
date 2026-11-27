import { RuntimeRequestId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { coordinatorMirroredQuestions } from "./coordinatorMirrors";

// The live case: the coordinator read the child's question, then asked the owner the same one.
const childRequest = "runtime-request:child-toolu";
const readChild = {
  type: "dynamic_tool",
  toolName: "t3-code.t3_pending_request",
  input: { action: "read", threadId: "thread:delegated-task:child", requestId: childRequest },
  output: {
    requestId: childRequest,
    questions: [{ id: "q", header: "Color", question: "Which color should I use?", options: [] }],
  },
};
const reAsk = {
  requestId: RuntimeRequestId.make("runtime-request:coordinator-async-call"),
  responseMode: "message" as const,
  questions: [{ question: "Which color should I use? " }],
};

describe("coordinatorMirroredQuestions", () => {
  it("finds the coordinator's message-mode re-ask of a child question it read", () => {
    expect(coordinatorMirroredQuestions([reAsk], [readChild])).toEqual([reAsk.requestId]);
  });

  it("leaves the coordinator's own questions alone", () => {
    // Not read off a child.
    expect(coordinatorMirroredQuestions([reAsk], [])).toEqual([]);
    // Only one of its questions repeats the child's.
    const wider = { ...reAsk, questions: [...reAsk.questions, { question: "And the size?" }] };
    expect(coordinatorMirroredQuestions([wider], [readChild])).toEqual([]);
    // A live question waits on an answer, so a dismiss could not cancel it.
    const { responseMode: _live, ...live } = reAsk;
    expect(coordinatorMirroredQuestions([live], [readChild])).toEqual([]);
    // Answering the child (action respond) is not reading it.
    const respond = { ...readChild, input: { ...readChild.input, action: "respond" } };
    expect(coordinatorMirroredQuestions([reAsk], [respond])).toEqual([]);
  });
});
