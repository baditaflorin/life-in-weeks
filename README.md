# life-in-weeks

[![pages](https://img.shields.io/badge/live-baditaflorin.github.io%2Flife--in--weeks-e63946)](https://baditaflorin.github.io/life-in-weeks/)
[![version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/baditaflorin/life-in-weeks/blob/main/package.json)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

> Your whole life as a grid of weeks — one row per year, one box per week. A poster you can print.

**Live → https://baditaflorin.github.io/life-in-weeks/**

Inspired by Tim Urban's _Life in Weeks_. Enter your birthdate and a life expectancy and every cell becomes one week of your life: weeks already lived are filled, this week glows, the rest wait. Mark the milestones that mattered, pick a theme, and export a printable poster. Quietly profound, instantly shareable — and entirely client-side.

## What you can do

- **See it** — a grid where each row is one year and each of the 52 columns is a week. Lived weeks are filled; the current week is highlighted.
- **Time it** — set your birthdate and drag the expectancy slider (60–100, default 90). Live stats show weeks lived, weeks remaining, and % of life elapsed.
- **Mark it** — add milestones (`date · label · color`) like "Started school" or "Met partner"; those weeks light up in your color, with a legend.
- **Share it** — birthdate, expectancy, theme, and milestones live in the URL hash, so **🔗 Copy link** hands someone your exact poster.
- **Keep it** — **⬇ SVG** for crisp vector, **⬇ PNG** for a raster (the SVG drawn onto a canvas), or **🖨 Print** the poster straight from the page.

## How it works

`model.ts` is the pure core: `weeksBetween`, `buildGrid` (rows × 52, with `livedWeeks` clamped to `[0, totalWeeks]`), `weekIndexOf` for milestone placement, and `encodeState`/`decodeState` for the shareable hash. `render.ts` turns that grid into a standalone SVG document — the **same** string powers the on-screen poster, the SVG export, and (rasterized onto a canvas) the PNG. Dates are computed in UTC so week counts are stable across timezones.

All logic is pure and unit-tested (`tests/core.test.ts`); the UI in `main.ts` is a thin wiring layer over it.

## Run it locally

```bash
git clone https://github.com/baditaflorin/life-in-weeks
cd life-in-weeks
npm install
npm run dev      # http://127.0.0.1:5173
```

## Build & deploy

GitHub Pages serves the committed `docs/` directory on `main`. No CI — a local smoke gate builds and sanity-checks the output:

```bash
npm run smoke    # vitest + tsc + vite build → docs/ + output checks
```

## Privacy

100% client-side. There is no backend, no analytics, no upload. Your birthdate and milestones live only in your browser and in the URL you choose to share.

## License

MIT — see [LICENSE](./LICENSE).
