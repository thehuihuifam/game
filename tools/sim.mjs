/* 밸런스 시뮬레이션 — 네 가지 플레이 습관으로 한 판(3일)을 돌려 완주율·죽음 경로·자원 흐름을 본다.
 * 쓰는 법: node tools/sim.mjs [판수]
 *   random = 아무 카드나 고름 / greedy = 자원 합 최대 / smart = 가장 낮은 자원의 여유 우선 / worst = 최악만 고름
 */
import { loadGame, rng } from "./load.mjs";

const g = loadGame();
const { RESOURCES, DAY_CYCLE } = g;
const N = Number(process.argv[2] || 2000);

/* 선택 점수 계산: 자원을 다 더하는 greedy와, 바닥난 자원을 먼저 보는 smart */
const score = (mode, g, card, state, rnd) => {
  let best = 0, bestV = -Infinity;
  card.options.forEach((o, i) => {
    const e = g.withBaseCost(o.effects);
    const r = { ...state.resources };
    for (const k of Object.keys(e)) r[k] = Math.min(g.RES[k].max, Math.max(g.RES[k].min, r[k] + e[k]));
    let v;
    if (mode === "greedy") v = (e.health || 0) + (e.mood || 0) * 1.1 + (e.time || 0) * 2;
    else if (mode === "worst") v = -((e.health || 0) + (e.mood || 0) * 1.1 + (e.time || 0) * 2);
    else v = Math.min(r.health, r.mood) + (r.health + r.mood) * 0.25 + r.time * 0.6 - (r.time <= 0 ? 12 : 0);
    if (v > bestV) { bestV = v; best = i; }
  });
  return best;
};

/* 슬롯을 다 못 채우고 하루가 끝나면 nightfall. 그 횟수를 세려고 효과 화면 문구를 본다 */
function playOne(mode, rnd) {
  let s = g.newGame();
  const flow = { health: 0, mood: 0, time: 0 };
  let picks = 0, nightfall = false;
  for (let guard = 0; guard < 300 && s.phase !== "end"; guard++) {
    if (s.phase === "card") {
      const before = { ...s.resources };
      const idx = mode === "random" ? Math.floor(rnd() * g.CARD[s.cardId].options.length) : score(mode, g, g.CARD[s.cardId], s, rnd);
      s = g.choose(s, idx);
      for (const r of RESOURCES) flow[r.key] += s.resources[r.key] - before[r.key];
      picks++;
    } else {
      if (s.effect && s.effect.dayEnd && s.effect.dayEnd.text === DAY_CYCLE.nightfall.text) nightfall = true;
      s = g.next(s);
    }
  }
  return { state: s, flow, picks, nightfall };
}

const modes = ["random", "greedy", "smart", "worst"];
console.log(`판수 ${N} · 목표 ${DAY_CYCLE.goalDays}일 · 하루 ${DAY_CYCLE.slots.length}칸\n`);
for (const mode of modes) {
  const rnd = rng(20260923);
  const deaths = {};
  let win = 0, picks = 0, nightfalls = 0;
  const flow = { health: 0, mood: 0, time: 0 };
  for (let i = 0; i < N; i++) {
    const r = playOne(mode, rnd);
    win += r.state.ending.win ? 1 : 0;
    if (r.nightfall) nightfalls++;
    picks += r.picks;
    for (const k of Object.keys(flow)) flow[k] += r.flow[k];
    if (!r.state.ending.win) deaths[r.state.ending.why.slice(0, 12)] = (deaths[r.state.ending.why.slice(0, 12)] || 0) + 1;
  }
  const pct = v => (v / N * 100).toFixed(1) + "%";
  console.log(`[${mode.padEnd(6)}] 완주 ${pct(win).padStart(6)} · 픽/판 ${(picks / N).toFixed(1)} · 하루 조기 종료(nightfall) ${pct(nightfalls)}`);
  console.log(`         픽당 자원 변화: ${RESOURCES.map(r => `${r.ko} ${(flow[r.key] / picks).toFixed(2)}`).join(", ")}`);
  const d = Object.entries(deaths).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}… ${pct(v)}`);
  console.log(`         죽음: ${d.length ? d.join(" | ") : "없음"}\n`);
}

/* 하루 안 중복 드로가 없는지 확인 */
{
  const rnd = rng(7);
  let dup = 0;
  for (let i = 0; i < 500; i++) {
    let s = g.newGame();
    for (let guard = 0; guard < 300 && s.phase !== "end"; guard++) {
      if (s.phase === "card") {
        if (new Set(s.usedToday).size !== s.usedToday.length) dup++;
        s = g.choose(s, Math.floor(rnd() * g.CARD[s.cardId].options.length));
      } else s = g.next(s);
    }
  }
  console.log(`하루 안 같은 카드 중복: ${dup}건 (500판)`);
}
