# SUMI 수묵 작업 노트

> 작성: 2026-09-28 (Opus 5.5 세션)
> 결과물: `sumi/index.html` (빌드 결과). 원본은 `sumi/index.src.html`, `sumi/sumi.css`, `sumi/js/*.js`. 수정 뒤 `node sumi/build.mjs`.

## 방향

AFTER DARK 의 검정 네온과 반대로 간다. 순백 한지(#FFFFFF), 먹의 검정과 여러 단계 회색 번짐, 붉은 낙관 하나.
크림, 아이보리, 베이지는 쓰지 않는다. 종이 결은 흰 바탕 위 옅은 회색 섬유로만 넣었다(`.paper` 레이어, multiply).

| 토큰 | 값 | 쓰임 |
|---|---|---|
| paper | #FFFFFF | 모든 바탕 |
| ink | #000000 | 먹 |
| wash-1~4 | #ECECEC, #CDCDCD, #9A9A9A, #4F4F4F | 번짐 단계, 보조 글 |
| seal | #B2221E | 낙관, 매화 |

서체: 제목은 Song Myung(붓으로 쓴 명조 계열), 세로 글줄은 Nanum Myeongjo. 제목은 전부 `writing-mode: vertical-rl`.

## 장면과 길이

장면 길이는 마크업의 `--len` × `:root --scroll-stretch`(기본 1.5)다. 템포는 배율 하나로 조절한다.

| 장면 | 이름 | --len | 배율 적용 | 기법 |
|---|---|---|---|---|
| 1 | 먹 | 1000vh | 1500vh | WebGL2 먹 번짐 시뮬레이션, 포인터가 붓 |
| 2 | 산 | 1400vh | 2100vh | 절차 생성 산 6겹 + 생성 이미지 원경, 핀홀 투영 카메라 비행, 안개 |
| 3 | 여백 | 1300vh | 1950vh | SVG 붓글씨 획순 드로잉(마스크 dashoffset), 번짐 사본 |
| 4 | 물 | 1100vh | 1650vh | Flow 영상 3편, 붓자국 CSS 마스크가 칠해지고 부풀어 전면이 됨 |
| 5 | 매화 | 1300vh | 1950vh | 캔버스 2D 가지 성장(너비 우선 분기), 붉은 꽃, 꽃잎 낙하 |
| 6 | 낙관 | 900vh | 1350vh | 원상(ensō) 한 획, 낙관 찍기, 자석 버튼(../) |
| 합계 | | 7000vh | 10,500vh | 900px 화면에서 문서 높이 94,500px, 375x812 에서 85,260px |

## 기법과 핵심 수치 (전부 `CONFIG`)

**먹(ink.js).** AFTER DARK IV 의 stable fluids 를 흑백으로 바꿨다. 염료는 R 채널 농도 하나.
- sim 96, dye 768(모바일 384), 압력 16회, curl 9, 속도 소산 1.1, 염료 소산 0.01.
- `bleed` 패스: 매 스텝 4이웃 평균 쪽으로 확산, 속도는 종이 섬유 텍스처에 비례(rate 0.16 × (0.55 + 섬유 × 6)). 먹이 결을 따라 스민다.
- 표시 셰이더: 농도가 임계값(0.07 × 노이즈 0.35~1.65)을 넘는 곳만 먹으로 칠해 가장자리를 날카롭고 들쭉날쭉하게, 안쪽 0.2 폭에 마르며 짙어지는 테두리, 바깥에 옅은 회색 번짐, 저주파 노이즈로 먹이 고이는 얼룩.
- 스크롤 진행 0.04~0.54 사이 9지점에서 먹방울이 한 번씩 떨어진다(앞으로 지날 때만). 0.8~0.97 에서 씻겨 흰 종이가 된다.
- 포인터 이동 경로를 3px 간격으로 찍어 붓선이 끊기지 않게 한다. 빠르게 그을수록 가늘고 옅다.

**산(mountains.js).** 봉우리 몇 개(가우시안 절반 + 라플라시안 절반의 max) + fbm 으로 능선을 만들고, 능선 아래 농도를 `exp(-d/깊이 × 1.7)` 로 빼서 산자락이 안개로 풀린다. 담묵은 0.5 해상도 ImageData 로 칠해 올려 붙이고, 능선 윤곽, 준법 획, 태점, 소나무(점 뭉치 여러 층)는 원 해상도 벡터로 그린다. 한 겹당 캔버스 하나, 장면 근처에 오면 한 번만 칠한다.
- 카메라 z 는 0 → 4.8, 각 겹 배율 = z / (z - camZ), 원점은 수평선 42vh. 가로 흔들림 9vw + 포인터 2.2vw 를 거리 반비례로.
- 거리 0.75~1.7 에서 사라진다. 너무 가까이 확대된 겹은 윤곽이 거칠게 보여서 일찍 뺐다.

**붓글씨(brush-geom.js, brush.js).** 획마다 중심선(SVG path) → 5px 간격 샘플 → 폭 함수(시작 누름 1.3배, 흔들림, 끝 모양 needle/dew/fly) → 몸통 다각형 + 붓털 13가닥의 선. 마른 붓은 붓털마다 잉크량을 주고 노이즈로 끊는다. 시작 캡은 왼쪽 위로 기울여 역입처럼 보이게 했다. 각 획은 자기 마스크(중심선 stroke, `pathLength=1`, dashoffset 1→0)로 드러난다. 같은 획을 blur 7px 로 한 벌 더 깔아 번짐으로 쓴다. 획 순서는 여(ㅇ, ㅕ 두 가로, 세로) 백(ㅂ 네 획, ㅐ 세 획, ㄱ). 끝에서 마지막 획 쪽으로 9배 확대해 흰 종이로 넘어간다.

**물(water.js).** `mask-image: 붓자국, linear-gradient` 를 intersect 로 겹친다. 그라데이션 경계가 왼쪽에서 오른쪽으로 가면 붓이 칠하듯 영상이 드러난다. 마스크 폭 86vw(모바일 150vw) → 2400vw 로 부풀면 붓자국 몸통이 화면을 덮고, 다 덮이면 마스크를 끈다. 닫을 때는 다시 줄이며 앞쪽부터 마른다. 영상은 `grayscale contrast(1.12) brightness(1.1)` + multiply 로 배경을 흰 종이에 맞춘다. 보이는 영상만 재생한다.

**매화(plum.js).** 너비 우선 큐로 줄기와 굵은 가지를 먼저 만들고 잔가지는 나중에(세그먼트 상한 900). 굵은 가지는 방향 흔들림 0.5, 가는 가지는 0.28(가끔 2.4배로 꺾음). 각도는 -2.6~0.35 라디안으로 묶어 화면 밖으로 안 나가게 했다. 가지는 선분이 아니라 한 개의 테이퍼 다각형으로 칠한다(선분마다 칠하면 겹친 이음매가 마디처럼 보였다). 굵은 가지에 점선 갈필 4줄, 분기점에 태점. 꽃은 가지가 자란 순서대로 0.34~0.86 에서 핀다. 0.86 이후 꽃잎이 떨어진다.

**낙관(end.js).** 원상은 붓글씨와 같은 생성기로 한 획. 낙관은 떨어지는 속도를 세제곱으로 가속해 손으로 누르는 느낌을 내고, 닿는 순간 화면이 0.6% 눌린다. 누른 뒤 흐린 사본이 3.5% 번진다. 자석 버튼은 `../` 목록으로.

**reduced-motion.** Lenis 끔, 먹은 초기 방울 + 140스텝을 미리 돌린 정지 화면(포인터로 그리면 그때만 다시 그림), 안개 흐름 끔, 붓글씨와 매화와 원상은 완성본, 영상은 포스터만, 확대 전환 없음.

## 함정

- `file://` 에서 WebGL 이 외부 이미지를 못 읽는다 → 종이 텍스처는 빌드 때 data URI. CSS `mask-image` 도 CORS 로 가져오므로 `file://` 에서 깨진다 → 붓자국 마스크도 data URI(`--brush-mask` 변수). 둘 다 `build.mjs` 가 넣는다(HTML 약 111KB).
- `<video>` 는 WebGL 텍스처가 아니라서 `file://` 에서도 그냥 나온다.
- 붓 몸통 다각형에서 시작 캡 점 순서를 뒤집으면 다각형이 꼬여 머리 부분이 따로 떨어진 조각처럼 보인다.
- 산 겹에 z-index 를 1부터 매기면 같은 pin 안의 흰 veil(z 4)과 글줄이 그 뒤로 숨는다. veil 30, 글 31 로 올렸다.
- 먹 시뮬레이션에서 curl 을 크게 두면 연기처럼 휘돌고, 0 에 가깝게 두면 둥근 얼룩만 남는다. 임계값 셰이더 + curl 9 가 종이 위 먹물 모양에 가장 가까웠다.
- Python 으로 JS 파일을 텍스트 모드로 쓰면 Windows 에서 CRLF 가 된다. 파일 편집은 Node 나 에디터 도구로 한다.
- 제목 서체로 Nanum Brush Script 를 먼저 썼는데 크게 키우면 매직펜 글씨처럼 보였다. Song Myung 으로 바꿨다(브리프 예시와 다름).

## 재료

이미지: ChatGPT OAuth 프록시, `node tools/gen-images-sumi.mjs`(한 장씩, 429 면 60초 대기 후 최대 5회), `python tools/prep-images-sumi.py`(흰색을 정확히 #FFFFFF 로 올리고 마스크에 알파를 만든 뒤 png 삭제). 공통 머리말:
`Traditional East Asian ink wash painting on pure white paper (#FFFFFF, not cream, not ivory, not beige), black sumi ink with soft grey washes, high resolution scan, no text, no letters, no signature, no watermark, no border, no frame.`

| 파일 | 프롬프트 요지 | 쓰임 |
|---|---|---|
| paper.webp | 빈 한지 매크로, 옅은 회색 섬유 | 페이지 종이 결, 먹 시뮬레이션 섬유(인라인) |
| brush-mask.webp | 굵은 가로 마른 붓 한 획 | 물 장면 마스크(인라인, 알파) |
| seal.webp | 붉은 주사 낙관 하나 | 산 장면 작은 낙관, 끝 장면 큰 낙관(알파) |
| mountains.webp | 겹겹이 안개 낀 산, 소나무 | 산 장면 원경(아래쪽 그라데이션 마스크) |
| plum.webp | 왼쪽에서 들어오는 늙은 매화 가지 | 매화 장면 뒤 흐린 회색 잔상(좌우 반전, 흑백) |

영상: Google Flow(`tools/flow-video.mjs gen`), 720p 8초, 한 편 12크레딧, 3편 36크레딧 사용. 포스터는 3.5~4초 프레임을 webp 로.

| 파일 | 프롬프트 |
|---|---|
| ink-cloud.mp4 | Extreme macro of soft black sumi ink clouds billowing and folding very slowly in clear water, the ink fills the frame, no glass, no container edges, no surface line, pure white background, black ink with many grey washes, static camera, slow motion, no text |
| ink-plume.mp4 | Thick black sumi ink poured slowly into clear water, heavy plumes curling and unfolding sideways into layered grey veils like mountain mist, pure white background, black ink only, static camera, slow motion, bright even studio light, no text |
| ink-bloom.mp4 | A single drop of black sumi ink falls into a clear glass of water and slowly blooms into soft billowing clouds and delicate tendrils, pure white background, black ink only, static camera, slow motion, macro, bright even studio light, no text |

ink-bloom 은 유리잔 테두리가 보여서 마지막 닫히는 붓자국 안에만 짧게 쓴다. Flow 반짝이 워터마크는 가리지 않았다(데스크톱 전면 구간에서 오른쪽 아래에 보인다).

## 2026-09-28 추가: 빈 화면 줄이기

지적: 20지점 샘플 중 5장이 거의 흰 종이였다(장면 사이 전환). "여백"은 순간이어야 하고 구간이 되면 안 된다.
기준: 40지점 균등 샘플에서 밝기 235 초과 픽셀이 95% 넘는 화면이 2장 이하, 연속 없음. 전체 길이(7000vh × 1.5)와 장면은 그대로 두고 전환만 겹쳤다.

| 장면 | 바꾼 것 (전부 `CONFIG`) |
|---|---|
| 먹 | wash 0.8~0.97 완전 소거 → 0.86~1, 최대 0.62(흔적이 남음). 스크롤 속도 밀기 scrollForce 2 → 0.5, 속도 상한 12(빠르게 내리면 먹이 화면 밖으로 쓸려 나가던 문제). 첫 방울 크게 |
| 산 | 끝의 흰 veil 1 → 0.35(산이 비친 채로 넘김) |
| 여백 | 원경 산 그림(mountains.webp)이 글씨 뒤에 남아 0.85 → 0.22 로 옅어짐. 획 0.01~0.62 로 당김, 획 폭 1.3배, 번짐 blur 12px, 불투명도 0.42. 확대 0.9~1, 9배 → 4배, 끝 불투명도 0.35 |
| 물 | 첫 프레임부터 ink-cloud 스틸을 0.42 로 전면에 깔고 붓자국이 커지면 걷음. 칠하기 0.08 로 단축. 끝에서 스틸을 0.4 로 다시 깔고, 닫힘은 0.7 까지만 |
| 매화 | 줄기가 이미 42% 자란 상태에서 시작(growStart), 성장 0~0.48, 줄기 폭 34 → 46, 참고 그림 잔상 0.4 → 0.2 |
| 낙관 | 원상이 30% 그려진 상태에서 시작, 0~0.26 에 완성, 폭 74 → 98. 낙관 0.3~0.42, 버튼 0.5~0.6 |

결과(자체 샘플러, 40지점, 휠로 조금씩 내리고 1.8초 대기):

| 조건 | 전 | 후 |
|---|---|---|
| 1280x720 | 12장, 연속 있음(13~17 다섯 장 연속) | 0장 |
| 375x812 | 측정 안 함 | 1장(매화 시작), 연속 없음 |

썸네일은 매화가 핀 프레임으로 다시 만들었다(`assets/thumb/sumi.webp`, 960x540).

## 검증 (2026-09-28)

`node sumi/build.mjs` 후 `python -m http.server 4203`, Playwright 로 1440x900, 375x812, reduced-motion 을 끝까지 조금씩 내리며 스크린샷. 세 조건 모두 콘솔 오류 0, 실패 요청 0, 가로 넘침 없음. `file://` 로 연 것도 오류 0, 먹 시뮬레이션 정상.
