import { afterEach, expect, it, vi } from "vite-plus/test";

vi.mock("../../../scripts/lib/public-config.ts", () => ({
  loadRepoEnv: () => ({
    APP_VARIANT: process.env.APP_VARIANT,
    NO3Y_MOBILE_IDENTITY: process.env.NO3Y_MOBILE_IDENTITY,
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

async function loadConfig(variant: string, identity: string | undefined) {
  vi.resetModules();
  vi.stubEnv("APP_VARIANT", variant);
  vi.stubEnv("NO3Y_MOBILE_IDENTITY", identity);
  return (await import("../app.config.ts")).default;
}

function pluginOptions(config: Awaited<ReturnType<typeof loadConfig>>, name: string) {
  const plugin = config.plugins?.find((entry) => Array.isArray(entry) && entry[0] === name);
  return Array.isArray(plugin) ? plugin[1] : undefined;
}

it.each([
  ["development", "com.noahhendrickson.no3ycode.dev"],
  ["preview", "com.noahhendrickson.no3ycode.preview"],
  ["production", "com.noahhendrickson.no3ycode"],
])("signs APP_VARIANT=%s as the no3y app on the fork's own team", async (variant, identifier) => {
  const config = await loadConfig(variant, undefined);
  expect(config.ios?.bundleIdentifier).toBe(identifier);
  expect(config.ios?.appleTeamId).toBe("4WDT6B6JDX");
  expect(config.ios?.associatedDomains).toBeUndefined();
  expect(config.ios?.entitlements?.["keychain-access-groups"]).toEqual([
    `$(AppIdentifierPrefix)${identifier}`,
  ]);
  expect(pluginOptions(config, "expo-widgets")).toMatchObject({
    bundleIdentifier: `${identifier}.widgets`,
    groupIdentifier: `group.${identifier}`,
  });
  expect(pluginOptions(config, "expo-sharing")?.ios).toMatchObject({
    extensionBundleIdentifier: `${identifier}.sharing`,
    appGroupId: `group.${identifier}`,
  });
  expect(config.owner).toBeUndefined();
  expect(config.updates).toEqual({ enabled: false });
  expect(config.extra?.eas?.projectId).toBeUndefined();
});

it("builds upstream's identity with NO3Y_MOBILE_IDENTITY=0", async () => {
  const config = await loadConfig("production", "0");
  expect(config.name).toBe("T3 Code");
  expect(config.ios?.bundleIdentifier).toBe("com.t3tools.t3code");
  expect(config.ios?.appleTeamId).toBe("ARK85ZXQ4Z");
  expect(config.owner).toBe("pingdotgg");
});
