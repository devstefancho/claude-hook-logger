---
name: electron-build
description: Electron 앱 빌드, DMG 생성 및 테스트. 트리거: "앱 빌드", "dmg 만들어", "electron build", "배포 빌드", "앱 패키징"
allowed-tools: Bash(pnpm*), Bash(just*), Bash(hdiutil*), Bash(open*), Bash(ls*), Bash(file*), Read, Edit
---

# Electron App Build & Deploy

## 빌드 절차

### 1. 빌드 실행

```bash
# 전체 빌드 (tsc + vite + electron-builder)
pnpm run electron:build
# 또는
just app
```

내부적으로 다음 순서로 실행됨:
1. `tsc -p tsconfig.json` (서버 컴파일)
2. `vite build` (프론트엔드 번들)
3. `tsc -p electron/tsconfig.json` (Electron 컴파일)
4. `electron-builder --mac` (DMG 패키징)

### 2. 빌드 결과물

- 출력 디렉토리: `release/`
- 파일명 패턴: `Claude Pulse-{version}-arm64.dmg`

### 3. DMG 테스트

```bash
# 마운트
hdiutil attach "release/Claude Pulse-{version}-arm64.dmg"

# 앱 실행
open "/Volumes/Claude Pulse {version}-arm64/Claude Pulse.app"

# 사용자 확인 후 언마운트
hdiutil detach "/Volumes/Claude Pulse {version}-arm64"
```

### 4. 버전 범핑

빌드 전에 필요 시 `package.json`의 `version` 필드를 업데이트한다.

```json
"version": "1.0.0"  // -> 원하는 버전으로 변경
```

## 코드 서명 (현재 비활성)

현재 `package.json`에서 `"identity": null`, `"notarize": false`로 설정되어 서명 없이 빌드된다.

Apple Developer 인증서로 서명하려면:
1. `package.json`의 `build.mac`에서 `"identity": null` 제거
2. `"notarize": false` → `true`로 변경
3. 환경변수 설정: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

## 주요 설정 파일

| 파일 | 역할 |
|---|---|
| `package.json` ("build") | electron-builder 설정 |
| `electron/main.cts` | Electron 메인 프로세스 |
| `electron/preload.cts` | 프리로드 스크립트 |
| `electron/tsconfig.json` | Electron TypeScript 설정 |
| `build/entitlements.mac.plist` | macOS 권한 |
| `build/icon.icns` | macOS 앱 아이콘 |
| `build/icon.ico` | Windows 앱 아이콘 |
| `build/icon.png` | Linux/범용 아이콘 |

## 개발 모드

```bash
# Vite dev 서버 + Electron (핫 리로드)
just electron-dev
```
