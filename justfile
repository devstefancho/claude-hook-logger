# Claude Hook Logger - Development Commands

# 기본 레시피 (just만 입력 시 실행)
default:
    @just --list

# --- Build ---

# tsc 컴파일 → npm run build
build:
    npm run build

# 타입 체크만 → npm run build:check
build-check:
    npm run build:check

# --- Test ---

# 테스트 실행 → npm test (인자로 특정 파일 지정 가능)
test *args:
    npm test {{args}}

# 커버리지 포함 테스트 → npm run test:coverage
test-coverage:
    npm run test:coverage

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

# --- Utilities ---

# dist/ 삭제 → rm -rf dist/
clean:
    rm -rf dist/
