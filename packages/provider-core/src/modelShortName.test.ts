import { describe, expect, it } from "vite-plus/test";

import { modelShortName } from "./modelShortName.ts";

describe("modelShortName", () => {
  it.each([
    ["Claude Opus 5.5", ["Claude "], "Opus 5.5"],
    ["Grok 4 Pro", [], undefined],
    ["Claude Opus 5.5", [], "Opus 5.5"],
    ["NVIDIA: Nemotron 3 Super", [], "Nemotron 3 Super"],
    ["GPT-5.5", ["GPT-"], undefined],
    /* fork:begin fork-model-picker — see .fork/customizations.yaml#fork-model-picker */
    ["GPT-6.1-Sol", ["GPT-"], undefined],
    ["GPT 6.0 Astra", ["GPT-", "GPT "], undefined],
    ["Gemini 3.1 Pro", ["Gemini "], undefined],
    ["Gemini 4 Neon", ["Gemini "], undefined],
    ["Gemini 4 Neon", [], undefined],
    /* fork:end fork-model-picker */
  ] as const)("gives %s on families %j the short name %s", (name, families, expected) => {
    expect(modelShortName(name, families)).toBe(expected);
  });
});
