import { ProviderDriverKind } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  pickerTriggerModelName,
  stripProviderName,
  triggerModelName,
} from "./modelPickerDisplayName";

const antigravity = ProviderDriverKind.make("antigravity");
const claude = ProviderDriverKind.make("claudeAgent");
const codex = ProviderDriverKind.make("codex");
const cursor = ProviderDriverKind.make("cursor");
const grok = ProviderDriverKind.make("grok");

describe("stripProviderName", () => {
  it("drops the standard provider name", () => {
    expect(stripProviderName("Claude Opus 5.5", { driverKind: claude })).toBe("Opus 5.5");
  });

  it("drops a custom account name", () => {
    expect(stripProviderName("Work Opus 5.5", { driverKind: claude, displayName: "Work" })).toBe(
      "Opus 5.5",
    );
  });

  it("drops Claude from Cursor's resold models only", () => {
    expect(stripProviderName("Claude Opus 5.5", { driverKind: cursor })).toBe("Opus 5.5");
    expect(stripProviderName("Composer 2", { driverKind: cursor })).toBe("Composer 2");
    expect(stripProviderName("Claude Opus 5.5", { driverKind: codex })).toBe("Claude Opus 5.5");
  });

  it("keeps a family word that carries the model's identity", () => {
    expect(stripProviderName("Gemini 4 Neon", { driverKind: antigravity })).toBe("Gemini 4 Neon");
    expect(
      stripProviderName("Gemini 4 Neon", { driverKind: antigravity, displayName: "Gemini" }),
    ).toBe("Gemini 4 Neon");
    expect(stripProviderName("Grok Build", { driverKind: grok })).toBe("Grok Build");
    expect(stripProviderName("Grok 4.6", { driverKind: grok })).toBe("Grok 4.6");
    // The default Grok instance is named "Grok"; that is not a custom account name.
    expect(stripProviderName("Grok 4.6", { driverKind: grok, displayName: "Grok" })).toBe(
      "Grok 4.6",
    );
    expect(
      triggerModelName(
        "Grok Build",
        { driverKind: grok, displayName: "Grok" },
        {
          iconShown: false,
        },
      ),
    ).toBe("Grok Build");
  });

  it("leaves names that don't lead with the provider", () => {
    expect(stripProviderName("GPT-5.5", { driverKind: codex })).toBe("GPT-5.5");
    expect(stripProviderName("Claudette 2", { driverKind: claude })).toBe("Claudette 2");
    expect(stripProviderName("Claude", { driverKind: claude })).toBe("Claude");
  });
});

describe("triggerModelName", () => {
  const hidden = { iconShown: false };
  const shown = { iconShown: true };

  it("names a reseller when its icon is hidden", () => {
    expect(triggerModelName("Claude Opus 5.5", { driverKind: cursor }, hidden)).toBe(
      "Cursor Opus 5.5",
    );
    expect(triggerModelName("Composer 2", { driverKind: cursor }, hidden)).toBe(
      "Cursor Composer 2",
    );
  });

  it("never doubles a reseller name the catalogue already carries", () => {
    expect(
      triggerModelName("Cursor Auto", { driverKind: cursor, displayName: "Cursor" }, hidden),
    ).toBe("Cursor Auto");
  });

  it("only strips beside the icon or for non-resellers", () => {
    expect(triggerModelName("Claude Opus 5.5", { driverKind: cursor }, shown)).toBe("Opus 5.5");
    expect(triggerModelName("Claude Opus 5.5", { driverKind: claude }, hidden)).toBe("Opus 5.5");
    expect(triggerModelName("GPT-5.5", { driverKind: codex }, hidden)).toBe("GPT-5.5");
  });

  it("keeps the name whole without a provider", () => {
    expect(triggerModelName("Claude Opus 5.5", null, hidden)).toBe("Claude Opus 5.5");
  });
});

describe("pickerTriggerModelName", () => {
  it("keeps Gemini and GPT prefixes in the web model picker trigger", () => {
    expect(
      pickerTriggerModelName(
        { slug: "gemini-4-neon", name: "Gemini 4 Neon" },
        { driverKind: antigravity },
      ),
    ).toBe("Gemini 4 Neon");
    expect(
      pickerTriggerModelName({ slug: "gpt-6.2-sol", name: "GPT-6.2-Sol" }, { driverKind: codex }),
    ).toBe("GPT-6.2-Sol");
    expect(
      pickerTriggerModelName(
        { slug: "gpt-6.1-terra", name: "GPT 6.1 Terra" },
        { driverKind: codex },
      ),
    ).toBe("GPT 6.1 Terra");
  });

  it("still shortens Claude and vendor-prefixed models", () => {
    expect(
      pickerTriggerModelName(
        { slug: "claude-opus-5-5", name: "Claude Opus 5.5" },
        { driverKind: claude },
      ),
    ).toBe("Opus 5.5");
    expect(
      pickerTriggerModelName(
        { slug: "claude-opus-5-5", name: "Claude Opus 5.5" },
        { driverKind: cursor },
      ),
    ).toBe("Opus 5.5");
    expect(
      pickerTriggerModelName(
        { slug: "nemotron-3-super", name: "NVIDIA: Nemotron 3 Super" },
        { driverKind: cursor },
      ),
    ).toBe("Nemotron 3 Super");
  });
});
