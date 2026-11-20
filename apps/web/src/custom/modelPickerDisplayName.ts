import { PROVIDER_DISPLAY_NAMES, ProviderDriverKind } from "@t3tools/contracts";
import {
  getDisplayModelName,
  getTriggerDisplayModelName,
  type ModelEsque,
} from "~/components/chat/providerIconUtils";

/** Families whose maker is already shown beside the row; kept families carry the model's identity. */
const SHOWN_FAMILY_NAMES: Partial<Record<ProviderDriverKind, ReadonlyArray<string>>> = {
  [ProviderDriverKind.make("claudeAgent")]: ["Claude"],
  [ProviderDriverKind.make("cursor")]: ["Claude"],
};

/** Family words that are the model's name, never stripped as an instance name. */
const KEPT_FAMILY_NAMES: Partial<Record<ProviderDriverKind, ReadonlyArray<string>>> = {
  [ProviderDriverKind.make("antigravity")]: ["Gemini"],
  [ProviderDriverKind.make("codex")]: ["GPT"],
  [ProviderDriverKind.make("grok")]: ["Grok"],
};

/** Leading family prefixes the web model picker keeps instead of shortening via `modelShortName`. */
const KEPT_TRIGGER_FAMILY_PREFIXES = ["Gemini ", "GPT-", "GPT "] as const;

/** Providers that resell another maker's models; named wherever their icon isn't shown. */
const RESELLERS: ReadonlySet<ProviderDriverKind> = new Set([ProviderDriverKind.make("cursor")]);

/** Drops a leading provider or custom account name wherever the provider icon is shown beside it. */
export function stripProviderName(
  name: string,
  provider: { driverKind: ProviderDriverKind; displayName?: string | undefined },
): string {
  for (const providerName of [
    ...(SHOWN_FAMILY_NAMES[provider.driverKind] ?? []),
    provider.displayName,
  ]) {
    const prefix = providerName?.trim().toLowerCase();
    if (KEPT_FAMILY_NAMES[provider.driverKind]?.some((kept) => kept.toLowerCase() === prefix)) {
      continue;
    }
    if (prefix && name.toLowerCase().startsWith(`${prefix} `)) {
      return name.slice(prefix.length).trim() || name;
    }
  }
  return name;
}

/** Trigger label for the web model picker (which always shows the provider icon). */
export function pickerTriggerModelName(
  model: ModelEsque,
  provider: { driverKind: ProviderDriverKind; displayName?: string | undefined } | null | undefined,
): string {
  const full = getDisplayModelName(model);
  const base = KEPT_TRIGGER_FAMILY_PREFIXES.some((prefix) => full.startsWith(prefix))
    ? full
    : getTriggerDisplayModelName(model, provider?.driverKind);
  return provider ? stripProviderName(base, provider) : base;
}

/** Trigger/row model name when a reseller may need to prefix itself if its icon is hidden. */
export function triggerModelName(
  name: string,
  provider: { driverKind: ProviderDriverKind; displayName?: string | undefined } | null | undefined,
  { iconShown }: { iconShown: boolean },
): string {
  if (!provider) return name;
  const stripped = stripProviderName(name, provider);
  return !iconShown && RESELLERS.has(provider.driverKind)
    ? `${PROVIDER_DISPLAY_NAMES[provider.driverKind] ?? provider.driverKind} ${stripped}`
    : stripped;
}
