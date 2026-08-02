// Pure life-in-weeks logic. No DOM, no globals — every cell is one week of a
// life, laid out as a grid of `expectancyYears` rows × 52 columns. This mirrors
// Tim Urban's "Life in Weeks": each row is one year, each column one of its 52
// weeks. The model is fully deterministic so the UI is a thin wiring layer and
// the math is unit-testable in isolation.

export const WEEKS_PER_YEAR = 52;
export const MS_PER_DAY = 86_400_000;

export type Milestone = {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  label: string;
  /** Hex color, e.g. `#ff6b6b`. */
  color: string;
};

export type State = {
  /** Birthdate as ISO `YYYY-MM-DD` (empty string until the user picks one). */
  birth: string;
  /** Life expectancy in whole years (grid rows). */
  expectancy: number;
  /** Theme/palette id. */
  theme: string;
  milestones: Milestone[];
};

export const EXPECTANCY_MIN = 60;
export const EXPECTANCY_MAX = 100;

export const DEFAULTS: State = {
  birth: "",
  expectancy: 90,
  theme: "ink",
  milestones: [],
};

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Parse an ISO `YYYY-MM-DD` string to a UTC-midnight Date. Returns `null` for
 * anything malformed or non-calendar (e.g. month 13). Using UTC sidesteps DST
 * and timezone drift so week counts are stable everywhere.
 */
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Reject overflow like 2021-02-31 → 2021-03-03.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

/** Format a Date as ISO `YYYY-MM-DD` (UTC). */
export function toISODate(d: Date): string {
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Whole weeks elapsed from `a` to `b` (floored). Negative if `b` precedes `a`. */
export function weeksBetween(a: Date, b: Date): number {
  const days = Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);
  return Math.floor(days / 7);
}

export type Grid = {
  totalWeeks: number;
  livedWeeks: number;
  rows: number;
  cols: number;
  /**
   * Index (0-based) of the week being lived right now, or -1 once life has run
   * past the expectancy grid.
   */
  currentIndex: number;
};

/**
 * Build the week grid for a life. `rows = expectancyYears`, `cols = 52`, so
 * `totalWeeks = rows * 52`. `livedWeeks` is clamped to `[0, totalWeeks]`: it is
 * 0 for a not-yet-born birthdate and caps at `totalWeeks` past the expectancy.
 */
export function buildGrid(birth: Date, expectancyYears: number, now: Date): Grid {
  const rows = Math.max(1, Math.floor(expectancyYears));
  const cols = WEEKS_PER_YEAR;
  const totalWeeks = rows * cols;
  const raw = weeksBetween(birth, now);
  const livedWeeks = clamp(raw, 0, totalWeeks);
  // The "current" cell is the week currently being lived (index === livedWeeks).
  // Once that would fall outside the grid, there is no current cell.
  const currentIndex = raw >= 0 && raw < totalWeeks ? raw : -1;
  return { totalWeeks, livedWeeks, rows, cols, currentIndex };
}

/**
 * Which grid cell (flat 0-based index) a date lands in for a given birthdate.
 * Negative for dates before birth; may exceed the grid for far-future dates —
 * callers decide whether to render out-of-range placements.
 */
export function weekIndexOf(birth: Date, date: Date): number {
  return weeksBetween(birth, date);
}

/** Convert a flat week index into `{ row, col }` (year, week-of-year). */
export function cellOf(index: number): { row: number; col: number } {
  return { row: Math.floor(index / WEEKS_PER_YEAR), col: index % WEEKS_PER_YEAR };
}

// ---- URL-hash (de)serialization ------------------------------------------
// Milestones are packed as `date~label~color` tuples joined by `;`. The label
// is percent-encoded, but `encodeURIComponent` intentionally leaves `~`
// unescaped (it's an RFC 3986 "unreserved" character) — so a label typed
// with a literal `~` (e.g. "Won ~1000 dollars") would otherwise smuggle in
// extra separators and corrupt the split. `date` (fixed ISO `YYYY-MM-DD`)
// and `color` (hex, optionally `#`-prefixed) never contain `~`, so instead
// of splitting on every `~`, we only ever look at the *first* one (end of
// date) and the *last* one (start of color) and treat everything between as
// the still-percent-encoded label, tildes and all.

function encodeMilestone(m: Milestone): string {
  return [m.date, encodeURIComponent(m.label), m.color.replace(/^#/, "")].join("~");
}

function decodeMilestone(raw: string): Milestone | null {
  const first = raw.indexOf("~");
  const last = raw.lastIndexOf("~");
  if (first < 0 || first === last) return null;
  const date = raw.slice(0, first);
  const label = raw.slice(first + 1, last);
  const color = raw.slice(last + 1);
  if (!date || !parseISODate(date)) return null;
  const hex = `#${color.replace(/^#/, "")}`;
  if (!/^#[0-9a-fA-F]{3,8}$/.test(hex)) return null;
  return {
    date,
    label: safeDecode(label),
    color: hex,
  };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Serialize state into a compact `#k=v&…` URL hash fragment. */
export function encodeState(s: State): string {
  const p = new URLSearchParams();
  if (s.birth) p.set("b", s.birth);
  p.set("e", String(s.expectancy));
  p.set("t", s.theme);
  if (s.milestones.length) {
    p.set("m", s.milestones.map(encodeMilestone).join(";"));
  }
  return p.toString();
}

/** Parse a URL hash fragment back into state, falling back to DEFAULTS. */
export function decodeState(hash: string): State {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const p = new URLSearchParams(clean);
  const out: State = { ...DEFAULTS, milestones: [] };

  const b = p.get("b");
  if (b && parseISODate(b)) out.birth = b;

  const e = Number(p.get("e"));
  if (Number.isFinite(e) && e > 0) {
    out.expectancy = clamp(Math.round(e), EXPECTANCY_MIN, EXPECTANCY_MAX);
  }

  const t = p.get("t");
  if (t) out.theme = t.slice(0, 32);

  const m = p.get("m");
  if (m) {
    out.milestones = m
      .split(";")
      .map(decodeMilestone)
      .filter((x): x is Milestone => x !== null);
  }
  return out;
}
