import { afterEach, expect, it, vi } from "vite-plus/test";

vi.mock("../../../scripts/lib/public-config.ts", () => ({
  loadRepoEnv: () => ({
    APP_VARIANT: process.env.APP_VARIANT,
    NO3Y_MOBILE_IDENTITY: process.env.NO3Y_MOBILE_IDENTITY,
    T3CODE_ANDROID_GOOGLE_SERVICES_FILE: process.env.T3CODE_ANDROID_GOOGLE_SERVICES_FILE,
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
  // The launch screen is the pixel leaf mark on the dark page the launch animation starts from.
  expect(pluginOptions(config, "expo-splash-screen")).toMatchObject({
    image: "./fork/assets/no3y-splash-leaf.png",
    imageWidth: 147,
    backgroundColor: "#191817",
    dark: { image: "./fork/assets/no3y-splash-leaf.png", backgroundColor: "#191817" },
  });
  expect(config.extra?.eas?.projectId).toBeUndefined();
  // Native permission copy is read before Metro's rename runs.
  expect(config.ios?.infoPlist?.NSLocalNetworkUsageDescription).toBe(
    "Allow no3y Code to connect to no3y Code servers on your local network or tailnet.",
  );
  expect(pluginOptions(config, "expo-camera")?.cameraPermission).toMatch(/^Allow no3y Code /u);
  expect(JSON.stringify(config)).not.toMatch(/\bT3 Code\b/u);
});

it("renames only display copy, never build inputs such as file paths", async () => {
  vi.stubEnv("T3CODE_ANDROID_GOOGLE_SERVICES_FILE", "/tmp/T3 Code/google-services.json");
  const config = await loadConfig("production", undefined);
  expect(config.android?.googleServicesFile).toBe("/tmp/T3 Code/google-services.json");
});

it("builds upstream's identity with NO3Y_MOBILE_IDENTITY=0", async () => {
  const config = await loadConfig("production", "0");
  expect(config.name).toBe("T3 Code");
  expect(config.ios?.bundleIdentifier).toBe("com.t3tools.t3code");
  expect(config.ios?.appleTeamId).toBe("ARK85ZXQ4Z");
  expect(config.owner).toBe("pingdotgg");
});
