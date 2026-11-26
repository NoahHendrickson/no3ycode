import { describe } from "@effect/vitest";

import { createOxlintRuleHarness } from "../test/utils.ts";

const rule = createOxlintRuleHarness("t3code/no-direct-icon-imports", {
  filename: "apps/web/src/custom/Example.tsx",
});

describe("t3code/no-direct-icon-imports", () => {
  rule.valid(
    "allows the Hugeicons shim",
    `
      import { CheckIcon } from "~/custom/icons/lucide-hugeicons";
      import { XIcon } from "./icons/lucide-hugeicons";
      export { PlusIcon } from "../icons/lucide-hugeicons";
    `,
  );

  rule.invalid("reports lucide-react", `import { CheckIcon } from "lucide-react";`);

  rule.invalid(
    "reports type-only lucide imports",
    `import type { LucideIcon } from "lucide-react";`,
  );

  rule.invalid(
    "reports Hugeicons' own package",
    `import { Layers02Icon } from "@hugeicons/core-free-icons";`,
  );

  rule.invalid("reports re-exports", `export { CheckIcon } from "lucide-react";`);

  rule.invalid("reports dynamic imports", `const icons = import("@phosphor-icons/react");`);
});
