// Color themes for the poster. Each theme defines the page background, the grid
// ink (lived weeks), an empty-cell color (future weeks), the "this week"
// highlight, and the text color. Milestones get their own per-entry color.

export type Theme = {
  id: string;
  name: string;
  bg: string;
  /** Lived weeks. */
  lived: string;
  /** Future / empty weeks. */
  empty: string;
  /** The current week. */
  current: string;
  text: string;
  muted: string;
};

export const THEMES: Theme[] = [
  {
    id: "ink",
    name: "Ink on paper",
    bg: "#fbfaf7",
    lived: "#1f2933",
    empty: "#e3e0d8",
    current: "#e63946",
    text: "#1f2933",
    muted: "#7b7768",
  },
  {
    id: "midnight",
    name: "Midnight",
    bg: "#0d1117",
    lived: "#c9d1d9",
    empty: "#21262d",
    current: "#f7b500",
    text: "#e6edf3",
    muted: "#8b949e",
  },
  {
    id: "ember",
    name: "Ember",
    bg: "#1a0f0a",
    lived: "#ff8a5c",
    empty: "#3a241a",
    current: "#ffd23f",
    text: "#ffe8d6",
    muted: "#b08968",
  },
  {
    id: "ocean",
    name: "Ocean",
    bg: "#f0f7fa",
    lived: "#11526e",
    empty: "#cfe2ea",
    current: "#ef476f",
    text: "#0b3a4f",
    muted: "#5e8a9c",
  },
  {
    id: "forest",
    name: "Forest",
    bg: "#f4f7f0",
    lived: "#2d5016",
    empty: "#d7e3cb",
    current: "#d62828",
    text: "#243f12",
    muted: "#6f8a5a",
  },
];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

/** Default colors offered when adding a milestone. */
export const MILESTONE_COLORS = ["#e63946", "#f77f00", "#06a77d", "#118ab2", "#7209b7", "#d81159"];
