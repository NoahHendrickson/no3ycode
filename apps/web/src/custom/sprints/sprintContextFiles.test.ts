import type { ServerProviderModel } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  bytesToBase64,
  contextFileName,
  decodeContextText,
  readContextFile,
} from "./sprintContextFiles";
import { withoutPromptInjectedLevels } from "./sprintModel";

describe("contextFileName", () => {
  it.each([
    ["spec.md", "spec.md"],
    ["../../CLAUDE.md", "CLAUDE.md"],
    ["C:\\notes\\brief.txt", "brief.txt"],
    [".claude", "claude"],
    ["a\u0000b\nc.md", "abc.md"],
    ["...", "file"],
    ["", "file"],
  ])("keeps %j as %j", (name, expected) => {
    expect(contextFileName(name)).toBe(expected);
  });
});

describe("decodeContextText", () => {
  const bytes = (...values: number[]) => new Uint8Array(values);
  it.each([
    ["UTF-8 text", new TextEncoder().encode("Flat Glass: spec ✓ é"), "Flat Glass: spec ✓ é"],
    ["an empty file", bytes(), ""],
    ["a PNG header", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00), null],
    ["invalid UTF-8", bytes(0x66, 0xff, 0x66), null],
  ])("reads %s", (_label, input, expected) => {
    expect(decodeContextText(input)).toBe(expected);
  });
});

describe("readContextFile", () => {
  it("sends text as UTF-8 and anything else as base64 of its bytes", async () => {
    expect(await readContextFile(new File(["# Spec ✓"], "spec.md"))).toEqual({
      kind: "file",
      name: "spec.md",
      contents: "# Spec ✓",
      encoding: "utf8",
    });
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
    const read = await readContextFile(new File([png], "shot.png"));
    expect(read.kind === "file" && read.encoding).toBe("base64");
    const decoded = read.kind === "file" ? atob(read.contents) : "";
    expect(Array.from(decoded, (char) => char.charCodeAt(0))).toEqual(Array.from(png));
  });

  it("encodes past one chunk", () => {
    const bytes = Uint8Array.from({ length: 0x8000 * 2 + 7 }, (_, index) => index % 256);
    const decoded = atob(bytesToBase64(bytes));
    expect(Array.from(decoded, (char) => char.charCodeAt(0))).toEqual(Array.from(bytes));
  });
});

describe("withoutPromptInjectedLevels", () => {
  it("drops the levels a prompt prefix turns on and keeps the rest", () => {
    const model = {
      slug: "claude-sonnet",
      name: "Sonnet",
      isCustom: false,
      capabilities: {
        optionDescriptors: [
          {
            id: "effort",
            label: "Effort",
            type: "select",
            options: [
              { id: "low", label: "Low" },
              { id: "high", label: "High" },
              { id: "ultrathink", label: "Ultrathink" },
            ],
            promptInjectedValues: ["ultrathink"],
          },
          { id: "fast", label: "Fast", type: "boolean" },
        ],
      },
    } as unknown as ServerProviderModel;
    const [filtered] = withoutPromptInjectedLevels([model]);
    expect(filtered?.capabilities?.optionDescriptors).toEqual([
      {
        id: "effort",
        label: "Effort",
        type: "select",
        options: [
          { id: "low", label: "Low" },
          { id: "high", label: "High" },
        ],
      },
      { id: "fast", label: "Fast", type: "boolean" },
    ]);
  });
});
