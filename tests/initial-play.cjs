const { launch } = require("./browser.cjs");
const fs = require("fs");
const assert = require("assert");
(async () => {
  fs.mkdirSync("artifacts", { recursive: true });
  const b = await launch();
  const page = await b.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const logs = [];
  const snap = () => page.evaluate(() => window.__game.snapshot());
  const shot = (n) => page.screenshot({ path: "artifacts/" + n + ".png" });
  const record = async (label) => {
    const s = await snap();
    logs.push({ label, ...s });
    fs.writeFileSync(
      "artifacts/play-log.json",
      JSON.stringify({ logs, errors }, null, 2),
    );
    return s;
  };
  await page.goto("http://127.0.0.1:8765");
  await shot("01-menu");
  await page.locator('[data-start="4"]').tap();
  await page.waitForTimeout(500);
  let first = await record("run1-first-level");
  assert.equal(first.state, "levelup");
  await shot("01-upgrade");
  await page.locator('[data-choice="0"]').tap();
  // Actual elapsed wall-time, keyboard movement, UI choices, dash. No state mutation.
  let direction = 0,
    paused = false;
  const directions = ["d", "s", "a", "w"];
  const started = Date.now();
  while (Date.now() - started < 85000) {
    let s = await snap();
    if (s.state === "levelup") {
      await page.keyboard.up(directions[direction % 4]);
      await page.locator('[data-choice="0"]').tap();
    } else if (s.state === "playing") {
      await page.keyboard.up(directions[direction % 4]);
      direction++;
      await page.keyboard.down(directions[direction % 4]);
      if (direction % 3 === 0) await page.keyboard.press("Space");
      if (s.time > 12 && !paused) {
        await page.keyboard.up(directions[direction % 4]);
        await page.locator("#pause").tap();
        let before = await snap();
        await page.waitForTimeout(500);
        assert.equal((await snap()).time, before.time);
        await shot("01-paused");
        await page.locator("[data-resume]").tap();
        paused = true;
      }
      if (s.time >= 62) break;
    } else break;
    await page.waitForTimeout(700);
  }
  await page.keyboard.up(directions[direction % 4]);
  let normal = await record("run1-end");
  await shot("01-play");
  assert(normal.time >= 60, "normal run must survive 60 seconds");
  // Novice: no movement or dash, choose upgrades only, wait until natural failure.
  await page.reload();
  await page.locator('[data-start="0"]').tap();
  const noviceStart = Date.now();
  while (Date.now() - noviceStart < 150000) {
    const s = await snap();
    if (s.state === "levelup") await page.locator('[data-choice="0"]').tap();
    if (s.state === "gameover") break;
    await page.waitForTimeout(400);
  }
  await record("run2-failure");
  await shot("02-failure");
  assert.equal((await snap()).state, "gameover");
  await page.locator("[data-restart]").tap();
  await record("run2-restart");
  await shot("02-restart");
  assert((await snap()).time < 2);
  await b.close();
  console.log("runs 1/2 complete, errors:", errors);
  assert.equal(errors.length, 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
