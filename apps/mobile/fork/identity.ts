/** Fork-owned — see `.fork/customizations.yaml#no3y-mobile-identity`. */
import type { ExpoConfig } from "expo/config";

import { NO3Y_APPLE_TEAM_ID, NO3Y_BUNDLE_IDENTIFIER } from "./no3yConstants.ts";

type AppVariant = "development" | "preview" | "production";

interface UpstreamVariant {
  readonly appName: string;
  readonly iosBundleIdentifier: string;
  readonly androidPackage: string;
  readonly assets: {
    readonly appIcon: string;
    readonly iosIcon: string;
    readonly splashIcon: string;
  };
}

type RepoEnv = Readonly<Record<string, string | undefined>>;

const fromRepoRoot = (relativePath: string) => `../../${relativePath}`;

const NO3Y_VARIANTS = {
  development: {
    appName: "no3y Code Dev",
    identifier: `${NO3Y_BUNDLE_IDENTIFIER}.dev`,
    iconProject: "assets/fork/dev-app-icon.icon",
    iconPng: "assets/fork/n3-dev-macos-1024.png",
  },
  preview: {
    appName: "no3y Code Preview",
    identifier: `${NO3Y_BUNDLE_IDENTIFIER}.preview`,
    iconProject: "assets/fork/dev-app-icon.icon",
    iconPng: "assets/fork/n3-dev-macos-1024.png",
  },
  production: {
    appName: "no3y Code",
    identifier: NO3Y_BUNDLE_IDENTIFIER,
    iconProject: "assets/fork/app-icon.icon",
    iconPng: "assets/fork/n3-universal-1024.png",
  },
} as const;

// On by default in the fork; NO3Y_MOBILE_IDENTITY=0 (e.g. in .env.local) builds upstream's identity.
export function isNo3yMobileIdentity(env: RepoEnv): boolean {
  return env.NO3Y_MOBILE_IDENTITY !== "0";
}

// Runs before upstream derives the widget, share-extension, app-group and keychain IDs from it.
export function no3yVariant<V extends UpstreamVariant>(
  appVariant: AppVariant,
  upstream: V,
  env: RepoEnv,
) {
  if (!isNo3yMobileIdentity(env)) return upstream;
  const no3y = NO3Y_VARIANTS[appVariant];
  return {
    ...upstream,
    appName: no3y.appName,
    iosBundleIdentifier: no3y.identifier,
    androidPackage: no3y.identifier,
    assets: {
      ...upstream.assets,
      appIcon: fromRepoRoot(no3y.iconPng),
      iosIcon: fromRepoRoot(no3y.iconProject),
      splashIcon: fromRepoRoot(no3y.iconPng),
    },
  };
}

/** The page colour the launch leaf animation (fork/No3yLaunchLeaf.tsx) starts on. */
export const NO3Y_SPLASH_BACKGROUND = "#191817";
/** Drawn at this width (7pt a leaf cell), centred, the frame the JS animation's first frame matches. */
export const NO3Y_SPLASH_IMAGE_WIDTH = 147;
const NO3Y_SPLASH_IMAGE = "./fork/assets/no3y-splash-leaf.png";

// The iOS launch screen shows the pixel leaf mark on the dark page; Android keeps upstream's.
function withNo3ySplash(plugins: ExpoConfig["plugins"]): ExpoConfig["plugins"] {
  return plugins?.map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== "expo-splash-screen") return plugin;
    const options = (plugin[1] ?? {}) as Record<string, unknown>;
    const ios = {
      image: NO3Y_SPLASH_IMAGE,
      imageWidth: NO3Y_SPLASH_IMAGE_WIDTH,
      backgroundColor: NO3Y_SPLASH_BACKGROUND,
    };
    return [
      plugin[0],
      {
        ...options,
        ...ios,
        dark: { image: ios.image, backgroundColor: ios.backgroundColor },
      },
    ];
  });
}

// Ping's Apple team, linked domains and Expo project cannot sign or serve a different bundle.
export function no3yNativeConfig(config: ExpoConfig, env: RepoEnv): ExpoConfig {
  if (!isNo3yMobileIdentity(env)) return config;
  const ios = { ...config.ios, appleTeamId: NO3Y_APPLE_TEAM_ID };
  delete ios.associatedDomains;
  const next: ExpoConfig = {
    ...config,
    ios,
    updates: { enabled: false },
    plugins: withNo3ySplash(config.plugins),
    extra: { ...config.extra, eas: { observe: config.extra?.eas?.observe } },
  };
  delete next.owner;
  return next;
}
