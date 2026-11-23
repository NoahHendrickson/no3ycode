/** Fork-owned — see `.fork/customizations.yaml#no3y-mobile-identity` and `#no3y-push`. */
export const NO3Y_APPLE_TEAM_ID = "4WDT6B6JDX";

/** Production's bundle ID; dev and preview append `.dev` and `.preview`. */
export const NO3Y_BUNDLE_IDENTIFIER = "com.noahhendrickson.no3ycode";

/** Where Tailscale Serve mounts the Mac push service, next to the T3 server. */
export const NO3Y_PUSH_MOUNT_PATH = "/no3y-push";

export function isNo3yBundleIdentifier(bundleId: string | null | undefined): bundleId is string {
  return (
    bundleId === NO3Y_BUNDLE_IDENTIFIER ||
    (bundleId?.startsWith(`${NO3Y_BUNDLE_IDENTIFIER}.`) === true &&
      /^[A-Za-z0-9.-]+$/u.test(bundleId))
  );
}
