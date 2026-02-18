# Claude Hook Logger

Claude Code hook 이벤트를 JSONL 형식으로 기록하고, 웹 대시보드로 분석하는 시스템.

## 프로젝트 구조

```
hooks/              # Hook 이벤트 로깅 쉘 스크립트 (event-logger.sh, rotate-logs.sh)
tools/              # CLI 분석 유틸리티 (analyze-interrupts.sh, log-viewer.sh)
lib/                # Node.js 라이브러리 (settings-merge.ts)
viewer/             # 웹 서버 백엔드 (server.ts, data.ts, mcp-tools.ts)
web/src/            # React 대시보드 프론트엔드 (Vite + React 19)
test/               # 테스트 스위트 (Node.js built-in test runner)
```

## 기술 스택

- **언어**: TypeScript (strict mode), Bash
- **프론트엔드**: React 19 + Vite 6
- **백엔드**: Node.js HTTP 서버 (viewer/server.ts)
- **패키지 매니저**: pnpm
- **테스트**: Node.js built-in test runner + tsx
- **빌드**: tsc (서버) + Vite (프론트엔드)
- **주요 의존성**: @anthropic-ai/claude-agent-sdk, zod 4, react-markdown

## 개발 명령어

```bash
just build          # tsc 컴파일 + Vite 빌드
just build-check    # 타입 체크만 (tsc --noEmit)
just test           # 테스트 실행
just test-coverage  # 커버리지 포함 테스트
just dev            # 빌드 후 서버 시작
just viewer         # 대시보드 서버 시작 + 브라우저 열기
just clean          # dist/ 삭제
```

## 테스트

```bash
pnpm test                    # 전체 테스트
pnpm test -- test/특정파일.test.ts  # 특정 테스트 파일
pnpm run test:coverage       # 커버리지 리포트
```

- Node.js `--experimental-test-module-mocks` 플래그 사용
- tsx를 통한 TypeScript 직접 실행
- 테스트 헬퍼: `test/helpers/` (bash-runner, fixtures, server-helper)

## 아키텍처

### 이벤트 흐름
Claude Code 세션 -> Hook 이벤트 트리거 -> event-logger.sh (stdin으로 JSON 수신) -> JSONL 파일에 추가 (`~/.claude/hook-logger/hook-events.jsonl`)

### 등록된 Hook 이벤트 (hooks-config.json)
SessionStart, SessionEnd, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, Notification, Stop, SubagentStart, SubagentStop

- SessionStart, UserPromptSubmit: 동기 실행
- 나머지: async 실행

### 웹 대시보드 (포트 7777)
- **data.ts**: JSONL 파싱, 세션 통계, 도구 사용량 집계
- **server.ts**: REST API 엔드포인트 + 정적 파일 서빙
- **mcp-tools.ts**: MCP 도구 핸들러 (get_dashboard_summary, list_sessions, get_session_detail, get_recent_activity, get_tool_skill_usage, search_events)
- **web/src/**: React 컴포넌트, 커스텀 훅 (useLogData, useAutoRefresh, useChat)

### Settings Merge (lib/settings-merge.ts)
- `~/.claude/settings.json`에 hook 설정을 비파괴적으로 병합
- 명령어 패턴 매칭으로 중복 방지
- 정규식 기반 안전한 제거

## 코드 컨벤션

- ESM (package.json `"type": "module"`)
- TypeScript strict 모드
- tsconfig: target ES2022, module NodeNext
- 프론트엔드와 백엔드 tsconfig 분리 (tsconfig.json, web/tsconfig.json)
- 쉘 스크립트에서 JSON 처리는 `jq` 사용
