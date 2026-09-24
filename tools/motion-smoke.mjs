/* 선택 피드백의 실제 CSS·모바일 레이아웃 검사 (게임 런타임 의존성 아님).
 * 저장소 밖에 playwright와 Chromium 설치 후 node tools/motion-smoke.mjs
 * 선택 환경 변수: CHROMIUM_PATH (기존 브라우저), GAME_URL (기본 file://).
 * jsdom과 달리 실제 브라우저가 필요하며, 설치 누락은 실패로 보고한다.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(process.env.GAME_URL || new URL("../index.html", import.meta.url).href);

  for (const motion of ["no-preference", "reduce"]) {
    await page.emulateMedia({ reducedMotion: motion });
    for (let pick = 0; pick < 2; pick++) {
      await page.evaluate(() => { state = { ...initialState(), cardId: "dawn" }; render(state); });
      // 카드 화면이 실제로 그려진 뒤 터치: 두 번째 효과에서도 CSS가 다시 시작해야 한다.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.locator("#options .opt").first().tap();
      const styles = await page.evaluate(() => {
        const duration = selector => getComputedStyle(document.querySelector(selector)).animationDuration;
        return {
          phase: state.phase,
          panel: duration("#effectPanel"),
          chip: duration("#fxDelta .feedback"),
          loss: duration('.stat[data-change="neg"] .barwrap'),
          gain: duration('.stat[data-change="pos"] .barwrap'),
          width: getComputedStyle(UI.bar.health).transitionDuration,
          running: el("effectPanel").getAnimations().length,
        };
      });
      assert.equal(styles.phase, "effect");
      assert.equal(styles.panel, motion === "reduce" ? "0s" : "0.2s");
      assert.equal(styles.chip, motion === "reduce" ? "0s" : "0.2s");
      assert.equal(styles.loss, motion === "reduce" ? "0s" : "0.25s");
      assert.equal(styles.gain, "0s");
      assert.equal(styles.width, motion === "reduce" ? "0s" : "0.25s");
      if (motion !== "reduce") assert.equal(styles.running, 1);
      const before = await page.evaluate(() => JSON.stringify(state));
      await page.locator("#topbar").tap();
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => JSON.stringify(state)), before, "배경 터치·시간 경과는 state 불변");
      assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === "running").length), 0);
      await page.locator("#fxNext").tap();
      assert.equal(await page.locator("#topbar [data-change]").count(), 0);
    }
  }

  // 가장 작은 화면에서도 전 카드·전 선택 효과(하루 마감 포함)가 잘리지 않는다.
  // 상태(Loop 6)가 꺼진/켜진 두 경우 모두: 상태 띠·선택지 상태 줄·상태 칩이 들어간 화면까지 본다.
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [[320, 568], [360, 640], [390, 844]]) {
    await page.setViewportSize({ width, height });
    const problems = await page.evaluate(() => {
      const issues = [];
      const inside = (node, label) => {
        const r = node.getBoundingClientRect();
        if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || node.scrollWidth > node.clientWidth + 1) issues.push(label);
      };
      for (const status of [null, ...Object.keys(STATUSES)]) for (const card of CARDS) {
        const start = { ...initialState(), cardId: card.id, day: 3, slot: 4, status };
        render(start);
        if (el("statusbar").classList.contains("hidden") !== !status) issues.push(card.id + ":statusbar");
        document.querySelectorAll("#statusbar, #statusbar .desc, #cardView .card, #options .opt, #options .label, #options .cost, #options .mark").forEach(n => inside(n, card.id + ":card:" + status));
        if (document.querySelector(".card").getBoundingClientRect().bottom > el("options").getBoundingClientRect().top) issues.push(card.id + ":overlap:" + status);
        card.options.forEach((_, i) => {
          render(choose(start, i));
          inside(el("effectPanel"), card.id + ":effect:" + status);
          inside(el("fxNext"), card.id + ":next:" + status);
          document.querySelectorAll("#fxDelta .cost").forEach(n => inside(n, card.id + ":chip:" + status));
          if (el("effectPanel").getBoundingClientRect().bottom > el("fxNext").getBoundingClientRect().top) issues.push(card.id + ":effect-overlap:" + status);
        });
      }
      state = { ...initialState(), phase: "effect", choices: 15, status: Object.keys(STATUSES)[0], resources: { health: 12, mood: 23, time: 0 }, effect: { nextLabel: "" } };
      finish(state, false, ENDINGS.death.health.nightfall);
      state.phase = "end";
      render(state);
      if (!el("statusbar").classList.contains("hidden")) issues.push("end-statusbar-visible");
      document.querySelectorAll("#endView .big, #endView .why, #endView .summary, #endView .summary-line, #endResources .cost, #endBtn").forEach(n => inside(n, "end-summary"));
      if (el("endSummary").getBoundingClientRect().bottom > el("endBtn").getBoundingClientRect().top) issues.push("end-summary-overlap");
      if (document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth) issues.push("document-scroll");
      return issues;
    });
    assert.deepEqual(problems, [], `${width}×${height}`);
  }
  await page.setViewportSize({ width: 844, height: 390 });
  assert.equal(await page.locator("#rotate").isVisible(), true);
  assert.equal(await page.locator("#game").isVisible(), false);
  assert.deepEqual(errors, []);
  console.log("브라우저 통과: 반복 선택·200/250ms·reduce 0ms·정지·3개 세로 뷰포트 전 카드(상태 꺼짐·켜짐)·가로 차단");
} finally {
  await browser.close();
}
