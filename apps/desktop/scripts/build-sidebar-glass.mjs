import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";

// oxlint-disable-next-line t3code/no-global-process-runtime -- The native compiler targets the actual host; this script has no Effect runtime.
const hostArch = process.arch;
// oxlint-disable-next-line t3code/no-global-process-runtime -- Native compilation only runs on the actual macOS host.
const hostPlatform = process.platform;

const { values } = NodeUtil.parseArgs({
  options: { output: { type: "string" }, arch: { type: "string", default: hostArch } },
});

function resolveNodeApiIncludeDir() {
  const candidates = [
    NodePath.resolve(NodePath.dirname(process.execPath), "..", "include", "node"),
    NodeURL.fileURLToPath(
      new URL(
        "../../../node_modules/.pnpm/koffi@3.3.6/node_modules/koffi/vendor/node-api-headers/include",
        import.meta.url,
      ),
    ),
  ];
  for (const dir of candidates) {
    if (NodeFS.existsSync(NodePath.join(dir, "node_api.h"))) {
      return dir;
    }
  }
  throw new Error("Could not locate node_api.h to compile native/sidebar-glass/sidebar_glass.m.");
}

if (hostPlatform === "darwin") {
  const clangArchFlags = {
    arm64: ["-arch", "arm64"],
    x64: ["-arch", "x86_64"],
    universal: ["-arch", "arm64", "-arch", "x86_64"],
  }[values.arch];
  if (clangArchFlags === undefined) {
    throw new Error(`Unsupported macOS architecture: ${values.arch}`);
  }

  const root = NodeURL.fileURLToPath(new URL("../../../native/sidebar-glass/", import.meta.url));
  const source = NodePath.resolve(root, "sidebar_glass.m");
  const output =
    values.output ?? NodePath.resolve(root, "build", values.arch, "sidebar_glass.node");
  const scriptPath = NodeURL.fileURLToPath(import.meta.url);

  let current = false;
  try {
    current =
      NodeFS.statSync(output).mtimeMs >=
      Math.max(NodeFS.statSync(source).mtimeMs, NodeFS.statSync(scriptPath).mtimeMs);
  } catch {}

  if (!current) {
    const includeDir = resolveNodeApiIncludeDir();
    NodeFS.mkdirSync(NodePath.dirname(output), { recursive: true });
    const temporary = `${output}.${process.pid}.tmp`;
    try {
      NodeChildProcess.execFileSync(
        "/usr/bin/clang",
        [
          "-ObjC",
          "-fobjc-arc",
          "-O2",
          "-Wall",
          "-Wextra",
          "-Werror",
          ...clangArchFlags,
          "-mmacosx-version-min=13.0",
          "-shared",
          "-undefined",
          "dynamic_lookup",
          `-I${includeDir}`,
          source,
          "-o",
          temporary,
          "-framework",
          "AppKit",
          "-framework",
          "QuartzCore",
        ],
        { stdio: "inherit" },
      );
      NodeFS.renameSync(temporary, output);
    } finally {
      NodeFS.rmSync(temporary, { force: true });
    }
  }
}
