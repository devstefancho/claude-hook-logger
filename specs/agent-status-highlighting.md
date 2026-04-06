# 에이전트 상태 하이라이팅 + UserPrompt 표시

## Purpose
에이전트의 작업 완료(Stop), Permission 대기(Notification), 최신 UserPrompt를 대시보드에서 시각적으로 표시하여 실시간 상태를 직관적으로 파악할 수 있도록 한다. 3가지 디자인 Variant를 동시 구현하고 URL 스위처로 전환 가능하게 한다.

## Requirements
- AgentInfo 타입에 `justCompleted`(30초 내 Stop), `permissionMessage`(Notification permission_prompt), `latestUserPrompt`(UserPromptSubmit prompt) 필드를 추가하고 `buildAgentList()`에서 채움
- Variant A(Inline): 카드 내 인라인 배너 — completion(초록 glow, 5초 fade), permission(주황 pulse), USER> 프롬프트 표시
- Variant B(Overlay): 카드 상단 고정 permission 배너 + "Go to tmux" 버튼, completion 플로팅 토스트(5초 auto-dismiss), 접이식 프롬프트 섹션
- Variant C(Feed+Dots): 카드 dot 인디케이터(green/amber/blue) + ActivityFeedPanel 컴포넌트 + `/api/activity-feed` API + useActivityFeed 훅 + TopBar bell 아이콘
- URL `?variant=a|b|c` + TopBar 드롭다운으로 variant 전환 (useUrlState 활용, 기본값 a)

## Approach
공통 백엔드(viewer/data.ts, types.ts)를 먼저 구현한 후 3가지 프론트엔드 Variant를 독립적으로 구현한다. AgentsView에서 variant prop에 따라 조건부 렌더링하여 각 Variant의 UI를 분리한다. Variant C만 신규 컴포넌트(ActivityFeedPanel)와 API 엔드포인트가 필요하고, A/B는 기존 AgentsView와 CSS 수정만으로 구현 가능하다. 최종적으로 TopBar에 variant 드롭다운을 추가하여 사용자가 실시간 전환할 수 있게 한다.

## Verification
- 각 variant(`?variant=a`, `b`, `c`)에서 Stop/Permission/UserPrompt 이벤트가 시각적으로 표시되는지 확인
- TopBar 드롭다운으로 variant 전환 시 URL 파라미터가 반영되고 UI가 즉시 변경되는지 확인
- Variant C의 Activity Feed 패널에서 필터링(All/Stop/Perm/Prompt)이 동작하고 항목 클릭 시 해당 에이전트로 스크롤되는지 확인
- `just build-check` 타입 에러 없음, `just test` 기존 테스트 통과 확인
