// Static UI regression, no simulation/play session: reproduce 8-slot, multi-row HUD.
const { launch } = require("./browser.cjs");
const fs = require("fs"),
  assert = require("assert");
(async () => {
  const b = await launch(),
    page = await b.newPage({ viewport: { width: 390, height: 844 } });
  await page.route("**/index.html", (route) => {
    let html = fs
      .readFileSync("index.html", "utf8")
      .replace(
        /menu\(\);\s*requestAnimationFrame\(tick\);/,
        `reset(2);state='paused';slots=8;inventory=[40,41,42,43,40,20,21,22].map(id=>({id,lv:8,tier:0,cd:0,evolved:false}));updateHud();render();`,
      );
    return route.fulfill({ contentType: "text/html", body: html });
  });
  await page.goto("http://127.0.0.1:8765/index.html");
  await page.screenshot({ path: "artifacts/05-hud-layout-fixed.png" });
  const bounds = await page.evaluate(() => ({
    hud: document.getElementById("hud").getBoundingClientRect().bottom,
    build: document.getElementById("build").getBoundingClientRect().top,
    tags: document.querySelectorAll(".tag").length,
  }));
  assert(bounds.build >= bounds.hud + 9);
  assert.equal(bounds.tags, 4);
  fs.writeFileSync(
    "artifacts/layout-log.json",
    JSON.stringify(bounds, null, 2),
  );
  await b.close();
  console.log("static HUD regression PASS", bounds);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
