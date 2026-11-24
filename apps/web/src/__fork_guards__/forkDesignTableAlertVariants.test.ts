// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-design-table-alert-variants`.
 *
 * The Automations tables' notice rows and muted cells, and design mode's compact result alert,
 * pick their look by prop rather than restyling the primitive (.fork/DESIGN-RULES.md B1).
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("fork guard: fork-design-table-alert-variants", () => {
  it("gives table rows a static state and cells a tone", () => {
    const table = read("../components/ui/table.tsx");
    expect(table).toContain('!interactive && "hover:bg-transparent"');
    expect(table).toContain('muted: "text-muted-foreground"');
    expect(table).toContain('destructive: "text-destructive"');
    expect(table).toContain('truncate && "truncate"');
    const runs = read("../custom/scheduled/ScheduledRunsTable.tsx");
    expect(runs).toContain("<TableRow interactive={false}>");
  });

  it("gives the alert a compact size", () => {
    const alert = read("../components/ui/alert.tsx");
    expect(alert).toContain(
      'sm: "rounded-md px-2.5 py-2 text-2xs leading-relaxed [&_[data-slot=alert-description]]:gap-1.5"',
    );
    const resolution = read("../custom/designMode/panel/SentPreviewResolution.tsx");
    expect(resolution).toContain('<Alert variant="success" size="sm"');
  });
});
