# Echo Type

A minimal typing speed test built with SvelteKit, Skeleton and Tailwind.

## Features

- **Three modes:** a timed test (15, 30, 60 or 120 seconds), a word count test (10, 25, 50 or 100 words), and custom text you paste in.
- **Punctuation and numbers** toggles for the random word modes.
- **Live feedback:** correct letters light up, mistakes turn red, extra letters are shown, and words left with mistakes are underlined. A countdown or word counter and live wpm show while you type.
- **Results:** wpm, accuracy, raw wpm, a character breakdown (correct / incorrect / extra / missed), consistency, and a chart of speed and errors over the test.
- **Personal bests** for each test configuration, saved in the browser along with your settings.

## Controls

| Key                                    | Action                                                       |
| -------------------------------------- | ------------------------------------------------------------ |
| Any key                                | Start the test (the timer starts on the first letter)        |
| <kbd>Space</kbd>                       | Go to the next word                                          |
| <kbd>Backspace</kbd>                   | Delete a letter, or go back to a previous word with mistakes |
| <kbd>Ctrl</kbd> + <kbd>Backspace</kbd> | Delete the whole word                                        |
| <kbd>Tab</kbd> or <kbd>Esc</kbd>       | Start a new test                                             |

## How the numbers are calculated

- **wpm:** characters in correctly typed words, including the spaces after them, divided by 5 and scaled to one minute.
- **raw:** every character typed, right or wrong, divided by 5 and scaled to one minute.
- **accuracy:** correct keystrokes out of all keystrokes, so mistakes you fix still count against you.
- **consistency:** how steady your per-second raw speed was, from 0 to 100%.

## Development

```bash
npm install
npm run dev
```

Other scripts:

- `npm run check` — type-check the project
- `npm run build` — build for production (`npm run preview` serves the build)
- `npm run format` — format with Prettier

The code lives in `src/components`: `typing.ts` (word generation, stats and saved data), `test.svelte` (the typing test itself), `results.svelte` and `chart.svelte` (the results screen), and `custom.svelte` (the custom text editor). `src/routes/+page.svelte` ties them together with the settings bar.
