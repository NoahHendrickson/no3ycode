import { describe, expect, it } from "vite-plus/test";

import { parseBotDigest } from "./botDigestSections";

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
        threads: [{ environmentId: "env-1", threadId: "thread-1" }],
        pullRequests: [{ url: "https://github.com/acme/app/pull/482", number: 482 }],
      },
      {
        text: "Fix billing is ready; merge #77 first?",
        source:
          "[Fix billing](t3-thread://v2/env-1/thread-2) is ready; merge https://github.com/acme/app/pull/77 first? <t3-thread://v2/env-1/thread-2>",
        threads: [{ environmentId: "env-1", threadId: "thread-2" }],
        pullRequests: [{ url: "https://github.com/acme/app/pull/77", number: 77 }],
      },
      {
        text: "See the review on #12.",
        source: "See the review on https://github.com/acme/app/pull/12/files#r9.",
        threads: [],
        pullRequests: [{ url: "https://github.com/acme/app/pull/12/files#r9", number: 12 }],
      },
    ]);
  });

  it("keeps an ask written inside its link, or running into it, as words", () => {
    const [section] = parseBotDigest(`## Needs you

- [Approve production deploy?](t3-thread://v2/env-1/thread-1)
- Please decide whether to merge [the billing PR](https://github.com/acme/app/pull/9)
`);
    expect(section?.kind).toBe("needs-you");
    expect(section?.items.map((item) => item.text)).toEqual([
      "Approve production deploy?",
      "Please decide whether to merge the billing PR",
    ]);
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
