# design-lab

웹 인터랙션 연습물 모음이다.

> 최초 기록: 2026-09-28
> 원본은 이 폴더(`claude-rules/design-lab/`)다. 공개 레포 `AHTTOH/design-lab` 은 `git subtree` 로 내보낸 복사본이고 GitHub Pages 로 배포된다.

공개 주소: https://ahttoh.github.io/design-lab/

## 구성

```
index.html                    목록 페이지
after-dark-1/index.html       AFTER DARK I. 오로라 셰이더, 글자 흩어짐, 속도 마키, 가로 갤러리
after-dark-2/index.html       AFTER DARK II. Three.js 파티클 모프, 스크램블, 줌 터널, RGB 분리
after-dark-3/index.src.html   AFTER DARK III 원본. 직접 고치는 파일
after-dark-3/build.mjs        텍스처를 인라인해서 index.html 을 만든다
after-dark-3/index.html       빌드 결과. 직접 고치지 않는다
assets/img/                   ChatGPT OAuth 프록시로 만든 이미지(webp)
assets/img/tex/               WebGL 텍스처. III 빌드 때 data URI 로 들어간다
assets/video/                 Google Flow 영상(720p, 8초)과 첫 프레임 포스터
assets/thumb/                 목록 페이지 썸네일
```

## AFTER DARK III 고치는 법

`file://` 로 연 페이지에서는 WebGL 이 외부 이미지를 읽지 못한다. 그래서 텍스처를 HTML 안에 넣어 빌드한다.

```
cd design-lab/after-dark-3
node build.mjs
```

## 미디어를 만든 방법

- 이미지: ChatGPT OAuth 프록시. `~/.claude/reference/codex-oauth-image/` 참고
- 영상: `instafactory/factories/shorts` 의 Flow 파이프라인. Omni 1.1 Flash, 720p, 8초, 한 편에 12크레딧

영상 프롬프트는 이렇다.

| 파일 | 프롬프트 |
|---|---|
| `v1.mp4` | Slow drifting smoke and fog in total darkness, cinematic, black background, subtle blue rim light, static camera, no text |
| `v2.mp4` | Deep cosmic nebula slowly swirling, violet and cobalt glow, tiny stars, dark background, slow motion, no text |
| `v3.mp4` | Liquid chrome ocean with slow heavy waves, iridescent blue and magenta reflections, black sky, static camera, no text |

## 공개 레포로 내보내기

claude-rules 에서 커밋한 뒤 이 폴더만 공개 레포로 밀어 넣는다.

```
cd claude-rules
git subtree push --prefix design-lab https://github.com/AHTTOH/design-lab.git main
```
