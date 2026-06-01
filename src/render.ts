// Pure SVG renderer for the life-in-weeks poster. Takes the computed grid +
// state + theme and returns a standalone, self-describing SVG document string.
// The same string powers the on-screen poster, the SVG export, and (rasterized
// onto a canvas) the PNG export — so what you see is exactly what you save.

import type { Grid } from "./model";
import { cellOf, weekIndexOf, parseISODate, type State } from "./model";
import { themeById, type Theme } from "./themes";

export type PosterLayout = {
  cell: number;
  gap: number;
  padX: number;
  padTop: number;
  padBottom: number;
  /** Left gutter for age labels. */
  gutter: number;
  headerH: number;
};

export const LAYOUT: PosterLayout = {
  cell: 11,
  gap: 3,
  padX: 40,
  padTop: 96,
  padBottom: 30,
  gutter: 34,
  headerH: 96,
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Geometry of the rendered poster, so the DOM layer can size its container. */
export function posterSize(
  grid: Grid,
  l: PosterLayout = LAYOUT,
): { width: number; height: number } {
  const step = l.cell + l.gap;
  const gridW = grid.cols * step - l.gap;
  const gridH = grid.rows * step - l.gap;
  const width = l.padX * 2 + l.gutter + gridW;
  // Header + grid + a legend band at the bottom.
  const height = l.padTop + gridH + l.padBottom;
  return { width, height };
}

/**
 * Map each milestone to the flat week index it occupies, keeping only those
 * that fall inside the grid. Later milestones win if two share a cell.
 */
export function milestoneCells(
  state: State,
  grid: Grid,
): Map<number, { color: string; label: string }> {
  const out = new Map<number, { color: string; label: string }>();
  const birth = parseISODate(state.birth);
  if (!birth) return out;
  for (const m of state.milestones) {
    const d = parseISODate(m.date);
    if (!d) continue;
    const idx = weekIndexOf(birth, d);
    if (idx < 0 || idx >= grid.totalWeeks) continue;
    out.set(idx, { color: m.color, label: m.label });
  }
  return out;
}

function lifeHeadline(state: State, grid: Grid): { title: string; sub: string } {
  const pct = grid.totalWeeks > 0 ? Math.round((grid.livedWeeks / grid.totalWeeks) * 1000) / 10 : 0;
  const remaining = grid.totalWeeks - grid.livedWeeks;
  const title = state.birth
    ? `A life in ${grid.totalWeeks.toLocaleString()} weeks`
    : "A life in weeks";
  const sub = state.birth
    ? `${grid.livedWeeks.toLocaleString()} lived · ${remaining.toLocaleString()} remaining · ${pct}% elapsed`
    : "Enter your birthdate to fill the grid";
  return { title, sub };
}

export function renderPoster(state: State, grid: Grid, l: PosterLayout = LAYOUT): string {
  const theme = themeById(state.theme);
  const { width, height } = posterSize(grid, l);
  const step = l.cell + l.gap;
  const gridLeft = l.padX + l.gutter;
  const gridTop = l.headerH;
  const cells = milestoneCells(state, grid);

  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="${theme.bg}"/>`);

  // Header.
  const { title, sub } = lifeHeadline(state, grid);
  parts.push(
    `<text x="${l.padX}" y="42" font-size="28" font-weight="700" fill="${theme.text}">${esc(title)}</text>`,
  );
  parts.push(`<text x="${l.padX}" y="68" font-size="15" fill="${theme.muted}">${esc(sub)}</text>`);

  // Column hint (weeks →) above the grid.
  parts.push(
    `<text x="${gridLeft}" y="${gridTop - 8}" font-size="11" fill="${theme.muted}">52 weeks →</text>`,
  );

  // Age labels down the left gutter (every 10 years).
  for (let row = 0; row < grid.rows; row += 10) {
    const y = gridTop + row * step + l.cell;
    parts.push(
      `<text x="${l.padX + l.gutter - 8}" y="${y}" font-size="10" text-anchor="end" fill="${theme.muted}">${row}</text>`,
    );
  }

  // The grid itself.
  const lived: string[] = [];
  const empty: string[] = [];
  const milestoneRects: string[] = [];
  let currentRect = "";

  for (let i = 0; i < grid.totalWeeks; i++) {
    const { row, col } = cellOf(i);
    const x = gridLeft + col * step;
    const y = gridTop + row * step;
    const base = `x="${fmt(x)}" y="${fmt(y)}" width="${l.cell}" height="${l.cell}" rx="2"`;
    const ms = cells.get(i);
    if (ms) {
      milestoneRects.push(
        `<rect ${base} fill="${ms.color}"><title>${esc(ms.label)}</title></rect>`,
      );
    } else if (i === grid.currentIndex) {
      currentRect = `<rect ${base} fill="${theme.current}"><title>This week</title></rect>`;
    } else if (i < grid.livedWeeks) {
      lived.push(`<rect ${base}/>`);
    } else {
      empty.push(`<rect ${base}/>`);
    }
  }

  // Group same-fill cells so the document stays compact.
  if (empty.length) parts.push(`<g fill="${theme.empty}">${empty.join("")}</g>`);
  if (lived.length) parts.push(`<g fill="${theme.lived}">${lived.join("")}</g>`);
  if (milestoneRects.length) parts.push(`<g>${milestoneRects.join("")}</g>`);
  if (currentRect) parts.push(currentRect);

  // Footer credit baked into the poster.
  parts.push(
    `<text x="${width - l.padX}" y="${height - 12}" font-size="10" text-anchor="end" fill="${theme.muted}">life-in-weeks · made with ♥</text>`,
  );

  parts.push(`</svg>`);
  return parts.join("\n");
}

export type LegendEntry = { color: string; label: string };

/** Legend rows for the milestones + the fixed lived/current/future swatches. */
export function legendEntries(state: State, theme: Theme): LegendEntry[] {
  const entries: LegendEntry[] = [
    { color: theme.lived, label: "Lived" },
    { color: theme.current, label: "This week" },
    { color: theme.empty, label: "Yet to come" },
  ];
  for (const m of state.milestones) {
    if (m.label.trim()) entries.push({ color: m.color, label: m.label });
  }
  return entries;
}
