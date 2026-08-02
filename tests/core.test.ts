import { describe, expect, it } from "vitest";
import {
  weeksBetween,
  buildGrid,
  weekIndexOf,
  cellOf,
  parseISODate,
  toISODate,
  encodeState,
  decodeState,
  clamp,
  DEFAULTS,
  WEEKS_PER_YEAR,
  type State,
} from "../src/model";
import { themeById, THEMES } from "../src/themes";
import { renderPoster, posterSize, milestoneCells, legendEntries } from "../src/render";

const day = (iso: string): Date => {
  const d = parseISODate(iso);
  if (!d) throw new Error(`bad date in test: ${iso}`);
  return d;
};

describe("date helpers", () => {
  it("parses and round-trips ISO dates in UTC", () => {
    expect(toISODate(day("1990-01-15"))).toBe("1990-01-15");
    expect(toISODate(day("2000-12-31"))).toBe("2000-12-31");
  });

  it("rejects malformed and overflow dates", () => {
    expect(parseISODate("not-a-date")).toBeNull();
    expect(parseISODate("2021-13-01")).toBeNull();
    expect(parseISODate("2021-02-31")).toBeNull();
    expect(parseISODate("1990-1-5")).toBeNull();
  });

  it("clamp bounds values", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-2, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe("weeksBetween", () => {
  it("counts whole weeks between two dates", () => {
    expect(weeksBetween(day("2020-01-01"), day("2020-01-08"))).toBe(1); // 7 days
    expect(weeksBetween(day("2020-01-01"), day("2020-01-15"))).toBe(2); // 14 days
    expect(weeksBetween(day("2020-01-01"), day("2020-01-14"))).toBe(1); // 13 days
    expect(weeksBetween(day("2020-01-01"), day("2020-01-07"))).toBe(0); // 6 days
  });

  it("is ~52 for exactly one year apart", () => {
    expect(weeksBetween(day("2021-06-02"), day("2022-06-02"))).toBe(52);
  });

  it("is negative when b precedes a", () => {
    expect(weeksBetween(day("2022-01-01"), day("2021-01-01"))).toBeLessThan(0);
  });
});

describe("buildGrid", () => {
  it("has rows = expectancy and 52 columns", () => {
    const g = buildGrid(day("1990-01-01"), 90, day("2020-01-01"));
    expect(g.rows).toBe(90);
    expect(g.cols).toBe(WEEKS_PER_YEAR);
    expect(g.totalWeeks).toBe(90 * 52);
  });

  it("a birth exactly one year ago yields ~52 lived weeks", () => {
    const g = buildGrid(day("2024-06-02"), 90, day("2025-06-02"));
    expect(g.livedWeeks).toBe(52);
    expect(g.currentIndex).toBe(52);
  });

  it("clamps livedWeeks to 0 for a future birthdate", () => {
    const g = buildGrid(day("2030-01-01"), 90, day("2025-01-01"));
    expect(g.livedWeeks).toBe(0);
    expect(g.currentIndex).toBe(-1);
  });

  it("clamps livedWeeks to totalWeeks past expectancy and drops the current cell", () => {
    const g = buildGrid(day("1900-01-01"), 90, day("2025-01-01"));
    expect(g.livedWeeks).toBe(g.totalWeeks);
    expect(g.currentIndex).toBe(-1);
  });

  it("places the current cell at the lived-week index mid-life", () => {
    const g = buildGrid(day("1990-01-01"), 90, day("2020-01-01"));
    expect(g.currentIndex).toBe(g.livedWeeks);
    expect(g.currentIndex).toBeGreaterThan(0);
    expect(g.currentIndex).toBeLessThan(g.totalWeeks);
  });
});

describe("weekIndexOf + cellOf", () => {
  it("locates a milestone in the right cell", () => {
    const birth = day("2000-01-01");
    expect(weekIndexOf(birth, day("2000-01-01"))).toBe(0);
    expect(weekIndexOf(birth, day("2000-01-08"))).toBe(1);
    // ~6 years in → row 6, somewhere in the year.
    const idx = weekIndexOf(birth, day("2006-01-01"));
    expect(cellOf(idx).row).toBe(6);
  });

  it("converts flat indices to row/col", () => {
    expect(cellOf(0)).toEqual({ row: 0, col: 0 });
    expect(cellOf(51)).toEqual({ row: 0, col: 51 });
    expect(cellOf(52)).toEqual({ row: 1, col: 0 });
    expect(cellOf(105)).toEqual({ row: 2, col: 1 });
  });
});

describe("encodeState / decodeState", () => {
  it("round-trips a full state", () => {
    const s: State = {
      birth: "1990-07-21",
      expectancy: 85,
      theme: "midnight",
      milestones: [
        { date: "1996-09-01", label: "Started school", color: "#e63946" },
        { date: "2015-06-15", label: "Met partner; moved in", color: "#118ab2" },
      ],
    };
    const decoded = decodeState("#" + encodeState(s));
    expect(decoded.birth).toBe("1990-07-21");
    expect(decoded.expectancy).toBe(85);
    expect(decoded.theme).toBe("midnight");
    expect(decoded.milestones).toHaveLength(2);
    expect(decoded.milestones[0]).toEqual(s.milestones[0]);
    // Label with a separator char survives the round-trip.
    expect(decoded.milestones[1]!.label).toBe("Met partner; moved in");
    expect(decoded.milestones[1]!.color).toBe("#118ab2");
  });

  it("falls back to defaults on garbage", () => {
    const d = decodeState("#b=nope&e=notanumber&m=broken");
    expect(d.birth).toBe(DEFAULTS.birth);
    expect(d.expectancy).toBe(DEFAULTS.expectancy);
    expect(d.milestones).toEqual([]);
  });

  it("ignores an empty hash", () => {
    const d = decodeState("");
    expect(d.birth).toBe(DEFAULTS.birth);
    expect(d.milestones).toEqual([]);
  });

  it("clamps a decoded expectancy into range", () => {
    expect(decodeState("#e=5").expectancy).toBe(60);
    expect(decodeState("#e=200").expectancy).toBe(100);
  });

  it("drops malformed milestones but keeps valid ones", () => {
    const hash = encodeState({
      ...DEFAULTS,
      birth: "1990-01-01",
      milestones: [{ date: "2000-01-01", label: "ok", color: "#abc" }],
    });
    const d = decodeState("#" + hash + ";garbage~~");
    expect(d.milestones.length).toBeGreaterThanOrEqual(1);
    expect(d.milestones.some((m) => m.label === "ok")).toBe(true);
  });

  it("round-trips a milestone label containing a literal tilde", () => {
    // `~` is the field separator for a packed milestone, but `encodeURIComponent`
    // leaves `~` unescaped (it's RFC 3986 "unreserved"), so a label like this
    // used to smuggle in extra separators and get silently dropped on decode.
    const s: State = {
      ...DEFAULTS,
      birth: "1990-01-01",
      milestones: [{ date: "2000-01-01", label: "Won ~1000 dollars", color: "#e63946" }],
    };
    const decoded = decodeState("#" + encodeState(s));
    expect(decoded.milestones).toHaveLength(1);
    expect(decoded.milestones[0]).toEqual(s.milestones[0]);
  });

  it("round-trips a label with multiple tildes and one at each edge", () => {
    const s: State = {
      ...DEFAULTS,
      birth: "1990-01-01",
      milestones: [{ date: "2000-01-01", label: "~a~b~c~", color: "#118ab2" }],
    };
    const decoded = decodeState("#" + encodeState(s));
    expect(decoded.milestones).toHaveLength(1);
    expect(decoded.milestones[0]?.label).toBe("~a~b~c~");
  });
});

describe("themes", () => {
  it("resolves by id and falls back to the first theme", () => {
    expect(themeById("midnight").id).toBe("midnight");
    expect(themeById("does-not-exist").id).toBe(THEMES[0]!.id);
  });
});

describe("render", () => {
  const baseState: State = {
    birth: "1990-01-01",
    expectancy: 90,
    theme: "ink",
    milestones: [{ date: "1996-09-01", label: "School", color: "#e63946" }],
  };

  it("emits a valid svg with background and grid cells", () => {
    const grid = buildGrid(day(baseState.birth), baseState.expectancy, day("2020-01-01"));
    const svg = renderPoster(baseState, grid);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("<rect");
    // Header reflects the total week count.
    expect(svg).toContain((90 * 52).toLocaleString());
  });

  it("computes a positive poster size that grows with expectancy", () => {
    const small = buildGrid(day(baseState.birth), 60, day("2020-01-01"));
    const big = buildGrid(day(baseState.birth), 100, day("2020-01-01"));
    expect(posterSize(small).height).toBeGreaterThan(0);
    expect(posterSize(big).height).toBeGreaterThan(posterSize(small).height);
  });

  it("maps milestones onto in-range grid cells only", () => {
    const grid = buildGrid(day(baseState.birth), 90, day("2020-01-01"));
    const cells = milestoneCells(baseState, grid);
    expect(cells.size).toBe(1);
    const idx = weekIndexOf(day(baseState.birth), day("1996-09-01"));
    expect(cells.get(idx)?.color).toBe("#e63946");

    // A milestone outside the grid is dropped.
    const outOfRange: State = {
      ...baseState,
      milestones: [{ date: "3000-01-01", label: "Far future", color: "#000" }],
    };
    expect(milestoneCells(outOfRange, grid).size).toBe(0);
  });

  it("builds a legend with the fixed swatches plus milestones", () => {
    const entries = legendEntries(baseState, themeById("ink"));
    expect(entries.length).toBe(4); // lived, this week, future, + 1 milestone
    expect(entries.some((e) => e.label === "School")).toBe(true);
  });

  it("renders a placeholder headline before a birthdate is set", () => {
    const empty: State = { ...DEFAULTS, milestones: [] };
    const grid = buildGrid(day("2000-01-01"), empty.expectancy, day("2000-01-01"));
    const svg = renderPoster(empty, grid);
    expect(svg).toContain("Enter your birthdate");
  });
});
