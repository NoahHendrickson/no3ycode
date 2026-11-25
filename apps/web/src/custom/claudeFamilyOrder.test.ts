import { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { orderClaudeFamilies } from "./claudeFamilyOrder";

const claude = ProviderInstanceId.make("claude");
const codex = ProviderInstanceId.make("codex");
const row = (instanceId: ProviderInstanceId, driver: string, slug: string) => ({
  instanceId,
  driverKind: ProviderDriverKind.make(driver),
  slug,
});

describe("orderClaudeFamilies", () => {
  it("lists Claude as Fable, Opus, Sonnet, Haiku, keeping release order within a family", () => {
    const manifest = [
      "claude-opus-5-5",
      "claude-sonnet-5-5",
      "claude-fable-5-2",
      "claude-fable-5-1",
      "claude-opus-5",
      "claude-haiku-5-5",
    ].map((slug) => row(claude, "claudeAgent", slug));
    expect(orderClaudeFamilies(manifest).map((item) => item.slug)).toEqual([
      "claude-fable-5-2",
      "claude-fable-5-1",
      "claude-opus-5-5",
      "claude-opus-5",
      "claude-sonnet-5-5",
      "claude-haiku-5-5",
    ]);
  });

  it("leaves other providers and unrecognized models in their places", () => {
    const items = [
      row(codex, "codex", "gpt-6-sol"),
      row(claude, "claudeAgent", "claude-opus-5-5"),
      row(claude, "claudeAgent", "my-custom-model"),
      row(claude, "claudeAgent", "claude-fable-5-2"),
      row(codex, "codex", "gpt-6-luna"),
    ];
    expect(orderClaudeFamilies(items).map((item) => item.slug)).toEqual([
      "gpt-6-sol",
      "claude-fable-5-2",
      "my-custom-model",
      "claude-opus-5-5",
      "gpt-6-luna",
    ]);
  });
});
