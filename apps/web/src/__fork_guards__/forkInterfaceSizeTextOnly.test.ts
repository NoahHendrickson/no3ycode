// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and
 * `.fork/customizations.yaml#fork-interface-size-text-only`.
 *
 * Interface font size scales text only: rem stays 16px, and every rem text size multiplies
 * --fork-interface-text-scale. Text is the closed set, so the guard sweeps it: any rem font size
 * that does not multiply the scale would stop following the setting.
 */

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const SRC = NodeURL.fileURLToPath(new URL("..", import.meta.url));
const SCALE = "var(--fork-interface-text-scale, 1)";

function read(relativePath: string): string {
  return NodeFS.readFileSync(NodePath.join(SRC, relativePath), "utf8");
}

function sourceFiles(extensions: ReadonlyArray<string>): string[] {
  return NodeFS.readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter(
    (file) =>
      extensions.some((extension) => file.endsWith(extension)) &&
      !file.includes("__fork_guards__") &&
      !/\.(test|spec)\.tsx?$/u.test(file) &&
      !file.includes("/vendor/"),
  );
}

describe("fork guard: interface size scales text only", () => {
  it("writes a text scale instead of the root font size", () => {
    const fonts = read("appearanceFonts.ts");
    expect(fonts).not.toMatch(/root\.style\.fontSize\s*=/u);
    expect(fonts).toContain('"--fork-interface-text-scale"');
    expect(read("main.tsx")).toContain('import "./theme.custom.interface-size.css";');
  });

  it("scales Tailwind's text tokens, the body and the dense steps", () => {
    const sheet = read("theme.custom.interface-size.css");
    const tailwindRem = {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
      "6xl": "3.75rem",
      "7xl": "4.5rem",
      "8xl": "6rem",
      "9xl": "8rem",
    };
    for (const [step, rem] of Object.entries(tailwindRem)) {
      expect(sheet).toContain(`--text-${step}: calc(${rem} * ${SCALE});`);
    }
    expect(sheet).toMatch(
      / body \{\s*font-size: calc\(1rem \* var\(--fork-interface-text-scale, 1\)\);/u,
    );
    for (const [step, rem] of [
      ["2xs", "0.6875rem"],
      ["3xs", "0.625rem"],
      ["4xs", "0.5rem"],
      ["5xs", "0.4375rem"],
    ]) {
      expect(read("index.css")).toContain(`--text-${step}: ${rem};`);
      expect(sheet).toContain(`.text-${step} {\n  font-size: calc(${rem} * ${SCALE});`);
    }
  });

  it("leaves no rem font size in a stylesheet that skips the scale", () => {
    const unscaled = sourceFiles([".css"]).flatMap((file) =>
      read(file)
        .split("\n")
        .filter((line) => /font-size:[^;]*\d(\.\d+)?rem/u.test(line))
        .filter((line) => !line.includes(SCALE) && !/var\([^,]+,\s*[\d.]+rem\)/u.test(line))
        .map((line) => `${file}: ${line.trim()}`),
    );
    expect(unscaled).toEqual([]);
  });

  it("leaves no arbitrary rem text class that skips the scale", () => {
    const unscaled = sourceFiles([".tsx", ".ts"]).flatMap((file) =>
      [...read(file).matchAll(/text-\[(?:length:)?[^\]]*\d(?:\.\d+)?rem[^\]]*\]/gu)]
        .map(([match]) => match)
        .filter((match) => !match.includes("var(--fork-interface-text-scale,1)"))
        .map((match) => `${file}: ${match}`),
    );
    expect(unscaled).toEqual([]);
  });

  it("composes the Chat stream sizes with the interface scale", () => {
    const sheet = read("theme.custom.css");
    const chat = sheet.match(/var\(--fork-chat-text-scale, 1\)[^)]*\)/gu) ?? [];
    expect(chat.length).toBeGreaterThan(0);
    for (const use of chat) expect(use).toContain(SCALE);
  });
});
