import { describe, expect, it } from "vite-plus/test";

import { childQuestionAnswers } from "./coordinatorAnswers";

// The live case: a Claude child's AskUserQuestion, answered "Red" on the coordinator's card.
const requestId = "runtime-request:child-toolu";
const answered = {
  type: "user_input_request",
  requestId,
  questions: [{ id: "Which color should I use?", question: "Which color should I use?" }],
  questionAnswer: {
    requestId,
    questionTextById: { "Which color should I use?": "Which color should I use?" },
    answers: { "Which color should I use?": "Red" },
    attachmentsByQuestionId: {},
  },
};

describe("childQuestionAnswers", () => {
  it("reads each question and its answer off the child's answered question item", () => {
    expect(childQuestionAnswers([{ type: "assistant_message" }, answered], requestId)).toEqual([
      { question: "Which color should I use?", answer: "Red" },
    ]);
  });

  it("names a question by its item's text when the record has none, and joins picks", () => {
    const item = {
      ...answered,
      questions: [{ id: "q1", question: "Which colors?" }],
      questionAnswer: { answers: { q1: ["Red", "Blue"] } },
    };
    expect(childQuestionAnswers([item], requestId)).toEqual([
      { question: "Which colors?", answer: "Red, Blue" },
    ]);
  });

  it("finds nothing for another request, an unanswered one or an empty answer", () => {
    expect(childQuestionAnswers([answered], "runtime-request:other")).toBeNull();
    const { questionAnswer: _none, ...pending } = answered;
    expect(childQuestionAnswers([pending], requestId)).toBeNull();
    const blank = { ...answered, questionAnswer: { answers: { q: "" } } };
    expect(childQuestionAnswers([blank], requestId)).toBeNull();
  });
});
