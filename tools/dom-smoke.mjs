/* DOM 스모크 테스트 — index.html을 실제로 굴려 VIEW·CONTROLLER까지 확인한다.
 * 쓰는 법: npm i jsdom (이 저장소 밖에서) 후 node tools/dom-smoke.mjs
 *   jsdom이 없으면 조용히 건너뛴다. 게임 런타임에는 아무 의존성도 없다.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let JSDOM, VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = await import("jsdom"));
} catch {
  console.log("jsdom이 없어 건너뜁니다 (npm i jsdom 후 다시 실행)");
  process.exit(0);
}

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(e.message));
const dom = new JSDOM(readFileSync(join(ROOT, "index.html"), "utf8"), { runScripts: "dangerously", virtualConsole: vc });
const { document } = dom.window;

const problems = [];
const check = (name, cond, extra = "") => { if (!cond) problems.push(name + (extra ? " — " + extra : "")); };
const visible = id => !document.getElementById(id).classList.contains("hidden");

check("시작 화면은 카드", visible("cardView") && !visible("effectView") && !visible("endView"));
check("자원 게이지 렌더", document.querySelectorAll("#topbar .stat").length === 3);
check("카드·선택지 렌더", document.getElementById("cardTitle").textContent.length > 0 && document.querySelectorAll("#options .opt").length >= 2);

/* Loop 4: authored 비용이 아니라 최종 게이지의 실제 변화만 강조한다.
   Loop 6: status(시작 상태) → mark(선택지 미리보기 줄) → expectStatus(선택 뒤 상태)·chip(효과 칩)·strip(상태 띠) */
const fixtures = [
  { name: "증가·감소", cardId: "dawn", option: 0, expected: ["neg", "pos", "neg"] },
  { name: "시간 순비용 0", cardId: "lunch", option: 1, expected: ["neg", "neg", null] },
  { name: "상한 회복 0", cardId: "dawn", option: 0, resources: { mood: 100 }, expected: ["neg", null, "neg"] },
  { name: "휴식 상쇄·시간 충전", cardId: "dawn", option: 0, slot: 4, expected: [null, "pos", "pos"] },
  { name: "시간 충전 전후 동일", cardId: "dawn", option: 0, slot: 4, resources: { time: 12 }, expected: [null, "pos", null] },
  { name: "즉시 죽음", cardId: "dawn", option: 0, resources: { health: 1 }, expected: ["neg", "pos", "neg"], ending: true },
  { name: "조기 마감 죽음", cardId: "dawn", option: 0, resources: { health: 8, time: 1 }, expected: ["neg", "neg", "neg"], ending: true },
  { name: "상태 획득", cardId: "call", option: 1, expected: [null, "neg", null], mark: "set", expectStatus: "unanswered", chip: "neg", expectNext: "reply" },
  { name: "상태 없으면 해제 무효", cardId: "call", option: 0, expected: ["neg", "neg", "neg"], mark: null, expectStatus: null, chip: null },
  { name: "상태 없으면 후속 카드 안 나옴", cardId: "lunch", option: 0, expected: ["pos", "neg", "neg"], expectStatus: null, chip: null },
  { name: "상태 해제", cardId: "reply", option: 0, status: "unanswered", expected: ["neg", "neg", "neg"], mark: "clear", expectStatus: null, chip: "pos" },
  { name: "상태 유지(또 미룸)", cardId: "reply", option: 2, status: "unanswered", expected: [null, "neg", null], mark: null, expectStatus: "unanswered", chip: null },
  { name: "켜진 상태 다시 켬은 변화 없음", cardId: "parent", option: 1, status: "unanswered", expected: ["neg", "neg", "neg"], mark: null, expectStatus: "unanswered", chip: null },
  { name: "하루 넘겨도 상태 유지", cardId: "night", option: 0, slot: 4, status: "unanswered", expected: ["pos", "pos", "pos"], mark: null, expectStatus: "unanswered", chip: null },
  { name: "상태 든 채 죽음", cardId: "reply", option: 2, status: "unanswered", resources: { mood: 5 }, expected: [null, "neg", null], expectStatus: "unanswered", chip: null, ending: true },
];
for (const fixture of fixtures) {
  dom.window.eval(`
    state = { ...initialState(), cardId: ${JSON.stringify(fixture.cardId)},
      slot: ${fixture.slot || 0},
      status: ${JSON.stringify(fixture.status || null)},
      resources: { ...initialState().resources, ...${JSON.stringify(fixture.resources || {})} } };
    render(state);
  `);
  check(fixture.name + " 시작 상태 띠", visible("statusbar") === Boolean(fixture.status));
  if ("mark" in fixture) {
    const mark = document.querySelectorAll("#options .opt")[fixture.option].querySelector(".mark");
    check(fixture.name + " 선택지 상태 줄", (mark ? (mark.classList.contains("set") ? "set" : "clear") : null) === fixture.mark && (!mark || mark.textContent.length > 0));
  }
  const before = dom.window.eval("JSON.stringify(state)");
  document.querySelectorAll("#options .opt")[fixture.option].click();
  check(fixture.name + " 선택 즉시 효과", visible("effectView") && !visible("cardView"));
  if ("expectStatus" in fixture) {
    check(fixture.name + " 상태 전이", dom.window.eval("state.status") === fixture.expectStatus);
    check(fixture.name + " 상태 띠 표시", visible("statusbar") === Boolean(fixture.expectStatus) &&
      (!fixture.expectStatus || document.getElementById("statusName").textContent === "미룬 연락"));
    const chip = document.querySelector("#fxDelta .cost[data-status]");
    check(fixture.name + " 상태 칩", (chip ? (chip.classList.contains("neg") ? "neg" : "pos") : null) === fixture.chip);
    check(fixture.name + " 효과 페이로드 status", JSON.stringify(dom.window.eval("state.effect.status")) ===
      JSON.stringify(fixture.chip ? { id: "unanswered", on: fixture.chip === "neg" } : null));
  }
  const rows = [...document.querySelectorAll("#topbar .stat")];
  rows.forEach((row, i) => {
    check(fixture.name + " 게이지 " + row.dataset.res,
      (row.dataset.change || null) === fixture.expected[i]);
    document.querySelectorAll(`#effectPanel .cost[data-res="${row.dataset.res}"]`).forEach(chip => {
      check(fixture.name + " 칩 변화 유무", chip.classList.contains("feedback") === Boolean(fixture.expected[i]));
    });
  });
  check(fixture.name + " 선택 전 사본 보존", dom.window.eval("JSON.stringify(state.effect.beforeResources)") === JSON.stringify(JSON.parse(before).resources));
  check(fixture.name + " 선택 횟수 누적", dom.window.eval("state.choices") === 1);
  const effectState = dom.window.eval("JSON.stringify(state)");
  dom.window.eval("render(state)");
  check("렌더는 state 불변", dom.window.eval("JSON.stringify(state)") === effectState);
  document.getElementById("effectPanel").click();
  document.getElementById("topbar").click();
  dom.window.eval("onChoose(0)");
  check("효과 화면 배경·중복 선택은 무기능", dom.window.eval("JSON.stringify(state)") === effectState);
  document.getElementById("fxNext").click();
  check("다음 화면에서 강조 해제", !document.querySelector("#topbar [data-change]"));
  if (fixture.ending) {
    check(fixture.name + " 마지막 효과 뒤 종료", visible("endView"));
    check(fixture.name + " 종료 화면에서 상태 띠 숨김", !visible("statusbar"));
    const summary = dom.window.eval("state.ending.summary");
    check(fixture.name + " 요약 일차·횟수 정확", summary.days === 1 && summary.choices === 1);
    check(fixture.name + " 요약 최종 자원 정확", JSON.stringify(summary.resources) === JSON.stringify(dom.window.eval("state.resources")));
    check(fixture.name + " 종료 화면 요약 렌더", document.getElementById("endDays").textContent.includes("1일") && document.getElementById("endChoices").textContent.includes("1회") && document.querySelectorAll("#endResources .cost").length === 3);
    document.getElementById("endBtn").click();
    check(fixture.name + " 다시 시작 요약 초기화", visible("cardView") && dom.window.eval("state.choices") === 0 && !document.querySelector("#topbar [data-change]"));
    check(fixture.name + " 다시 시작 상태 초기화", dom.window.eval("state.status") === null && !visible("statusbar"));
  } else if ("expectStatus" in fixture) {
    // 상태가 켜진 채 다음 슬롯으로: 후속 카드가 후보에 들면 반드시 그 카드(결정적 드로)
    const due = JSON.parse(dom.window.eval("JSON.stringify(state.status ? poolAt(state.slot, state.day, state.usedToday.filter(id => id !== state.cardId), state.status).filter(id => CARD[id].needs) : [])"));
    const drawn = dom.window.eval("state.cardId");
    const gateOk = dom.window.eval("!CARD[state.cardId].needs || CARD[state.cardId].needs === state.status");   // 꺼진 상태의 후속 카드는 절대 안 나온다
    check(fixture.name + " 후속 카드 강제 드로", gateOk && (due.length === 0 || due.includes(drawn)), JSON.stringify(due) + " → " + drawn);
    if ("expectNext" in fixture) check(fixture.name + " 다음 카드", drawn === fixture.expectNext, drawn);
  }
}
dom.window.eval("state = newGame(); render(state)");

const stats = { wins: 0, losses: 0, maxDay: 0, statusOn: 0, followUps: 0 };
for (let game = 0; game < 200; game++) {
  let guard = 0;
  check("새 판은 상태 없음", dom.window.eval("state.status") === null && !visible("statusbar"));
  while (!visible("endView") && guard++ < 400) {
    if (visible("cardView")) {
      const opts = [...document.querySelectorAll("#options .opt")];
      check("선택지 2~3개", opts.length >= 2 && opts.length <= 3, String(opts.length));
      // 상태 띠는 state.status 그대로, 후속 카드는 켜진 상태에서만, 켜져 있고 후보에 들면 반드시 그 카드
      check("상태 띠 = state.status", visible("statusbar") === Boolean(dom.window.eval("state.status")));
      check("후속 카드는 켜진 상태에서만", dom.window.eval("!CARD[state.cardId].needs || CARD[state.cardId].needs === state.status"));
      check("켜진 상태의 후속 카드 강제 드로", dom.window.eval("(() => { if (!state.status) return true; const due = poolAt(state.slot, state.day, state.usedToday.filter(id => id !== state.cardId), state.status).filter(id => CARD[id].needs); return !due.length || due.includes(state.cardId); })()"));
      if (dom.window.eval("state.status")) stats.statusOn++;
      if (dom.window.eval("Boolean(CARD[state.cardId].needs)")) stats.followUps++;
      opts[Math.floor(Math.random() * opts.length)].click();
    } else if (visible("effectView")) {
      document.getElementById("fxNext").click();
    }
  }
  if (!visible("endView")) { problems.push("한 판이 끝나지 않음"); break; }
  check("종료 사유 표시", document.getElementById("endWhy").textContent.length > 0);
  const ending = dom.window.eval("state.ending");
  const shownDays = Number(document.getElementById("endDays").textContent.match(/(\d+)일/)?.[1]);
  const shownChoices = Number(document.getElementById("endChoices").textContent.match(/(\d+)회/)?.[1]);
  check("종료 일차 요약 정확", shownDays === ending.summary.days && shownDays === (ending.win ? 3 : dom.window.eval("state.day")));
  check("종료 선택 횟수 요약 정확", shownChoices === ending.summary.choices && shownChoices === dom.window.eval("state.choices"));
  check("최종 자원 요약 정확", [...document.querySelectorAll("#endResources .cost")].map(n => n.textContent.trim()).join("|") === `체력 ${ending.summary.resources.health}|기분 ${ending.summary.resources.mood}|시간 ${ending.summary.resources.time}`);
  stats.maxDay = Math.max(stats.maxDay, Number(document.getElementById("dayNum").textContent));
  if (document.getElementById("endTitle").textContent === "생존") stats.wins++; else stats.losses++;
  document.getElementById("endBtn").click();
  check("다시 시작하면 카드 화면", visible("cardView"));
  check("재시작 요약·선택·강조 초기화", dom.window.eval("state.choices === 0 && state.ending === null && state.effect === null") && !document.querySelector("#topbar [data-change]") && document.getElementById("endDays").textContent === "");
}

check("JS 예외 없음", errors.length === 0, errors.slice(0, 2).join(" | "));
check("완주·죽음 모두 관측", stats.wins > 0 && stats.losses > 0, JSON.stringify(stats));
check("상태 켜짐·후속 카드 모두 관측", stats.statusOn > 0 && stats.followUps > 0, JSON.stringify(stats));
check("일차 카운터가 목표 일수까지 감", stats.maxDay === 4, "maxDay=" + stats.maxDay);

console.log("200판 클릭 시뮬레이션:", JSON.stringify(stats));
if (problems.length) { console.log("문제:\n - " + problems.slice(0, 10).join("\n - ")); process.exit(1); }
console.log("DOM 스모크 테스트 통과");
