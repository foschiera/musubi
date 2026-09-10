import { GraphView } from "./graph-view";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/libre-caslon-display/400.css";
import "./style.css";
import "./dark.css";
type Narrative = {
  id: string;
  perspective_id: string;
  language: string;
  text: string;
  source_ids: string[];
};
type Event = {
  id: string;
  title: string;
  date: { start: string; end: string; circa: boolean };
  region_ids: string[];
  location: string;
  summary: string;
  narratives: Narrative[];
  source_ids: string[];
  layout: { x: number; y: number };
};
type Edge = {
  id: string;
  source_event_id: string;
  target_event_id: string;
  type: string;
  confidence: number;
  directed: boolean;
  description: string;
  source_ids: string[];
};
type Source = {
  id: string;
  title: string;
  url: string;
  citation: string;
  kind: string;
};
type Meta = {
  regions: { id: string; label: string; color: string }[];
  perspectives: { id: string; label: string }[];
  sources: Source[];
  relationship_types: string[];
  editorial_note: string;
};
type Graph = { nodes: Event[]; edges: Edge[]; truncated: boolean };
type Route = {
  found: boolean;
  events: string[];
  relationships: string[];
  total_cost: number;
  strategy: string;
};
const icon = (name: string) => {
  const paths: Record<string, string> = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    graph:
      '<circle cx="5" cy="12" r="2.5"/><circle cx="17" cy="5" r="2.5"/><circle cx="17" cy="19" r="2.5"/><path d="m7 11 8-5M7 13l8 5M17 8v8"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    book: '<path d="M12 5C8 2 4 3 2 4v15c3-1 6-1 10 1 4-2 7-2 10-1V4c-3-1-6-1-10 1v15"/>',
    link: '<path d="m10 14 4-4m-6 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2-1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(2 -1) scale(.9)"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    reset: '<path d="M4 10a8 8 0 1 1 2 8M4 4v6h6"/>',
    pin: '<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2"/>',
    expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  };
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.graph}</svg>`;
};
const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
let meta: Meta,
  graph: Graph = { nodes: [], edges: [], truncated: false },
  all: Event[] = [],
  route: Route | null = null;
const params = new URLSearchParams(location.search);
let selected = params.get("event") || "evt_bandung",
  mode = innerWidth < 640 ? "list" : "graph",
  tab = "narratives",
  request = 0;
const state = {
  regions: params.get("region")?.split(",").filter(Boolean) || ([] as string[]),
  perspective: params.get("perspective") || "",
  type: params.get("relationship_type") || "",
  from: params.get("from") || "1947",
  to: params.get("to") || "1967",
  q: params.get("q") || "",
};
const app = $("#app");
app.innerHTML = `<header class="topbar"><a class="brand" href="/" aria-label="Musubi home"><span class="brand-mark">結</span><span>musubi<span class="brand-dot">.</span></span></a><nav aria-label="Main navigation"><button class="nav-active" id="explore-nav">Explore</button><button id="collection-nav">The collection <span>01</span></button><button id="about-nav">About the project ${icon("arrow")}</button></nav><div class="top-right"><span class="prototype"><i></i> RESEARCH PROTOTYPE</span><button class="icon-button" id="share" aria-label="Copy link to this view">${icon("link")}</button></div></header>
<main><section class="intro"><div><div class="eyebrow"><span></span> AN ATLAS OF INTERCONNECTED HISTORIES</div><h1>History doesn’t happen <em>in isolation.</em></h1><p>Follow the threads between events. Discover the perspectives that connect our world.</p></div><button class="primary" id="connect">${icon("graph")} Find a connection ${icon("arrow")}</button></section>
<section class="workspace" aria-label="Historical atlas"><aside class="filters"><div class="panel-heading"><span>${icon("filter")} Your lens</span><button class="text-button" id="clear">Reset</button></div><label class="searchbox">${icon("search")}<input id="search" type="search" placeholder="Search events…" aria-label="Search events"></label><div class="filter-section"><h2>REGIONS <span id="region-count">ALL</span></h2><div id="regions"></div></div><div class="filter-section"><h2>PERSPECTIVE</h2><select id="perspective" aria-label="Perspective"><option value="">All perspectives</option></select><p class="filter-hint">See the world through a different lens.</p></div><div class="filter-section"><h2>RELATIONSHIP</h2><select id="relationship" aria-label="Relationship type"><option value="">All connections</option></select></div><div class="filter-section period"><h2>TIME PERIOD</h2><div class="date-inputs"><input id="from" type="number" min="1" max="9999" aria-label="From year"><span>—</span><input id="to" type="number" min="1" max="9999" aria-label="To year"></div><div class="mini-timeline"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="lens-note">${icon("globe")}<p>One event. Many histories.<br><span>Every perspective adds a thread.</span></p></div></aside>
<div class="canvas-panel"><div class="canvas-toolbar"><div class="view-tabs"><button id="graph-view" class="active">${icon("graph")} Graph</button><button id="list-view">${icon("list")} List</button></div><span class="counts" id="counts">Loading atlas…</span><button class="icon-button mobile-filter" id="toggle-filters" aria-label="Toggle filters">${icon("filter")}</button></div><div class="graph-area" id="graph-area"><div class="collection-label"><span>FEATURED COLLECTION / 01</span><h2>Threads of independence</h2><p>Decolonization & the emerging Global South</p></div><svg id="graph" role="img" aria-label="Graph of historical events and their connections"></svg><div id="event-list" hidden></div><div id="empty" hidden><span>∅</span><h3>No events in this view</h3><p>Try a wider time period or reset your filters.</p><button class="secondary" id="empty-reset">Reset filters</button></div><div id="error" hidden></div><div class="graph-bottom"><span class="graph-hint">Drag to explore · Scroll to zoom · Select an event</span><div class="zoom-controls"><button id="zoom-out" aria-label="Zoom out">−</button><span id="zoom-level">100%</span><button id="zoom-in" aria-label="Zoom in">+</button><button id="fit" aria-label="Reset graph position">${icon("expand")}</button></div></div></div><div class="legend" id="legend"></div></div>
<aside class="detail" id="detail" aria-label="Selected event"></aside></section>
<footer><span><i class="live-dot"></i> Built for curiosity. Grounded in sources.</span><span>Musubi <span class="footer-jp">結び</span> <span class="footer-separator">/</span> A connection, a knot, a new understanding.</span><button id="methodology">Our approach ${icon("arrow")}</button></footer></main><div id="toast" role="status" aria-live="polite"></div><span id="live" class="sr-only" aria-live="polite"></span><dialog id="path-dialog"><div class="dialog-heading"><span class="eyebrow">FOLLOW A THREAD</span><button class="icon-button" id="close-path" aria-label="Close connection finder">${icon("close")}</button></div><h2>What connects them?</h2><p>Trace a path between two moments in history.</p><form id="path-form"><label>FROM<select id="path-from" required></select></label><div class="path-divider">↓</div><label>TO<select id="path-to" required></select></label><label>EXPLORE BY<select id="strategy"><option value="fewest_hops">Fewest connections</option><option value="highest_confidence">Confidence-weighted cost</option></select></label><p class="dialog-note">Uses your current filters and the visible graph. Connections are research interpretations, not proof of causality.</p><button class="primary" id="find-path">Find connection ${icon("arrow")}</button></form><div id="path-result" aria-live="polite"></div></dialog><dialog id="info-dialog"><button class="icon-button dialog-close" id="close-info" aria-label="Close information">${icon("close")}</button><div id="info-content"></div></dialog>`;
$("#graph").setAttribute("role", "group");
$(".filters").setAttribute("role", "region");
$(".filters").setAttribute("aria-label", "Research filters");
$("#detail").setAttribute("role", "region");
const titleCase = (s: string) =>
  s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
const region = (e: { region_ids: string[] }) =>
  meta.regions.find((r) => r.id === e.region_ids[0])!;
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error?.message || "Unable to load the atlas");
  return body;
}
function toast(message: string) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 3200);
}
function filters() {
  return {
    region_ids: state.regions,
    perspective_ids: state.perspective ? [state.perspective] : [],
    relationship_types: state.type ? [state.type] : [],
    from: state.from || null,
    to: state.to || null,
    q: state.q,
  };
}
function urlState() {
  const p = new URLSearchParams();
  if (selected) p.set("event", selected);
  if (state.regions.length) p.set("region", state.regions.join(","));
  if (state.perspective) p.set("perspective", state.perspective);
  if (state.type) p.set("relationship_type", state.type);
  if (state.from) p.set("from", state.from);
  if (state.to) p.set("to", state.to);
  if (state.q) p.set("q", state.q);
  history.replaceState(null, "", "?" + p);
  return p;
}
async function refresh() {
  const token = ++request;
  route = null;
  $("#path-result").innerHTML = "";
  $("#counts").textContent = "Updating atlas…";
  $("#error").hidden = true;
  urlState();
  const p = urlState();
  p.delete("event");
  try {
    const data = await api<Graph>("/api/v1/graph?" + p);
    if (token !== request) return;
    graph = data;
    $("#counts").textContent =
      `${data.nodes.length} events · ${data.edges.length} connections`;
    $("#live").textContent = $("#counts").textContent;
    $("#region-count").textContent = state.regions.length
      ? String(state.regions.length)
      : "ALL";
    $("#empty").hidden = !!data.nodes.length;
    draw();
    renderDetail();
    updatePathOptions();
    if (data.truncated)
      toast("Showing a sample. Refine your filters to see fewer events.");
  } catch (e) {
    if (token !== request) return;
    graph = { nodes: [], edges: [], truncated: false };
    draw();
    $("#detail").innerHTML = "";
    $("#counts").textContent = "Atlas unavailable";
    $("#error").hidden = false;
    $("#error").innerHTML =
      `<h3>We couldn’t load this view.</h3><p>${esc((e as Error).message)}</p><button class="secondary" id="retry">Try again</button>`;
    $("#retry").onclick = () => void refresh();
  }
}
function selectEvent(id: string) {
  selected = id;
  tab = "narratives";
  urlState();
  draw();
  renderDetail();
}
const graphView = new GraphView({
  select: selectEvent,
  region,
  read: () => {
    tab = "narratives";
    renderDetail();
    $("#detail").scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "nearest",
    });
    $("#detail").setAttribute("tabindex", "-1");
    $("#detail").focus();
  },
});
function draw() {
  const isList = mode === "list";
  $("#event-list").hidden = !isList;
  $("#graph").style.display = isList ? "none" : "block";
  $("#graph-view").classList.toggle("active", !isList);
  $("#list-view").classList.toggle("active", isList);
  $("#graph-area").classList.toggle("list-mode", isList);
  $("#event-list").innerHTML = graph.nodes
    .map(
      (e) =>
        `<button class="event-row ${e.id === selected ? "selected" : ""}" data-event="${e.id}"><span class="event-year">${e.date.start}</span><i style="background:${region(e).color}"></i><div><strong>${esc(e.title)}</strong><span>${esc(e.location)} · ${esc(region(e).label)}</span></div>${icon("arrow")}</button>`,
    )
    .join("");
  document
    .querySelectorAll<HTMLButtonElement>("[data-event]")
    .forEach((b) => (b.onclick = () => selectEvent(b.dataset.event!)));
  graphView.render(graph.nodes, graph.edges, selected, route);
}
function sourceLinks(ids: string[]) {
  return ids
    .map((id) => {
      const s = meta.sources.find((s) => s.id === id);
      return s
        ? `<a class="source-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${icon("book")} ${esc(s.title)} ↗</a>`
        : "";
    })
    .join("");
}
function renderDetail() {
  const e = graph.nodes.find((e) => e.id === selected);
  const panel = $("#detail");
  if (!e) {
    panel.innerHTML = `<div class="detail-placeholder">${icon("graph")}<h2>A world of connections.</h2><p>Select an event to discover its stories, sources and connections.</p></div>`;
    return;
  }
  const r = region(e);
  const narratives = e.narratives.filter(
    (n) => !state.perspective || n.perspective_id === state.perspective,
  );
  const connections = graph.edges.filter(
    (x) => x.source_event_id === e.id || x.target_event_id === e.id,
  );
  panel.innerHTML = `<div class="detail-top"><span>EVENT / ${String(all.findIndex((x) => x.id === e.id) + 1).padStart(2, "0")}</span><button class="icon-button" id="close-detail" aria-label="Close event details">${icon("close")}</button></div><div class="event-art" style="--event-color:${r.color}"><div class="art-orbit one"></div><div class="art-orbit two"></div><div class="art-orbit three"></div><span class="art-year">${e.date.start}</span><span class="art-caption">A MOMENT THAT CONNECTED WORLDS</span></div><div class="detail-body"><div class="region-pill" style="color:${r.color}"><i style="background:${r.color}"></i>${esc(r.label)}</div><h2>${esc(e.title)}</h2><div class="location">${icon("pin")} ${esc(e.location)}</div><p class="event-summary">${esc(e.summary)}</p><div class="detail-tabs"><button id="narratives-tab" class="${tab === "narratives" ? "active" : ""}">Perspectives <span>${narratives.length}</span></button><button id="connections-tab" class="${tab === "connections" ? "active" : ""}">Connections <span>${connections.length}</span></button></div><div class="detail-content">${
    tab === "narratives"
      ? `<p class="editorial-label">EDITORIAL SUMMARIES · ORIGINAL LANGUAGE</p>${narratives.map((n) => `<article class="narrative"><div><span>${esc(meta.perspectives.find((p) => p.id === n.perspective_id)?.label)}</span><span class="language">${esc(n.language.toUpperCase())}</span></div><p lang="${esc(n.language)}">${esc(n.text)}</p>${sourceLinks(n.source_ids)}</article>`).join("") || "<p>No narrative for this perspective.</p>"}`
      : connections
          .map((edge) => {
            const other = all.find(
              (x) =>
                x.id ===
                (edge.source_event_id === e.id
                  ? edge.target_event_id
                  : edge.source_event_id),
            )!;
            return `<article class="connection-card"><span class="eyebrow">${edge.source_event_id === e.id ? "OUTGOING" : "INCOMING"} · ${titleCase(edge.type)}</span><button data-other="${other.id}">${esc(other.title)} ${icon("arrow")}</button><p>${esc(edge.description)}</p><small>Confidence ${edge.confidence}/5</small>${sourceLinks(edge.source_ids)}</article>`;
          })
          .join("") || "<p>No connections in this view.</p>"
  }</div><button class="secondary detail-connect" id="connect-event">${icon("graph")} Find a connection from here ${icon("arrow")}</button></div>`;
  panel
    .querySelector(".event-summary")!
    .insertAdjacentHTML(
      "afterend",
      `<button class="secondary detail-focus" id="inspect-event">${icon("expand")} Zoom into this event</button>`,
    );
  $("#inspect-event").onclick = () => {
    mode = "graph";
    draw();
    graphView.focus(e.id);
    $("#graph-area").scrollIntoView({ block: "nearest" });
  };
  $("#close-detail").onclick = () => {
    selected = "";
    urlState();
    renderDetail();
    draw();
  };
  $("#narratives-tab").onclick = () => {
    tab = "narratives";
    renderDetail();
  };
  $("#connections-tab").onclick = () => {
    tab = "connections";
    renderDetail();
  };
  $("#connect-event").onclick = () => openPath(e.id);
  panel
    .querySelectorAll<HTMLButtonElement>("[data-other]")
    .forEach((b) => (b.onclick = () => selectEvent(b.dataset.other!)));
}
function updatePathOptions() {
  const options = graph.nodes
    .map(
      (e) =>
        `<option value="${e.id}">${esc(e.title)} (${e.date.start})</option>`,
    )
    .join("");
  $("#path-from").innerHTML = options;
  $("#path-to").innerHTML = options;
  if (graph.nodes.some((e) => e.id === "evt_bandung"))
    $<HTMLSelectElement>("#path-from").value = "evt_bandung";
  if (graph.nodes.length)
    $<HTMLSelectElement>("#path-to").value =
      graph.nodes.find((e) => e.id === "evt_g77")?.id || graph.nodes.at(-1)!.id;
  $<HTMLButtonElement>("#find-path").disabled = !graph.nodes.length;
}
function openPath(from?: string) {
  if (from) $<HTMLSelectElement>("#path-from").value = from;
  $<HTMLDialogElement>("#path-dialog").showModal();
}
$("#connect").onclick = () => openPath();
$("#close-path").onclick = () => $<HTMLDialogElement>("#path-dialog").close();
$("#path-form").onsubmit = async (event) => {
  event.preventDefault();
  const button = $<HTMLButtonElement>("#find-path");
  button.disabled = true;
  button.textContent = "Following the threads…";
  try {
    route = await api<Route>("/api/v1/paths", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_event_id: $<HTMLSelectElement>("#path-from").value,
        to_event_id: $<HTMLSelectElement>("#path-to").value,
        strategy: $<HTMLSelectElement>("#strategy").value,
        filters: filters(),
      }),
    });
    const result = $("#path-result");
    result.innerHTML = route.found
      ? `<div class="route-summary"><i class="live-dot"></i> Connection found <span>${route.relationships.length} steps · cost ${route.total_cost} · ${route.strategy === "fewest_hops" ? "unweighted shortest path" : "Dijkstra"}</span></div><ol class="route-steps">${route.events
          .map((id, i) => {
            const e = all.find((e) => e.id === id)!;
            const edge = graph.edges.find(
              (e) => e.id === route!.relationships[i],
            );
            return `<li><strong>${esc(e.title)}</strong><span>${e.date.start}</span>${edge ? `<p>${esc(edge.description)}</p>${sourceLinks(edge.source_ids)}` : ""}</li>`;
          })
          .join(
            "",
          )}</ol><button class="secondary" id="show-route">View on the graph ${icon("arrow")}</button>`
      : '<div class="no-route"><h3>No connection in this view</h3><p>Try swapping the events or widening your filters. Directed links can only be followed in their recorded direction.</p></div>';
    draw();
    if (route.found)
      $("#show-route").onclick = () => {
        mode = "graph";
        draw();
        $<HTMLDialogElement>("#path-dialog").close();
        toast("Route highlighted. Change a filter to clear it.");
      };
  } catch (e) {
    $("#path-result").textContent = (e as Error).message;
  } finally {
    button.disabled = false;
    button.innerHTML = `Find connection ${icon("arrow")}`;
  }
};
function reset() {
  Object.assign(state, {
    regions: [],
    perspective: "",
    type: "",
    from: "1947",
    to: "1967",
    q: "",
  });
  syncInputs();
  void refresh();
}
function syncInputs() {
  $<HTMLInputElement>("#search").value = state.q;
  $<HTMLInputElement>("#from").value = state.from;
  $<HTMLInputElement>("#to").value = state.to;
  $<HTMLSelectElement>("#perspective").value = state.perspective;
  $<HTMLSelectElement>("#relationship").value = state.type;
  document
    .querySelectorAll<HTMLInputElement>("[name=region]")
    .forEach((c) => (c.checked = state.regions.includes(c.value)));
}
$("#clear").onclick = reset;
$("#empty-reset").onclick = reset;
$("#graph-view").onclick = () => {
  mode = "graph";
  draw();
};
$("#list-view").onclick = () => {
  mode = "list";
  draw();
};
$("#zoom-in").onclick = () => graphView.scale(1.25);
$("#zoom-out").onclick = () => graphView.scale(0.8);
$("#fit").onclick = () => graphView.fit();
$("#toggle-filters").onclick = () =>
  $(".filters").classList.toggle("mobile-open");
let timer: ReturnType<typeof setTimeout>;
$("#search").oninput = () => {
  state.q = $<HTMLInputElement>("#search").value;
  clearTimeout(timer);
  timer = setTimeout(() => void refresh(), 250);
};
for (const id of ["from", "to"] as const)
  $("#" + id).onchange = () => {
    state[id] = $<HTMLInputElement>("#" + id).value;
    void refresh();
  };
$("#perspective").onchange = () => {
  state.perspective = $<HTMLSelectElement>("#perspective").value;
  void refresh();
};
$("#relationship").onchange = () => {
  state.type = $<HTMLSelectElement>("#relationship").value;
  void refresh();
};
$("#share").onclick = async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    toast("Link copied. Share this perspective.");
  } catch {
    toast("Copy the address from your browser to share this view.");
  }
};
function info(collection = false) {
  $("#info-content").innerHTML = collection
    ? `<span class="eyebrow">CURATED COLLECTION / 01</span><h2>Threads of independence</h2><p>Explore the emergence of new international forums through eight moments between 1947 and 1967.</p><p>Start at Bandung, follow the Non-Aligned Movement to the Group of 77, or compare the four language summaries of the conference.</p><p>Region colors describe research lenses. The location of each event is recorded separately.</p>`
    : `<span class="eyebrow">THE MUSUBI PROJECT</span><h2>History, connected.</h2><p>Musubi (結び) means a connection or a knot. This atlas makes room for the relationships and perspectives that a single timeline can leave out.</p><p>${esc(meta?.editorial_note || "A prototype for exploring historical relationships.")}</p><p>Confidence is an editorial score from 1 to 5. Weighted routes minimize the sum of 6 − confidence. A path is a research lead, not evidence of causation.</p><p>Prototype interface in English; narratives preserve their original language. No accounts, tracking or external runtime services.</p>`;
  $<HTMLDialogElement>("#info-dialog").showModal();
}
$("#about-nav").onclick = () => info();
$("#methodology").onclick = () => info();
$("#collection-nav").onclick = () => info(true);
$("#close-info").onclick = () => $<HTMLDialogElement>("#info-dialog").close();
$("#explore-nav").onclick = () =>
  $(".workspace").scrollIntoView({ behavior: "smooth" });
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    !document.querySelector("dialog[open]") &&
    selected
  ) {
    const old = selected;
    selected = "";
    urlState();
    draw();
    renderDetail();
    const event = all.find((x) => x.id === old);
    if (event)
      document
        .querySelector<SVGGElement>(
          `[aria-label="${CSS.escape(`${event.title}, ${event.date.start}, ${region(event).label}`)}"]`,
        )
        ?.focus();
  }
});
async function init() {
  try {
    meta = await api<Meta>("/api/v1/meta");
    all = (await api<{ items: Event[] }>("/api/v1/events?limit=200")).items;
    $("#regions").innerHTML = meta.regions
      .map(
        (r) =>
          `<label class="region-option"><input type="checkbox" name="region" value="${r.id}"><i style="background:${r.color}"></i><span>${esc(r.label)}</span><small>${all.filter((e) => e.region_ids.includes(r.id)).length}</small></label>`,
      )
      .join("");
    $("#legend").innerHTML = meta.regions
      .map(
        (r) =>
          `<span><i style="background:${r.color}"></i>${esc(r.label)}</span>`,
      )
      .join("");
    $("#perspective").insertAdjacentHTML(
      "beforeend",
      meta.perspectives
        .map((p) => `<option value="${p.id}">${esc(p.label)}</option>`)
        .join(""),
    );
    $("#relationship").insertAdjacentHTML(
      "beforeend",
      meta.relationship_types
        .map((t) => `<option value="${t}">${titleCase(t)}</option>`)
        .join(""),
    );
    document.querySelectorAll<HTMLInputElement>("[name=region]").forEach(
      (c) =>
        (c.onchange = () => {
          state.regions = Array.from(
            document.querySelectorAll<HTMLInputElement>(
              "[name=region]:checked",
            ),
          ).map((c) => c.value);
          void refresh();
        }),
    );
    syncInputs();
    await refresh();
  } catch (e) {
    $("#counts").textContent = "Dataset unavailable";
    $("#error").hidden = false;
    $("#error").innerHTML =
      `<h3>The atlas is unavailable</h3><p>${esc((e as Error).message)}</p><button class="secondary" id="reload">Try again</button>`;
    $("#reload").onclick = () => void init();
  }
}
void init();
