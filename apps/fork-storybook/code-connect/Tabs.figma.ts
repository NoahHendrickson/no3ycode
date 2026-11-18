// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=40-191
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/Tabs.tsx
// component=Tabs
import figma from "figma";

const track = figma.selectedInstance;
// The track's size sets its outer height: 28 / 32 / 36px at sm / md / lg.
const size = track.getEnum("Kind", { "Icon md": "md", "Icon lg": "lg", Word: "md" });
const tabs = track.findConnectedInstances(() => true);

export default {
  example: figma.tsx`<Tabs aria-label="View"${size ? ` size="${size}"` : ""} defaultValue={["code"]}>
  ${tabs.map((tab) => (tab.type === "INSTANCE" ? tab.executeTemplate().example : ""))}
</Tabs>`,
  imports: ['import { Tabs } from "~/custom/Tabs";'],
  id: "tabs",
};
