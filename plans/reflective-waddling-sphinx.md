# 카드 컴팩트화 + 팀 인라인 펼침

## Context

대시보드 AGENTS 뷰에서 데이터 대비 카드가 너무 크고, 특히 idle 세션이 과도한 공간을 차지함. 팀 카드 클릭 시 화면 전환 대신 인라인 펼침으로 변경.

## 수정 파일

- `web/src/components/AgentsView.tsx`
- `web/src/styles.css`

## 변경 1: 팀 카드 인라인 펼침

### 현재 동작
- `TeamOverviewCard` 클릭 → `setSelectedTeam(name)` → 전체 화면 team-detail-view로 전환 (line 715-737)
- 뒤로가기(`← Back`) 필요

### 변경
- `selectedTeam` state를 `expandedTeams: Set<string>` 패턴으로 교체 (기존 `collapsedTeams`와 동일 패턴)
- 팀 카드 클릭 → 카드 바로 아래에 멤버 카드가 accordion으로 펼침
- team-detail-view 분기(line 715-737) 제거

```
┌─ my-team  3/3 members ──────────┐
│ ●●○  planner, impl, lead       │
│ 2 active / 1 idle · 340 events │
└──────────────────────────────────┘
 ▾ 펼침 시:
 ├── ● "planner"  [ACTIVE]  ...full card...
 ├── ● "impl"     [ACTIVE]  ...full card...
 └── ● 6aa7cec8   [IDLE]    name · project · 15m ago  ▸
```

### JSX (renderDashboardOverview, line ~740)
```tsx
// Before: onClick={() => setSelectedTeam(group.team.name)}
// After:
onClick={() => toggleExpandTeam(group.team.name)}

// TeamOverviewCard 바로 다음:
{expandedTeams.has(group.team.name) && (
  <div className="team-inline-members">
    {filteredAgents.map((agent) =>
      agent.status === "idle" || agent.status === "ended"
        ? <AgentMiniCard .../> + accordion
        : renderAgentCard(agent, group.team)
    )}
  </div>
)}
```

### CSS
```css
.team-inline-members {
  padding: 4px 0 8px 12px;
  border-left: 2px solid var(--accent);
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
```

## 변경 2: Idle 카드 컴팩트화 (one-liner)

### 현재 동작
- idle/ended 세션이 active와 동일한 크기의 AgentCard로 표시

### 변경
- idle/ended 에이전트는 기존 `AgentMiniCard`(line 289-320) 재사용 → 한 줄 표시
- MiniCard에 idle 시간 정보 추가: `lastActivity`를 "15m ago" 형태로 표시
- 클릭 시 accordion으로 full AgentCard 펼침

### Active 카드는 변경 없음
- 사용자 요청: "Active 카드는 정보가 rich해야하므로 일부러 숨기지는 말자"

### AgentMiniCard 수정 (idle 시간 표시 추가)
```tsx
// 기존: dot + name + project + badge + expand
// 변경: dot + name + project + elapsed + badge + expand
<span className="agent-mini-elapsed">
  {formatRelativeTime(agent.lastActivity)}
</span>
```

### JSX (Ungrouped 영역, line ~765 + 팀 인라인 멤버)
```tsx
// agents-grid 내부에서 status로 분기:
{filteredAgents.map((agent) => {
  if (agent.status === "idle" || agent.status === "ended") {
    const isExpanded = expandedIdleAgents.has(agent.sessionId);
    return (
      <div key={agent.sessionId} className="agent-accordion">
        <AgentMiniCard agent={agent} isExpanded={isExpanded}
          onClick={() => toggleExpandIdle(agent.sessionId)} />
        {isExpanded && renderAgentCard(agent)}
      </div>
    );
  }
  return renderAgentCard(agent);
})}
```

### CSS
기존 `.agent-mini-card` + `.agent-accordion` 스타일 재사용. 추가:
```css
.agent-mini-elapsed {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}
```

## 변경 3: state 정리

- `selectedTeam` / `setSelectedTeam` → 제거 (또는 `expandedTeams`로 교체)
- `expandedTeams: Set<string>` 추가 (팀 펼침)
- `expandedIdleAgents: Set<string>` 추가 (idle 에이전트 accordion)
- 기존 `collapsedTeams`와 동일한 toggle 패턴

## 검증

1. `pnpm run build:check` 타입 체크
2. `pnpm run build` 빌드
3. 브라우저에서:
   - 팀 카드 클릭 → 화면 전환 없이 인라인 펼침 확인
   - Active 카드: 기존과 동일한 rich 정보 표시
   - Idle 카드: one-liner + idle 시간 표시 + 클릭 시 펼침 확인
   - Ungrouped 영역 높이가 크게 줄어든 것 확인
