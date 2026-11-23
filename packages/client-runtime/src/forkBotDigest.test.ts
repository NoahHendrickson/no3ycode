import { MessageId, RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  answeredBotDigestAsks,
  type BotDigestRead,
  botDigestQuotes,
  botDigestRevision,
  nextBotDigestRead,
  parseBotDigest,
  parseBotDigestStatus,
  quoteBotDigestAsk,
  splitBotDigestAsk,
} from "./forkBotDigest.ts";

describe("parseBotDigest", () => {
  it("keeps the sections with something in them, as plain lines", () => {
    const sections = parseBotDigest(`# Digest

Some preamble the bot wrote.

## Needs you

- **Approve** the migration in [Fix billing](t3://thread/abc)
1. Pick a release day
#412 waiting on your review

## New

Nothing.

### In progress ##

* [ ] Flaky test fix: running the suite
- Flaky test fix: running the suite
`);
    expect(
      sections.map((section) => ({ ...section, items: section.items.map((i) => i.text) })),
    ).toEqual([
      {
        title: "Needs you",
        kind: "needs-you",
        items: [
          "Approve the migration in Fix billing",
          "Pick a release day",
          "#412 waiting on your review",
        ],
      },
      { title: "In progress", kind: "status", items: ["Flaky test fix: running the suite"] },
    ]);
  });

  it("keeps the threads and pull requests a line links, each once, leaving the ask as its words", () => {
    const [section] = parseBotDigest(`## Needs you

- Round split payments half-even or half-up? [Fix invoice rounding](t3-thread://v2/env-1/thread-1) ([#482](https://github.com/acme/app/pull/482)).
- [Fix billing](t3-thread://v2/env-1/thread-2) is ready; merge https://github.com/acme/app/pull/77 first? <t3-thread://v2/env-1/thread-2>
- See the review on https://github.com/acme/app/pull/12/files#r9.
`);
    expect(section?.items).toEqual([
      {
        text: "Round split payments half-even or half-up?",
        source:
          "Round split payments half-even or half-up? [Fix invoice rounding](t3-thread://v2/env-1/thread-1) ([#482](https://github.com/acme/app/pull/482)).",
        threads: [
          {
            link: { environmentId: "env-1", threadId: "thread-1" },
            label: "Fix invoice rounding",
          },
        ],
        pullRequests: [{ url: "https://github.com/acme/app/pull/482", number: 482 }],
        answers: [],
      },
      {
        text: "Fix billing is ready; merge #77 first?",
        source:
          "[Fix billing](t3-thread://v2/env-1/thread-2) is ready; merge https://github.com/acme/app/pull/77 first? <t3-thread://v2/env-1/thread-2>",
        threads: [{ link: { environmentId: "env-1", threadId: "thread-2" }, label: "Fix billing" }],
        pullRequests: [{ url: "https://github.com/acme/app/pull/77", number: 77 }],
        answers: [],
      },
      {
        text: "See the review on #12.",
        source: "See the review on https://github.com/acme/app/pull/12/files#r9.",
        threads: [],
        pullRequests: [{ url: "https://github.com/acme/app/pull/12/files#r9", number: 12 }],
        answers: [],
      },
    ]);
  });

  it("keeps an ask written inside its link, or running into it, as words", () => {
    const [section] = parseBotDigest(`## Needs you

- [Approve production deploy?](t3-thread://v2/env-1/thread-1)
- Please decide whether to merge [the billing PR](https://github.com/acme/app/pull/9)
- Review [the billing PR](https://github.com/acme/app/pull/9). [Fix billing](t3-thread://v2/env-1/thread-1) <https://github.com/acme/app/pull/9>
- [Approve production deploy?](t3-thread://v2/env-1/thread-1) https://github.com/acme/app/pull/9
- The export finished. ([Nightly export](t3-thread://v2/env-1/thread-2))
- Retry the import? [Retry import](<t3-thread://v2/env-1/work(2)>)
`);
    expect(section?.kind).toBe("needs-you");
    expect(section?.items.map((item) => item.text)).toEqual([
      "Approve production deploy?",
      "Please decide whether to merge the billing PR",
      "Review the billing PR.",
      "Approve production deploy?",
      "The export finished.",
      "Retry the import?",
    ]);
  });

  it("reads an ask's short answers after its arrow, and its status line apart from any section", () => {
    const digest = `# Digest

Status: Waiting on you · next scan Thu 8:00

## Needs you

- OK to push #21 and open a PR? [Fix search](t3-thread://v2/env-1/thread-1) → Push | Hold
- Remote only, or hybrid? →Remote|Hybrid|
- Merge it? https://github.com/acme/app/pull/23 → Merge | Hold
- Migrate A → B before the release?
- Migrate A → B now
- Which plan? → The one that keeps the old billing tables around for a quarter | New
- Migrate (staging) → prod

## In progress

- Deploy v2 (beta). → stable
Status: CI red on #9
`;
    const [needsYou] = parseBotDigest(digest);
    expect(needsYou?.items.map(({ text, source, answers }) => ({ text, source, answers }))).toEqual(
      [
        {
          text: "OK to push #21 and open a PR?",
          source: "OK to push #21 and open a PR? [Fix search](t3-thread://v2/env-1/thread-1)",
          answers: ["Push", "Hold"],
        },
        {
          text: "Remote only, or hybrid?",
          source: "Remote only, or hybrid?",
          answers: ["Remote", "Hybrid"],
        },
        {
          text: "Merge it?",
          source: "Merge it? https://github.com/acme/app/pull/23",
          answers: ["Merge", "Hold"],
        },
        // Prose with an arrow in it, or answers too long to be buttons, stay the line's words.
        {
          text: "Migrate A → B before the release?",
          source: "Migrate A → B before the release?",
          answers: [],
        },
        { text: "Migrate A → B now", source: "Migrate A → B now", answers: [] },
        {
          text: "Which plan? → The one that keeps the old billing tables around for a quarter | New",
          source:
            "Which plan? → The one that keeps the old billing tables around for a quarter | New",
          answers: [],
        },
        // A closing parenthesis is not a link, so "prod" stays the line's.
        { text: "Migrate (staging) → prod", source: "Migrate (staging) → prod", answers: [] },
      ],
    );
    // Only an ask reads answers, and a status line inside a section is that section's item.
    expect(
      parseBotDigest(digest)[1]?.items.map(({ text, answers }) => ({ text, answers })),
    ).toEqual([
      { text: "Deploy v2 (beta). → stable", answers: [] },
      { text: "Status: CI red on #9", answers: [] },
    ]);
    expect(parseBotDigestStatus(digest)).toBe("Waiting on you · next scan Thu 8:00");
    expect(parseBotDigestStatus("# Digest\n\n## New\n\nStatus: CI red\n")).toBeNull();
    expect(parseBotDigestStatus("# Digest\n\nStatus: Nothing yet.\n")).toBeNull();
    expect(parseBotDigestStatus("## Needs you\n\n- Pick a day\n")).toBeNull();
  });

  it("reads an untouched or headingless digest as empty", () => {
    expect(
      parseBotDigest(
        "# Digest\r\n\r\n## Needs you\r\n\r\nNothing yet.\r\n\r\n## New\r\n\r\nNone\r\n",
      ),
    ).toEqual([]);
    expect(parseBotDigest("Just a note with no sections.")).toEqual([]);
  });
});

describe("splitBotDigestAsk", () => {
  it("leads with the line's question and keeps the rest as detail", () => {
    expect(
      splitBotDigestAsk(
        '#21: built on branch fix/21-perkcombo-search (9fdd30ae), sol approved, 1677 tests pass. OK to push and open a PR? (thread "#21 fix: perkcombo:A+B in Items search")',
      ),
    ).toEqual({
      question: "OK to push and open a PR?",
      detail:
        '#21: built on branch fix/21-perkcombo-search (9fdd30ae), sol approved, 1677 tests pass. (thread "#21 fix: perkcombo:A+B in Items search")',
    });
    expect(splitBotDigestAsk("Round half-even or half-up? It changes 3 invoices.")).toEqual({
      question: "Round half-even or half-up?",
      detail: "It changes 3 invoices.",
    });
    // A line that asks nothing leads with its first sentence.
    expect(splitBotDigestAsk("Confirm push-ups (500) are per week.")).toEqual({
      question: "Confirm push-ups (500) are per week.",
      detail: null,
    });
    expect(
      splitBotDigestAsk("#22: ask the player where it sits. Or have me start a read-only thread."),
    ).toEqual({
      question: "#22: ask the player where it sits.",
      detail: "Or have me start a read-only thread.",
    });
  });
});

type RunStatus = "completed" | "running" | "queued" | "cancelled";
const run = (id: string, status: RunStatus) => ({ id: RunId.make(id), status });
const user = (id: string, runId: string | null, text: string) => ({
  id: MessageId.make(id),
  role: "user" as const,
  runId: runId === null ? null : RunId.make(runId),
  text,
});

describe("botDigestQuotes", () => {
  it("reads the asks each owner message quotes, and whether its run has settled", () => {
    expect(
      botDigestQuotes({
        runs: [run("r1", "completed"), run("r2", "running"), run("r3", "cancelled")],
        messages: [
          user("m1", "r1", `${quoteBotDigestAsk("Ship it?")}yes`),
          { ...user("m2", "r2", "> Not an answer?"), role: "assistant" as const },
          user("m3", "r2", `Earlier draft\n\n${quoteBotDigestAsk("Merge #412?")}hold off`),
          user("m4", "r3", `${quoteBotDigestAsk("Cancelled before it ran?")}never mind`),
          // An imported message has no run, so it can never hide an ask for good.
          user("m5", null, `${quoteBotDigestAsk("Pick a day?")}Thursday`),
          user("m6", "r2", "no quote here"),
        ],
      }),
    ).toEqual([
      { messageId: "m1", asks: ["Ship it?"], settled: true },
      { messageId: "m3", asks: ["Merge #412?"], settled: false },
      { messageId: "m4", asks: ["Cancelled before it ran?"], settled: true },
    ]);
  });

  it("moves the revision when any run starts or settles, behind a queued one too", () => {
    const revisions = [
      botDigestRevision([run("r1", "queued"), run("r2", "queued")]),
      botDigestRevision([run("r1", "running"), run("r2", "queued")]),
      botDigestRevision([run("r1", "completed"), run("r2", "queued")]),
    ];
    expect(new Set(revisions).size).toBe(3);
  });
});

describe("nextBotDigestRead", () => {
  const quote = (messageId: string, settled: boolean) => ({
    messageId: MessageId.make(messageId),
    asks: [`Ask ${messageId}?`],
    settled,
  });
  const read = (revision: string, readAt: number | null, settled: string[]): BotDigestRead => ({
    revision,
    readAt,
    settled: new Set(settled.map((id) => MessageId.make(id))),
  });

  it("hides an answer until a read lands under the revision that settled it", () => {
    const pending = read("a", 1, []);
    const answeredAsk = (state: BotDigestRead) =>
      answeredBotDigestAsks([quote("m1", true)], state, new Map());
    // The run settles: the revision moves, and the read in hand, even one landing now, predates it.
    const moved = nextBotDigestRead(pending, {
      revision: "b",
      readAt: 2,
      waiting: false,
      quotes: [quote("m1", true)],
    });
    expect(moved).toEqual(read("b", 2, []));
    expect(answeredAsk(moved)).toEqual(new Set(["Ask m1?"]));
    // A refresh in flight, or a failed one, keeps it hidden.
    for (const next of [
      { readAt: 3, waiting: true },
      { readAt: null, waiting: false },
    ]) {
      expect(
        nextBotDigestRead(moved, { revision: "b", quotes: [quote("m1", true)], ...next }),
      ).toBe(moved);
    }
    // The read under the new revision is the bot's word on it.
    const fresh = nextBotDigestRead(moved, {
      revision: "b",
      readAt: 3,
      waiting: false,
      quotes: [quote("m1", true)],
    });
    expect(fresh).toEqual(read("b", 3, ["m1"]));
    expect(answeredAsk(fresh)).toEqual(new Set());
  });

  it("hides an answer sent from here until the conversation holds it", () => {
    const pending = new Map([[MessageId.make("m2"), "Ask m2?"]]);
    const state = read("a", 1, []);
    expect(answeredBotDigestAsks([], state, pending)).toEqual(new Set(["Ask m2?"]));
    // Once held, the message's run decides, so a settled read brings the ask back.
    expect(answeredBotDigestAsks([quote("m2", true)], read("a", 2, ["m2"]), pending)).toEqual(
      new Set(),
    );
  });
});
