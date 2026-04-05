# Electron App 지원

## Purpose
Claude Hook Logger 대시보드를 Electron 앱으로도 실행할 수 있게 한다. 기존 웹 버전(브라우저 + Node.js 서버)은 그대로 유지하면서, 동일한 프론트엔드와 백엔드 코드를 Electron 앱에서도 사용할 수 있도록 진입점만 분리한다.

## Requirements
- Electron 앱 실행 시 main process에서 기존 Node.js 서버(viewer/server.ts)를 내장 실행하고, renderer에서 React 대시보드를 로드한다
- 웹 버전(`just viewer`)과 Electron 버전(`just app` 또는 `pnpm run electron`)을 독립적으로 실행할 수 있다
- 프론트엔드(web/src/)와 백엔드(viewer/) 코드는 공유하며, Electron 전용 코드는 `electron/` 디렉토리에 격리한다
- Electron 앱은 macOS .dmg 또는 .app으로 패키징할 수 있다
- 기존 테스트와 빌드 파이프라인에 영향을 주지 않는다

## Approach
`electron/` 디렉토리에 main.ts(메인 프로세스)와 preload.ts를 추가한다. main.ts에서 기존 `createServer()`를 임포트하여 내장 서버를 띄우고, BrowserWindow로 `http://localhost:7777`을 로드한다. 빌드는 기존 `tsc + vite build` 이후 electron-builder로 패키징하는 단계를 추가한다. Vite dev 모드에서는 Electron이 localhost:5173(Vite dev server)을 로드하도록 분기한다. electron-builder 설정은 package.json의 `build` 필드에 정의한다.

## Verification
- `pnpm run electron:dev`로 Electron 앱이 열리고 대시보드가 정상 표시된다
- `just viewer`로 기존 웹 버전이 변함없이 동작한다
- `pnpm run electron:build`로 macOS .app 파일이 생성된다
- Electron 앱에서 이벤트 목록, 세션 상세, 채팅 기능이 모두 동작한다
- 기존 `pnpm test`가 모두 통과한다
