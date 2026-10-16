const fs = require("fs"),
  vm = require("vm"),
  assert = require("assert");
const html = fs.readFileSync("index.html", "utf8"),
  source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(source);
const noop = () => {};
const element = () => ({
  style: {},
  dataset: {},
  classList: { add: noop, remove: noop },
  addEventListener: noop,
  querySelector: () => element(),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 122, height: 122 }),
  setPointerCapture: noop,
  getContext: () => new Proxy({}, { get: () => noop }),
});
const nodes = {};
const context = vm.createContext({
  console,
  Math,
  Date,
  Set,
  JSON,
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 1,
  requestAnimationFrame: noop,
  addEventListener: noop,
  document: {
    getElementById: (id) => (nodes[id] ??= element()),
    addEventListener: noop,
  },
  window: {},
});
vm.runInContext(source, context);
const run = (code) => vm.runInContext(code, context);
const tests = [];
function test(name, code) {
  try {
    assert(run(code));
    tests.push({ name, pass: true });
  } catch (e) {
    tests.push({ name, pass: false, error: e.message });
    throw e;
  }
}
run("muted=true;reset(0)");
test(
  "64 unique weapons / valid tags / distinct configs",
  `WEAPONS.length===64 && new Set(WEAPONS.map(w=>w.name)).size===64 && WEAPONS.every(w=>w.tags.length<=3&&w.tags.every(t=>TAGS.includes(t))) && new Set(WEAPONS.map(w=>[w.mode,w.count,w.spread,w.cd,w.range].join('/'))).size===64`,
);
test(
  "16 recipes change emitter / 5 starters",
  `RECIPES.length===16&&STARTERS.length===5&&RECIPES.every(r=>r.mode!==WEAPONS[r.base].mode&&PASSIVES.some(p=>p[0]===r.passive))`,
);
test(
  "first level within 5 seconds",
  `(()=>{for(let i=0;i<300&&state==='playing';i++)update(1/60);return state==='levelup'&&time<=5&&choices.length===4})()`,
);
test(
  "choice applies and simulation pauses at upgrade",
  `(()=>{const t=time;update(1);if(time!==t)return false;applyChoice(0);return state==='playing'&&stats.choices===1})()`,
);
test(
  "auto fire all 64 + 16 evolved no errors",
  `(()=>{reset(0);for(const def of WEAPONS){enemies.clear();shots.clear();zones.clear();spawn();const e=enemies.items.find(e=>e.active);e.x=70;e.y=0;const w={id:def.id,lv:8,tier:0,evolved:false};fire(w);if(shots.count()+zones.count()===0)return false}for(const r of RECIPES){enemies.clear();shots.clear();zones.clear();spawn();const e=enemies.items.find(e=>e.active);e.x=70;e.y=0;fire({id:r.base,lv:8,tier:0,evolved:true});if(shots.count()+zones.count()===0)return false}return stats.shots>50})()`,
);
test(
  "pool caps enemies/projectiles/particles",
  `(()=>{reset(0);for(let i=0;i<2000;i++){spawn();spark(0,0,'red');projectile(0,0,0,1,1,inventory[0])}return enemies.count()===240&&shots.count()===420&&particles.count()===220})()`,
);
test(
  "3/5 synergy and fusion max tier",
  `(()=>{reset(0);inventory=Array.from({length:5},()=>({id:40,lv:1,tier:0,cd:0,evolved:false}));const base=WEAPONS[40].damage;const enhanced=damage(inventory[0]);if(!has('화염')||enhanced<=base*1.2)return false;let ok=fuse(0,1);inventory[0].tier=4;inventory[1].tier=4;return ok&&!fuse(0,1)})()`,
);
test(
  "all 16 recipes eligible only with Lv8 + passive + chest",
  `(()=>{for(const r of RECIPES){reset(0);inventory=[{id:r.base,lv:7,tier:0,cd:0,evolved:false}];passives[r.passive]=1;collectBox({active:true});if(inventory[0].evolved)return false;inventory[0].lv=8;passives={};collectBox({active:true});if(inventory[0].evolved)return false;passives[r.passive]=1;collectBox({active:true});if(!inventory[0].evolved)return false}return true})()`,
);
test(
  "tag weighted distribution 10000 samples",
  `(()=>{reset(0);inventory=[{id:0},{id:1},{id:2}];rngState=42;let melee=0,other=0;for(let i=0;i<10000;i++){const w=pickWeighted([WEAPONS[0],WEAPONS[40]],offerWeight);if(w.id===0)melee++;else other++}stats.distribution={melee,other};return melee>other*6})()`,
);
test(
  "slots bounded 4 to 8 / four nonduplicate choices",
  `(()=>{reset(0);for(slots=4;slots<8;slots++){if(!makeChoices().every(c=>c.kind!=='slot'||slots<8))return false}return !makeChoices().some(c=>c.kind==='slot')&&new Set(makeChoices().map(c=>c.kind+':'+c.id+':'+c.index)).size===4})()`,
);
test(
  "dash cooldown, pause freezes, HP0 and restart",
  `(()=>{reset(0);dash();dash();if(stats.dashes!==1)return false;pause();const t=time;update(1);if(time!==t)return false;pause();p.hp=1;hurt(100);if(state!=='gameover')return false;reset(4);return state==='playing'&&p.hp===160&&kills===0})()`,
);
test(
  "240 second victory boundary",
  `(()=>{reset(0);time=239.99;update(.02);return state==='victory'&&time===240})()`,
);
test(
  "snapshot is a copy / no mutation API",
  `(()=>{reset(0);const s=window.__game.snapshot();s.player.hp=0;s.inventory[0].lv=99;return p.hp===100&&inventory[0].lv===1&&Object.keys(window.__game).length===1})()`,
);
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(
  "artifacts/unit-log.json",
  JSON.stringify(
    {
      syntax: "PASS",
      tests,
      distribution: run(
        `(()=>{reset(0);inventory=[{id:0},{id:1},{id:2}];rngState=42;let a=0;for(let i=0;i<10000;i++)if(pickWeighted([WEAPONS[0],WEAPONS[40]],offerWeight).id===0)a++;return {matching:a,unrelated:10000-a,matchingWeight:offerWeight(WEAPONS[0]),unrelatedWeight:offerWeight(WEAPONS[40])}})()`,
      ),
    },
    null,
    2,
  ),
);
console.log(tests.length + " tests PASS + syntax PASS");
