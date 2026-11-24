// Fork display-name rewrite for Metro — see .fork/customizations.yaml#fork-brand-name.
// The same rewrite the web and desktop builds run (scripts/lib/fork-brand-name-core.ts),
// applied to each app module's source before the Babel transformer it wraps sees it.
const NodeCrypto = require("node:crypto");
const NodeFS = require("node:fs");
const NodePath = require("node:path");

const brandNameSource = NodePath.resolve(__dirname, "../../../scripts/lib/fork-brand-name-core.ts");
const { isRebrandedModule, rewriteUpstreamDisplayName } = require(brandNameSource);
// metro.config.js sets this: workers receive only this file's path, never a closure, so the
// transformer it wraps (Expo's, plus whatever Uniwind layers on) can only arrive this way.
const upstreamPath = process.env.NO3Y_UPSTREAM_BABEL_TRANSFORMER;
if (!upstreamPath) {
  throw new Error("NO3Y_UPSTREAM_BABEL_TRANSFORMER is unset; load this through metro.config.js.");
}
const upstream = require(upstreamPath);

module.exports = {
  ...upstream,
  transform(props) {
    const src = isRebrandedModule(props.filename)
      ? (rewriteUpstreamDisplayName(props.src) ?? props.src)
      : props.src;
    return upstream.transform(src === props.src ? props : { ...props, src });
  },
  // Metro hashes this file in place of the transformer it wraps, and neither one's imports.
  getCacheKey(options) {
    const sources = NodeCrypto.createHash("sha1")
      .update(NodeFS.readFileSync(brandNameSource))
      .update(NodeFS.readFileSync(require.resolve(upstreamPath)))
      .digest("hex");
    return `${upstream.getCacheKey?.(options) ?? ""}:${sources}`;
  },
};
