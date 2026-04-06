# Team Summary Card + Drill-down

## Purpose
팀을 compact한 요약 카드로 먼저 보여주고, 클릭하면 해당 팀의 멤버 상세 뷰로 drill-down하는 2단계 네비게이션을 제공한다. 현재는 모든 멤버가 펼쳐져 있어 팀 간 비교가 어렵다.

## Requirements
- Overview 모드에서 각 팀을 `TeamDashboardCard` 컴포넌트로 표시한다 (3-4줄: 팀 이름, 멤버 status dots, active/idle count, 최근 활동 시간)
- 팀 카드 클릭 시 `selectedTeam` state가 설정되고, 해당 팀 멤버만 기존 AgentCard로 보여주는 Detail view로 전환된다
- Detail view 상단에 Back 버튼과 팀 이름 헤더를 표시하며, Escape 키로도 Overview로 복귀한다
- Ungrouped agents는 Overview 하단에 기존 카드 형태로 표시한다
- `selectedTeam` state는 `string | null`로 관리하며, `null`이면 Overview 모드이다

## Approach
AgentsView 내부에 `selectedTeam` state를 추가한다. `selectedTeam === null`이면 팀별 `TeamDashboardCard`를 그리드로 렌더링하고, 값이 있으면 해당 팀의 `teamGroups` 항목을 찾아 멤버를 기존 AgentCard로 렌더링한다. `TeamDashboardCard`는 AgentsView.tsx 내부에 새로 정의하며, team.members에서 매칭된 agents 정보를 집계하여 표시한다. Escape 키 핸들러는 `useEffect`로 등록하고, `selectedTeam`이 null이 아닐 때만 활성화한다. 필터/검색/정렬은 두 모드 모두에서 동작하되, Overview에서는 팀 단위 필터링(팀 내 매칭 agent가 있으면 팀 표시), Detail에서는 멤버 단위 필터링을 적용한다.

## Verification
- Overview에서 각 팀이 compact 카드로 표시되고, active/idle 카운트가 정확하다
- 팀 카드 클릭 시 해당 팀 멤버 상세 뷰로 전환되고, Back 버튼이 표시된다
- Escape 키를 누르면 Overview로 즉시 복귀한다
- Overview에서 검색 시 매칭 멤버가 있는 팀만 표시된다
- Ungrouped agents가 Overview 하단에 정상 표시된다

## Implementation Status
- [x] `TeamOverviewCard` 컴포넌트 — 팀 이름, status dots, active/idle count, 멤버 목록, 이벤트 수, 최근 활동
- [x] `selectedTeam` state (`string | null`) — null이면 Overview, 값이면 Detail
- [x] Detail view — Back 버튼 + 팀 이름 헤더 + 멤버 AgentCard 목록
- [x] Escape 키로 Overview 복귀
- [x] Ungrouped agents 하단 별도 표시
- **Note**: Case 4 (Team Dashboard Overview)와 통합되어 `"teams"` ViewMode로 구현됨
