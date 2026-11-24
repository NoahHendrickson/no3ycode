// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=62-43
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/combobox.tsx
// component=Combobox
import figma from "figma";

import { connected, nestedImports, stack } from "./shared";

const combobox = figma.selectedInstance;
const triggers = connected(combobox, "combobox-trigger");
const items = connected(combobox, "combobox-item");
const values = items.map((item) => JSON.stringify(item.metadata?.props?.["value"] ?? "item"));

export default {
  example: figma.tsx`<Combobox items={[${values.join(", ")}]}>
  ${stack(triggers)}
  <ComboboxPopup>
    <ComboboxList>
      ${stack(items, "      ")}
    </ComboboxList>
  </ComboboxPopup>
</Combobox>`,
  imports: nestedImports(
    [...triggers, ...items],
    ['import { Combobox, ComboboxList, ComboboxPopup } from "~/components/ui/combobox";'],
  ),
  id: "combobox",
};
