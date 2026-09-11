"use strict";
const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";
const labels = {
  P31: "Tipo de evento",
  P361: "Parte de",
  P710: "Participante",
  P276: "Local",
  P17: "País",
  P580: "Início",
  P582: "Fim",
  P585: "Data",
  P828: "Causa declarada",
  P1542: "Efeito declarado",
  P1344: "Participou de",
};
let current = null;
let busy = false;
let view = { x: 0, y: 0, zoom: 1 };
let drag = null;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function safeLink(url, title) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
      return element("span", title);
    const link = element("a", title + " ↗", "source-link");
    link.href = parsed.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  } catch {
    return element("span", title);
  }
}
function notice(message, error = false) {
  $("notice").textContent = message;
  $("notice").classList.toggle("error", error);
  $("notice").hidden = !message;
}
async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error(
      "Não foi possível conectar à API. Verifique se o serviço está em execução.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "O serviço retornou uma resposta inesperada. Tente novamente.",
    );
  }
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Não foi possível concluir a solicitação. Verifique os dados e tente novamente.",
    );
  return data;
}
function setBusy(value) {
  busy = value;
  document
    .querySelectorAll(
      "#search-form button, #search-form input, #search-form select, #results button, #recent button, .suggestions button",
    )
    .forEach((node) => (node.disabled = value));
  $("search-form").setAttribute("aria-busy", String(value));
}
async function search(event) {
  event?.preventDefault();
  if (busy || !$("search-form").reportValidity()) return;
  const query = $("query").value.trim();
  if (query.length < 2) {
    notice("Digite ao menos dois caracteres.", true);
    return;
  }
  const language = $("language").value;
  setBusy(true);
  notice("Consultando a Wikipédia…");
  $("results").replaceChildren();
  $("result-count").textContent = "…";
  $("search-hint").textContent = "Buscando artigos relacionados.";
  try {
    const rows = await request(
      `/search?${new URLSearchParams({ q: query, language })}`,
    );
    $("result-count").textContent = rows.length;
    $("search-hint").textContent = rows.length
      ? "Escolha o artigo para importar suas conexões."
      : "Nenhum artigo encontrado. Experimente outro nome ou idioma.";
    for (const row of rows) {
      const button = element("button", row.title, "result-button");
      button.type = "button";
      button.append(element("small", "IMPORTAR E EXPLORAR ↗"));
      button.addEventListener("click", () => importEvent(row));
      $("results").append(button);
    }
    notice(
      rows.length
        ? `${rows.length} artigos encontrados. Selecione o evento que deseja estudar.`
        : "Busca concluída sem resultados.",
    );
  } catch (error) {
    $("result-count").textContent = "—";
    $("search-hint").textContent =
      "A busca falhou. Você pode tentar novamente.";
    notice(error.message, true);
  } finally {
    setBusy(false);
  }
}
async function importEvent(row) {
  if (busy) return;
  setBusy(true);
  notice(
    `Reunindo informações sobre “${row.title}” e salvando no grafo. Isso pode levar alguns instantes…`,
  );
  try {
    const data = await request("/events/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_id: row.page_id, language: row.language }),
    });
    renderEvent(data);
    remember(data);
    notice(
      "Evento importado. Selecione uma conexão para investigar suas fontes.",
    );
  } catch (error) {
    notice(error.message, true);
  } finally {
    setBusy(false);
  }
}
function readRecent() {
  try {
    const rows = JSON.parse(localStorage.getItem("musubi.recent") || "[]");
    return Array.isArray(rows)
      ? rows
          .filter(
            (row) => /^Q\d+$/.test(row.id) && typeof row.title === "string",
          )
          .slice(0, 8)
      : [];
  } catch {
    return [];
  }
}
function remember(data) {
  const rows = [
    { id: data.id, title: data.title },
    ...readRecent().filter((row) => row.id !== data.id),
  ].slice(0, 8);
  try {
    localStorage.setItem("musubi.recent", JSON.stringify(rows));
  } catch {
    /* Local history is optional. */
  }
  renderRecent();
}
function renderRecent() {
  const rows = readRecent();
  $("recent").replaceChildren();
  if (!rows.length)
    $("recent").append(
      element("p", "Seus eventos importados aparecerão aqui.", "muted"),
    );
  for (const row of rows) {
    const button = element("button", row.title + " ↗", "recent-button");
    button.disabled = busy;
    button.addEventListener("click", () => loadEvent(row.id));
    $("recent").append(button);
  }
}
async function loadEvent(id) {
  if (busy) return;
  setBusy(true);
  notice("Abrindo evento salvo…");
  try {
    renderEvent(await request(`/events/${encodeURIComponent(id)}`));
    notice("Evento carregado do banco de dados.");
  } catch (error) {
    notice(error.message, true);
  } finally {
    setBusy(false);
  }
}
function json(value, fallback = {}) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function statementValue(statement) {
  if (statement.target_id)
    return (
      current.entities.find((item) => item.id === statement.target_id)?.name ||
      statement.target_id
    );
  const value = json(statement.value_json);
  if (!value.time) return "Valor não disponível";
  const match = value.time.match(/^([+-])(\d+)-(\d+)-(\d+)/);
  if (!match) return value.time;
  const [, sign, year, month, day] = match;
  let result = String(Number(year));
  if (value.precision >= 10 && month !== "00") result = `${month}/${result}`;
  if (value.precision >= 11 && day !== "00") result = `${day}/${result}`;
  if (value.precision < 9) result = `c. ${result} (precisão reduzida)`;
  return result + (sign === "-" ? " a.C." : "");
}
function renderEvent(data) {
  current = data;
  history.replaceState(null, "", `/#${encodeURIComponent(data.id)}`);
  $("event-title").textContent = data.title;
  $("event-tag").textContent = data.id;
  $("empty-state").hidden = true;
  $("graph").removeAttribute("hidden");
  $("graph-controls").hidden = false;
  $("event-content").hidden = false;
  $("event-summary").textContent =
    data.summary || "A fonte não disponibilizou um resumo para este artigo.";
  $("source-links").replaceChildren(
    safeLink(data.source_url, "Artigo na Wikipédia"),
    safeLink(data.wikidata_url, "Item no Wikidata"),
  );
  const retrieved = new Date(data.retrieved_at);
  $("attribution").textContent =
    `Wikipédia · CC BY-SA · revisão ${data.revision_id ?? "não informada"}. Wikidata · CC0. Consultado em ${Number.isNaN(retrieved.valueOf()) ? "data não informada" : retrieved.toLocaleString("pt-BR")}.`;
  $("detail-title").textContent = "Selecione uma conexão";
  $("detail-content").replaceChildren(
    element(
      "p",
      "Clique em um nó do grafo ou em uma relação abaixo para consultar seus detalhes.",
    ),
  );
  $("connection-count").textContent = `${data.statements.length} RELAÇÕES`;
  $("connections-list").replaceChildren();
  data.statements.forEach((statement, index) => {
    const button = element("button", undefined, "connection");
    const text = element("span", statementValue(statement));
    text.prepend(
      element("small", labels[statement.property] || statement.predicate),
    );
    button.append(text, element("span", "↗"));
    button.addEventListener("click", () => selectStatement(index));
    $("connections-list").append(button);
  });
  if (!data.statements.length)
    $("connections-list").append(
      element(
        "p",
        "Nenhuma relação das propriedades suportadas foi encontrada. O resumo e as fontes continuam disponíveis.",
      ),
    );
  drawGraph();
}
function selectStatement(index) {
  const statement = current.statements[index];
  $("detail-title").textContent = statementValue(statement);
  const content = $("detail-content");
  content.replaceChildren();
  content.append(
    element(
      "p",
      `${labels[statement.property] || statement.predicate} · ${statement.property}`,
    ),
  );
  content.append(
    element(
      "p",
      `Classificação na fonte: ${statement.rank === "preferred" ? "preferencial" : "normal"}.`,
    ),
  );
  content.append(safeLink(statement.source_url, "Ver declaração no Wikidata"));
  if (statement.target_id)
    content.append(
      safeLink(
        `https://www.wikidata.org/wiki/${statement.target_id}`,
        "Consultar entidade",
      ),
    );
  const references = json(statement.references_json, []);
  content.append(
    element(
      "p",
      references.length
        ? `${references.length} referência(s) registrada(s) na declaração.`
        : "Esta declaração não possui referências registradas no Wikidata.",
    ),
  );
  const seen = new Set();
  for (const ref of references)
    for (const snak of ref.snaks?.P854 || []) {
      const url = snak.datavalue?.value;
      if (typeof url === "string" && !seen.has(url)) {
        content.append(safeLink(url, "Abrir referência"));
        seen.add(url);
      }
    }
  for (const [title, value] of [
    ["Valor original (inclui precisão e calendário)", statement.value_json],
    ["Qualificadores da declaração", statement.qualifiers_json],
    ["Referências completas", statement.references_json],
  ]) {
    const details = element("details");
    details.append(
      element("summary", title),
      element("pre", JSON.stringify(json(value), null, 2)),
    );
    content.append(details);
  }
  document
    .querySelectorAll(".connection")
    .forEach((button, i) => button.classList.toggle("selected", i === index));
  document
    .querySelectorAll(".node[data-index]")
    .forEach((node) =>
      node.setAttribute(
        "aria-pressed",
        String(Number(node.dataset.index) === index),
      ),
    );
}
function svg(tag, attrs, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
function drawGraph() {
  const layer = $("graph-layer");
  layer.replaceChildren();
  const mobile = matchMedia("(max-width: 740px)").matches;
  $("graph").setAttribute("viewBox", mobile ? "250 0 500 650" : "0 0 1000 650");
  // Bound the visual overview; the complete list remains available below.
  const statements = current.statements.slice(0, 24);
  $("graph-count").textContent =
    `${statements.length} de ${current.statements.length} relações`;
  $("graph-help").textContent =
    "Arraste para mover · selecione um nó · use +/− para ampliar";
  statements.forEach((statement, index) => {
    const angle = (index / statements.length) * Math.PI * 2 - Math.PI / 2;
    const ring = statements.length > 12 && index % 2 ? 1.35 : 1;
    const x = 500 + Math.cos(angle) * (mobile ? 150 : 320) * ring;
    const y = 325 + Math.sin(angle) * 220 * ring;
    layer.append(
      svg("line", { x1: 500, y1: 325, x2: x, y2: y, class: "edge" }),
    );
    if (statements.length <= 12)
      layer.append(
        svg(
          "text",
          {
            x: (500 + x) / 2,
            y: (325 + y) / 2 - 8,
            "text-anchor": "middle",
            class: "edge-label",
          },
          labels[statement.property] || statement.property,
        ),
      );
    const value = statementValue(statement);
    const node = svg("g", {
      class: "node",
      transform: `translate(${x} ${y})`,
      tabindex: 0,
      role: "button",
      "aria-label": `${labels[statement.property] || statement.property}: ${value}`,
      "aria-pressed": "false",
      "data-index": index,
    });
    node.append(svg("title", {}, value));
    node.append(
      svg("circle", {
        r: 22,
        fill: statement.target_id ? "#dce7d4" : "#ecd8c6",
        stroke: statement.target_id ? "#a0b694" : "#bf9577",
      }),
    );
    node.append(
      svg(
        "text",
        { y: 5, "text-anchor": "middle", fill: "#4c6543", "font-size": 14 },
        statement.target_id ? "◦" : "◷",
      ),
    );
    node.append(
      svg(
        "text",
        { y: 42, "text-anchor": "middle", fill: "#374e37", "font-size": 12 },
        value.length > 31 ? value.slice(0, 28) + "…" : value,
      ),
    );
    node.addEventListener("click", () => selectStatement(index));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectStatement(index);
      }
    });
    layer.append(node);
  });
  const center = svg("g", { class: "node", transform: "translate(500 325)" });
  center.append(svg("circle", { r: 62, fill: "#294c40", stroke: "#9aaf89" }));
  center.append(
    svg(
      "text",
      { y: -4, "text-anchor": "middle", fill: "#d6e7b2", "font-size": 11 },
      "EVENTO",
    ),
  );
  center.append(
    svg(
      "text",
      { y: 17, "text-anchor": "middle", fill: "#f5f6e9", "font-size": 13 },
      current.id,
    ),
  );
  center.append(svg("title", {}, current.title));
  layer.append(center);
  resetView();
}
function transform() {
  $("graph-layer").setAttribute(
    "transform",
    `translate(${view.x} ${view.y}) translate(500 325) scale(${view.zoom}) translate(-500 -325)`,
  );
}
function resetView() {
  view = { x: 0, y: 0, zoom: current?.statements.length > 12 ? 0.8 : 1 };
  transform();
}
function zoom(factor) {
  view.zoom = Math.max(0.35, Math.min(3, view.zoom * factor));
  transform();
}
function point(event) {
  const p = $("graph").createSVGPoint();
  p.x = event.clientX;
  p.y = event.clientY;
  return p.matrixTransform($("graph").getScreenCTM().inverse());
}
$("graph").addEventListener("pointerdown", (event) => {
  if (event.target.closest(".node") || event.button !== 0) return;
  drag = { point: point(event), x: view.x, y: view.y };
  $("graph").setPointerCapture(event.pointerId);
});
$("graph").addEventListener("pointermove", (event) => {
  if (!drag) return;
  const p = point(event);
  view.x = drag.x + p.x - drag.point.x;
  view.y = drag.y + p.y - drag.point.y;
  transform();
});
for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
  $("graph").addEventListener(name, () => (drag = null));
$("zoom-in").addEventListener("click", () => zoom(1.2));
$("zoom-out").addEventListener("click", () => zoom(1 / 1.2));
$("reset-view").addEventListener("click", resetView);
$("search-form").addEventListener("submit", search);
document.querySelectorAll("[data-query]").forEach((button) =>
  button.addEventListener("click", () => {
    $("query").value = button.dataset.query;
    search();
  }),
);
renderRecent();
matchMedia("(max-width: 740px)").addEventListener("change", () => {
  if (current) drawGraph();
});
if (/^#Q\d+$/.test(location.hash)) loadEvent(location.hash.slice(1));
