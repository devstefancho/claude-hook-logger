# AGENTS 뷰 팀 멤버 그룹화

## Purpose
AGENTS 뷰에서 같은 agent team에 속한 세션들을 그룹으로 묶어 표시하여, 팀 구조와 각 멤버의 역할을 한눈에 파악할 수 있게 한다. 현재는 세션 ID만 개별 나열되어 팀 컨텍스트를 알 수 없다.

## Requirements
- `~/.claude/teams/{team-name}/config.json`의 members 배열을 읽어 같은 team_name의 세션들을 하나의 그룹으로 묶어 표시한다
- 그룹 헤더에 팀 이름(예: `test-agent-team`)과 멤버 수, 활성 상태 요약을 표시한다
- 각 멤버 카드에 역할(team-lead, planner, implementer)을 세션 ID 옆에 배지로 표시한다
- 그룹은 접기/펼치기(collapse/expand)가 가능하며, 기본값은 펼침 상태이다
- 팀에 속하지 않은 독립 세션은 기존과 동일하게 "Ungrouped" 섹션에 표시한다

## Approach
백엔드(`viewer/server.ts`)에 새 API 엔드포인트 `GET /api/teams`를 추가하여 `~/.claude/teams/` 디렉토리를 스캔하고, 각 팀의 config.json에서 members 배열과 leadSessionId를 파싱하여 반환한다. 팀 config의 `members[].name`이 역할명이 되고, `leadSessionId` 및 각 멤버의 `cwd`+session 매칭으로 기존 AgentInfo와 연결한다. 프론트엔드에서는 `useAgents` 훅을 확장하여 팀 데이터를 병렬 fetch하고, AgentsView에서 팀별 그룹 컨테이너를 렌더링한다. 세션-팀 매칭은 teams config의 `members[].agentId` 패턴(`{name}@{team-name}`)에서 name을 추출하고, 같은 cwd의 ClaudeSession과 매칭하는 방식을 사용한다. 접기/펼치기 상태는 컴포넌트 로컬 state로 관리한다.

## Verification
- 같은 팀에 속한 3개 세션(team-lead, planner, implementer)이 하나의 그룹 아래에 표시된다
- 그룹 헤더에 팀 이름과 "2 active / 1 idle" 형태의 상태 요약이 보인다
- 각 멤버 카드에 역할 배지(예: `team-lead`, `planner`)가 세션 ID 옆에 표시된다
- 그룹 헤더 클릭 시 멤버 카드가 접히고/펼쳐진다
- 팀에 속하지 않은 세션은 별도 섹션에 기존과 동일하게 표시된다

## Implementation Status
- [x] `GET /api/teams` 엔드포인트 — `~/.claude/teams/` 스캔, config.json 파싱
- [x] `useAgents` 훅 확장 — 팀 데이터 병렬 fetch, `teamGroups`/`ungroupedAgents` 반환
- [x] 팀 그룹 헤더 (팀 이름 + 멤버 수 + collapse 토글)
- [x] 역할 배지 표시 (team-lead, planner, implementer)
- [x] 접기/펼치기 (`collapsedTeams` state)
- [x] Ungrouped 섹션 별도 표시
