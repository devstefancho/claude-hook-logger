# Focus 모드 네비게이션

## Purpose
사이드바가 완전히 숨겨지는 focus 모드에서 뷰 전환 수단이 없는 문제를 해결하여, 집중 모드에서도 Agents/Tools/Skills/Events 간 전환이 가능하게 한다.

## Requirements
- Focus 모드에서 TopBar 또는 키보드 단축키로 뷰 전환 가능
- TopBar에 뷰 전환 탭/버튼이 focus 모드일 때만 나타남 (full/compact 모드에서는 사이드바가 담당)
- 키보드 단축키 1/2/3/4로 각 뷰 전환 지원
- 현재 활성 뷰가 시각적으로 표시됨

## Approach
focus 모드 진입 시 TopBar에 인라인 탭 바를 조건부 렌더링한다. sidebarMode 상태가 'focus'일 때 TopBar 중앙 영역에 Agents/Tools/Skills/Events 탭을 표시하고, activeView 변경 콜백을 연결한다. 키보드 이벤트는 App 레벨에서 useEffect로 등록하되, 입력 필드 포커스 시에는 무시한다.

## Verification
- Focus 모드에서 TopBar에 뷰 전환 탭이 표시됨
- Full/compact 모드에서는 TopBar에 뷰 전환 탭이 표시되지 않음
- 숫자키 1-4로 뷰 전환이 동작하고, 검색 입력 중에는 무시됨
- 뷰 전환 시 DetailPanel 콘텐츠가 올바르게 변경됨

## Implementation Status
- [x] Focus 모드에서 TopBar 인라인 탭 바 조건부 렌더링
- [x] 키보드 단축키 1/2/3/4로 뷰 전환 (입력 필드 포커스 시 무시)
- [x] 활성 뷰 시각적 표시
