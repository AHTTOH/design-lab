# CLAY 작업 노트

> 작성: 2026-09-29 (Opus 5.5 세션)
> 신영환 규칙(2026-09-29) "움직이는 장면은 ChatGPT 이미지를 이어 붙여 만든다, Google Flow 금지"를 처음 적용한 작품이다.

## 개요

주황 점토 친구 핍(Pip)의 하루를 스크롤로 한 장씩 넘기는 클레이 스톱모션이다. 영상 파일은 하나도 없고 키프레임 42장과 기준 이미지 1장이 전부다.
스크롤 위치를 "스텝"으로 양자화해서 모든 변화(프레임, 카메라, 크로스페이드, 제목 카드)가 끊어지며 움직인다. 부드럽게 흐르는 곳이 없어야 스톱모션처럼 보인다.

파일 구성

| 경로 | 내용 |
|---|---|
| `clay/index.html` | 장면 마크업. 장면 길이는 `style="--len"` 만 둔다 |
| `clay/clay.css` | 토큰, 장면별 색(`[data-scene]`), 점토 제목 카드, 필름 그레인 |
| `clay/clay.js` | 스크롤 엔진, 프레임 저장소, 장면별 캔버스 플레이어. 수치는 전부 맨 위 `CONFIG` |
| `tools/gen-images-clay.mjs` | 키프레임 생성 스크립트(재개 가능) |
| `assets/clay/ref.webp` | 캐릭터 기준 이미지 |
| `assets/clay/s1..s6/01..07.webp` | 장면별 키프레임 7장 |
| `assets/thumb/clay.webp` | 목록 썸네일 960x540 (`s4/05` 가운데 크롭) |

## 장면과 길이

`:root { --scroll-stretch: 1 }`, 장면 높이는 `calc(var(--len) * var(--scroll-stretch))` 이다.

| 장면 | 제목 카드 | 길이 | 내용 |
|---|---|---|---|
| s1 | CLAY / 아침 | 1100vh | 점토 침실에서 잠을 깨고 기지개, 문밖으로 |
| s2 | 골목 | 1200vh | 알록달록한 골목을 옆에서 본다. 새에게 손 인사, 과일 가판, 무언가를 보고 멈춤 |
| s3 | 빨간 풍선 | 1100vh | 나무에 걸린 풍선을 잡고 몸이 떠오름 |
| s4 | 하늘 | 1200vh | 지붕 위, 구름 사이, 파랑새, 해, 먹구름이 몰려옴 |
| s5 | 소나기 | 1200vh | 번개, 바람 빠진 풍선, 꽃 정원 잎 위에 착지, 무지개 |
| s6 | 노을 | 1200vh | 언덕에서 노을을 보다 돌아서서 손 인사. "안녕" + 목록으로 가는 자석 버튼 |

합계 7,000vh. 1440x900 에서 문서 높이 63,000px, 375x812 에서 56,840px(`100svh` 기준).

장면 안 구간(`CONFIG`)
- 제목 카드: progress 0~0.035 는 카드가 화면을 덮고, 0.035~0.1 에 6스텝으로 위로 들리며 기울어 떨어져 나간다. 카드 밑에는 이미 1번 프레임이 그려져 있어 빈 화면이 생기지 않는다.
- 프레임: 0.1~0.95 (s6 은 0.1~0.8, 나머지는 엔딩).
- 엔딩: s6 0.84~0.9 에서 4스텝으로 "안녕"과 버튼이 들어온다.

## 스톱모션 재생 방식

- 키프레임 하나를 7스텝 유지하고 다음 키프레임으로 2스텝만 크로스페이드한다(알파 1/3, 2/3). 섞이는 구간이 짧아서 모핑처럼 보이지 않는다.
- 카메라 줌(1.03 → 1.09)과 좌우 팬(1.4%)도 같은 스텝 단위로만 바뀐다. 장면마다 팬 방향이 번갈아 바뀐다.
- 스텝마다 교체 지터: 위치 2.2px, 회전 0.18도, 밝기 3.5% 깜빡임. 스텝 번호로 만든 결정적 난수라 같은 스크롤 위치는 늘 같은 모양이다(되감아도 똑같다).
- 게이트 위브: 보이는 장면의 무대만 12fps 로 0.9px 흔든다. 화면 밖 장면은 멈춘다.
- 제목 글자 끓임(boil): 글자마다 8fps 로 3.2도, 2.2px 흔든다. 카드가 보일 때만 돈다.
- 점토 질감: 제목 카드와 버튼 배경은 SVG `feTurbulence` + `feDiffuseLighting` 범프에 지문 소용돌이(동심 타원) 타일을 `soft-light` 로 얹는다. 글자는 Jua 폰트에 8겹 `text-shadow` 로 두께를 주고 `feDisplacementMap` 으로 가장자리를 울퉁불퉁하게 만든다.
- 맞춤: 가로 화면은 cover 로 채우되 축마다 최대 9%까지만 잘라 캐릭터가 잘리지 않게 한다. 덜 채워지는 부분과 세로 화면의 위아래는 같은 프레임을 흐리고 어둡게 깐 매트로 채운다. 세로 화면은 가로 폭 맞춤 x 1.28.
- 프리로드: 모든 장면의 1, 4, 7번을 먼저, 그다음 장면 순서대로 나머지. 동시 4개, `img.decode()` 가 끝난 것만 쓰고, 목표 프레임이 없으면 같은 장면에서 가장 가까운 로드된 프레임을 그린다. 로딩 표시는 숫자 없는 4px 노란 막대다.
- reduced-motion: Lenis 끔, 장면마다 핵심 스틸 1장만 받는다(`CONFIG.keyFrame`), 제목 카드 대신 좌상단 점토 라벨, 엔딩은 처음부터 보임, 지터와 위브와 끓임과 그레인 애니메이션 없음.

## 일관성 방법과 결과

방법
1. 기준 이미지 `ref.webp` 를 먼저 만든다(하늘색 배경에 핍 정면 전신).
2. 장면 첫 프레임은 `refImagePaths = [ref]`, 그 뒤 프레임은 `[ref, 직전 프레임]` 을 넣는다.
3. 프롬프트는 매번 같은 조각을 이어 붙인다: 화면비 문구, 스타일, "다음 프레임" 지시(같은 세트, 같은 조명, 같은 카메라, 설명한 것만 바꿈), 캐릭터 묘사, 유지 조건, 세트 묘사, 카메라, 이번 프레임 동작.

결과
- 캐릭터 동일성은 42장 모두 합격이다. 몸 색, 눈, 볼, 새싹 잎 두 장이 장면을 넘어가도 유지됐다.
- 세트와 카메라 고정도 좋았다. s1 1~5번, s2 전체, s3 전체, s6 전체가 거의 같은 구도에서 캐릭터만 바뀐다. 진짜 스톱모션에 가깝다.
- 어긋난 것: s1 6, 7번은 카메라가 조금 넓어졌다(문을 보여 주려고). 컷 전환처럼 읽혀서 그대로 두었다. s4 3번은 풍선이 사라져서 다시 만들었다(프롬프트에 "여전히 두 손으로 풍선 줄을 잡고"를 넣으니 한 번에 고쳐짐).
- 크로스페이드 구간에서 캐릭터 위치가 크게 다른 두 장이 섞이면 반투명 겹상이 1~2스텝 보인다(예: s4 2→3 의 새). 스텝이 짧아 거슬리지 않지만 알고는 있어야 한다.

## 프롬프트 (전문은 `tools/gen-images-clay.mjs`)

공통 조각
- 화면비: `Wide landscape 3:2 film frame, horizontal composition, 1536x1024.`
- 스타일: `Handmade plasticine claymation, visible fingerprints and tool marks on clay, miniature set, soft studio lighting, shallow depth of field, saturated playful colours, bold clay colours, no cream, no beige, no text, no letters, no numbers, no logo, no watermark.`
- 캐릭터: `Pip, a small round plasticine creature (not a human, not an animal from any existing franchise): an egg-shaped body of vivid tangerine orange clay, two big round white clay eyes with glossy black pupils, small rosy pink cheek dots, a tiny curved smile line, two short stubby arms, two short stubby feet, a single little teal clay sprout with two leaves on top of its head.`
- 유지: `Keep Pip exactly the same character as in the reference images: same body shape, same tangerine orange colour, same eyes, same teal sprout, same size relative to the set. Pip is always fully visible inside the frame, never cropped.`
- 다음 프레임: `This is the next frame of a stop-motion animation: keep the same set, same props, same lighting and the same camera angle and framing as the previous frame (second reference image), only change what is described.`
- 첫 프레임: `This is the first frame of a new stop-motion shot on a new miniature set. Match the clay style of the reference images.`
- 기준 이미지: 스타일 + `Character reference photo:` + 캐릭터 + `Pip stands facing the camera in a neutral happy pose, full body, centred, on a plain seamless sky blue backdrop with a teal clay floor. Studio product shot.`

장면 세트와 카메라
- s1: 청록 벽 침실, 산호색 침대, 해바라기색 이불, 둥근 창, 코발트 러그, 초록 자명종, 보라 협탁. 정면 와이드, 고정.
- s2: 옆에서 본 골목, 산호, 노랑, 보라, 민트 집, 하늘색 하늘, 점토 조약돌 보도, 청록 가로등, 초록 울타리. 보도 높이 측면, 고정.
- s3: 작은 광장, 둥근 잎 보라 나무, 민트 벤치, 노란 분수, 산호색 타일. 정면 미디엄 와이드, 고정.
- s4: 점토 마을 위 하늘, 멀리 지붕, 하늘색 배경, 흰색과 분홍 구름. 카메라가 핍을 따라가고 배경만 바뀜.
- s5: 보라와 남색 먹구름, 파란 점토 빗방울, 아래에 거대한 꽃 정원. 핍 중심 추적.
- s6: 초록 점토 언덕, 산호와 마젠타와 보라 노을띠, 수평선의 반쯤 진 해. 정면 와이드, 고정.

프레임별 동작 7개씩은 스크립트의 `SCENES.sN.frames` 에 그대로 있다.

## 이미지 수와 용량

- 최종 사용: 43장(기준 1 + 키프레임 42). webp 1280px, quality 70, 장당 약 50~80KB, `assets/clay/` 합계 2.30MB(2,303,154 바이트). 썸네일 25KB.
- 실제 생성 호출: 60회. 정사각 결과 16장을 버렸고(아래 함정 1), s4/03 을 한 번 다시 만들었다. 호출당 31~49초, 429 와 빈 응답은 한 번도 없었다.
- 목표 예산(36~48장)은 최종 사용 기준으로 지켰지만 호출 수로는 12회 넘었다.

## 함정

1. **`size: '1536x1024'` 을 줘도 정사각(1024x1024)이 돌아왔다.** 첫 배치 16장이 전부 정사각이었다. 프롬프트 맨 앞에 `Wide landscape 3:2 film frame, horizontal composition, 1536x1024.` 를 넣고, 스크립트가 PNG 비율을 `ffprobe` 로 재서 1.35 미만이면 버리고 다시 요청하게 했다. 이후 43장 모두 한 번에 가로로 나왔다. 버린 정사각 프레임은 참고 이미지로 쓰지 않도록 폴더째 치웠다(섞이면 다음 프레임도 정사각으로 끌려갈 수 있다).
2. 장면 카드를 순수 단색으로 두면 균등 샘플 검사에서 "거의 빈 화면"으로 잡힌다(표준편차 6~16). 실제로는 큰 점토 글자가 있는 의도된 화면이다. 40지점 중 2곳(시작 CLAY, 노을 카드)이 여기에 걸렸고 연속은 아니다.
3. 카드 질감에 가로로 늘인 `feTurbulence`(baseFrequency `.004 .09`)를 쓰면 점토가 아니라 헤어라인 금속처럼 보인다. 낮은 주파수 범프(.011, surfaceScale 9) + 동심 타원 지문 타일로 바꿨다.
4. 흔들림(지터, 팬)을 넣으면 캔버스 가장자리에 배경색 틈이 보인다. 줌 시작값을 1.0 이 아니라 1.03 으로 둬서 여유를 만든다.
5. `file://` 에서 `type="module"` 스크립트는 CORS 로 막힌다. `clay.js` 는 일반 스크립트(IIFE)다. 2D 캔버스에 이미지를 그리기만 하고 픽셀을 읽지 않아서 캔버스 오염 문제는 없다.
6. 마지막 장면에서 "안녕" 글자가 가운데 있으면 핍 얼굴을 가린다. 가로 화면에서는 엔딩을 오른쪽(바다와 해 쪽)으로 옮겼다.
7. 세로 화면에서 16:9 가까운 프레임을 cover 로 채우면 걷는 장면(s2)에서 핍이 잘린다. 폭 맞춤 x 1.28 + 흐린 매트로 타협했다. 캐릭터는 다 보이지만 그림이 화면 가운데 띠로 작게 보인다.

## 검증 (2026-09-29)

- 서버 `python -m http.server 4234 --bind 127.0.0.1`, Playwright(`design-lab/node_modules/playwright`).
- 1440x900, 375x812, reduced-motion, `file://` 네 조건 모두 콘솔 오류 0, 실패 요청 0, 가로 넘침 없음.
- 1280x720 에서 휠로 조금씩 내려 1.5초 기다린 40지점 샘플: 거의 빈 화면 2장(제목 카드 2장, 비연속).
- 스크린샷: 세션 scratchpad `lab-clay/`.
