# Claude Hook Logger

Claude Code의 모든 hook 이벤트를 자동으로 기록하고, 웹 대시보드에서 시각적으로 분석할 수 있는 시스템입니다.

![Dashboard](screenshots/dashboard.png)

## Features

- **자동 이벤트 로깅** — 10가지 Claude Code hook 이벤트를 JSONL 형식으로 기록
- **웹 대시보드** — 세션 타임라인, 도구 사용 차트, 인터럽트/고아 감지 시각화
- **AI 채팅 분석** — Claude SDK 기반 SSE 스트리밍 채팅으로 로그 데이터 분석
- **MCP 도구** — 6개의 구조화된 쿼리 도구로 AI가 직접 데이터를 조회
- **CLI 분석 도구** — 터미널에서 빠른 분석
- **안전한 설정 병합** — 기존 hooks와 settings를 파괴하지 않는 비파괴적 병합
- **로그 로테이션** — 자동 로그 파일 관리
- **원커맨드 설치/제거**

## Prerequisites

- [jq](https://jqlang.github.io/jq/) — 셸 스크립트 JSON 처리
- [Node.js](https://nodejs.org/) 18+ — 서버 및 빌드
- [pnpm](https://pnpm.io/) — 패키지 매니저
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — hook 이벤트 소스

## Quick Start

```bash
git clone https://github.com/devstefancho/claude-hook-logger.git
cd claude-hook-logger
pnpm install
./install.sh
```

`install.sh`가 수행하는 작업:

1. 의존성 확인 (jq, Node.js 18+)
2. TypeScript 빌드 (`pnpm run build`)
3. hook 스크립트를 `~/.claude/hooks/`에 복사
4. `hooks-config.json`을 `~/.claude/settings.json`에 병합
5. 로그 디렉토리 `~/.claude/hook-logger/` 생성

## Usage

### Web Dashboard

```bash
# 대시보드 시작 (기본 포트: 7777)
~/.claude/hooks/log-viewer.sh --open

# 포트 변경
~/.claude/hooks/log-viewer.sh --open --port 8080

# 서버 상태 확인
~/.claude/hooks/log-viewer.sh --status

# 서버 중지
~/.claude/hooks/log-viewer.sh --stop
```

`http://localhost:7777`에서 대시보드에 접근할 수 있습니다.

#### 대시보드 기능

| 구성 요소 | 설명 |
|---|---|
| **StatBar** | 총 이벤트 수, 세션(활성/비활성/종료), 도구 사용, 인터럽트, 고아 호출 통계 |
| **SessionList** | 왼쪽 사이드바에서 세션 목록 조회 및 필터링 |
| **EventTimeline** | 시간순 이벤트 타임라인 (메인 영역) |
| **LeftTabs** | 이슈(인터럽트/고아), 도구 사용량, 스킬 사용량 탭 |
| **ChatPanel** | AI 기반 로그 분석 채팅 (SSE 스트리밍) |

#### 세션 상태 감지

- **Live** — SessionStart 이후 5분 이내 활동이 있는 세션
- **Stale** — SessionStart 이후 5분 이상 활동이 없는 세션
- **Ended** — SessionEnd 이벤트가 있는 세션

### CLI Analysis

```bash
# 오늘 로그 요약
~/.claude/hooks/analyze-interrupts.sh

# 특정 세션 타임라인
~/.claude/hooks/analyze-interrupts.sh <logfile> <session_id_prefix>

# 인터럽트만 표시
~/.claude/hooks/analyze-interrupts.sh --interrupts

# 고아 도구 호출 (PreToolUse에 매칭되는 PostToolUse가 없는 경우)
~/.claude/hooks/analyze-interrupts.sh --orphans

# 세션 요약 테이블
~/.claude/hooks/analyze-interrupts.sh --sessions
```

## Hook Events

`event-logger.sh`는 Claude Code의 hook 이벤트를 stdin으로 JSON을 수신하여 처리합니다.

| Event | Timing | Async | Data Fields |
|---|---|---|---|
| `SessionStart` | 세션 시작 | Sync | `source`, `model` |
| `SessionEnd` | 세션 종료 | Async | `reason` |
| `UserPromptSubmit` | 사용자 프롬프트 전송 | Sync | `prompt` (500자 truncate), `prompt_length` |
| `PreToolUse` | 도구 실행 전 | Async | `tool_name`, `tool_use_id`, `tool_input_summary` |
| `PostToolUse` | 도구 성공 후 | Async | `tool_name`, `tool_use_id`, `success` |
| `PostToolUseFailure` | 도구 실패 후 | Async | `tool_name`, `tool_use_id`, `error`, `is_interrupt` |
| `Notification` | 시스템 알림 | Async | `notification_type`, `message` |
| `Stop` | 에이전트 정지 | Async | `stop_hook_active` |
| `SubagentStart` | 서브에이전트 생성 | Async | `agent_id`, `agent_type` |
| `SubagentStop` | 서브에이전트 종료 | Async | `agent_id`, `agent_type` |

### Tool Input Summary

도구별로 의미 있는 요약 정보를 추출합니다:

| Tool | 추출 내용 |
|---|---|
| Bash | 명령어 (처음 200자) |
| Read / Write / Edit | 파일 경로 |
| Glob / Grep | 패턴 |
| WebFetch | URL |
| WebSearch | 검색 쿼리 |
| Skill | 스킬 이름 |
| Task | 태스크 설명 |

## Log Format

로그는 JSONL (한 줄에 하나의 JSON 객체) 형식으로 `~/.claude/hook-logger/hook-events.jsonl`에 저장됩니다.

```json
{
  "ts": "2025-01-15T09:30:00.000Z",
  "event": "PreToolUse",
  "session_id": "abc123-def456",
  "cwd": "/Users/you/project",
  "permission_mode": "default",
  "data": {
    "tool_name": "Read",
    "tool_use_id": "tool_01ABC",
    "tool_input_summary": "/src/index.ts"
  }
}
```

**공통 필드**: `ts` (ISO 8601), `event`, `session_id`, `cwd`, `permission_mode`
**이벤트별 필드**: `data` 객체 안에 이벤트 타입에 따라 다른 필드가 포함됩니다.

## MCP Tools

AI 채팅에서 사용 가능한 6개의 MCP 도구:

| Tool | 설명 |
|---|---|
| `get_dashboard_summary` | 전체 대시보드 통계 요약 |
| `list_sessions` | 세션 목록 조회 (상태별 필터: live/stale/ended) |
| `get_session_detail` | 특정 세션의 이벤트 및 도구 사용 상세 |
| `get_recent_activity` | 시간 범위 기반 최근 활동 요약 |
| `get_tool_skill_usage` | 도구/스킬 사용 통계 |
| `search_events` | 이벤트 검색 (타입, 도구, 텍스트 필터) |

## Architecture

```
Claude Code Session
  │ (hook 이벤트 트리거)
  ▼
event-logger.sh (stdin으로 JSON 수신)
  │ (이벤트별 데이터 추출)
  ▼
~/.claude/hook-logger/hook-events.jsonl (JSONL append)
  │
  ├──▶ Web Dashboard (localhost:7777)
  │     ├── REST API (/api/files, /api/events, /api/summary)
  │     ├── SSE Chat (/api/chat) + MCP Tools
  │     └── React SPA (세션 목록, 타임라인, 차트, 채팅)
  │
  └──▶ CLI Tools
        ├── log-viewer.sh → 서버 시작/중지/상태
        └── analyze-interrupts.sh → 터미널 분석
```

## Project Structure

```
claude-hook-logger/
├── hooks/                  # Hook 이벤트 로깅 셸 스크립트
│   ├── event-logger.sh     #   이벤트 수신 및 JSONL 기록
│   └── rotate-logs.sh      #   로그 로테이션
├── lib/                    # Node.js 라이브러리
│   ├── settings-merge.ts   #   settings.json 비파괴적 병합
│   └── settings-merge-cli.ts
├── viewer/                 # 웹 서버 백엔드
│   ├── server.ts           #   HTTP 서버 + REST API + SSE
│   ├── data.ts             #   JSONL 파싱, 통계, 필터링
│   ├── mcp-tools.ts        #   MCP 도구 핸들러
│   └── start.ts            #   서버 시작 진입점
├── web/                    # React 프론트엔드 (Vite + React 19)
│   └── src/
│       ├── App.tsx          #   메인 앱 (레이아웃, 상태 관리)
│       ├── components/      #   UI 컴포넌트 (11개)
│       ├── hooks/           #   커스텀 훅 (useLogData, useAutoRefresh, useChat)
│       ├── utils/           #   유틸리티 (상수, 포맷팅)
│       └── types.ts         #   TypeScript 타입 정의
├── test/                   # 테스트 스위트 (9개 파일)
├── tools/                  # CLI 유틸리티
│   ├── log-viewer.sh       #   대시보드 서버 관리
│   └── analyze-interrupts.sh
├── install.sh              # 설치 스크립트
├── uninstall.sh            # 제거 스크립트
├── hooks-config.json       # Hook 이벤트 등록 설정
├── justfile                # 개발 명령어 단축키
└── package.json
```

## Tech Stack

| Category | Technology |
|---|---|
| Language | TypeScript (strict), Bash |
| Frontend | React 19, Vite 6 |
| Backend | Node.js HTTP (Express 없음) |
| AI | @anthropic-ai/claude-agent-sdk |
| Validation | Zod 4 |
| Markdown | react-markdown |
| Package Manager | pnpm |
| Test | Node.js built-in test runner + tsx |
| Build | tsc (서버) + Vite (프론트엔드) |
| Shell JSON | jq |

## Development

### 개발 서버

```bash
# 프론트엔드 dev 서버 (포트 5173, /api를 7777로 프록시)
pnpm run dev

# 백엔드 서버 (포트 7777)
pnpm run dev:server
```

### 빌드 및 테스트

```bash
pnpm run build           # tsc 컴파일 + Vite 빌드 → dist/
pnpm run build:check     # 타입 체크만 (tsc --noEmit)
pnpm test                # 전체 테스트 실행
pnpm run test:coverage   # 커버리지 리포트
```

### justfile 명령어

[just](https://just.systems/)가 설치되어 있다면 단축 명령어를 사용할 수 있습니다:

```bash
just build          # 빌드
just build-check    # 타입 체크
just test           # 테스트
just test-coverage  # 커버리지 테스트
just dev            # 빌드 후 서버 시작
just viewer         # 대시보드 열기
just viewer-stop    # 대시보드 서버 중지
just viewer-status  # 서버 상태 확인
just analyze        # CLI 분석
just clean          # dist/ 삭제
just install        # hook 설치
just uninstall      # hook 제거
```

## Uninstall

```bash
cd claude-hook-logger
./uninstall.sh
```

> **Note:** 로그 파일은 `~/.claude/hook-logger/`에 보존됩니다. 필요 없다면 수동으로 삭제하세요.

## License

MIT
