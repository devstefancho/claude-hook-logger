# Compact Table View 토글

## Purpose
AgentsView에 Card/Table 뷰 모드 토글을 추가하여, 많은 에이전트를 한 화면에서 빠르게 스캔할 수 있는 테이블 뷰를 제공한다. 현재 카드 뷰는 정보가 풍부하지만 에이전트 수가 많을 때 스크롤이 과다하다.

## Requirements
- AgentsView 헤더에 Card/Table 뷰 모드 토글 스위치를 추가한다 (아이콘 버튼 2개: 그리드/리스트)
- `viewMode` state를 `"card" | "table"`로 관리하며, 기본값은 `"card"`이다
- Table 뷰에서 agent 하나는 한 row로 표시한다: status dot, name(또는 sessionId 앞 8자), project, branch, last activity(relative time), actions(tmux/filter/summary)
- 새 `AgentTableRow` 컴포넌트를 생성하며, 기존 `AgentCard` 컴포넌트는 수정하지 않는다
- 팀 그룹화가 적용된 상태에서도 테이블 뷰가 동작한다 (팀 헤더 행 + 멤버 행)

## Approach
AgentsView 컴포넌트 내부에 `viewMode` state를 추가하고, 헤더의 정렬 드롭다운 옆에 토글 버튼을 배치한다. `viewMode === "table"`일 때 기존 카드 그리드 대신 `<table>` 기반 레이아웃을 렌더링하되, `filterAndSort` 로직은 그대로 재사용한다. `AgentTableRow`는 AgentsView.tsx 내부에 정의하고, props는 AgentCard와 동일한 인터페이스를 사용한다. 팀 그룹 렌더링 시 team 헤더는 `<tr>` colspan으로 처리하고, collapsedTeams 상태도 동일하게 적용한다. CSS는 `.agent-table` 클래스로 styles.css에 추가하며, Terminal Brutalism 변수(`--border-color`, `--bg-secondary` 등)를 사용한다.

## Verification
- 토글 클릭 시 Card ↔ Table 뷰가 즉시 전환된다
- Table 뷰에서 status dot 색상이 agent 상태에 맞게 표시된다
- 검색, 상태 필터, 정렬이 Table 뷰에서도 동일하게 동작한다
- 팀 그룹이 있는 경우 팀 헤더 행이 표시되고 접기/펼치기가 동작한다
- Table 뷰에서 tmux/filter/summary 액션 버튼이 정상 동작한다

## Implementation Status
- [x] `ViewMode` 타입에 `"compact"` 모드 추가 (table 대신 accordion 방식으로 변경)
- [x] `AgentMiniCard` 컴포넌트 — 한 줄 mini card (status dot + name + project + status badge)
- [x] `expandedCards` state (`Set<string>`) — 카드별 accordion 펼치기/접기
- [x] 팀 그룹 내 accordion 동작 (team header collapse + 개별 card expand 독립 동작)
- [x] View mode 토글 UI (▦ Grid / ≡ List / ⊞ Team / ◫ Split)
- **Note**: 원래 `<table>` 기반 레이아웃 대신 accordion/mini card 방식으로 구현됨. Case 3과 통합.
