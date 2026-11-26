import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";

/** A ready, signed-in provider on its default instance; stories override only what they show. */
export function serverProvider(
  driver: string,
  displayName: string,
  overrides: Partial<ServerProvider> = {},
): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make(driver),
    driver: ProviderDriverKind.make(driver),
    displayName,
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-11-26T09:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
    ...overrides,
  };
}
