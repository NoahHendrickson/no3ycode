import { describe } from "@effect/vitest";

import { createOxlintRuleHarness } from "../test/utils.ts";

const rule = createOxlintRuleHarness("t3code/no-hand-built-primitives", {
  filename: "apps/web/src/custom/Example.tsx",
});

describe("t3code/no-hand-built-primitives", () => {
  rule.valid(
    "allows the primitives, unstyled buttons and other roles",
    `
      const a = <Button variant="ghost" size="sm">Save</Button>;
      const b = <button type="submit">Save</button>;
      const c = <div role="group" className="flex" />;
      const d = <MenuPopup role="menu" />;
    `,
  );

  rule.invalid(
    "reports a styled raw button",
    `const a = <button type="button" className="rounded-md px-2">Save</button>;`,
  );

  rule.invalid(
    "reports a styled raw button passed to render",
    `const a = <MenuTrigger render={<button className={cn("px-2")} />} />;`,
  );

  rule.invalid("reports a hand-built menu", `const a = <div role="menu">{items}</div>;`);

  rule.invalid("reports a hand-built listbox", `const a = <ul role="listbox" />;`);

  rule.invalid("reports a hand-built dialog", `const a = <div role="dialog" aria-modal />;`);

  rule.invalid("reports a hand-built tooltip", `const a = <span role="tooltip">Hint</span>;`);
});
