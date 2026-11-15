import { describe, expect, it } from "vite-plus/test";

import { parseBotDigest } from "./botDigestSections";

describe("parseBotDigest", () => {
  it("keeps the sections with something in them, as plain lines", () => {
    expect(
      parseBotDigest(`# Digest

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
`),
    ).toEqual([
      {
        title: "Needs you",
        items: [
          "Approve the migration in Fix billing",
          "Pick a release day",
          "#412 waiting on your review",
        ],
        needsYou: true,
      },
      { title: "In progress", items: ["Flaky test fix: running the suite"], needsYou: false },
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
