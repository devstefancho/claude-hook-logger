# Claude Hook Logger - Development Commands

# 기본 레시피 (just만 입력 시 실행)
default:
    @just --list

# --- Build ---

# tsc 컴파일 → pnpm run build
build:
    pnpm run build

# 타입 체크만 → pnpm run build:check
build-check:
    pnpm run build:check

# --- Test ---

# 테스트 실행 → pnpm test (인자로 특정 파일 지정 가능)
test *args:
    pnpm test {{args}}

# 커버리지 포함 테스트 → pnpm run test:coverage
test-coverage:
    pnpm run test:coverage

# --- Install / Uninstall ---

# hook 설치 → ./install.sh
install:
    ./install.sh

# hook 제거 → ./uninstall.sh
uninstall:
    ./uninstall.sh

# --- Viewer ---

# 대시보드 서버 시작 + 브라우저 열기 → ./tools/log-viewer.sh --open
viewer:
    ./tools/log-viewer.sh --open

# 서버 중지 → ./tools/log-viewer.sh --stop
viewer-stop:
    ./tools/log-viewer.sh --stop

# 서버 상태 확인 → ./tools/log-viewer.sh --status
viewer-status:
    ./tools/log-viewer.sh --status

# --- Analysis ---

# 인터럽트 분석 → ./tools/analyze-interrupts.sh (인자 전달)
analyze *args:
    ./tools/analyze-interrupts.sh {{args}}

# --- Dev ---

# 포트 7777 점유 프로세스 종료
kill:
    -lsof -ti :7777 | xargs kill -9 2>/dev/null; echo "Port 7777 freed"

# 빌드 후 서버 시작 (기존 포트 점유 프로세스 자동 정리)
dev: kill build
    pnpm run dev:server

# --- Electron ---

# Electron 개발 모드 (사전에 just dev-server 실행 필요, 포트 5188)
electron-dev:
    pnpm run electron:build:ts && pnpm run electron:dev

# Electron macOS 앱 빌드
app:
    pnpm run electron:build

# --- Utilities ---

# dist/ 삭제 → rm -rf dist/
clean:
    rm -rf dist/
