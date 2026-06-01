import {
  DEFAULTS,
  EXPECTANCY_MIN,
  EXPECTANCY_MAX,
  buildGrid,
  clamp,
  decodeState,
  encodeState,
  parseISODate,
  type Milestone,
  type State,
} from "./model";
import { THEMES, MILESTONE_COLORS, themeById } from "./themes";
import { renderPoster, posterSize, legendEntries } from "./render";

// ---- DOM helpers ----------------------------------------------------------
function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

let state: State = decodeState(location.hash);
if (!THEMES.some((t) => t.id === state.theme)) state.theme = DEFAULTS.theme;

// ---- rendering ------------------------------------------------------------
function currentGrid() {
  const birth = parseISODate(state.birth) ?? parseISODate(todayISO())!;
  return buildGrid(birth, state.expectancy, new Date());
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function renderAll(): void {
  const grid = currentGrid();
  const svg = renderPoster(state, grid);
  el("poster").innerHTML = svg;
  renderLegend();
  renderStats(grid);
}

function renderLegend(): void {
  const wrap = el("legend");
  wrap.innerHTML = "";
  if (!state.birth) {
    wrap.innerHTML = `<span class="empty-hint">Pick a birthdate to begin.</span>`;
    return;
  }
  for (const e of legendEntries(state, themeById(state.theme))) {
    const item = document.createElement("span");
    item.className = "item";
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = e.color;
    const label = document.createElement("span");
    label.textContent = e.label;
    item.append(sw, label);
    wrap.appendChild(item);
  }
}

function statBox(num: string, lbl: string): string {
  return `<div class="stat"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`;
}

function renderStats(grid: ReturnType<typeof buildGrid>): void {
  const stats = el("stats");
  if (!state.birth) {
    stats.innerHTML = "";
    return;
  }
  const remaining = grid.totalWeeks - grid.livedWeeks;
  const pct = grid.totalWeeks ? Math.round((grid.livedWeeks / grid.totalWeeks) * 1000) / 10 : 0;
  stats.innerHTML =
    statBox(grid.livedWeeks.toLocaleString(), "weeks lived") +
    statBox(remaining.toLocaleString(), "remaining") +
    statBox(`${pct}%`, "elapsed");
}

// ---- controls -------------------------------------------------------------
function syncControls(): void {
  el<HTMLInputElement>("birth").value = state.birth;
  const exp = el<HTMLInputElement>("expectancy");
  exp.min = String(EXPECTANCY_MIN);
  exp.max = String(EXPECTANCY_MAX);
  exp.value = String(state.expectancy);
  el<HTMLOutputElement>("expectancy-out").textContent = `${state.expectancy} yrs`;
  el<HTMLSelectElement>("theme").value = state.theme;
}

function updateHash(): void {
  history.replaceState(null, "", `#${encodeState(state)}`);
}

function commit(): void {
  updateHash();
  renderAll();
}

// ---- milestone editor -----------------------------------------------------
function renderMilestoneList(): void {
  const list = el("milestone-list");
  list.innerHTML = "";
  const tpl = el<HTMLTemplateElement>("milestone-tpl");
  if (!state.milestones.length) {
    const hint = document.createElement("div");
    hint.className = "empty-hint";
    hint.textContent = "No milestones yet — add school, jobs, moves, people…";
    list.appendChild(hint);
    return;
  }
  state.milestones.forEach((m, i) => {
    const node = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
    const color = node.querySelector<HTMLInputElement>(".m-color")!;
    const date = node.querySelector<HTMLInputElement>(".m-date")!;
    const label = node.querySelector<HTMLInputElement>(".m-label")!;
    const remove = node.querySelector<HTMLButtonElement>(".m-remove")!;
    color.value = normalizeHex(m.color);
    date.value = m.date;
    label.value = m.label;

    color.addEventListener("input", () => {
      state.milestones[i]!.color = color.value;
      commit();
    });
    date.addEventListener("change", () => {
      state.milestones[i]!.date = date.value;
      commit();
    });
    label.addEventListener("input", () => {
      state.milestones[i]!.label = label.value;
      commit();
    });
    remove.addEventListener("click", () => {
      state.milestones.splice(i, 1);
      renderMilestoneList();
      commit();
    });
    list.appendChild(node);
  });
}

/** <input type="color"> only accepts #rrggbb; coerce shorthand/garbage. */
function normalizeHex(hex: string): string {
  const h = hex.replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(h)) return `#${h}`;
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return "#e63946";
}

function addMilestone(): void {
  const color = MILESTONE_COLORS[state.milestones.length % MILESTONE_COLORS.length]!;
  const m: Milestone = { date: state.birth || todayISO(), label: "", color };
  state.milestones.push(m);
  renderMilestoneList();
  commit();
}

// ---- export ---------------------------------------------------------------
function toast(msg: string): void {
  const t = el<HTMLElement>("toast");
  t.textContent = msg;
  t.classList.add("show");
  window.setTimeout(() => t.classList.remove("show"), 1800);
}

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fileStem(): string {
  return `life-in-weeks${state.birth ? `-${state.birth}` : ""}`;
}

function exportSvg(): void {
  const svg = renderPoster(state, currentGrid());
  download(`${fileStem()}.svg`, new Blob([svg], { type: "image/svg+xml" }));
}

function exportPng(): void {
  const grid = currentGrid();
  const svg = renderPoster(state, grid);
  const { width, height } = posterSize(grid);
  const scale = 2; // crisp poster export
  const img = new Image();
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(blobUrl);
      toast("PNG export not supported here");
      return;
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(blobUrl);
    canvas.toBlob((blob) => {
      if (blob) download(`${fileStem()}.png`, blob);
      else toast("PNG export failed");
    }, "image/png");
  };
  img.onerror = () => {
    URL.revokeObjectURL(blobUrl);
    toast("PNG export failed");
  };
  img.src = blobUrl;
}

// ---- wiring ---------------------------------------------------------------
function wire(): void {
  const themeSel = el<HTMLSelectElement>("theme");
  for (const t of THEMES) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    themeSel.appendChild(opt);
  }

  syncControls();
  renderMilestoneList();

  el<HTMLInputElement>("birth").addEventListener("change", (e) => {
    state.birth = (e.target as HTMLInputElement).value;
    commit();
  });

  el<HTMLInputElement>("expectancy").addEventListener("input", (e) => {
    state.expectancy = clamp(
      Number((e.target as HTMLInputElement).value),
      EXPECTANCY_MIN,
      EXPECTANCY_MAX,
    );
    el<HTMLOutputElement>("expectancy-out").textContent = `${state.expectancy} yrs`;
    commit();
  });

  themeSel.addEventListener("change", (e) => {
    state.theme = (e.target as HTMLSelectElement).value;
    commit();
  });

  el("add-milestone").addEventListener("click", addMilestone);
  el("svg").addEventListener("click", exportSvg);
  el("png").addEventListener("click", exportPng);
  el("print").addEventListener("click", () => window.print());

  el("share").addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}#${encodeState(state)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied — your poster, shareable");
    } catch {
      toast(url);
    }
  });

  el("toggle-panel").addEventListener("click", () => el("panel").classList.add("hidden"));
  el("show-panel").addEventListener("click", () => el("panel").classList.remove("hidden"));

  el<HTMLElement>("version").textContent = `v${__APP_VERSION__} · ${__GIT_COMMIT__}`;
}

wire();
updateHash();
renderAll();
