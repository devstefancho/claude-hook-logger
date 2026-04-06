# 로딩 스켈레톤 및 Stale-While-Revalidate 캐시

## Purpose
데이터 로딩 중 "No agents found" 대신 스켈레톤 UI를 표시하고, 이전 데이터를 캐시하여 새로고침 시 stale 화면을 먼저 보여준 뒤 새 데이터로 업데이트하여 사용자 경험을 개선한다.

## Requirements
- AgentsView의 각 렌더 모드(Original, Accordion, Dashboard, SplitPanel)에서 `loading && agents.length === 0`일 때 스켈레톤 UI 표시
- `useAgents` 훅에서 fetch 성공 시 응답 데이터를 sessionStorage에 캐시하고, 초기 로드 시 캐시된 데이터를 즉시 반환(stale-while-revalidate 패턴)
- 스켈레톤 컴포넌트는 실제 카드/리스트 레이아웃과 동일한 구조로 pulse 애니메이션 적용
- 캐시 키에 threshold 값을 포함하여 파라미터별 캐시 분리
- `loading` prop을 AgentsView에 전달하여 로딩 상태를 UI에 반영

## Approach
`useAgents` 훅의 `loadAgents` 함수에서 fetch 성공 시 sessionStorage에 agents/teams 데이터를 저장하고, 초기 state를 sessionStorage에서 복원한다. AgentsView는 `loading` prop을 받아 `agents.length === 0`과 조합하여 스켈레톤을 표시하며, stale 데이터가 있으면 스켈레톤 없이 기존 화면을 유지하면서 백그라운드에서 갱신한다. 스켈레톤 컴포넌트는 AgentsView 내부에 정의하여 각 viewMode별 레이아웃에 맞게 렌더링한다.

## Verification
- URL에 `?team=xxx`로 접속 시 스켈레톤이 먼저 보이고, 데이터 로드 후 실제 화면으로 전환되는지 확인
- 데이터 로드 후 새로고침 시 캐시된 화면이 즉시 표시되고 백그라운드 갱신이 이루어지는지 확인
- threshold 변경 시 해당 파라미터의 캐시가 사용되는지 확인
- `just build-check` 타입 에러 없음, `just test` 기존 테스트 통과 확인
