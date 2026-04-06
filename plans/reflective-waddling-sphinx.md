# 팀 인라인 펼침 시 멤버 필터 제거

## Context

ACTIVE 필터 상태(`?status=active`)에서 팀 카드를 인라인 펼침하면, `filterAndSort(group.agents)`가 전역 상태 필터를 팀 멤버에도 적용하여 idle 상태인 team-lead가 사라지는 버그. 팀 카드 펼침 시에는 모든 멤버를 보여줘야 함.

## 수정

### `web/src/components/AgentsView.tsx` (line ~748-760)

```tsx
// Before: 전역 필터 적용
const filteredAgents = filterAndSort(group.agents);
...
{isExpanded && (
  <div className="team-inline-members">
    {filteredAgents.map((agent) => renderAgentByStatus(agent, group.team))}
  </div>
)}

// After: 카드 카운트에만 필터 적용, 펼침은 전체 멤버 표시
const filteredAgents = filterAndSort(group.agents);
const allSorted = filterAndSort(group.agents, true); // skipStatusFilter
...
{isExpanded && (
  <div className="team-inline-members">
    {allSorted.map((agent) => renderAgentByStatus(agent, group.team))}
  </div>
)}
```

`filterAndSort`에 `skipStatusFilter` 옵션을 추가하거나, 더 간단하게 인라인 펼침 시 `group.agents`를 정렬만 하여 사용.

## 검증

1. `?status=active` 에서 팀 펼침 → team-lead 포함 전체 멤버 표시
2. idle 멤버는 MiniCard(one-liner)로 표시되어 시각적 구분
3. `pnpm run build:check` 타입 체크
