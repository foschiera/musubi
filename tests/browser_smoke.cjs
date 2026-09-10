const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { AxeBuilder } = require("@axe-core/playwright");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  const errors = [];
  const externalRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:8080"))
      externalRequests.push(request.url());
  });
  await page.goto("http://127.0.0.1:8080");
  await page
    .locator("#counts")
    .filter({ hasText: "8 events · 9 connections" })
    .waitFor();
  await page
    .locator("#detail h2")
    .filter({ hasText: "The Bandung Conference" })
    .waitFor();
  assert.equal(await page.locator(".narrative").count(), 4);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  const accessibility = await new AxeBuilder({ page }).analyze();
  require("node:fs").writeFileSync(
    "test-results/accessibility.json",
    JSON.stringify(accessibility.violations, null, 2),
  );
  console.log(
    "Accessibility findings:",
    accessibility.violations
      .map((v) => `${v.id}: ${v.nodes.length}`)
      .join(", ") || "none",
  );
  assert.deepEqual(accessibility.violations, []);
  // Semantic zoom, neighborhood depth, force controls, and draggable pins.
  await page.locator('[data-node="evt_bandung"] .node-dot').dblclick();
  await page.locator("#zoom-card").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector("#zoom-level").textContent === "260%",
  );
  assert.equal(
    await page.locator("#graph").getAttribute("data-detail-level"),
    "detail",
  );
  assert.equal(await page.locator(".node.pinned").count(), 0);
  assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
  assert.ok(
    (await page.locator("#zoom-card").textContent()).includes("Twenty-nine"),
  );
  await page.mouse.move(10, 10);
  const dimmedOne = await page.locator(".node.faded").count();
  await page.locator("#focus-depth").selectOption("2");
  assert.ok((await page.locator(".node.faded").count()) < dimmedOne);
  await page.screenshot({
    path: "test-results/event-zoom.png",
    fullPage: true,
  });
  await page.locator("#read-zoom-event").click();
  assert.equal(
    await page.locator("#detail").evaluate((e) => e === document.activeElement),
    true,
  );
  await page.locator("#zoom-back").click();
  await page.locator("#zoom-card").waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.querySelector("#zoom-level").textContent === "100%",
  );
  for (let i = 0; i < 2; i++) await page.locator("#zoom-out").click();
  assert.equal(
    await page.locator("#graph").getAttribute("data-detail-level"),
    "overview",
  );
  await page.locator("#fit").click();
  await page.waitForFunction(
    () => document.querySelector("#zoom-level").textContent === "100%",
  );
  const dot = page.locator('[data-node="evt_india"] .node-dot');
  const bounds = await dot.boundingBox();
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(bounds.x + 75, bounds.y + 35, { steps: 8 });
  await page.mouse.up();
  assert.ok(
    (
      await page.locator('[data-node="evt_india"]').getAttribute("class")
    ).includes("pinned"),
  );
  await page.locator(".graph-settings summary").click();
  await page.locator("#show-labels").uncheck();
  assert.ok(
    (await page.locator("#graph").getAttribute("class")).includes("labels-off"),
  );
  await page.locator("#show-labels").check();
  await page.locator("#show-arrows").uncheck();
  assert.equal(await page.locator(".edge[marker-end]").count(), 0);
  await page.locator("#show-arrows").check();
  await page.locator("#relayout").click();
  assert.equal(await page.locator(".node.pinned").count(), 0);
  await page.locator(".graph-settings summary").click();
  await page.locator(".node").filter({ hasText: "India becomes" }).focus();
  await page.keyboard.press("Enter");
  await page
    .locator("#detail h2")
    .filter({ hasText: "India becomes independent" })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByText("A world of connections.", { exact: true }).waitFor();
  await page.locator("#connect").click();
  await page.locator("#find-path").click();
  await page.getByText("Connection found", { exact: false }).waitFor();
  assert.equal(await page.locator(".route-steps li").count(), 3);
  await page.locator("#show-route").click();
  await page.locator("#connect").click();
  await page.locator("#path-from").selectOption("evt_algiers");
  await page.locator("#path-to").selectOption("evt_india");
  await page.locator("#find-path").click();
  await page.getByText("No connection in this view", { exact: true }).waitFor();
  await page.locator("#close-path").click();
  await page.locator("input[value=africa]").check();
  await page
    .locator("#counts")
    .filter({ hasText: "3 events · 1 connections" })
    .waitFor();
  assert.ok(page.url().includes("region=africa"));
  await page.reload();
  await page
    .locator("#counts")
    .filter({ hasText: "3 events · 1 connections" })
    .waitFor();
  await page.locator("#clear").click();
  await page
    .locator("#counts")
    .filter({ hasText: "8 events · 9 connections" })
    .waitFor();
  await page.locator("#search").fill("not-a-historical-event");
  await page.getByText("No events in this view", { exact: true }).waitFor();
  await page.locator("#empty-reset").click();
  await page
    .locator("#counts")
    .filter({ hasText: "8 events · 9 connections" })
    .waitFor();
  await page.locator("#list-view").click();
  await page.locator("[data-event=evt_ghana]").click();
  await page.locator("#detail h2").filter({ hasText: "Ghana" }).waitFor();
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await mobile.goto("http://127.0.0.1:8080");
  await mobile
    .locator("#counts")
    .filter({ hasText: "8 events · 9 connections" })
    .waitFor();
  assert.equal(await mobile.locator("#event-list").isVisible(), true);
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await mobile.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await mobile.locator("#inspect-event").click();
  await mobile.locator("#zoom-card").waitFor({ state: "visible" });
  assert.equal(await mobile.locator("#graph").isVisible(), true);
  await mobile.locator("#zoom-back").click();
  await mobile.locator("#zoom-card").waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  await browser.close();
  console.log(
    "Browser smoke passed: graph, narratives, paths, no route, filters, URL, empty, list, mobile.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
