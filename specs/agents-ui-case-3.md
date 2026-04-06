# Expandable Mini Cards / Accordion

## Purpose
에이전트를 기본적으로 한 줄 mini card로 표시하고 클릭 시 accordion으로 펼쳐 상세 정보를 보여줌으로써, 화면 공간을 효율적으로 사용하면서도 필요할 때 상세 정보에 접근할 수 있게 한다.

## Requirements
- 기본 상태에서 각 agent는 한 줄 mini card로 표시한다: status dot + name + project name (한 줄에 모두 수평 배치)
- Mini card 클릭 시 accordion으로 펼쳐지며, 기존 AgentCard의 전체 내용(branch, last activity, prompts, actions 등)을 표시한다
- `expandedCards` state를 `Set<string>`으로 관리하며, 여러 카드를 동시에 펼칠 수 있다
- 펼침/접힘 전환 시 CSS transition으로 부드럽게 애니메이션한다
- 팀 그룹 내에서도 mini card → accordion 동작이 동일하게 적용된다

## Approach
AgentsView에 `expandedCards` state(`Set<string>`, sessionId 기반)를 추가한다. 각 agent 렌더링 시 `expandedCards.has(sessionId)`를 체크하여, false이면 `AgentMiniCard` 컴포넌트(새로 생성, 한 줄 레이아웃)를, true이면 기존 `AgentCard`를 렌더링한다. `AgentMiniCard` 클릭 핸들러에서 expandedCards를 토글한다. 애니메이션은 `max-height` transition과 `overflow: hidden`으로 구현하며, 펼침 시 AgentCard를 wrapping하는 div에 `.expanded` 클래스를 적용한다. CSS는 `.agent-mini-card` 클래스를 styles.css에 추가하고, Terminal Brutalism 변수를 사용한다.

## Verification
- 기본 상태에서 모든 agent가 한 줄 mini card로 표시된다
- Mini card 클릭 시 해당 카드가 accordion으로 펼쳐지고, 기존 AgentCard 내용이 모두 보인다
- 펼쳐진 카드를 다시 클릭하면 접힌다
- 여러 카드를 동시에 펼칠 수 있다
- 팀 그룹 헤더 접기/펼치기와 개별 카드 accordion이 독립적으로 동작한다

## Implementation Status
- [x] `AgentMiniCard` 컴포넌트 — status dot + name + project + status badge (한 줄)
- [x] `expandedCards` state (`Set<string>`) — sessionId 기반 다중 펼치기 지원
- [x] `renderAccordion()` — `"compact"` ViewMode에서 accordion 렌더링
- [x] 펼침 시 기존 `AgentCard` 전체 내용 표시
- [x] 팀 그룹 내 독립적 accordion 동작 (팀 collapse + 개별 card expand)
- **Note**: Case 1 (Table View)과 통합되어 `"compact"` ViewMode로 구현됨. CSS transition 대신 조건부 렌더링 방식 사용.
