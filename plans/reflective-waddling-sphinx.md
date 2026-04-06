# URL 상태 저장 구현 계획

## Context

현재 웹 대시보드는 모든 UI 상태(뷰, 필터, 검색, 탭 등)가 `useState`로만 관리되어 새로고침 시 전부 초기화됨. URL query params에 상태를 저장하여 새로고침 후에도 유지되고, URL 공유로 동일한 뷰를 재현할 수 있도록 개선.

## 접근 방식

`useState` 드롭인 대체 훅 `useUrlState`를 만들어 각 컴포넌트에서 최소한의 변경으로 적용. 외부 라이브러리 불필요 (URLSearchParams + history.replaceState만 사용).

## 구현 단계

### 1. `web/src/hooks/useUrlState.ts` 신규 생성

- `useUrlState<T>(key, defaultValue, options?)` — useState와 동일한 API
- `useUrlSetState(key, defaultSet)` — Set<string> 전용 래퍼
- 모듈 레벨 공유 write buffer + 100ms debounce로 replaceState 호출
- 기본값과 동일하면 URL에서 제거 (깔끔한 URL 유지)
- string/number/boolean 자동 직렬화, Set은 comma-separated

### 2. App.tsx — 3개 상태 교체

- `activeView` → `useUrlState<SidebarView>("view", "agents")`
- `layoutMode` → `useUrlState<LayoutMode>("layout", "full")`
- `selectedSessions` → `useUrlSetState("sessions", new Set())`

### 3. useLogData.ts — 1개 상태 교체

- `currentFile` → `useUrlState("file", "hook-events.jsonl")`

### 4. useAgents.ts — 1개 상태 교체

- `threshold` → `useUrlState("threshold", 5)`

### 5. EventTimeline.tsx — 5개 상태 교체

- `activeFilters` → `useUrlSetState("filters", new Set(Object.keys(EVENT_TYPES)))`
- `searchText` → `useUrlState("search", "")`
- `searchField` → `useUrlState<SearchField>("searchField", "all")`
- `timeRange` → `useUrlState<TimeRange>("timeRange", "all")`
- `viewMode` → `useUrlState<"list"|"chart">("evView", "list")`

### 6. AgentsView.tsx — 5개 상태 교체

- `searchQuery` → `useUrlState("agentSearch", "")`
- `statusFilter` → `useUrlState<StatusFilter>("status", "all")`
- `sortBy` → `useUrlState<SortBy>("agentSort", "status")`
- `viewMode` → `useUrlState<ViewMode>("agentView", "teams")`
- `selectedTeam` → `useUrlState<string|null>("team", null)` (serialize: `v => v ?? ""`, deserialize: `v => v || null`)

### 7. ToolsView.tsx / SkillsView.tsx — 각 3개 상태 교체

- ToolsView: `toolSort`, `toolSearch`, `toolMin`
- SkillsView: `skillSort`, `skillSearch`, `skillMin`

## URL 파라미터 맵

| Key | Default | Example |
|-----|---------|---------|
| `view` | `agents` | `?view=events` |
| `layout` | `full` | `?layout=compact` |
| `file` | `hook-events.jsonl` | `?file=other.jsonl` |
| `sessions` | (empty) | `?sessions=abc,def` |
| `threshold` | `5` | `?threshold=60` |
| `search` | `""` | `?search=Read` |
| `searchField` | `all` | `?searchField=tool` |
| `filters` | (all types) | `?filters=Stop,PreToolUse` |
| `timeRange` | `all` | `?timeRange=1h` |
| `evView` | `list` | `?evView=chart` |
| `agentSearch` | `""` | `?agentSearch=foo` |
| `status` | `all` | `?status=active` |
| `agentSort` | `status` | `?agentSort=name` |
| `agentView` | `teams` | `?agentView=cards` |
| `team` | `null` | `?team=MyTeam` |
| `toolSort`/`skillSort` | `count` | `?toolSort=az` |
| `toolSearch`/`skillSearch` | `""` | |
| `toolMin`/`skillMin` | `1` | `?toolMin=5` |

## 수정 대상 파일

- `web/src/hooks/useUrlState.ts` (신규)
- `web/src/App.tsx`
- `web/src/hooks/useLogData.ts`
- `web/src/hooks/useAgents.ts`
- `web/src/components/EventTimeline.tsx`
- `web/src/components/AgentsView.tsx`
- `web/src/components/ToolsView.tsx`
- `web/src/components/SkillsView.tsx`

## 주의사항

- `activeFilters` 기본값은 `Object.keys(EVENT_TYPES)` 전체 — 전체 선택 시 URL에서 제거
- replaceState 사용 (pushState 아님) — 브라우저 히스토리 오염 방지
- 기존 `handleToolClick`/`handleSkillClick` DOM 해킹은 그대로 유지 (onChange 트리거하므로 호환됨)
- expandedIdx, highlightIdx, copiedId 등 ephemeral 상태는 URL에 저장하지 않음

## 검증 방법

1. `just dev`로 서버 시작
2. 각 뷰에서 필터/검색/탭 변경 후 URL에 파라미터 반영 확인
3. 새로고침 후 동일한 상태 복원 확인
4. 기본값 상태에서 URL이 깨끗한지 확인 (파라미터 없음)
5. `just build-check`로 타입 에러 없는지 확인
6. `just test`로 기존 테스트 통과 확인
