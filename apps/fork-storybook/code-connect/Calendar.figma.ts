// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=66-25
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/calendar.tsx
// component=Calendar
import figma from "figma";

// As the custom snooze dialog picks a day (CustomSnoozeDialog.tsx).
export default {
  example: figma.tsx`<Calendar mode="single" required selected={date} defaultMonth={date} onSelect={setDate} />`,
  imports: ['import { Calendar } from "~/components/ui/calendar";'],
  id: "calendar",
};
