# Rattle Finder

A mobile-first PWA that plays low-frequency test tones (20–500 Hz) through your
car's speakers to help locate rattles.

- **Manual** – hold a tone at a chosen frequency, optionally pulsed and panned
  left/right to narrow down where a rattle is.
- **Rattle Test** – sweep a frequency range and tap **Rattle!** whenever
  something buzzes. Recorded frequencies are compensated for reaction time,
  saved on the device, and can be replayed in Manual mode.

## Development

```bash
npm install
npm run dev      # dev server
npm run check    # type + a11y checks
npm run build    # production build (with service worker)
```
