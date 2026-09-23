/* 데이터 무결성 검사 — AGENTS.md "데이터 무결성 규칙 1~5" + 카드 풀 최소 조건.
 * 쓰는 법: node tools/check.mjs   (실패가 있으면 exit 1)
 */
import { loadGame } from "./load.mjs";

const g = loadGame();
const { RESOURCES, CARDS, PACKS, DAY_CYCLE, CARD } = g;

const fails = [];
const ok = [];
const t = (name, cond, detail = "") => (cond ? ok.push(name) : fails.push(name + (detail ? " — " + detail : "")));

/* 규칙 1: 카드 id는 유일, 모든 카드는 정확히 한 팩에 속한다 */
const ids = CARDS.map(c => c.id);
t("규칙1 카드 id 유일", new Set(ids).size === ids.length);
const owned = {};
for (const [pid, p] of Object.entries(PACKS)) for (const cid of p.cards) (owned[cid] ||= []).push(pid);
t("규칙1 모든 카드가 팩에 속함", ids.every(id => owned[id]), ids.filter(id => !owned[id]).join(","));
t("규칙1 카드가 정확히 한 팩", ids.every(id => owned[id].length === 1),
  ids.filter(id => owned[id] && owned[id].length !== 1).map(id => `${id}:${owned[id]}`).join(","));
t("규칙1 팩에 없는 카드 id 없음", Object.keys(owned).every(id => CARD[id]), Object.keys(owned).filter(id => !CARD[id]).join(","));

/* 규칙 2: 모든 팩은 slots에서 최소 한 번 참조된다(고아 팩 = 죽은 데이터 금지) */
const slotPacks = new Set(DAY_CYCLE.slots.flatMap(s => s.packs));
t("규칙2 고아 팩 없음", Object.keys(PACKS).filter(p => !slotPacks.has(p)).length === 0,
  Object.keys(PACKS).filter(p => !slotPacks.has(p)).join(","));
t("규칙2 슬롯이 참조한 팩이 실재", [...slotPacks].every(p => PACKS[p]), [...slotPacks].filter(p => !PACKS[p]).join(","));

/* 규칙 3: effects·rest·nightfall의 키는 RESOURCES.key 부분집합 */
const keys = new Set(RESOURCES.map(r => r.key));
const badKey = [];
for (const c of CARDS) c.options.forEach((o, i) => {
  const ks = Object.keys(o.effects);
  if (!ks.length) badKey.push(`${c.id}#${i}: 효과 없음`);
  for (const k of ks) if (!keys.has(k)) badKey.push(`${c.id}#${i}:${k}`);
});
for (const [k] of Object.entries(DAY_CYCLE.rest.effects)) if (!keys.has(k)) badKey.push("rest:" + k);
for (const [k] of Object.entries(DAY_CYCLE.nightfall.effects)) if (!keys.has(k)) badKey.push("nightfall:" + k);
t("규칙3 자원 키 유효", badKey.length === 0, badKey.join(","));

/* 규칙 4: conseq.tone ∈ good|bad|note */
const tones = ["good", "bad", "note"];
t("규칙4 tone 유효", !CARDS.some(c => c.options.some(o => !o.conseq || !tones.includes(o.conseq.tone))),
  CARDS.filter(c => c.options.some(o => !o.conseq || !tones.includes(o.conseq.tone))).map(c => c.id).join(","));

/* 규칙 5: 슬롯마다 후보 ≥1, 그리고 하루를 중복 없이 뽑을 수 있다(카드의 minDay 게이트 반영) */
const inDay = (cid, day) => (CARD[cid].minDay || 1) <= day;
const poolAt = (slot, day) => [...new Set(DAY_CYCLE.slots[slot].packs.filter(p => PACKS[p]).flatMap(p => PACKS[p].cards))].filter(id => inDay(id, day));
for (let day = 1; day <= DAY_CYCLE.goalDays; day++) {
  const pools = DAY_CYCLE.slots.map((_, i) => poolAt(i, day));
  t(`규칙5 슬롯 후보 ≥1 (${day}일차)`, pools.every(p => p.length >= 1), pools.map(p => p.length).join("/"));
  t(`규칙5 ${day}일차를 중복 없이 드로 가능`, matchable(pools), pools.map(p => p.length).join("/"));
}
/* 이분 매칭: 슬롯마다 서로 다른 카드를 배정할 수 있는가 */
function matchable(pools) {
  const assign = new Map();
  const tryK = (s, seen) => {
    for (const cid of pools[s]) {
      if (seen.has(cid)) continue;
      seen.add(cid);
      if (!assign.has(cid) || tryK(assign.get(cid), seen)) { assign.set(cid, s); return true; }
    }
    return false;
  };
  return pools.every((_, s) => tryK(s, new Set()));
}

/* 카드 풀 최소 조건(카드 풀 확장 Loop의 완료 조건) */
const need = { morning: 3, school: 5, home: 3 };
for (const [pid, n] of Object.entries(need)) t(`팩 ${pid} ≥ ${n}장`, PACKS[pid].cards.length >= n, `${PACKS[pid].cards.length}장`);
t("총 카드 ≥ 11장", CARDS.length >= 11, `${CARDS.length}장`);

/* 카드/선택지 형태 */
t("카드 옵션 2~3개", CARDS.every(c => c.options.length >= 2 && c.options.length <= 3),
  CARDS.filter(c => c.options.length < 2 || c.options.length > 3).map(c => c.id).join(","));
t("카드 필수 칸 채움", CARDS.every(c => c.tag && c.title && c.text));
t("선택지 필수 칸 채움", CARDS.every(c => c.options.every(o => o.label && o.flavor && o.conseq && o.conseq.text)));
t("minDay는 1 이상 정수", CARDS.every(c => c.minDay === undefined || (Number.isInteger(c.minDay) && c.minDay >= 1)),
  CARDS.filter(c => c.minDay !== undefined && !(Number.isInteger(c.minDay) && c.minDay >= 1)).map(c => c.id).join(","));

/* 픽션화: 실제 기관·지역·통계 수치를 문구에 노출하지 않는다 (MATERIALS.md 픽션화 규칙 5) */
const banned = ["교육청", "교육부", "학폭위", "교권보호위", "82cook", "나무위키", "브런치", "%"];
const allText = CARDS.flatMap(c => [c.tag, c.title, c.text, ...c.options.flatMap(o => [o.label, o.flavor, o.conseq.text])]).join(" ");
t("픽션화 금지어 없음", banned.every(b => !allText.includes(b)), banned.filter(b => allText.includes(b)).join(","));

console.log(`통과 ${ok.length}건`);
if (fails.length) {
  console.log("실패:\n - " + fails.join("\n - "));
  process.exit(1);
}
console.log("전부 통과");
