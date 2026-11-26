/** Line suppressions (S1, S2) and the whole-selector or component allowlist. */

import { DESIGN_LINT_ALLOWLIST } from "../design-rules.mjs";
import { finding } from "./sources.mjs";

const DISABLE =
  /^\s*design-lint-disable-next-line\s+([A-Z]\d(?:\s*,\s*[A-Z]\d)*)\s*(?:--\s*(.*?))?\s*$/su;

export function applySuppressions(findings, sheets) {
  const directives = [];
  for (const sheet of sheets) {
    const lines = sheet.text.split("\n");
    for (const comment of sheet.comments) {
      const parsed = DISABLE.exec(comment.text);
      if (!parsed) continue;
      let target = comment.endLine + 1;
      while (target <= lines.length && /^\s*(?:\/\*.*\*\/)?\s*$/u.test(lines[target - 1] ?? ""))
        target++;
      directives.push({
        file: sheet.path,
        line: comment.line,
        target,
        rules: parsed[1].split(/\s*,\s*/u),
        reason: parsed[2]?.trim() ?? "",
        used: new Set(),
      });
    }
  }
  const kept = findings.filter((entry) => {
    const directive = directives.find(
      (candidate) =>
        candidate.file === entry.file &&
        candidate.rules.includes(entry.rule) &&
        (candidate.target === entry.line || candidate.target === entry.ruleLine),
    );
    if (!directive) return true;
    directive.used.add(entry.rule);
    return false;
  });
  for (const directive of directives) {
    if (!directive.reason)
      kept.push(finding("S1", directive.file, directive.line, "say why after `--`"));
    const unused = directive.rules.filter((rule) => !directive.used.has(rule));
    if (unused.length > 0)
      kept.push(
        finding(
          "S2",
          directive.file,
          directive.line,
          `nothing to suppress for ${unused.join(", ")}`,
        ),
      );
  }
  return kept;
}

export const allowlisted = (entry) =>
  DESIGN_LINT_ALLOWLIST.some(
    (allowed) =>
      allowed.rule === entry.rule &&
      (allowed.file === undefined || allowed.file === entry.file) &&
      (allowed.name === undefined
        ? (entry.selector ?? entry.component ?? "").includes(allowed.match)
        : entry.component === allowed.name),
  );
