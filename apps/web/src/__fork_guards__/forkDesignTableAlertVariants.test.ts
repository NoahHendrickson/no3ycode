// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-design-primitives`.
 *
 * The Automations tables' notice rows and muted cells, and design mode's compact result alert,
 * pick their look by prop rather than restyling the primitive (.fork/DESIGN-RULES.md B1).
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (path: string) =>
  NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("fork guard: fork-design-primitives", () => {
  it("gives table rows a static state and cells a tone", () => {
    const table = read("../components/ui/table.tsx");
    expect(table).toContain('!interactive && "hover:bg-transparent"');
    expect(table).toContain('muted: "text-muted-foreground"');
    expect(table).toContain('destructive: "text-destructive"');
    expect(table).toContain('truncate && "truncate"');
    const runs = read("../custom/scheduled/ScheduledRunsTable.tsx");
    expect(runs).toContain("<TableRow interactive={false}>");
  });
});
