const { launch } = require("./browser.cjs");
const assert = require("assert"),
  fs = require("fs");
(async () => {
  const b = await launch(),
    page = await b.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8765");
  await page.locator('[data-start="2"]').tap();
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => __game.snapshot().state), "levelup");
  await page.locator('[data-choice="0"]').tap();
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, touches) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: touches });
  const joy = { x: 85, y: 753, id: 1, radiusX: 5, radiusY: 5, force: 1 },
    dash = { x: 321, y: 753, id: 2, radiusX: 5, radiusY: 5, force: 1 };
  const before = await page.evaluate(() => __game.snapshot());
  await touch("touchStart", [joy]);
  joy.x = 120;
  joy.y = 730;
  await touch("touchMove", [joy]);
  await page.waitForTimeout(350);
  await touch("touchStart", [joy, dash]);
  await page.waitForTimeout(150);
  await touch("touchEnd", [joy]);
  await page.waitForTimeout(200);
  const during = await page.evaluate(() => __game.snapshot());
  assert(during.player.x > before.player.x + 30);
  assert.equal(during.stats.dashes, 1);
  await page.screenshot({ path: "artifacts/04-multitouch.png" });
  await touch("touchEnd", []);
  await page.waitForTimeout(500);
  const release = await page.evaluate(() => __game.snapshot());
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => __game.snapshot());
  assert(
    Math.abs(release.player.x - after.player.x) < 1,
    "pointer release must stop movement",
  );
  await page.locator("#pause").tap();
  const frozen = await page.evaluate(() => __game.snapshot().time);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => __game.snapshot().time), frozen);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: "artifacts/04-landscape.png" });
  await page.locator("[data-resume]").tap();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "artifacts/04-landscape-play.png" });
  const small = await page
    .locator("button:visible")
    .evaluateAll((bs) =>
      bs
        .map((b) => ({
          text: b.textContent,
          width: b.getBoundingClientRect().width,
          height: b.getBoundingClientRect().height,
        }))
        .filter((b) => b.width < 44 || b.height < 44),
    );
  assert.deepEqual(small, []);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "artifacts/04-desktop.png" });
  const final = await page.evaluate(() => __game.snapshot());
  fs.writeFileSync(
    "artifacts/round4-log.json",
    JSON.stringify(
      { before, during, release, after, final, errors, touchTargets: small },
      null,
      2,
    ),
  );
  assert.equal(errors.length, 0);
  await b.close();
  console.log(
    "round4 PASS: multitouch, dash, release, pause, landscape, desktop, 44px targets",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
