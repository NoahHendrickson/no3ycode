/**
 * Claude's models in family order — see `.fork/customizations.yaml#fork-model-picker`.
 *
 * The model manifest lists Claude by release (Opus 5.5, Sonnet 5.5, Fable 5.2, Haiku); the picker
 * reads Fable, Opus, Sonnet, Haiku, keeping the manifest's order within a family.
 */
import type { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";

const CLAUDE_FAMILY_RANK: Readonly<Record<string, number>> = {
  fable: 0,
  opus: 1,
  sonnet: 2,
  haiku: 3,
};

function claudeFamilyRank(slug: string): number | undefined {
  const family = /(?:^|-)(fable|opus|sonnet|haiku)(?:-|$)/u.exec(slug)?.[1];
  return family === undefined ? undefined : CLAUDE_FAMILY_RANK[family];
}

/**
 * Reorders each Claude instance's family models among the slots they already hold, so every other
 * row (other providers, a custom model) keeps its place.
 */
export function orderClaudeFamilies<
  T extends { slug: string; driverKind: ProviderDriverKind; instanceId: ProviderInstanceId },
>(items: ReadonlyArray<T>): T[] {
  const result = [...items];
  const slotsByInstance = new Map<ProviderInstanceId, number[]>();
  items.forEach((item, index) => {
    if (item.driverKind !== "claudeAgent" || claudeFamilyRank(item.slug) === undefined) return;
    const slots = slotsByInstance.get(item.instanceId) ?? [];
    slots.push(index);
    slotsByInstance.set(item.instanceId, slots);
  });
  for (const slots of slotsByInstance.values()) {
    const ordered = slots
      .map((slot) => items[slot]!)
      .toSorted((a, b) => claudeFamilyRank(a.slug)! - claudeFamilyRank(b.slug)!);
    slots.forEach((slot, index) => {
      result[slot] = ordered[index]!;
    });
  }
  return result;
}
