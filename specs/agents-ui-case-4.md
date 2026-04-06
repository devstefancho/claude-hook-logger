# Team Dashboard Overview

## Purpose
팀 레벨 대시보드를 먼저 보여줘서 전체 팀 상태를 한눈에 파악하고, 팀 클릭으로 상세 뷰에 진입하는 구조를 제공한다. 현재는 멤버 단위로만 나열되어 팀 간 상태 비교가 어렵다.

## Requirements
- 팀 대시보드 카드에 다음 정보를 표시한다: 팀 이름, 멤버 status dots(가로 나열), active/idle count, 멤버 이름 목록, 총 이벤트 수
- 2열 반응형 그리드 레이아웃으로 팀 카드를 배치한다 (화면 너비 800px 이하에서 1열)
- 팀 카드 클릭 시 해당 팀 멤버를 기존 AgentCard로 보여주는 상세 뷰로 전환된다
- Ungrouped agents는 대시보드 하단에 별도 섹션으로 표시한다
- 상세 뷰에서 Back 버튼과 Escape 키로 대시보드로 복귀한다

## Approach
AgentsView에 `dashboardMode` state(`"overview" | "detail"`)와 `selectedTeam` state를 추가한다. Overview 모드에서 `TeamOverviewCard` 컴포넌트를 2열 CSS Grid(`grid-template-columns: repeat(auto-fill, minmax(360px, 1fr))`)로 배치한다. 각 `TeamOverviewCard`는 teamGroups에서 해당 팀의 agents를 집계하여 status dots, count, 멤버명을 표시한다. 이벤트 수는 agents의 eventCount 합산으로 계산한다. 팀 카드 클릭 시 `selectedTeam`을 설정하고 `dashboardMode`를 `"detail"`로 전환한다. Detail 모드에서는 해당 팀 멤버를 기존 AgentCard로 렌더링하되, 필터/검색/정렬은 멤버 단위로 적용한다.

## Verification
- Overview에서 팀 카드가 2열 그리드로 배치된다
- 각 팀 카드에 status dots, active/idle count, 멤버 목록, 이벤트 수가 표시된다
- 800px 이하에서 1열로 전환된다
- 팀 카드 클릭 → 상세 뷰 전환 → Back/Escape로 복귀가 정상 동작한다
- Ungrouped agents가 대시보드 하단에 표시된다

## Implementation Status
- [x] `TeamOverviewCard` 컴포넌트 — 팀 이름, member count, status dots, 멤버명 목록, active/idle count, 총 이벤트 수, 최근 활동
- [x] `team-dashboard-grid` CSS Grid 레이아웃 (2열 반응형)
- [x] `selectedTeam` drill-down — 팀 카드 클릭 → 멤버 상세 뷰 전환
- [x] Back 버튼 + Escape 키 복귀
- [x] Ungrouped agents 하단 섹션
- [x] `renderDashboardOverview()` — `"teams"` ViewMode로 구현
- **Note**: Case 2 (Team Summary Card + Drill-down)의 기능을 포함. `dashboardMode` 대신 `selectedTeam` null 체크로 Overview/Detail 전환.
