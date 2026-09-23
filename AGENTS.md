# AGENTS.md — 작업 규약

이 파일은 AI가 이 저장소에서 일하는 방식의 유일한 기준이다. 코드와 함께 자란다.
숫자·시스템·스키마·세부 규칙은 **필요해질 때** 정한다. 미리 완성하지 않는다.

## 프로젝트 소재 (확정 아님, 다 바뀔 수 있음)

- 소재: 6학년 체육 전담 교사이자 두 아이 아빠. 인생의 자원(체력·기분·시간)을 관리하는 압박이 핵심 재미.
- 장르: 턴제 로그라이크.
- **순수 창작 픽션. 실제 인물·학교·지역 지칭 금지.**

## 불변식 (어떤 Loop에서도 깨지 않는다)

1. 플레이어의 유일한 행동은 선택창에서 카드를 **터치로** 고르는 것.
2. 선택창이 뜨면 게임 **완전 정지**. 선택 즉시 효과 표시.
3. 게임 진행 중 터치는 아무 기능도 하지 않는다.
4. 모바일 **세로 고정**. **도형만 사용**. 외부 라이브러리·CDN·이미지 에셋 금지.
5. 스크롤·확대·줌·당겨서 새로고침 차단.

## 루프 규칙 (Loop = 한 목표 = 한 PR, 기능 단위의 작은 덩어리)

- 한 Loop = 한 가지 목표 = 하나의 PR. Loop 하나당 목표 하나다.
- PR은 따라가기 쉬운 작은 크기로, 리뷰 가능한 수준이어야 한다.
- 각 Loop 결과물은 **항상 플레이 가능한 상태**여야 한다. 죽은 코드(도달 불가/미사용)를 남기지 않는다.

## 세션 규칙

- 매 세션은 `AGENTS.md`와 `PROGRESS.md`를 **먼저 읽고**, 미완료 Loop 중 다음 것부터 시작한다.
- 루프 규칙에서 지시받지 않은 즉흥 기능 추가·확장은 **하지 않는다** (YAGNI). 현재 Loop의 목표만.
- 완료 Loop는 `PROGRESS.md` 원장에 1~2줄로 압축해 영구 보존. **삭제·번호 재배치 금지.**
- **승격** = 큐의 한 줄 목표를 아래 `시스템 스펙` 섹션의 스키마·상태 전이로 옮겨 적는 것. Loop 계획(범위·완료 조건)은 `PROGRESS.md`에, 구현 뒤에도 참으로 남는 스키마는 이 파일에 둔다.
- 미완료 Loop가 2개 이하면 AI가 스스로 3~5개 기획해 큐를 채운다. "뭐 할까요?" 금지.
- 카드·이벤트·대사 소재는 MATERIALS.md를 참조한다. AI는 여기서 픽션화·일반화해 카드를 만든다.
- 세션 종료 전 3단계(압축·승격·보충) **필수**.

## 구현 규약

- 스택: 외부 빌드 툴·프레임워크 없이 정적 HTML/CSS/JS 단일 파일(또는 몇 개의 평범한 정적 파일). `python3 -m http.server`로 로컬 제공.
- 에셋: 이미지·폰트·라이브러리·CDN 금지. UI는 전부 SVG/CSS 도형 + 시스템 텍스트.
- 뷰포트: 세로 고정(모바일 우선), 화면 하나에 담고 스크롤 없음. 뷰포트 단위(`dvh`) 기준.
- 상태는 한 곳(JS 객체)에 모으고, 렌더는 상태 -> DOM 단방향으로.
- 숫자 밸런스는 그때그때 최소치만 정한다. 공 하나 섞지 않는다.

## 시스템 스펙

Loop이 **실제로 필요로 만든** 시스템만 여기에 승격한다. 미리 완성하지 않는다.
코드가 바뀌면 이 스펙도 **같은 PR에서** 같이 바꾼다. (Loop 2 승격분)

### 계층 — 단일 `index.html` 안의 네 구역

파일은 계속 하나다(`python3 -m http.server`, `file://` 모두 동작). "데이터 분리"는 파일 분리가 아니라 **구역·스키마 분리**다.
화면에 보이는 한국어 문구는 **전부 DATA의 템플릿**(`{자리}`를 RULE이 `fill`로 채운다)에서 온다. RULE·VIEW에 문구 리터럴을 남기지 않는다.

| 구역 | 책임 | 금지 |
|------|------|------|
| DATA | 자원·카드·팩·하루 사이클·문구(`TEXTS`·`ENDINGS`). 읽기 전용 상수 | DOM 접근, state 변경 |
| RULE | 순수 함수. `state + 입력 -> 새 state` (입력 state는 바꾸지 않는다) | DOM 접근 |
| VIEW | `render(state)` — state -> DOM **단방향**, state 하나로 화면이 전부 결정 | state 변경, 판정·수식 정책 |
| CONTROLLER | 이벤트 -> RULE 호출 -> `render` | 직접 DOM 조작, 판정 |

### state 스키마 (단일 원천)

```
{ phase, day, slot, resources, cardId, usedToday, effect, pending, ending }
```

| 필드 | 값 | 뜻 |
|------|----|----|
| `phase` | `card` \| `effect` \| `end` | 지금 보이는 화면. 뷰는 이 값만으로 결정 |
| `day` | 1.. | 일차 |
| `slot` | 0.. | 지금(방금) 플레이한 하루 슬롯 인덱스 = 그날의 몇 번째 선택 |
| `resources` | `{health, mood, time}` | 자원 현재값. 키는 `RESOURCES`에서 옴 |
| `cardId` | string | 현재 카드 |
| `usedToday` | string[] | 오늘 이미 나온 카드(중복 방지). 새 하루에 리셋 |
| `effect` | null \| 페이로드 | `{tag, title, deltas, flavor, conseq, dayEnd, nextLabel}` — 효과 화면이 표시할 것 전부 |
| `pending` | null \| `slot` \| `day` \| `end` | 효과 화면의 "다음"이 어디로 갈지 |
| `ending` | null \| `{win, why}` | `phase==="end"`일 때만 값 |

### 자원 스키마 `RESOURCES`

`{ key, ko, min, max, start, ui, shape, deadly }` — `ui`는 `"bar"`(게이지) \| `"pips"`(칸), `shape`은 `SHAPES`의 도형 키, `deadly`는 `true`면 `min` 도달 시 즉시 게임 오버.
한 줄을 추가하면 게이지가 늘어난다(VIEW가 데이터로 조립하므로). 색은 CSS에서 `[data-res="<key>"] { --res: ... }` 한 줄.

확정 자원(Loop 2에서 숫자 변경 없음): 체력 0~100 시작 48 deadly / 기분 0~100 시작 48 deadly / 시간 0~12 시작 8 non-deadly.
**시간은 소진돼도 죽지 않는다** → `nightfall`(하루 강제 종료)로 전이.

### 카드·팩 스키마

```
PACKS  { <packId>: { ko, cards: [cardId, ...] } }   ← 팩이 카드를 참조(단방향). 카드는 자기 팩을 모른다
CARD   { id, tag, title, text, options: [OPTION] }   ← 소재는 MATERIALS.md에서 픽션화
OPTION { label, flavor, effects: {<resourceKey>: number}, conseq: {tone, text} }
```

- `effects`에 없는 자원 = 0. 부호·색·라벨 같은 **표시는 VIEW가 계산**하고, DATA는 authored 값만 가진다.
- 시간 표시·적용값 = `effects.time - DAY_CYCLE.baseTimeCost`.
- `conseq.tone` ∈ `good` \| `bad` \| `note`.

### 하루 사이클 스키마 `DAY_CYCLE`

| 필드 | 뜻 |
|------|----|
| `goalDays` | 이 일수를 채우면 승리 |
| `baseTimeCost` | 선택 1회의 기본 시간 소모 |
| `timeRefill` | 새 하루에 채워 주는 시간 |
| `slots` | 하루의 선택 칸 배열. 칸마다 `{packs:[packId,...]}` = 그 칸에서 뽑을 수 있는 팩. **하루 길이 = `slots.length`** |
| `noRepeatInDay` | 하루 안에서 같은 카드를 다시 뽑지 않는다(풀이 부족하면 자동 해제) |
| `rest` | 슬롯을 다 채워 하루를 마감할 때 `{effects, text}` |
| `nightfall` | 시간을 다 태웠을 때 `{effects, text}` |

확정값(Loop 2는 기존 숫자를 그대로 옮기기만 한다): `goalDays 3`, `baseTimeCost 1`, `timeRefill 12`, `rest {health:+4, mood:+3}`, `nightfall {health:-5, mood:-4}`, 슬롯 5칸 = 아침 → 아침·학교 → 학교 → 학교·집 → 집.

### 상태 전이

| # | 현재 phase | 트리거 | 조건 | 다음 phase | 하는 일 |
|---|-----------|--------|------|-----------|---------|
| T0 | — | `newGame()` | — | `card` | state 초기화 → 슬롯 0 드로 |
| T1 | `card` | `choose(i)` | 항상 | `effect` | 옵션 `effects` 적용 → 하루 종료 판정 → `effect` 페이로드 기록 |
| T2 | `effect` | `next()` | `pending==="end"` | `end` | — |
| T3 | `effect` | `next()` | `pending==="day"` | `card` | `slot=0`, `usedToday=[]`, 드로 |
| T4 | `effect` | `next()` | `pending==="slot"` | `card` | `slot+1`, 드로 |
| T5 | `end` | `restart()` | — | `card` | T0과 같다 |

- **죽음·승리도 `effect`를 지난다.** 불변식 2("선택 즉시 효과 표시")를 끊지 않으려고 T1은 항상 `effect`로 가고, 종료 화면은 T2에서 넘긴다.
- T1 안의 판정 우선순위: ① deadly 자원 `min` 도달 → 죽음 ② 시간 `min` 도달 → `nightfall` 적용 후 deadly 재검사 → 죽음 or 하루 넘김 ③ 마지막 슬롯 → `rest` 적용 후 하루 넘김 ④ `day > goalDays` → 승리 ⑤ 아니면 계속.
- 하루 넘김에서 `day+1`·`timeRefill`은 **T1 시점**에 적용한다(효과 화면의 숫자와 상단 게이지가 어긋나지 않게). 카드 드로만 T3에서.

### 데이터 무결성 규칙 (카드·자원을 추가할 때마다 지킨다)

1. 카드 id는 유일하고, 모든 카드는 **정확히 하나의 팩**에 속한다.
2. 모든 팩은 `slots`에서 최소 한 번 참조된다(고아 팩 금지 = 죽은 데이터 금지).
3. `effects`·`rest`·`nightfall`의 키는 `RESOURCES.key` 부분집합이다.
4. `conseq.tone`은 `good|bad|note` 중 하나.
5. 각 슬롯의 후보 카드는 1장 이상, 하루 길이만큼 **중복 없이** 뽑을 수 있어야 한다.
