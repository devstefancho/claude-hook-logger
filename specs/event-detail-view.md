# 이벤트 상세 보기 및 검색 강화

## Purpose
EventTimeline의 검색과 필터링을 강화하고, 이벤트 상세 JSON 보기를 추가하여 개별 이벤트의 전체 payload를 탐색할 수 있게 한다.

## Requirements
- 텍스트 검색 강화: 현재 JSON stringify 전체 검색에 더해, 특정 필드(tool name, event type 등) 대상 검색 옵션 제공
- 에이전트 필터 복수 선택: AgentsView에서 multi-select 후 Events 전환 시 selectedSessions로 필터링 (Events 뷰 자체에는 세션 칩 UI 없음)
- 이벤트 행 클릭 시 하단에 상세 JSON payload 펼치기/접기 (아코디언)
- 시간 범위 필터 추가 (최근 1시간, 6시간, 24시간, 전체)

## Approach
selectedSession을 단일 string에서 Set<string>으로 변경하여 복수 세션 필터를 지원한다. App.tsx에서 관리하는 상태와 AgentsView의 filter 액션 콜백도 함께 수정한다. 텍스트 검색은 검색 바 옆에 드롭다운으로 검색 대상 필드를 선택할 수 있게 하고, 기본은 전체 검색을 유지한다. 이벤트 상세는 expandedId 상태로 관리하며, 가상화 리스트의 동적 높이를 활용한다. 시간 범위 필터는 필터 바에 드롭다운으로 추가한다.

## Verification
- 복수 에이전트를 동시에 필터링하면 해당 세션들의 이벤트만 표시됨
- 필드 지정 검색(예: tool name = "Read")이 전체 검색과 독립적으로 동작함
- 이벤트 행 클릭 시 상세 JSON이 펼쳐지고 다시 클릭하면 접힘
- 시간 범위 필터 변경 시 해당 범위의 이벤트만 표시됨

## Implementation Status
- [x] 필드별 검색 드롭다운 (All / Tool name / Event type / Session ID / Data)
- [x] 복수 세션 필터링 (`selectedSessions` Set<string>)
- [x] 이벤트 행 클릭 → JSON 상세 펼치기/접기 (accordion)
- [x] 시간 범위 필터 (All / 1h / 6h / 24h)
