# design-lab

웹 인터랙션 연습물 모음이다.

> 최초 기록: 2026-09-28
> 작업 원본은 로컬 `C:\Users\sh\design-lab` (공개 레포 `AHTTOH/design-lab`, main) 이다. main 에 푸시하면 GitHub Pages 로 바로 배포된다.
> `claude-rules/design-lab/` 은 백업 사본이다. 거기서 직접 고치지 않고 아래 방법으로 끌어온다.

공개 주소: https://ahttoh.github.io/design-lab/

## 구성

```
index.html                    목록 페이지
stardust/index.html           STARDUST. 캔버스 별가루, 휠 속도 워프, 마우스 가루
after-dark-1/index.html       AFTER DARK I. 오로라 셰이더, 글자 흩어짐, 속도 마키, 가로 갤러리
after-dark-2/index.html       AFTER DARK II. Three.js 파티클 모프, 스크램블, 줌 터널, RGB 분리
after-dark-3/index.src.html   AFTER DARK III 원본. 직접 고치는 파일
after-dark-3/build.mjs        텍스처를 인라인해서 index.html 을 만든다
after-dark-3/index.html       빌드 결과. 직접 고치지 않는다
after-dark-4/index.html       AFTER DARK IV. WebGL2 유체 커서, 영상 텍스트 마스크, 192프레임 이미지 시퀀스 스크롤
after-dark-5/index.src.html   AFTER DARK V 원본. 레이마칭 메타볼, 속도 반응 글자, Three.js 파편 조각과 후처리, 변위 전환 갤러리, CSS 3D 비행, Matter.js 글자, 선 드로잉
after-dark-5/build.mjs        갤러리 스틸 5장을 data URI 로 넣어 index.html 을 만든다 (node after-dark-5/build.mjs)
after-dark-5/index.html       빌드 결과(약 1.1MB). 직접 고치지 않는다
chrome/                       CHROME. Y2K 하늘색·크롬, 액체 금속, 비눗방울, 홀로 카드, 녹는 3D 글자, 하늘 비행. src/*.js 를 build.mjs 가 이어 붙여 index.html 생성, NOTES.md
sumi/                         SUMI 수묵. 흰 화선지, 먹 번짐 WebGL, 산수 레이어, 붓글씨 획순, 먹물 영상 마스크, 매화. js/*.js + sumi.css, build.mjs, NOTES.md
toytown/                      TOY TOWN. 절차 생성 3D 장난감 섬, 건물 낙하 조립, 낮밤, 차 추적 카메라, 틸트시프트. 단일 파일, NOTES.md
vhs/                          VHS. 브라운관·비디오테이프, WebGL 유리층 + 2D 캔버스 테이프 효과, 스크롤 되감기, 채널 돌리기. js/*.js, NOTES.md (Flow 4편, 48크레딧)
8bit/                         8BIT. 스크롤이 조작인 픽셀 횡스크롤 게임, 5개 월드, 정수 배율 픽셀. 단일 파일, NOTES.md
popup/                        POP-UP. Three.js 색종이 팝업북, 경첩 접기, 펼침면 5개. src/*.js + build.mjs, NOTES.md
museum/                       MUSEUM. 3D 미술관 산책, 생성 회화 6점, 조각, 레이저, 영상실. src/*.js + build.mjs, NOTES.md
deepsea/                      DEEP SEA. 수면에서 심해까지, 굴절·커스틱, 물고기 떼, 해파리, 발광 생물. src/*.js + build.mjs, NOTES.md
marble/                       MARBLE RUN. 루브 골드버그 구슬 장치, 스크롤 진행도 하나로 결정되어 정확히 되감김. src/*.js + build.mjs, NOTES.md
seasons/                      SEASONS. 절차 생성 나무의 사계절, 잎·꽃 인스턴싱, 눈 쌓임 셰이더, 포인터 바람. js/ 조각 + build.mjs, NOTES.md
clay/                         CLAY. ChatGPT 이미지 43장으로 만든 점토 스톱모션(Flow 없는 영상 규칙 첫 적용). clay.js, clay.css, NOTES.md
assets/clay/                  CLAY 키프레임(webp, 2.3MB). tools/gen-images-clay.mjs 로 생성
assets/vhs/, assets/popup/, assets/museum/  위 작품들의 영상·이미지
tools/gen-images-vhs.mjs, gen-images-popup.mjs, gen-images-museum.mjs  각 작품 이미지 생성
assets/chrome/, assets/sumi/  위 두 작품의 이미지·영상 (SUMI 영상 3편은 Flow, 36크레딧)
tools/gen-images-chrome.mjs   CHROME 이미지 생성
tools/gen-images-sumi.mjs     SUMI 이미지 생성 (prep-images-sumi.py 가 흰색 보정·알파 마스크)
assets/img/                   ChatGPT OAuth 프록시로 만든 이미지(webp)
assets/img/tex/               WebGL 텍스처. III 빌드 때 data URI 로 들어간다
assets/img/ad4/               IV 의 완성차·분해도 스틸(webp 참조, png 는 원본 보관)
assets/img/ad5/               V 변위 갤러리 스틸 koi, moth, city, diver, bloom (1536x1024, webp 참조, png 는 원본 보관)
assets/seq/ad4-explode/       IV 이미지 시퀀스 001~192.webp (1280x720, 장당 약 45KB, 합계 11MB)
assets/video/                 Google Flow 영상(720p, 8초)과 포스터. V 에서 ad5-ink, ad5-aurora 추가(포스터는 3초 지점 프레임)
assets/thumb/                 목록 페이지 썸네일
tools/gen-images-1.mjs        I·II 이미지 생성 (chrome, glass, orb, bloom)
tools/gen-images-2.mjs        III 이미지와 포스터 스틸 생성 (eclipse, jelly, mask, v1~v3)
tools/gen-images-ad4.mjs      IV 완성차(assembled)와 분해도(exploded) 이미지 생성
tools/gen-images-ad5.mjs      V 갤러리 스틸 5장 생성 (koi, moth, city, diver, bloom)
tools/flow-video.mjs          Flow 영상 생성·다운로드 드라이버. bridge 모드는 시작·끝 이미지 사이를 잇는 영상을 만든다
tools/check-pages.mjs         전 페이지 오류·넘침 검사 (npm run check)
docs/HANDOFF-2026-09-28.md    인수인계서. 취향, 레퍼런스, 작업 순서, 기법 수치, 함정
CLAUDE.md                     이 폴더를 열면 Claude 가 자동으로 읽는 요약
```

## AFTER DARK III 고치는 법

`file://` 로 연 페이지에서는 WebGL 이 외부 이미지를 읽지 못한다. 그래서 텍스처를 HTML 안에 넣어 빌드한다.

```
cd after-dark-3
node build.mjs
```

## 미디어를 만드는 법

이미지는 ChatGPT OAuth 프록시로 만든다. `npx openai-oauth --port 10531` 을 띄우고 `node tools/gen-images-1.mjs` 를 실행한다.
결과가 png 로 나오니 `ffmpeg -i a.png -q:v 80 a.webp` 로 바꿔서 쓴다.

영상은 `node tools/flow-video.mjs gen <출력.mp4> "<프롬프트>" "<파일명 키워드>"` 로 만든다.
내부에서 `instafactory/factories/shorts` 의 Flow 모듈을 쓴다. Omni 1.1 Flash, 720p, 8초이고 한 편에 12크레딧이 든다.
원 파이프라인은 Flow 변경 로그 팝업을 닫지 못하고 720p 완료도 감지하지 못한다(2026-09-28 실측). 그래서 이 드라이버를 따로 뒀다.
Flow 는 다운로드 파일 이름을 영상 내용으로 짓는다. 키워드가 파일 이름과 맞으면 완료로 본다.

| 파일 | 프롬프트 |
|---|---|
| `v1.mp4` | Slow drifting smoke and fog in total darkness, cinematic, black background, subtle blue rim light, static camera, no text |
| `v2.mp4` | Deep cosmic nebula slowly swirling, violet and cobalt glow, tiny stars, dark background, slow motion, no text |
| `v3.mp4` | Liquid chrome ocean with slow heavy waves, iridescent blue and magenta reflections, black sky, static camera, no text |

## AFTER DARK IV 재료

> 기록: 2026-09-28

이미지 시퀀스는 두 장의 스틸 사이를 Flow bridge 로 이어서 만든다.

1. `node tools/gen-images-ad4.mjs` 로 `assets/img/ad4/assembled.png`, `exploded.png` 를 만든다.
2. `node tools/flow-video.mjs bridge assets/video/ad4-explode.mp4 "<프롬프트>" "<키워드>" assets/img/ad4/assembled.png assets/img/ad4/exploded.png`
   Flow 라이브러리는 파일 이름으로 이미지를 검색해 고른다. 업로드 전에 `ad4-car-assembled.png` 처럼 겹치지 않는 이름으로 복사해서 넘긴다.
3. 프레임으로 자른다.

```
ffmpeg -i assets/video/ad4-explode.mp4 -vf scale=1280:-2 -c:v libwebp -quality 50 assets/seq/ad4-explode/%03d.webp
```

bridge 프롬프트: `The complete hypercar slowly and smoothly disassembles, body panels, doors, wheels and internal parts glide apart along clean straight axes into a perfectly aligned exploded view. Static camera, black background, no text.`

8초 24fps 라서 192장이 나온다. 우측 하단의 Flow 워터마크는 가리거나 자르지 않는다.
터널 영상 `ad4-streak.mp4` 는 `gen` 모드로 만들었고 포스터는 빛줄기가 보이는 4초 지점 프레임이다.

## AFTER DARK V 재료

> 기록: 2026-09-28

1. 스틸: `node tools/gen-images-ad5.mjs` 로 `assets/img/ad5/*.png` 를 만들고 `ffmpeg -i x.png -q:v 80 x.webp` 로 바꾼다. 페이지는 webp 만 쓰고 빌드 때 인라인한다.
2. 영상: `node tools/flow-video.mjs gen assets/video/<이름>.mp4 "<프롬프트>" "<키워드>"`
3. 포스터: `ffmpeg -ss 3 -i ad5-ink.mp4 -frames:v 1 -q:v 80 ad5-ink.webp`. 첫 프레임은 잉크가 퍼지기 전이라 3초 지점을 쓴다.

| 파일 | 프롬프트 |
|---|---|
| `ad5-ink.mp4` | Colorful ink drops blooming and swirling slowly in black water, cobalt blue, violet and magenta clouds, macro, slow motion, static camera, no text |
| `ad5-aurora.mp4` | Aurora borealis rippling over a still black ocean at night, green, violet and cobalt curtains of light reflected on the water, slow motion, static camera, no text |

FLIGHT 장면은 이 두 편과 `v1`, `v2`, `v3`, `ad4-streak` 까지 6편을 쓴다.

## 배포와 백업

```
cd C:\Users\sh\design-lab
git add -A
git commit -m "..."
git push
```

푸시하면 Pages 가 1분 안팎으로 다시 배포한다.

claude-rules 백업은 이렇게 갱신한다.

```
cd /c/Users/sh/claude-rules
rm -rf design-lab/* && git -C ../design-lab archive main | tar -x -C design-lab
git add -A design-lab && git commit -m "chore: sync design-lab backup" && git push
```

두 레포 히스토리가 이어져 있지 않아서 `git subtree pull` 은 거부된다. 그래서 커밋된 main 을 통째로 풀어 덮어쓴다.
