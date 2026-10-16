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
  await shot("02-menu");
  await page.locator('[data-start="1"]').tap();
  await page.waitForTimeout(500);
  assert.equal((await snap()).state, "levelup");
  await shot("02-upgrade");
  await page.locator('[data-choice="0"]').tap();
  // Actual wall-clock simulation; wide kiting, not state manipulation.
  let current = "",
    paused = false,
    lastDash = -5;
  const directions = ["d", "s", "a", "w"];
  const started = Date.now();
  const samples = [];
  while (Date.now() - started < 100000) {
    let s = await snap();
    samples.push({ time: s.time, fps: s.fps, hp: s.player.hp, state: s.state });
    if (s.state === "levelup") {
      await page.keyboard.up(current || "d");
      current = "";
      await page.locator('[data-choice="0"]').tap();
    } else if (s.state === "playing") {
      const wanted = directions[Math.floor(s.time / 7) % 4];
      if (wanted !== current) {
        if (current) await page.keyboard.up(current);
        current = wanted;
        await page.keyboard.down(current);
      }
      if (s.time - lastDash > 3.1) {
        await page.keyboard.press("Space");
        lastDash = s.time;
      }
      if (s.time > 12 && !paused) {
        await page.keyboard.up(current);
        current = "";
        await page.locator("#pause").tap();
        let before = await snap();
        await page.waitForTimeout(500);
        assert.equal((await snap()).time, before.time);
        await shot("02-paused");
        await page.locator("[data-resume]").tap();
        paused = true;
      }
      if (s.time >= 62) break;
    } else break;
    await page.waitForTimeout(300);
  }
  if (current) await page.keyboard.up(current);
  let normal = await record("round2-normal-end");
  await shot("02-play");
  fs.writeFileSync(
    "artifacts/fps-samples.json",
    JSON.stringify(samples, null, 2),
  );
  assert(normal.time >= 60, "normal run must survive 60 seconds");
  await page.reload();
  await page.locator('[data-start="0"]').tap();
  const noviceStart = Date.now();
  while (Date.now() - noviceStart < 150000) {
    const s = await snap();
    if (s.state === "levelup") await page.locator('[data-choice="0"]').tap();
    if (s.state === "gameover") break;
    await page.waitForTimeout(400);
  }
  await record("round3-novice-failure");
  await shot("03-failure");
  assert.equal((await snap()).state, "gameover");
  await page.locator("[data-restart]").tap();
  await record("round3-restart");
  await shot("03-restart");
  assert((await snap()).time < 2);
  await b.close();
  console.log("rounds 2/3 complete, errors:", errors);
  assert.equal(errors.length, 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
