# Plan: Electron App 지원 추가

## Context
Claude Hook Logger 대시보드를 브라우저뿐 아니라 Electron 데스크톱 앱으로도 실행할 수 있게 한다. 기존 웹 버전은 그대로 유지하면서, 동일한 프론트엔드/백엔드 코드를 Electron에서 재사용한다. Electron main process에서 기존 `createServer()`를 임포트하여 내장 서버를 띄우고, BrowserWindow로 로드하는 방식.

## 새로 생성할 파일

### 1. `electron/main.ts` — Electron 메인 프로세스
- `app.whenReady()`에서:
  - Production: `createServer()` 임포트 → 7777 포트 서버 시작 → BrowserWindow로 `http://localhost:7777` 로드
  - Dev (`ELECTRON_DEV` env): 서버 시작 안 함 → BrowserWindow로 `http://localhost:5173` (Vite HMR) 로드
- `window-all-closed` → `app.quit()`
- macOS `activate` → 윈도우 재생성
- Packaged 앱에서는 `process.resourcesPath`로 웹 에셋 경로 결정

### 2. `electron/preload.ts` — Preload 스크립트
- `contextBridge.exposeInMainWorld('electronAPI', { isElectron: true, platform: process.platform })`
- 최소한으로 유지, 필요 시 확장

### 3. `electron/tsconfig.json` — Electron 전용 TS 설정
- `module: "CommonJS"` (Electron main process는 CJS)
- `outDir: "../dist/electron"`
- ESM 서버 모듈은 dynamic `import()`로 로드

## 수정할 파일

### 4. `package.json`
- **devDependencies 추가**: `electron`, `electron-builder`
- **`"main"` 필드**: `"dist/electron/main.js"` (electron-builder 필수)
- **scripts 추가**:
  - `"electron:dev"`: `ELECTRON_DEV=1 electron dist/electron/main.js`
  - `"electron:build:ts"`: `tsc -p electron/tsconfig.json`
  - `"electron:build"`: `pnpm run build && pnpm run electron:build:ts && electron-builder --mac`
  - `"electron:start"`: `electron dist/electron/main.js`
- **`"build"` 필드** (electron-builder 설정):
  - `appId`: `com.claude-hook-logger.app`
  - `mac.target`: `["dmg"]`
  - `extraResources`: `dist/web` → `web`, `viewer/index.html` → `viewer/index.html`
  - `directories.output`: `release`

### 5. `justfile`
- `electron-dev` recipe 추가
- `electron-build` recipe 추가

### 6. `.gitignore`
- `release/` 추가 (electron-builder 출력)

## 변경하지 않는 파일
- `viewer/server.ts` — `createServer()`는 이미 충분히 파라미터화되어 있음
- `viewer/start.ts` — 웹 전용 진입점으로 그대로 유지
- `web/src/**` — 프론트엔드 코드 변경 불필요 (`/api/*` fetch 그대로 동작)
- `tsconfig.json` — 이미 `electron/` 제외됨
- `test/**` — 기존 테스트 영향 없음

## 핵심 설계 결정

| 결정 | 이유 |
|------|------|
| Electron main은 CJS | Electron main process 기본이 CJS, ESM 서버는 dynamic import로 로드 |
| Production에서만 내장 서버 | Dev에서는 Vite HMR 활용을 위해 외부 서버 사용 |
| `extraResources`로 웹 에셋 배치 | asar 안에서 `fs.readFileSync`가 제대로 동작하지 않으므로 리소스로 분리 |
| 기존 코드 수정 최소화 | 웹 버전에 영향 없도록 `electron/` 디렉토리에 격리 |

## 구현 순서

1. `electron` + `electron-builder` devDependencies 설치
2. `electron/tsconfig.json` 생성
3. `electron/preload.ts` 생성
4. `electron/main.ts` 생성
5. `package.json` 수정 (main, scripts, build 설정)
6. `justfile`에 recipe 추가
7. `.gitignore`에 `release/` 추가
8. Dev 워크플로우 테스트
9. Production 빌드 테스트

## Verification

- `pnpm run electron:build:ts && ELECTRON_DEV=1 pnpm run electron:dev` → Electron 창에 대시보드 표시
- `just viewer` → 기존 웹 버전 정상 동작
- `pnpm run electron:build` → `release/` 디렉토리에 .dmg 생성
- `pnpm test` → 기존 테스트 전부 통과
- Electron 앱에서 이벤트 목록, 세션 상세, 채팅 기능 동작 확인
