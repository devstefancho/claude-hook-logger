# Dashboard UI Redesign

## Purpose
탭 기반 레이아웃(Header + LeftTabs + SessionList + AgentPanel + StatBar)을 사이드바+디테일 패널 구조(TopBar + Sidebar + DetailPanel)로 전면 재구성하여, 네비게이션 효율성과 정보 밀도를 높인다.

## Requirements
- TopBar에 레이아웃 토글(full/compact/focus), 파일 선택, refresh, auto-refresh, chat 토글 배치
- Sidebar에 Agents/Tools/Skills/Events 4개 탭 네비게이션 + 카운트 뱃지 + 하단 통계(Sessions, Agents, Issues)
- DetailPanel이 activeView에 따라 AgentsView, ToolsView, SkillsView, EventTimeline 전환
- 기존 AgentPanel의 에이전트 카드/필터/검색/threshold/tmux/summary/filter 기능을 AgentsView로 이관
- 삭제된 컴포넌트(Header, LeftTabs, SessionList, StatBar, Issues, AgentPanel) 기능을 새 구조에 병합

## Approach
6개 컴포넌트를 삭제하고 5개 새 컴포넌트(TopBar, Sidebar, DetailPanel, AgentsView, ToolsView, SkillsView)를 도입한다. App.tsx는 레이아웃 상태(sidebarMode, activeView)만 관리하고, 각 뷰 컴포넌트가 자체 필터/검색 상태를 소유한다. Sidebar는 full(220px)/compact(52px, 아이콘만)/focus(숨김) 3단계 모드를 지원하며, compact 모드에서는 아이콘+뱃지만 표시한다. 기존 SessionList의 세션 목록 기능은 AgentsView의 에이전트 카드로 대체하고, StatBar의 통계는 Sidebar 하단으로 이동한다.

## Verification
- full/compact/focus 모드 전환 시 사이드바 너비와 콘텐츠가 올바르게 변경됨
- 4개 탭 클릭 시 DetailPanel 내 뷰가 정확히 전환됨
- AgentsView에서 상태 필터, 검색, threshold 설정, tmux/summary/filter 액션이 모두 동작함
- EventTimeline의 이벤트 타입 필터, 텍스트 검색, 세션 필터링, 가상화 스크롤이 유지됨
- ChatPanel이 TopBar 토글로 열리고 리사이즈/SSE 스트리밍이 정상 동작함

## Implementation Status
- [x] TopBar — 레이아웃 토글(full/compact/focus), 파일 선택, refresh, auto-refresh, chat 토글
- [x] Sidebar — 4개 탭 네비게이션 + 카운트 뱃지 + 아이콘 모드 + 하단 통계
- [x] DetailPanel — activeView별 뷰 전환 (AgentsView, ToolsView, SkillsView, EventTimeline)
- [x] AgentsView — 에이전트 카드/필터/검색/threshold/tmux/summary/filter 이관 완료
- [x] 6개 구 컴포넌트 삭제, 5개 신규 컴포넌트 도입
