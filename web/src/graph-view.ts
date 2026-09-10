import * as d3 from "d3";

export type GraphEvent = {
  id: string;
  title: string;
  date: { start: string };
  summary: string;
  location: string;
  region_ids: string[];
  narratives: { language: string; text: string }[];
  source_ids: string[];
  layout: { x: number; y: number };
};
type Link = {
  id: string;
  source_event_id: string;
  target_event_id: string;
  type: string;
  directed: boolean;
  confidence: number;
  description: string;
};
type Node = d3.SimulationNodeDatum & {
  id: string;
  event: GraphEvent;
  degree: number;
  color: string;
};
type ForceLink = d3.SimulationLinkDatum<Node> & { edge: Link };
type Options = {
  select: (id: string) => void;
  read: () => void;
  region: (event: GraphEvent) => { label: string; color: string };
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export class GraphView {
  private svg = d3.select<SVGSVGElement, unknown>("#graph");
  private world = this.svg.append("g").attr("class", "world");
  private edgesLayer = this.world.append("g").attr("class", "edges-layer");
  private nodesLayer = this.world.append("g").attr("class", "nodes-layer");
  private nodes: Node[] = [];
  private links: ForceLink[] = [];
  private positions = new Map<string, Node>();
  private simulation = d3.forceSimulation<Node>().stop();
  private signature = "";
  private selected = "";
  private focused = "";
  private depth = 1;
  private hover = "";
  private route: { events: string[]; relationships: string[] } | null = null;
  private transform = d3.zoomIdentity;
  private beforeFocus = d3.zoomIdentity;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private showLabels = true;
  private showArrows = true;
  private zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .extent([
      [0, 0],
      [1180, 750],
    ])
    .scaleExtent([0.25, 5])
    .on("zoom", (event) => {
      this.transform = event.transform;
      this.world.attr("transform", this.transform.toString());
      document.querySelector("#zoom-level")!.textContent =
        Math.round(this.transform.k * 100) + "%";
      this.detailLevel();
    });

  constructor(private options: Options) {
    this.svg
      .attr("viewBox", "0 0 1180 750")
      .attr("tabindex", 0)
      .attr(
        "aria-label",
        "Interactive event graph. Arrow keys pan, plus and minus zoom, Enter selects a node, F focuses it, Escape returns to overview.",
      )
      .call(this.zoom)
      .on("dblclick.zoom", null);
    this.svg
      .insert("defs", ":first-child")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 17)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", "#858199");
    document.querySelector(".graph-area")!.insertAdjacentHTML(
      "beforeend",
      `
      <div class="graph-context"><button id="all-events" class="active">All events</button><span>/</span><button id="focus-event">Focus event</button><select id="focus-depth" aria-label="Neighborhood depth" hidden><option value="1">1 connection deep</option><option value="2">2 connections deep</option></select></div>
      <div class="zoom-detail-badge" id="zoom-detail-badge">Explore · event labels</div>
      <details class="graph-settings"><summary aria-label="Graph display and forces">⚙ <span>Graph settings</span></summary><div class="settings-body"><h3>DISPLAY</h3><label><input id="show-labels" type="checkbox" checked> Event labels</label><label><input id="show-arrows" type="checkbox" checked> Direction arrows</label><h3>FORCES</h3><label for="repulsion">Node repulsion</label><input id="repulsion" type="range" min="300" max="2200" value="1000"><label for="link-distance">Connection distance</label><input id="link-distance" type="range" min="80" max="280" value="170"><button id="relayout" class="secondary">Reset layout & unpin nodes</button><p>Drag a node to pin its position. Double-click it, or press F, to zoom in.</p></div></details>
      <article id="zoom-card" class="zoom-card" aria-label="Event detail at current zoom" hidden></article>`,
    );
    document
      .querySelector("#focus-event")!
      .addEventListener("click", () => this.focus(this.selected));
    document
      .querySelector("#all-events")!
      .addEventListener("click", () => this.overview());
    document
      .querySelector("#focus-depth")!
      .addEventListener("change", (event) => {
        this.depth = Number((event.target as HTMLSelectElement).value);
        this.highlight();
      });
    document
      .querySelector("#show-labels")!
      .addEventListener("change", (event) => {
        this.showLabels = (event.target as HTMLInputElement).checked;
        this.detailLevel();
      });
    document
      .querySelector("#show-arrows")!
      .addEventListener("change", (event) => {
        this.showArrows = (event.target as HTMLInputElement).checked;
        this.edgesLayer
          .selectAll<SVGLineElement, ForceLink>("line")
          .attr("marker-end", (d) =>
            d.edge.directed && this.showArrows ? "url(#arrowhead)" : null,
          );
      });
    for (const id of ["repulsion", "link-distance"])
      document
        .querySelector("#" + id)!
        .addEventListener("input", () => this.forces());
    document.querySelector("#relayout")!.addEventListener("click", () => {
      for (const node of this.nodes) {
        node.fx = null;
        node.fy = null;
      }
      (document.querySelector("#repulsion") as HTMLInputElement).value = "1000";
      (document.querySelector("#link-distance") as HTMLInputElement).value =
        "170";
      this.forces();
      this.nodesLayer.selectAll(".node").classed("pinned", false);
    });
    this.svg.on("keydown.camera", (event: KeyboardEvent) => {
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        this.scale(1.25);
      }
      if (event.key === "-") {
        event.preventDefault();
        this.scale(0.8);
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        this.focus(this.selected);
      }
      const offset = event.shiftKey ? 100 : 35;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [offset, 0],
        ArrowRight: [-offset, 0],
        ArrowUp: [0, offset],
        ArrowDown: [0, -offset],
      };
      if (moves[event.key]) {
        event.preventDefault();
        const [x, y] = moves[event.key];
        this.svg.call(
          this.zoom.translateBy,
          x / this.transform.k,
          y / this.transform.k,
        );
      }
      if (event.key === "Escape" && (this.focused || this.transform.k >= 2.2)) {
        event.preventDefault();
        event.stopPropagation();
        this.overview();
      }
    });
  }

  render(
    events: GraphEvent[],
    edges: Link[],
    selected: string,
    route: typeof this.route,
  ) {
    const signature = JSON.stringify([
      events.map((e) => e.id),
      edges.map((e) => e.id),
    ]);
    this.selected = selected;
    this.route = route?.events.length ? route : null;
    if (this.focused && selected && events.some((e) => e.id === selected))
      this.focused = selected;
    if (this.focused && !selected) this.overview();
    if (this.focused && !events.some((e) => e.id === this.focused)) {
      this.focused = "";
      this.svg.call(this.zoom.transform, d3.zoomIdentity);
    }
    if (signature !== this.signature) {
      this.signature = signature;
      this.simulation.stop();
      this.nodes = events.map((event) => {
        const old = this.positions.get(event.id);
        const n: Node = {
          ...old,
          id: event.id,
          event,
          degree: edges.filter(
            (e) =>
              e.source_event_id === event.id || e.target_event_id === event.id,
          ).length,
          color: this.options.region(event).color,
          x: old?.x ?? event.layout.x,
          y: old?.y ?? event.layout.y,
        };
        this.positions.set(n.id, n);
        return n;
      });
      this.links = edges.map((edge) => ({
        source: edge.source_event_id,
        target: edge.target_event_id,
        edge,
      }));
      this.simulation
        .nodes(this.nodes)
        .force(
          "link",
          d3
            .forceLink<Node, ForceLink>(this.links)
            .id((n) => n.id)
            .distance(170)
            .strength(0.35),
        )
        .force("charge", d3.forceManyBody().strength(-1000))
        .force("collision", d3.forceCollide<Node>().radius(65))
        .force("x", d3.forceX<Node>(590).strength(0.035))
        .force("y", d3.forceY<Node>(405).strength(0.055));
      this.simulation.alpha(1).stop().tick(180);
    }
    const lines = this.edgesLayer
      .selectAll<SVGLineElement, ForceLink>("line")
      .data(this.links, (d) => d.edge.id)
      .join("line")
      .attr("class", "edge")
      .attr("data-edge", (d) => d.edge.id)
      .attr("marker-end", (d) =>
        d.edge.directed && this.showArrows ? "url(#arrowhead)" : null,
      );
    lines.selectAll("title").remove();
    lines
      .append("title")
      .text(
        (d) =>
          `${d.edge.type.replaceAll("_", " ")} · confidence ${d.edge.confidence}/5\n${d.edge.description}`,
      );
    const nodes = this.nodesLayer
      .selectAll<SVGGElement, Node>("g.node")
      .data(this.nodes, (d) => d.id)
      .join((enter) => {
        const g = enter
          .append("g")
          .attr("class", "node")
          .attr("role", "button")
          .attr("tabindex", 0);
        g.append("circle")
          .attr("class", "node-hit")
          .attr("r", 24)
          .attr("fill", "transparent");
        g.append("circle").attr("class", "node-halo");
        g.append("circle").attr("class", "node-dot");
        g.append("text")
          .attr("class", "node-title")
          .attr("text-anchor", "middle");
        g.append("text")
          .attr("class", "node-year")
          .attr("text-anchor", "middle");
        g.append("title");
        return g;
      })
      .attr("data-node", (d) => d.id)
      .attr(
        "aria-label",
        (d) =>
          `${d.event.title}, ${d.event.date.start}, ${this.options.region(d.event).label}`,
      )
      .classed("selected", (d) => d.id === selected)
      .classed("pinned", (d) => d.fx != null)
      .on("click", (_event, d) => this.options.select(d.id))
      .on("dblclick", (event, d) => {
        event.preventDefault();
        event.stopPropagation();
        this.focus(d.id);
      })
      .on("mouseenter", (_event, d) => {
        this.hover = d.id;
        this.highlight();
      })
      .on("mouseleave", () => {
        this.hover = "";
        this.highlight();
      })
      .on("keydown", (event: KeyboardEvent, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.options.select(d.id);
        }
        if (event.key.toLowerCase() === "f") {
          event.preventDefault();
          event.stopPropagation();
          this.focus(d.id);
        }
      });
    nodes
      .select(".node-dot")
      .attr("r", (d) => 5 + Math.sqrt(d.degree) * 2)
      .attr("fill", (d) => d.color);
    nodes
      .select(".node-halo")
      .attr("r", (d) => 13 + Math.sqrt(d.degree) * 2)
      .attr("stroke", (d) => d.color);
    nodes
      .select(".node-title")
      .attr("y", (d) => 26 + Math.sqrt(d.degree) * 2)
      .text((d) => d.event.title);
    nodes
      .select(".node-year")
      .attr("y", (d) => 43 + Math.sqrt(d.degree) * 2)
      .text(
        (d) => `${d.event.date.start} · ${this.options.region(d.event).label}`,
      );
    nodes
      .select("title")
      .text(
        (d) =>
          `${d.event.summary}\n${d.degree} connections · Double-click to focus`,
      );
    nodes.call(
      d3
        .drag<SVGGElement, Node>()
        .container(() => this.world.node()!)
        .on("start", (event) => {
          event.sourceEvent.stopPropagation();
        })
        .on("drag", (event, d) => {
          d.fx = d.x = event.x;
          d.fy = d.y = event.y;
          this.tick();
        })
        .on("end", (_event, d) => {
          nodes.filter((n) => n.id === d.id).classed("pinned", d.fx != null);
        }),
    );
    this.simulation.on("tick", () => this.tick());
    this.tick();
    this.highlight();
    this.detailLevel();
    (document.querySelector("#focus-event") as HTMLButtonElement).disabled =
      !events.some((e) => e.id === selected);
  }

  private tick() {
    this.edgesLayer
      .selectAll<SVGLineElement, ForceLink>("line")
      .attr("x1", (d) => (d.source as Node).x!)
      .attr("y1", (d) => (d.source as Node).y!)
      .attr("x2", (d) => (d.target as Node).x!)
      .attr("y2", (d) => (d.target as Node).y!);
    this.nodesLayer
      .selectAll<SVGGElement, Node>(".node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`);
  }
  private neighborhood(id: string, depth: number) {
    const ids = new Set([id]);
    for (let i = 0; i < depth; i++) {
      const frontier = new Set(ids);
      for (const { edge } of this.links) {
        if (frontier.has(edge.source_event_id)) ids.add(edge.target_event_id);
        if (frontier.has(edge.target_event_id)) ids.add(edge.source_event_id);
      }
    }
    return ids;
  }
  private highlight() {
    const center = this.hover || this.focused;
    const local = center
      ? this.neighborhood(center, this.hover ? 1 : this.depth)
      : null;
    this.nodesLayer
      .selectAll<SVGGElement, Node>(".node")
      .classed(
        "faded",
        (d) =>
          !!(local && !local.has(d.id)) ||
          !!(this.route && !this.route.events.includes(d.id)),
      )
      .classed("neighbor", (d) => !!local?.has(d.id));
    this.edgesLayer
      .selectAll<SVGLineElement, ForceLink>("line")
      .classed("linked", (d) =>
        this.route
          ? this.route.relationships.includes(d.edge.id)
          : !!(
              local &&
              local.has(d.edge.source_event_id) &&
              local.has(d.edge.target_event_id)
            ),
      )
      .classed(
        "faded",
        (d) =>
          !!(
            local &&
            (!local.has(d.edge.source_event_id) ||
              !local.has(d.edge.target_event_id))
          ) || !!(this.route && !this.route.relationships.includes(d.edge.id)),
      );
    document
      .querySelector("#all-events")!
      .classList.toggle("active", !this.focused);
    document
      .querySelector("#focus-event")!
      .classList.toggle("active", !!this.focused);
    (document.querySelector("#focus-depth") as HTMLElement).hidden =
      !this.focused;
  }
  private detailLevel() {
    const k = this.transform.k;
    const level = k < 0.7 ? "overview" : k < 2.2 ? "explore" : "detail";
    this.svg
      .attr("data-detail-level", level)
      .classed("labels-off", !this.showLabels);
    document.querySelector("#zoom-detail-badge")!.textContent =
      level === "overview"
        ? "Overview · connections"
        : level === "explore"
          ? "Explore · event labels"
          : "Detail · stories & sources";
    const card = document.querySelector<HTMLElement>("#zoom-card")!;
    const node = this.nodes.find((n) => n.id === this.selected);
    card.hidden = level !== "detail" || !node;
    if (!card.hidden && node) {
      const event = node.event;
      card.innerHTML = `<div class="eyebrow">${escape(event.date.start)} · ${escape(this.options.region(event).label)}</div><h3>${escape(event.title)}</h3><p>${escape(event.summary)}</p><div class="zoom-card-meta">${node.degree} connections · ${event.narratives.length} narratives · ${event.source_ids.length} event sources</div><button id="read-zoom-event" class="primary">Read perspectives & sources →</button><button id="zoom-back" class="text-button">← Back to the wider graph</button>`;
      card
        .querySelector("#read-zoom-event")!
        .addEventListener("click", () => this.options.read());
      card
        .querySelector("#zoom-back")!
        .addEventListener("click", () => this.overview());
    }
  }
  private camera(transform: d3.ZoomTransform) {
    this.svg.interrupt();
    if (this.reduced) this.svg.call(this.zoom.transform, transform);
    else
      this.svg.transition().duration(420).call(this.zoom.transform, transform);
  }
  focus(id: string) {
    const node = this.nodes.find((n) => n.id === id);
    if (!node) return;
    if (!this.focused) this.beforeFocus = this.transform;
    this.focused = id;
    this.options.select(id);
    this.camera(
      d3.zoomIdentity
        .translate(420, 360)
        .scale(2.6)
        .translate(-node.x!, -node.y!),
    );
    this.highlight();
    document.querySelector("#live")!.textContent =
      `Focused on ${node.event.title}. Showing its neighborhood; distant events are dimmed.`;
  }
  overview() {
    this.focused = "";
    this.hover = "";
    this.camera(this.beforeFocus.k < 2.2 ? this.beforeFocus : d3.zoomIdentity);
    this.highlight();
  }
  fit() {
    this.focused = "";
    this.hover = "";
    this.beforeFocus = d3.zoomIdentity;
    this.camera(d3.zoomIdentity);
    this.highlight();
  }
  scale(factor: number) {
    this.svg.interrupt();
    this.svg.call(this.zoom.scaleBy, factor);
  }
  private forces() {
    const repel = Number(
      (document.querySelector("#repulsion") as HTMLInputElement).value,
    );
    const distance = Number(
      (document.querySelector("#link-distance") as HTMLInputElement).value,
    );
    this.simulation.force("charge", d3.forceManyBody().strength(-repel));
    (this.simulation.force("link") as d3.ForceLink<Node, ForceLink>).distance(
      distance,
    );
    if (this.reduced) {
      this.simulation.alpha(0.7).stop().tick(120);
      this.tick();
    } else this.simulation.alpha(0.7).restart();
  }
}
