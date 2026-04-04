# 구현 피드백 수정 플랜

## Context

4개 스펙 구현 후 실제 사용 테스트에서 3가지 문제 발견. 스크린샷 기반 피드백으로 수정 필요.

## 문제 및 수정

### 1. Events 뷰 세션 칩 과다 표시 → 제거

**문제**: `agent-filter-bar`에 모든 세션이 칩으로 나열되어 화면 절반 차지 (64개 세션 등). 선별 불가.
**해결**: EventTimeline에서 agent-filter-bar 자체를 제거. 복수 에이전트 필터링은 AgentsView에서 multi-select 후 Events 전환으로 처리.

**AgentsView 변경**: filter 버튼을 토글 방식으로 변경 → 여러 에이전트 선택 가능. 선택된 세션들을 `selectedSessions` Set에 추가. Events 전환은 별도 "View Events" 버튼.

**수정 파일:**
- `web/src/components/EventTimeline.tsx`: agent-filter-bar 섹션 삭제, `onToggleSessionFilter` prop 제거, `agents` prop 제거
- `web/src/components/AgentsView.tsx`: filter 버튼을 multi-select 토글로 변경, "View filtered events" 버튼 추가
- `web/src/components/DetailPanel.tsx`: props 정리
- `web/src/App.tsx`: `handleFilterBySession`을 multi-select 로직으로 변경

### 2. claude -r / fork-session 명령어 수정

**문제**: `claude -r` 뒤에 session ID가 빠져있고, `--fork-session`에 `-r`도 빠져있음.
**올바른 문법** (claude-code-guide 에이전트 확인):
- Resume: `cd {cwd} && claude -r {sessionId}`
- Fork: `cd {cwd} && claude -r {sessionId} --fork-session`

**수정 파일:**
- `web/src/components/AgentsView.tsx` L261, L268:
  - `claude -r` → `claude -r {sessionId}`
  - `claude --fork-session {sessionId}` → `claude -r {sessionId} --fork-session`

### 3. tmux, summary 버튼 미동작 → 디버깅

**문제**: 버튼 클릭 시 동작 없음.
**원인**: `onOpenTmux`와 `onGenerateSummary`는 `useAgents` hook에서 서버 API를 호출함. 서버가 `/api/agents/:id/open-tmux`와 `/api/agents/:id/summary`를 처리해야 함. 서버가 실행 중인지, 엔드포인트가 존재하는지 확인 필요.

**수정 파일:**
- `viewer/server.ts`: 해당 엔드포인트 존재 여부 확인
- `web/src/hooks/useAgents.ts`: API 호출 로직 확인, 에러 핸들링 추가 (현재 실패해도 무시됨)

## 스펙 업데이트

### `specs/agent-session-ux.md`
- 명령어 수정: `-r {sessionId}`, `-r {sessionId} --fork-session`
- filter 버튼 → multi-select 토글로 변경

### `specs/event-detail-view.md`
- agent-filter-bar 삭제, AgentsView에서 multi-select 방식으로 변경

## Verification
- Events 뷰에서 세션 칩 바가 사라졌는지 확인
- AgentsView에서 여러 에이전트 filter 선택 후 Events 전환 시 해당 세션만 표시되는지 확인
- claude -r 버튼 클릭 시 `cd {cwd} && claude -r {sessionId}` 복사되는지 확인
- fork-session 버튼 클릭 시 `cd {cwd} && claude -r {sessionId} --fork-session` 복사되는지 확인
- tmux/summary 버튼 동작 확인 (서버 API 응답 확인)
