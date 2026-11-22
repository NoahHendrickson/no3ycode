// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=63-10
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/autocomplete.tsx
// component=Autocomplete
import figma from "figma";

// The kit draws the Add environment dialog's SSH host field (AddEnvironmentDialog.tsx): the
// hosts it lists are the machine's discovered SSH targets.
export default {
  example: figma.tsx`<Autocomplete
  items={filteredDiscoveredSshHosts}
  itemToStringValue={sshHostSuggestionValue}
  mode="none"
  openOnInputClick
>
  <AutocompleteInput id="saved-backend-ssh-host" placeholder="Search hosts or type devbox" spellCheck={false} />
  <AutocompletePopup>
    <AutocompleteList className="max-h-72">
      {filteredDiscoveredSshHosts.map((target) => (
        <AutocompleteItem key={target.alias} value={target}>
          {target.alias}
        </AutocompleteItem>
      ))}
    </AutocompleteList>
  </AutocompletePopup>
</Autocomplete>`,
  imports: [
    'import { Autocomplete, AutocompleteInput, AutocompleteItem, AutocompleteList, AutocompletePopup } from "~/components/ui/autocomplete";',
  ],
  id: "autocomplete",
};
