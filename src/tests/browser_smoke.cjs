// Isolated UI tests: all HTTP responses are intercepted; no imports reach Neo4j.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");

const sample = {
  id: "Q6534",
  title: "Revolução Francesa",
  summary: "Resumo de teste da Revolução Francesa.",
  language: "pt",
  revision_id: 123,
  retrieved_at: "2026-09-11T12:00:00Z",
  source_url: "https://pt.wikipedia.org/wiki/Revolução_Francesa",
  wikidata_url: "https://www.wikidata.org/wiki/Q6534",
  entities: [{ id: "Q142", name: "França" }],
  statements: [
    {
      id: "Q6534$place",
      target_id: "Q142",
      property: "P17",
      rank: "normal",
      value_json: '{"id":"Q142"}',
      qualifiers_json: "{}",
      references_json: "[]",
      source_url: "https://www.wikidata.org/wiki/Q6534#P17",
    },
    {
      id: "Q6534$date",
      property: "P580",
      rank: "normal",
      value_json: '{"time":"+1789-00-00T00:00:00Z","precision":9}',
      qualifiers_json: "{}",
      references_json: "[]",
      source_url: "https://www.wikidata.org/wiki/Q6534#P580",
    },
  ],
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error(error.message);
    });
    let imports = 0;
    await page.route("http://musubi.test/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/search") {
        const query = url.searchParams.get("q");
        const rows =
          query === "vazio"
            ? []
            : [{ page_id: 123, language: "pt", title: sample.title }];
        return route.fulfill({ json: rows });
      }
      if (url.pathname === "/events/import") {
        imports++;
        assert.deepEqual(route.request().postDataJSON(), {
          page_id: 123,
          language: "pt",
        });
        return route.fulfill({ json: sample });
      }
      if (url.pathname.startsWith("/events/"))
        return route.fulfill({ json: sample });
      const name =
        url.pathname === "/" ? "index.html" : path.basename(url.pathname);
      const body = await fs.readFile(path.join(__dirname, "../web", name));
      return route.fulfill({
        body,
        contentType: name.endsWith(".js")
          ? "text/javascript"
          : name.endsWith(".css")
            ? "text/css"
            : "text/html",
      });
    });
    await page.goto("http://musubi.test/");
    assert.equal(await page.locator("#empty-state").isVisible(), true);
    await page.screenshot({
      path: "/tmp/musubi-front-empty.png",
      fullPage: true,
    });
    await page.locator("#query").fill("vazio");
    await page.locator("#search-button").click();
    await page.getByText("Busca concluída sem resultados.").waitFor();
    await page.locator("#query").fill("Revolução Francesa");
    await page.locator("#search-button").click();
    await page.locator(".result-button").click();
    await page.locator("#event-content").waitFor();
    assert.equal(imports, 1);
    assert.equal(await page.locator(".connection").count(), 2);
    assert.equal(await page.locator("#empty-state").isVisible(), false);
    assert.equal(await page.locator("#graph").isVisible(), true);
    await page.locator('.node[data-index="0"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () => document.getElementById("detail-title").textContent === "França",
    );
    assert.equal(await page.locator("#detail-title").textContent(), "França");
    assert.match(
      await page.locator("#detail-content").textContent(),
      /não possui referências/,
    );
    const before = await page.locator("#graph-layer").getAttribute("transform");
    await page.locator("#zoom-in").click();
    assert.notEqual(
      await page.locator("#graph-layer").getAttribute("transform"),
      before,
    );
    await page.locator(".connection").nth(1).click();
    assert.equal(await page.locator("#detail-title").textContent(), "1789");
    await page.reload();
    await page.locator("#event-content").waitFor();
    assert.equal(imports, 1); // Reload reads saved event, never imports again.
    assert.equal(await page.locator(".recent-button").count(), 1);
    await page.screenshot({
      path: "/tmp/musubi-front-graph.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: "/tmp/musubi-front-mobile.png",
      fullPage: true,
    });
    await page.route("http://musubi.test/search?**", (route) =>
      route.fulfill({ status: 502, json: { detail: "Fonte indisponível" } }),
    );
    await page.locator("#query").fill("erro");
    await page.locator("#search-button").click();
    await page.getByText("Fonte indisponível", { exact: true }).waitFor();
    assert.equal(await page.locator("#search-button").isEnabled(), true);
    assert.equal(await page.locator("#event-content").isVisible(), true);
    assert.deepEqual(errors, []);
    console.log(
      "OK: busca vazia, importação, grafo, teclado, zoom, fontes, recentes, recarga, mobile e erro.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
