// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=59-86
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/alert.tsx
// component=Alert
import figma from "figma";

import { jsxText } from "./shared";

const alert = figma.selectedInstance;
const variant = alert.getEnum("Variant", {
  error: "error",
  info: "info",
  success: "success",
  warning: "warning",
});
const titled = alert.getBoolean("Show title");
const IMPORT = titled
  ? 'import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";'
  : 'import { Alert, AlertDescription } from "~/components/ui/alert";';

export default {
  example: figma.tsx`<Alert${variant ? ` variant="${variant}"` : ""}>${
    titled ? `\n  <AlertTitle>${jsxText(alert.getString("Title"))}</AlertTitle>` : ""
  }
  <AlertDescription>${jsxText(alert.getString("Description"))}</AlertDescription>
</Alert>`,
  imports: [IMPORT],
  id: "alert",
  metadata: { nestable: true, props: { imports: [IMPORT] } },
};
