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
assets/img/                   ChatGPT OAuth 프록시로 만든 이미지(webp)
assets/img/tex/               WebGL 텍스처. III 빌드 때 data URI 로 들어간다
assets/video/                 Google Flow 영상(720p, 8초)과 첫 프레임 포스터
assets/thumb/                 목록 페이지 썸네일
tools/gen-images-1.mjs        I·II 이미지 생성 (chrome, glass, orb, bloom)
tools/gen-images-2.mjs        III 이미지와 포스터 스틸 생성 (eclipse, jelly, mask, v1~v3)
tools/flow-video.mjs          Flow 영상 생성·다운로드 드라이버
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
