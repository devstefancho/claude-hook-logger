# Tools/Skills 뷰 인터랙션 강화

## Purpose
현재 바 차트만 표시하는 ToolsView와 SkillsView에 정렬, 검색, 조건 필터를 추가하여 실질적인 분석 도구로 만든다.

## Requirements
- 정렬 옵션: 사용 횟수순(기본), 알파벳순(A-Z / Z-A)
- 텍스트 검색으로 도구/스킬 이름 실시간 필터링
- 조건 필터: 사용 횟수 N 이상 (Min: 1/3/5/10 드롭다운)
- 도구/스킬 항목 클릭 시 Events 뷰로 전환 + 해당 이름으로 필터링

## Approach
ToolsView와 SkillsView에 각각 sortBy, searchQuery, minCount 상태를 추가한다. 정렬은 useMemo로 계산하고, 알파벳순은 localeCompare로 처리한다. 조건 필터는 필터 바에 드롭다운/입력으로 배치하며 검색과 독립적으로 동작한다. 클릭 시 activeView를 'events'로 변경하고 searchQuery에 도구/스킬 이름을 주입하는 콜백을 App에서 전달받는다.

## Verification
- 알파벳순 정렬 시 도구/스킬 목록이 A-Z 순서로 재정렬됨
- 검색 입력 시 도구/스킬 목록이 실시간 필터링됨
- 사용 횟수 조건 필터가 정렬/검색과 동시에 동작함
- 도구 항목 클릭 시 Events 뷰로 전환되고 해당 도구 이벤트만 필터링됨

## Implementation Status
- [x] 정렬 옵션 (Count / A-Z / Z-A)
- [x] 텍스트 검색 실시간 필터링
- [x] Min count 필터 (1/3/5/10 드롭다운)
- [x] 도구/스킬 클릭 → Events 뷰 전환 + 필터링
