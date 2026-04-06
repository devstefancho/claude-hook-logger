# Split Panel

## Purpose
좌측에 팀/에이전트 목록 패널, 우측에 선택된 항목의 상세 정보를 동시에 표시하는 split panel 레이아웃으로, 팀 간 빠른 전환과 상세 정보 확인을 동시에 지원한다.

## Requirements
- AgentsView를 좌측 목록 패널(너비 280px)과 우측 상세 패널(나머지 영역)로 분할한다
- 좌측 패널에 팀 이름(접기/펼치기 가능)과 멤버 이름을 트리 형태로 나열한다 (status dot + name, 한 줄씩)
- 좌측에서 팀 또는 agent 클릭 시 우측에 상세 정보를 표시한다: 팀 선택 시 팀 요약 + 멤버 카드 목록, agent 선택 시 해당 AgentCard 확대 표시
- `selectedItem` state를 `{ type: "team" | "agent", id: string } | null`로 관리한다
- 검색/필터는 좌측 목록에 적용되며, 우측 상세 패널 내용은 영향받지 않는다

## Approach
AgentsView 최상위 레이아웃을 CSS flexbox 기반 split panel(`display: flex`)로 변경한다. 좌측 `.agents-list-panel`(width 280px, overflow-y auto)에 팀/agent 트리를 렌더링하고, 우측 `.agents-detail-panel`(flex 1)에 선택된 항목의 상세를 렌더링한다. 좌측 트리에서 팀 이름은 collapsedTeams state로 접기/펼치기하고, 각 멤버는 클릭 가능한 리스트 아이템으로 표시한다. `selectedItem` state에 따라 우측 패널을 조건부 렌더링하며, 미선택 시 "Select a team or agent" placeholder를 표시한다. 기존 필터/검색 로직은 좌측 목록 데이터에만 적용하고, 우측은 선택된 항목의 원본 데이터를 사용한다.

## Verification
- 좌측에 팀/agent 트리가 표시되고, 우측에 상세 패널이 동시에 보인다
- 좌측에서 팀 클릭 시 우측에 팀 요약 + 멤버 카드가 표시된다
- 좌측에서 agent 클릭 시 우측에 해당 AgentCard가 표시된다
- 좌측 목록에서 검색/필터가 정상 동작하고, 우측 상세는 영향받지 않는다
- 팀 이름 접기/펼치기가 좌측 트리에서 동작한다

## Implementation Status
- [x] `renderSplitPanel()` — `"split"` ViewMode로 구현
- [x] 좌측 `.agents-list-panel` (280px, overflow-y auto, 커스텀 스크롤바)
- [x] 우측 `.agents-detail-panel` (flex 1)
- [x] `splitSelectedItem` state (`{ type: "team" | "agent", id: string } | null`)
- [x] 팀 선택 시 팀 요약(이름, description, active/idle/total) + 멤버 AgentCard 표시
- [x] Agent 선택 시 해당 AgentCard 확대 표시
- [x] 미선택 시 "Select a team or agent" placeholder
- [x] 좌측 트리에서 팀 접기/펼치기 동작
- [x] Escape 키로 선택 해제
