// Round 5: intentionally instrument ONLY the test response, never production HTML.
const fs = require("fs"),
  assert = require("assert");
const { launch } = require("./browser.cjs");
(async () => {
  const b = await launch(),
    page = await b.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/index.html", async (route) => {
    let html = fs.readFileSync("index.html", "utf8");
    html = html.replace(
      /menu\(\);\s*requestAnimationFrame\(tick\);/,
      `window.__fixture=()=>{muted=true;reset(2);slots=8;inventory=[40,41,42,43,40,20,21,22].map((id,i)=>({id,lv:8,tier:i===4?1:0,cd:0,evolved:false}));passives={core:1,fuel:1,magnet:2};p.hp=p.maxHp=100000;need=1e9;time=200;collectBox({active:true});for(let i=0;i<240;i++)spawn();setInterval(()=>{if(state==='playing')while(enemies.count()<240)spawn()},100);};menu();requestAnimationFrame(tick);`,
    );
    await route.fulfill({ contentType: "text/html", body: html });
  });
  await page.goto("http://127.0.0.1:8765/index.html");
  await page.evaluate(() => __fixture());
  const start = await page.evaluate(() => __game.snapshot());
  assert(start.inventory[0].evolved);
  assert.equal(start.synergies["화염"], 5);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "artifacts/05-forced-evolution-synergy.png" });
  const rawFrames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const a = [];
        let prev = performance.now();
        function tick(t) {
          a.push(t - prev);
          prev = t;
          if (a.length >= 300) resolve(a);
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }),
  );
  const final = await page.evaluate(() => __game.snapshot());
  assert(
    final.enemies <= 240 && final.projectiles <= 420 && final.particles <= 220,
  );
  assert.equal(errors.length, 0);
  const sorted = rawFrames.slice(1).sort((a, b) => a - b);
  const summary = {
    frames: sorted.length,
    medianMs: sorted[Math.floor(sorted.length * 0.5)],
    p95Ms: sorted[Math.floor(sorted.length * 0.95)],
    maxMs: sorted[sorted.length - 1],
  };
  fs.writeFileSync(
    "artifacts/round5-forced-log.json",
    JSON.stringify(
      {
        notice:
          "FORCED fixture: HP, time, loadout, enemies, XP threshold altered in intercepted response only. Not a natural run.",
        start,
        final,
        frameSummary: summary,
        rawFrames,
        errors,
      },
      null,
      2,
    ),
  );
  await b.close();
  console.log("round5 fixture PASS", summary);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
