// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-desktop-release`.
 *
 * The fork's own release path. The build being correct is CI's job; what this
 * guards is the three properties that are dangerous to lose quietly:
 *
 *   1. It fires on `workflow_dispatch` and nothing else. A `schedule:` or
 *      `push:` trigger added here would publish releases from the fork
 *      unattended — the exact failure `release-upstream-only` exists to stop,
 *      reintroduced through the fork's own door.
 *   2. It never publishes to a package registry. Fork builds carry upstream's
 *      package names, so an `npm publish` here would push fork artifacts to
 *      upstream's namespace.
 *   3. Every macOS build is signed and notarized, so installs can update in place.
 *   4. Windows publishes into the same release, behind its own isolation gate.
 */

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const repoRoot = NodePath.resolve(
  NodeURL.fileURLToPath(new URL(".", import.meta.url)),
  "../../../..",
);

const readForkRelease = (): string =>
  NodeFS.readFileSync(NodePath.join(repoRoot, ".github/workflows/fork-release.yml"), "utf8");

const readIsolationScript = (): string =>
  NodeFS.readFileSync(NodePath.join(repoRoot, ".github/scripts/launch-isolation-check.sh"), "utf8");

/** One step's YAML block: from its `- name:` line to the next `- name:`. */
const readStepBlock = (workflow: string, stepName: string): string => {
  const start = workflow.indexOf(`- name: ${stepName}`);
  if (start === -1) {
    throw new Error(`Step not found in fork-release.yml: ${stepName}`);
  }
  const rest = workflow.slice(start + 1);
  const end = rest.search(/^ {6}- name: /mu);
  return workflow.slice(start, end === -1 ? undefined : start + 1 + end);
};

/** One job's YAML block: from its `  <id>:` line to the next job or top-level key. */
const readJobBlock = (workflow: string, jobId: string): string => {
  const start = workflow.search(new RegExp(`^ {2}${jobId}:$`, "mu"));
  if (start === -1) {
    throw new Error(`Job not found in fork-release.yml: ${jobId}`);
  }
  const bodyStart = workflow.indexOf("\n", start) + 1;
  const end = workflow.slice(bodyStart).search(/^ {0,2}\S/mu);
  return workflow.slice(start, end === -1 ? undefined : bodyStart + end);
};

/** The `on:` block, up to the next top-level key. */
const readTriggerBlock = (workflow: string): string => {
  const start = workflow.search(/^on:$/mu);
  const rest = workflow.slice(start + "on:\n".length);
  const end = rest.search(/^[A-Za-z]/mu);
  return end === -1 ? rest : rest.slice(0, end);
};

describe("fork guard: fork-desktop-release", () => {
  it("runs only when a human dispatches it", () => {
    const triggers = readTriggerBlock(readForkRelease())
      .split("\n")
      .filter((line) => /^ {2}\S/u.test(line))
      .map((line) => line.trim().replace(/:.*$/u, ""));
    expect(triggers).toEqual(["workflow_dispatch"]);
  });

  it("stays gated to the fork repository", () => {
    expect(readForkRelease()).toContain("github.repository_owner == 'NoahHendrickson'");
  });

  it("never publishes to a package registry", () => {
    const workflow = readForkRelease();
    // `npm publish`, `pnpm publish`, `vp publish`, and the token that would
    // authenticate any of them.
    expect(workflow).not.toMatch(/\b(?:npm|pnpm|yarn|vp)\s+publish\b/u);
    expect(workflow).not.toContain("NODE_AUTH_TOKEN");
    expect(workflow).not.toContain("NPM_TOKEN");
  });

  it("builds the artifact the release advertises", () => {
    // The release body promises a macOS arm64 build; if the build step is
    // retargeted without updating that text, users download the wrong thing.
    // `--target dmg` is additionally load-bearing for the launch isolation
    // gate: the build script expands dmg into [dmg, zip], and the gate
    // launches the DMG's bundle and compares the zip's executable against
    // it. Retargeting silently breaks artifact discovery — the failure mode
    // that cost the first v0.1.2 release run.
    const workflow = readForkRelease();
    expect(workflow).toContain("--platform mac");
    expect(workflow).toContain("--arch arm64");
    expect(workflow).toContain("--target dmg");
  });

  it("signs and notarizes every macOS build", () => {
    // Installs update in place through Squirrel.Mac, which rejects an update
    // whose signature does not match the running app's. One unsigned release
    // published as latest would strand every signed install on an update it
    // can download but never apply.
    const mac = readJobBlock(readForkRelease(), "mac");
    const build = readStepBlock(mac, "Build desktop artifact");
    expect(build).toContain("--signed");
    expect(build).not.toMatch(/^\s+if:/mu);
    const verify = readStepBlock(mac, "Verify signature and notarization");
    expect(verify).toContain('grep -qx "TeamIdentifier=$EXPECTED_TEAM_ID"');
    expect(verify).toContain('grep -q "source=Notarized Developer ID"');
    expect(verify).toContain("xcrun stapler validate");
    expect(verify).not.toMatch(/^\s+if:/mu);
    // Upstream's build script throws for a signed mac build without a
    // provisioning profile. If a sync drops the fork's opt-in gate, every
    // release fails halfway through a full build instead of at PR time.
    const buildScript = NodeFS.readFileSync(
      NodePath.join(repoRoot, "scripts/build-desktop-artifact.ts"),
      "utf8",
    );
    const fence = buildScript.slice(
      buildScript.indexOf("/* fork:begin fork-desktop-release"),
      buildScript.indexOf("/* fork:end fork-desktop-release */"),
    );
    expect(fence).toContain("T3CODE_MACOS_PROVISIONING_PROFILE?.trim()");
  });

  it("publishes only after both platforms pass their gates", () => {
    // The gates are the only executable proof of the fork's data isolation —
    // v0.1.1 passed every static check while its server child opened the
    // real ~/.t3/userdata database. A failed step fails its job, so what
    // protects publishing is: each gate runs unconditionally (no `if:` — a
    // dry run exists to exercise them) in a build job that publish needs.
    // Each platform's updater reads only the latest release, so publish must
    // also wait on both builds or one platform's feed goes missing.
    const workflow = readForkRelease();
    const macGate = readStepBlock(readJobBlock(workflow, "mac"), "Launch isolation check");
    expect(macGate).toContain("bash .github/scripts/launch-isolation-check.sh release");
    expect(macGate).not.toMatch(/^\s+if:/mu);
    const windows = readJobBlock(workflow, "windows");
    expect(windows).toContain("--platform win");
    expect(windows).toContain("--target nsis");
    const windowsGate = readStepBlock(windows, "Windows launch isolation check");
    expect(windowsGate).toContain(
      ".github/scripts/launch-isolation-check-windows.ps1 -ReleaseDir release",
    );
    expect(windowsGate).not.toMatch(/^\s+if:/mu);
    const publish = readJobBlock(workflow, "publish");
    expect(publish).toContain("needs: [preflight, mac, windows]");
    expect(publish).toMatch(/^ {4}if: \$\{\{ !inputs\.dry_run \}\}$/mu);
    expect(readStepBlock(publish, "Publish GitHub Release")).toContain("release-publish/*.exe");
    // The lint lives in CI (release_smoke), where a defect in a script costs a
    // PR check, not a release build. The first dry run burned a full build
    // discovering the gate step itself couldn't run.
    const ci = NodeFS.readFileSync(NodePath.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("shellcheck .github/scripts/launch-isolation-check.sh");
    expect(ci).toContain(".github/scripts/launch-isolation-check-windows.ps1");
  });

  it("keeps the isolation scripts' assertions intact", () => {
    // The scripts are code, not YAML prose — assert against their
    // load-bearing constructs. Comments can't satisfy these: each string pins
    // an executable line (teardown wiring, the realpath normalization that
    // keeps pkill able to see the server child, the fail-fast and positive
    // assertions, and the upstream-name sweep, which both scripts share).
    const script = readIsolationScript();
    expect(script).toContain("trap cleanup EXIT");
    expect(script).toContain("pwd -P");
    expect(script).toContain('hdiutil attach "$dmg" -nobrowse -readonly');
    expect(script).toContain('"$scratch/.t3-fork/userdata/statev2.sqlite"');
    expect(script).toContain('violated "the build created ~/.t3"');
    expect(script).toContain(
      '-name ".t3" -o -name "t3code" -o -name "t3code-v2" -o -name "com.t3tools.t3code"',
    );
    expect(script).toContain('"$support/t3code-fork-v2"');
    expect(script).toContain('pkill -TERM -f "$app/Contents"');
    expect(script).toContain('cmp -s "$app/Contents/Resources/app.asar"');

    const windows = NodeFS.readFileSync(
      NodePath.join(repoRoot, ".github/scripts/launch-isolation-check-windows.ps1"),
      "utf8",
    );
    expect(windows).toContain('"/D=$installDir"');
    expect(windows).toContain("$env:USERPROFILE = $scratch");
    expect(windows).toContain("$env:APPDATA = $roaming");
    expect(windows).toContain('Join-Path $scratch ".t3-fork\\userdata\\statev2.sqlite"');
    expect(windows).toContain('Fail-Isolation "the build created ~/.t3"');
    expect(windows).toContain(
      '$upstreamNames = @(".t3", "t3code", "t3code-v2", "com.t3tools.t3code")',
    );
    expect(windows).toContain('Join-Path $roaming "t3code-fork-v2"');
  });
});
