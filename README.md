# Rattle Finder

**Find the rattles and buzzes in your car using your own speakers.**

👉 **[belte42.github.io/rattle-finder](https://belte42.github.io/rattle-finder/)**. It runs in the
browser on your phone, with nothing to install and no account.

Most interior rattles are resonances: a loose panel, clip, or wire that vibrates
at one particular frequency. Rattle Finder plays low-frequency test tones
through your car's speakers (Bluetooth or aux) so you can make the rattle happen
on demand while parked, then track it down by hand.

## How to use it

1. **Park somewhere quiet** and connect your phone to the car stereo.
2. Open the app and set the **volume low**. Raise it gradually until things
   start to buzz.
3. Go to **Rattle Test** and press **Start Test**. The tone sweeps slowly
   through the frequency range.
4. When something rattles, **tap the big pad**. The frequency is saved.
   The app subtracts your reaction time, so the saved value matches the tone
   that caused it.
5. Press **Hold** to freeze the tone on the current frequency. Use **− / +** to
   nudge it until the rattle is loudest, then press on panels, trim and door
   cards until the noise stops. That's your culprit.
6. Name each rattle ("left door, upper trim"), use **Refine** to narrow it down
   with a slow ±8 Hz sweep, and **Mark fixed** once it's sorted.

**Manual** mode plays a steady tone at any frequency, with **pulse** (1 s on/off,
which makes intermittent rattles easier to hear) and **left/right pan** to work
out which side of the car it's on.

## Features

- Sweeps between 20–500 Hz, from 0.5 to 20 Hz/s, one-way or looping up and down
- Big tap-anywhere pad to mark rattles, with vibration feedback
- Hold + fine-tune ±1 Hz (press and hold to repeat)
- Reaction-time calibration (Settings → Measure), done through your actual
  car audio so Bluetooth delay is included
- Saved rattles with names, a frequency map, Refine, and fixed/to-do status
- Auto-stop timer (5/10/20 min) so a tone is never left running
- Keeps the screen awake during a test; timing stays accurate even if the phone
  locks, because all audio is scheduled on the Web Audio clock
- Installable as an app (Add to Home Screen) and works offline
- Everything is stored on your device

## Tips

- **Start quiet.** Low-frequency tones at high volume can damage speakers and
  hearing, and the loudest settings rarely help.
- Many car speakers produce very little below **~35 Hz**. If nothing happens down
  there, it doesn't mean nothing rattles; try a car with a subwoofer.
- Common culprits: door cards, dash trim, seat belt buckles, sunglasses holders,
  rear parcel shelf, number-plate frames, and loose items in door pockets.
- On iPhone, the app asks iOS to play audio even with the silent switch on.
  If you hear nothing, check the switch and the media volume anyway.

## Development

Built with [Svelte 5](https://svelte.dev), TypeScript, Tailwind CSS and Vite.

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run check    # type + accessibility checks
npm run build    # production build in dist/
```

Requires Node 20.19+ or 22.12+. Pushing to `main` deploys to GitHub Pages via
[.github/workflows/deploy.yml](.github/workflows/deploy.yml).

The audio engine lives in [src/lib/audioEngine.ts](src/lib/audioEngine.ts).

## Privacy

No accounts, and your saved rattles and settings stay in your browser. The site
uses [Umami](https://umami.is), a cookie-free analytics tool, to count visits.

## Contributing

Issues and pull requests are welcome, especially reports of which frequencies
found rattles in which cars.

## License

[MIT](LICENSE)
