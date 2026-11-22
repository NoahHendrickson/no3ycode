// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=65-121
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/qr-code.tsx
// component=QRCodeSvg
import figma from "figma";

// As Connections settings draws a pairing link (AuthorizedClientsSettings.tsx).
export default {
  example: figma.tsx`<QRCodeSvg value={revealValue} size={132} level="M" />`,
  imports: ['import { QRCodeSvg } from "~/components/ui/qr-code";'],
  id: "qr-code",
};
