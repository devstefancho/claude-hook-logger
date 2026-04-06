# 카드 컴팩트화 및 팀 인라인 펼침

## Purpose
대시보드의 에이전트 카드를 데이터 밀도에 맞게 컴팩트하게 줄이고, 팀 카드 클릭 시 화면 전환 대신 인라인 accordion 펼침으로 전환하며, idle 세션을 한 줄 수준으로 초컴팩트하게 표시하여 72개 이상 세션에서도 한눈에 파악 가능한 UX를 제공한다.

## Requirements
- 팀 카드(TeamOverviewCard) 클릭 시 `selectedTeam` 화면 전환 대신, 카드 아래에 멤버 카드가 accordion으로 펼쳐지는 인라인 expand/collapse 패턴 적용
- Active 에이전트 카드의 padding/margin/font-size를 축소하고 session-id/commands 영역을 접이식으로 변경하여 카드 높이를 ~40% 절감
- Idle 에이전트는 MiniCard 수준의 한 줄(one-liner) 레이아웃으로 표시하되, 클릭 시 full 카드로 펼쳐지는 방식
- 기존 다크 테마 디자인 시스템(CSS 변수, border-left status color)과 일관성 유지
- Grid/List/Split 등 다른 viewMode에도 동일한 컴팩트 원칙 적용

## Approach
Dashboard 모드(`renderDashboardOverview`)에서 `selectedTeam` 기반 화면 전환 로직을 제거하고, `TeamOverviewCard` 클릭 시 `expandedTeams` state를 토글하여 카드 바로 아래에 멤버 목록을 렌더링한다. AgentCard 컴포넌트에 `compact` prop을 추가하여 session-id, commands, variant banners 영역을 기본 숨김 처리하고, idle 상태 에이전트는 기존 `AgentMiniCard`를 재사용하여 한 줄로 표시한다. CSS는 `.agent-card-v2.compact` modifier로 padding 6px, font-size 축소를 적용하고, `.idle-one-liner` 클래스로 idle 전용 스타일을 분리한다.

## Verification
- Dashboard 모드에서 팀 카드 클릭 시 화면 전환 없이 멤버가 카드 아래에 펼쳐지고, 다시 클릭하면 접히는지 확인
- Active 카드가 기존 대비 ~40% 낮은 높이로 표시되고 핵심 정보(name, status, project, last activity)가 모두 보이는지 확인
- Idle 세션이 한 줄로 표시되고 클릭 시 full 카드로 펼쳐지는지 확인
- 72개 이상 ungrouped 세션에서 스크롤 성능이 정상이고 한 화면에 더 많은 세션이 보이는지 확인
- `just build-check` 타입 에러 없음, `just test` 기존 테스트 통과 확인
