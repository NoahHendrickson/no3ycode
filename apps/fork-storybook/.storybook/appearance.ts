// The preferences a user on Inlet · Jungle Art has stored. Imported ahead of every app module:
// useTheme applies the stored theme as it loads, and forkTheme.ts derives the rest from these.
const PREFERENCES = {
  "t3code:theme": "dark",
  "t3code:theme-appearance-mode": "dark",
  "t3code:theme-follow-system": "false",
  "t3code:fork-theme": "inlet",
  "t3code:fork-inlet-color": "jungle",
};

for (const [key, value] of Object.entries(PREFERENCES)) {
  window.localStorage.setItem(key, value);
}
