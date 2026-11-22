// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=50-147
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/toast.tsx
// component=toastManager
import figma from "figma";

// Toasts are imperative: a call adds one and the app's ToastProvider draws it.
const toast = figma.selectedInstance;
const type = toast.getEnum("Type", {
  Success: "success",
  Error: "error",
  Warning: "warning",
  Info: "info",
  Loading: "loading",
});
const action = toast.getBoolean("Action") ? toast.findInstance("Action") : null;
const lines = [
  `  type: "${type ?? "success"}",`,
  `  title: ${JSON.stringify(toast.getString("Title"))},`,
  ...(toast.getBoolean("Show description")
    ? [`  description: ${JSON.stringify(toast.getString("Description"))},`]
    : []),
  ...(action?.type === "INSTANCE"
    ? [`  actionProps: { children: ${JSON.stringify(action.getString("Label"))}, onClick },`]
    : []),
];

export default {
  example: figma.tsx`toastManager.add({
${lines.join("\n")}
});`,
  imports: ['import { toastManager } from "~/components/ui/toast";'],
  id: "toast",
};
