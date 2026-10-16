# NEON FOUNDRY / 네온 파운드리

모바일 우선 Canvas 2D 생존 로그라이크. **무기를 조합해 나만의 빌드를 만들고, 쏟아지는 적을 쓸어버린다.**

## 게임 실행 (설치·빌드 없음)

```sh
python -m http.server 8765 --bind 0.0.0.0
```

로컬 브라우저: http://localhost:8765 · Arena에서는 8765 LIVE PREVIEW 사용.
게임은 `index.html` 하나이며 런타임 외부 의존성, 이미지/폰트 다운로드, WebGL, 빌드 도구가 없습니다.

- 모바일: 왼쪽 조이스틱 이동, 오른쪽 대시, 자동 공격, 중앙 카드 선택
- PC: WASD / 방향키, Space 대시, Esc 일시정지
- 240초 생존 = VICTORY, HP 0 = GAME OVER
- 일시정지 메뉴에서 같은 무기·같은 티어 2개 융합. 최대 Mythic.
- Lv8 + 지정 패시브 + 정예 상자 = 진화. 시작 화면의 아카이브에서 레시피 확인.
- 64개 무기 구성(16 공격 엔진 × 서로 다른 4개 발사 구성), 16 태그, 16 진화, 5 스타터, 8 패시브.

## 개발 검증 (게임과 별도)

Node 22+, Python 3, Linux `tar`가 필요합니다.

```sh
npm ci
npm test                     # DOM 스텁 + VM 로직/구문 검사, 서버 불필요
npm run test:font            # 선택: gh를 통한 헤드리스용 한글 폰트 캐시
# 위 Python 서버를 별도 실행한 상태에서:
npm run test:play            # 실제 시간 62초 정상 생존 + 무이동 실패/재시작, 약 2~4분
npm run test:input           # 실제 멀티터치/대시/해제/일시정지/화면 크기
npm run test:fixture         # 강제 부하/진화/시너지. 자연 플레이 아님
npm run test:layout          # 다중 시너지 HUD 정적 회귀
```

Playwright 기본 브라우저 CDN 접근이 막혀 npm 패키지 `@sparticuz/chromium`의 바이너리를 사용합니다. `tests/browser.cjs`가 패키지에 포함된 al2023 공유 라이브러리를 임시 폴더에 풀고 브라우저를 실행합니다. npm 의존성은 **테스트 전용**입니다. 한글 폰트는 실제 기기 시스템 폰트를 사용하며, 헤드리스 환경에서만 `test:font`가 선택적으로 필요합니다. 폰트는 Git에 포함하지 않습니다.

공개 진단 API는 `window.__game.snapshot()`뿐입니다. 반환값은 복사본이며 게임 상태를 수정하지 않습니다. 강제 테스트는 응답을 가로채 테스트 전용 함수를 삽입하며 원본 파일에는 치트 API를 만들지 않습니다.

검증 근거와 미검증 범위: [PLAYTEST.md](PLAYTEST.md) · 다음 작업 지침: [HANDOFF.md](HANDOFF.md).
