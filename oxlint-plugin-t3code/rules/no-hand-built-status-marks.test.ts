import { describe } from "@effect/vitest";

import { createOxlintRuleHarness } from "../test/utils.ts";

const rule = createOxlintRuleHarness("t3code/no-hand-built-status-marks", {
  filename: "apps/web/src/custom/Example.tsx",
});

describe("t3code/no-hand-built-status-marks", () => {
  rule.valid(
    "allows the shared marks, neutral dots and larger round shapes",
    `
      import { SidebarV2StatusMark } from "./SidebarV2StatusIndicator";
      import { CircleIcon } from "./icons/lucide-hugeicons";
      const a = <SidebarV2StatusMark status="done" seed="t1" />;
      const b = <span className="size-1.5 rounded-full bg-current" />;
      const c = <span className="size-8 rounded-full bg-emerald-500" />;
      const d = <span className="size-2 rounded-full bg-success">3</span>;
    `,
  );

  rule.invalid(
    "reports the CircleHalf glyph",
    `import { CircleHalfIcon } from "./icons/lucide-hugeicons";`,
  );

  rule.invalid(
    "reports a dot in the status palette",
    `const a = <span className="size-2 rounded-full bg-sidebar-v2-status-done" />;`,
  );

  rule.invalid(
    "reports a dot coloured through cn()",
    `const a = <span className={cn("size-2.5 rounded-full", failed && "bg-red-500")} />;`,
  );
});
