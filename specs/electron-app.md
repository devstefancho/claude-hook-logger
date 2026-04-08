# Electron App 지원

## Purpose
Claude Pulse 대시보드를 Electron 앱으로도 실행할 수 있게 한다. 기존 웹 버전(브라우저 + Node.js 서버)은 그대로 유지하면서, 동일한 프론트엔드와 백엔드 코드를 Electron 앱에서도 사용할 수 있도록 진입점만 분리한다.

## Requirements
- Electron 앱 실행 시 main process에서 기존 Node.js 서버(viewer/server.ts)를 내장 실행하고, renderer에서 React 대시보드를 로드한다
- 웹 버전(`just viewer`)과 Electron 버전(`pnpm run electron:dev`)을 독립적으로 실행할 수 있다
- 프론트엔드(web/src/)와 백엔드(viewer/) 코드는 공유하며, Electron 전용 코드는 `electron/` 디렉토리에 격리한다
- Electron 앱은 macOS .dmg 또는 .app으로 패키징할 수 있다 (electron-builder 사용)
- 기존 테스트와 빌드 파이프라인에 영향을 주지 않는다

## Approach
`electron/` 디렉토리에 main.cts(메인 프로세스)와 preload.cts를 CommonJS 형식으로 추가한다. main.cts에서 기존 `createServer()`를 동적 임포트하여 내장 서버(포트 7777)를 띄우고, BrowserWindow로 로드한다. `ELECTRON_DEV` 환경변수로 dev/prod를 분기하며, dev 모드에서는 localhost:5188(Vite dev server)을, prod에서는 내장 서버를 로드한다. 빌드는 기존 `tsc + vite build` 이후 별도 `tsc -p electron/tsconfig.json`으로 Electron 코드를 컴파일하고, electron-builder로 패키징한다. electron-builder 설정은 package.json의 `build` 필드에 정의한다.

## Verification
- `pnpm run electron:dev`로 Electron 앱이 열리고 대시보드가 정상 표시된다
- `just viewer`로 기존 웹 버전이 변함없이 동작한다
- `pnpm run electron:build`로 macOS .app 파일이 생성된다
- Electron 앱에서 이벤트 목록, 세션 상세, 채팅 기능이 모두 동작한다
- 기존 `pnpm test`가 모두 통과한다

## Implementation Status
- [x] `electron/main.cts` — 메인 프로세스 (서버 내장, BrowserWindow 생성)
- [x] `electron/preload.cts` — contextBridge로 `electronAPI` 노출
- [x] `electron/tsconfig.json` — CommonJS 타겟, `dist/electron/`으로 출력
- [x] `package.json` scripts — `electron:dev`, `electron:start`, `electron:build`, `electron:build:ts`
- [x] `package.json` build — electron-builder 설정 (appId: com.claude-pulse.app, productName: Claude Pulse, mac dmg/zip)
- [x] electron v41, electron-builder v26 의존성 추가
