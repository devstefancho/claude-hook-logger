# Dashboard Redesign: Sidebar + Detail Panel 레이아웃

## Context

현재 대시보드는 3-패널 분할 레이아웃(SessionList + LeftTabs + EventTimeline)을 사용하는데, **Sessions 패널과 Agent 패널의 역할이 겹친다** (둘 다 세션/에이전트 정보 표시). 이를 와이어프레임 기반으로 **Sidebar 네비게이션 + Detail Panel** 구조로 재설계하여 중복 제거 및 UX 개선.

**현재 → 목표:**
```
[Header]                         [TopBar: 뷰전환 | 액션버튼]
[StatBar]                   →    [Sidebar | DetailPanel    ]
[SessionList | EventTimeline]              [ChatPanel]
[LeftTabs    |              ]
```

## 미학 방향: Terminal Brutalism

- 기존 GitHub Dark 테마 기반 유지하되, 더 어두운 배경 + cyan 악센트(`#00d4ff`)
- 구조적 요소에 border-radius 없음 (badge/pill만 둥글게)
- 대문자 라벨 + letter-spacing으로 섹션 구분
- 높은 정보 밀도, 최소한의 패딩

## 구현 계획

### Phase 1: 새 컴포넌트 생성

**1. `web/src/components/TopBar.tsx`** (Header.tsx 대체)
- 왼쪽: 사이드바 토글 버튼 (expanded/collapsed/hidden 3단계)
- 오른쪽: File selector, Refresh, Auto-refresh, Chat 토글
- 높이 48px 고정

**2. `web/src/components/Sidebar.tsx`**
- 고정 폭 220px (collapsed: 48px, hidden: 0px)
- 네비게이션 아이템: Agents, Tools, Skills, Events
- 각 아이템에 아이콘 + 라벨 + 카운트 뱃지
- 하단: 축약 통계 (StatBar 흡수) — 총 이벤트, 세션 수, 이슈 수
- 활성 아이템: 왼쪽 2px accent 보더 + accent 텍스트 색상

**3. `web/src/components/DetailPanel.tsx`**
- `activeView`에 따라 컨텐츠 스위칭하는 라우터 역할
- agents → AgentsView, tools → ToolsView, skills → SkillsView, events → EventsView

**4. `web/src/components/AgentsView.tsx`** (SessionList + AgentPanel 병합)
- 데이터 병합: `useAgents()` + `summary.sessions` (sessionId로 매칭)
- 검색 바 (이름, 프로젝트, 세션ID, cwd)
- 상태 필터 버튼 (All / Active / Idle / Waiting / Ended)
- Threshold 셀렉터
- 통합 카드: 상태 dot + 이름 + 프로젝트/브랜치 + 요약 + 메타(이벤트수, 시간, interrupt/orphan) + 액션(tmux, summary, filter)
- 재사용: `AgentPanel.tsx`의 STATUS_COLORS, formatDuration, THRESHOLD_OPTIONS
- 재사용: `SessionList.tsx`의 sortSessions 로직 (live > stale > ended 정렬)

**5. `web/src/components/ToolsView.tsx`**
- 헤더: "Tools" 타이틀 + 총 고유 도구 수
- 본문: 기존 `ToolUsage` 컴포넌트 래핑 (ToolUsage.tsx 내부 컴포넌트로 유지)

**6. `web/src/components/SkillsView.tsx`**
- ToolsView와 동일 패턴, 보라색 바

### Phase 2: App.tsx 재작성

**제거할 상태/로직:**
- `leftWidthPercent`, `sessionListHeight`, `maximizedPanel` 상태
- `mainRef`, `leftRef`, `verticalDragging`, `horizontalDragging` refs
- `onVerticalResizeMouseDown`, `onHorizontalResizeMouseDown` 콜백
- `toggleMaximize` 콜백

**추가할 상태:**
```typescript
type SidebarView = "agents" | "tools" | "skills" | "events";
type LayoutMode = "full" | "compact" | "focus";
const [activeView, setActiveView] = useState<SidebarView>("agents");
const [layoutMode, setLayoutMode] = useState<LayoutMode>("full");
```

**유지할 것:**
- `selectedSession`, `highlightIdx`, `chatOpen` 상태 + 핸들러
- 모든 hooks: useLogData, useAutoRefresh, useAgents
- ChatPanel (플로팅 오버레이 그대로)

**새 렌더 구조:**
```tsx
<>
  <TopBar ... />
  <div className="app-body">
    <Sidebar activeView={activeView} onChangeView={setActiveView} summary={summary} agents={agents} layoutMode={layoutMode} />
    <DetailPanel activeView={activeView} ... />
  </div>
  <ChatPanel ... />
</>
```

### Phase 3: styles.css 재작성

**새 CSS 변수:**
```css
--bg-base: #0a0e14;
--bg-surface: #12161e;
--bg-elevated: #1a1f2b;
--border: #252b37;
--border-active: #00d4ff;
--accent: #00d4ff;
--sidebar-width: 220px;
--topbar-height: 48px;
```

**새 레이아웃 스타일:**
- `.app-body`: topbar 아래 flex row, `height: calc(100vh - var(--topbar-height))`
- `.sidebar`: 고정 폭, overflow-y auto, 우측 보더
- `.detail-panel`: flex: 1, 내부 스크롤
- `.detail-header`: 각 뷰의 헤더 바 (타이틀 + 뷰별 컨트롤)

**제거할 스타일:** resize-handle 관련, `.main .left .right` 레이아웃, maximized 관련

### Phase 4: 정리

**삭제할 파일:**
- `Header.tsx` → TopBar.tsx로 대체
- `StatBar.tsx` → Sidebar 하단으로 흡수
- `SessionList.tsx` → AgentsView.tsx로 병합
- `LeftTabs.tsx` → Sidebar + DetailPanel로 대체
- `AgentPanel.tsx` → AgentsView.tsx로 병합
- `Issues.tsx` → EventsView 내 이벤트 필터로 흡수

**유지할 파일 (변경 없음):**
- `EventTimeline.tsx`, `EventRow.tsx`, `TimelineChart.tsx` — Events 뷰에서 그대로 사용
- `ChatPanel.tsx`, `ChatMessage.tsx`, `ChatInput.tsx`
- `ToolUsage.tsx`, `SkillUsage.tsx` — View 래퍼 안에서 재사용
- `hooks/*` 전체, `utils/*` 전체, `types.ts`

## 핵심 수정 파일

| 파일 | 작업 |
|---|---|
| `web/src/App.tsx` | 전면 재작성 (레이아웃 + 상태) |
| `web/src/styles.css` | 전면 재작성 (디자인 시스템 + 레이아웃) |
| `web/src/components/TopBar.tsx` | 신규 생성 |
| `web/src/components/Sidebar.tsx` | 신규 생성 |
| `web/src/components/DetailPanel.tsx` | 신규 생성 |
| `web/src/components/AgentsView.tsx` | 신규 생성 |
| `web/src/components/ToolsView.tsx` | 신규 생성 |
| `web/src/components/SkillsView.tsx` | 신규 생성 |

## 검증 방법

1. `just build` — TypeScript 컴파일 + Vite 빌드 성공 확인
2. `just viewer` — 서버 시작 후 브라우저에서 대시보드 확인
3. 기능 체크리스트:
   - 사이드바 네비게이션으로 4개 뷰 전환
   - Agents 뷰: 에이전트 카드 표시, 검색/필터, tmux/summary/filter 액션
   - Tools/Skills 뷰: 바 차트 표시
   - Events 뷰: 이벤트 타임라인 리스트/차트 뷰 전환, 필터링
   - 사이드바 토글 (expanded → collapsed → hidden)
   - Chat 패널 열기/닫기
   - Auto-refresh 동작
   - 에이전트 카드 클릭 → 이벤트 필터링 연동
