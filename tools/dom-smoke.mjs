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

const stats = { wins: 0, losses: 0, maxDay: 0 };
for (let game = 0; game < 200; game++) {
  let guard = 0;
  while (!visible("endView") && guard++ < 400) {
    if (visible("cardView")) {
      const opts = [...document.querySelectorAll("#options .opt")];
      check("선택지 2~3개", opts.length >= 2 && opts.length <= 3, String(opts.length));
      opts[Math.floor(Math.random() * opts.length)].click();
    } else if (visible("effectView")) {
      document.getElementById("fxNext").click();
    }
  }
  if (!visible("endView")) { problems.push("한 판이 끝나지 않음"); break; }
  check("종료 사유 표시", document.getElementById("endWhy").textContent.length > 0);
  stats.maxDay = Math.max(stats.maxDay, Number(document.getElementById("dayNum").textContent));
  if (document.getElementById("endTitle").textContent === "생존") stats.wins++; else stats.losses++;
  document.getElementById("endBtn").click();
  check("다시 시작하면 카드 화면", visible("cardView"));
}

check("JS 예외 없음", errors.length === 0, errors.slice(0, 2).join(" | "));
check("완주·죽음 모두 관측", stats.wins > 0 && stats.losses > 0, JSON.stringify(stats));
check("일차 카운터가 목표 일수까지 감", stats.maxDay === 4, "maxDay=" + stats.maxDay);

console.log("200판 클릭 시뮬레이션:", JSON.stringify(stats));
if (problems.length) { console.log("문제:\n - " + problems.slice(0, 10).join("\n - ")); process.exit(1); }
console.log("DOM 스모크 테스트 통과");
