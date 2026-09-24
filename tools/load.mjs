/* index.html에서 DATA·RULE 구역만 잘라 실행 가능한 객체로 만든다 (개발용 도구).
 *
 * 경계는 주석 앵커에 의존한다: `const RESOURCES` 부터 `VIEW — render(state)` 직전의 `/* ═`.
 * 그 주석을 지우면 이 도구가 깨진다(게임 자체는 아무 영향 없다).
 * 브라우저·DOM 없이 카드/규칙/전이만 돌려 보기 위한 것이고, 게임 런타임이 아니다.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXPORTS = "RESOURCES, SHAPES, CARDS, STATUSES, PACKS, DAY_CYCLE, TEXTS, ENDINGS, " +
  "RES, CARD, fill, initialState, newGame, choose, next, drawSlot, poolAt, withBaseCost, toDeltas, previewDeltas, deadKey, " +
  "nextStatus, statusChange, previewStatus";

export function loadGame(file = join(ROOT, "index.html")) {
  const html = readFileSync(file, "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!script) throw new Error("index.html에서 <script> 구역을 찾지 못했다");
  const js = script[1];
  const start = js.indexOf("const RESOURCES");
  const view = js.indexOf("VIEW — render(state)");
  if (start < 0 || view < 0) throw new Error("DATA/RULE 경계 주석을 찾지 못했다");
  const body = js.slice(start, js.lastIndexOf("/* ═", view));
  return new Function(body + "\nreturn { " + EXPORTS + " };\n")();
}

/* 시드 고정 난수(재현 가능한 시뮬레이션용) */
export function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
