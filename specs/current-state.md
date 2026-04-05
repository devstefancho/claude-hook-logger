# Dashboard Feature Spec

## 현재 구현 상태

### 레이아웃 구조

```
[TopBar: 레이아웃토글 | HOOK LOGGER | 파일선택 | Refresh | Auto | Chat]
[Sidebar (220px)  |  DetailPanel (flex:1)                             ]
[  - Agents       |  (activeView에 따라 전환)                           ]
[  - Tools        |                                                    ]
[  - Skills       |                                                    ]
[  - Events       |                                                    ]
[  -------------- |                                                    ]
[  Stats          |                                                    ]
                                                         [ChatPanel]
```

---

## 컴포넌트별 기능 명세

### 1. TopBar

| 기능 | 상태 | 설명 |
|---|---|---|
| 레이아웃 토글 | ✅ | full(220px) → compact(52px) → focus(숨김) 순환 |
| 타이틀 | ✅ | "HOOK LOGGER" 텍스트 |
| 파일 선택 | ✅ | JSONL 로그 파일 드롭다운 |
| Refresh | ✅ | 수동 데이터 새로고침 |
| Auto-refresh | ✅ | 5초 간격 폴링 토글 |
| Chat 토글 | ✅ | ChatPanel 열기/닫기 |

### 2. Sidebar

| 기능 | 상태 | 설명 |
|---|---|---|
| 네비게이션 | ✅ | Agents/Tools/Skills/Events 4개 탭 |
| 카운트 뱃지 | ✅ | 각 항목 오른쪽에 숫자 표시 |
| 아이콘 모드 | ✅ | compact 모드에서 아이콘만 표시 |
| 하단 통계 | ✅ | Sessions (live/stale), Agents (active/idle), Issues |
| focus 모드 | ✅ | 사이드바 완전히 숨김 |
| **빠진 기능** | ❌ | focus 모드에서 뷰 전환 수단 없음 |

### 3. AgentsView (Agents 탭)

| 기능 | 상태 | 설명 |
|---|---|---|
| 에이전트 카드 | ✅ | 이름, 상태뱃지, 프로젝트/브랜치, 메타정보 |
| 상태 필터 | ✅ | All / ACTIVE / IDLE / WAITING / ENDED |
| 검색 | ✅ | 이름, sessionId, 프로젝트, cwd 검색 |
| Threshold 설정 | ✅ | active 판정 기준 (5m/30m/1h/6h/24h) |
| tmux 액션 | ✅ | 해당 세션의 tmux 윈도우로 이동 |
| summary 액션 | ✅ | AI 요약 생성 (서버 API 호출) |
| filter 액션 | ✅ | 클릭 시 Events 뷰로 전환 + 세션 필터링 |
| Session 데이터 병합 | ✅ | interrupt/orphan 정보 SessionInfo에서 가져옴 |
| **빠진 기능** | ❌ | 카드 클릭으로 상세 확장/축소 없음 |
| **빠진 기능** | ❌ | 정렬 옵션 없음 (항상 서버 응답 순) |
| 경로 표시 | ✅ | HOME을 ~/로 축약한 전체 절대경로 표시 (extractProjectName) |
| **빠진 기능** | ❌ | 삭제된 Issues 컴포넌트의 "click-to-scroll" 기능 미복구 |

### 4. ToolsView (Tools 탭)

| 기능 | 상태 | 설명 |
|---|---|---|
| 수평 바 차트 | ✅ | 도구명 + 사용 횟수, 최대값 대비 비율 |
| 총 도구 수 표시 | ✅ | 헤더에 "N unique tools" |
| **빠진 기능** | ❌ | 도구 클릭 시 해당 이벤트 필터링 없음 |
| **빠진 기능** | ❌ | 검색/정렬 없음 |
| **빠진 기능** | ❌ | 세션별 도구 사용량 분리 없음 |

### 5. SkillsView (Skills 탭)

| 기능 | 상태 | 설명 |
|---|---|---|
| 수평 바 차트 | ✅ | 스킬명 + 사용 횟수 (보라색 바) |
| 총 스킬 수 표시 | ✅ | 헤더에 "N unique skills" |
| **빠진 기능** | ❌ | ToolsView와 동일한 한계점 |

### 6. EventTimeline (Events 탭)

| 기능 | 상태 | 설명 |
|---|---|---|
| 이벤트 타입 필터 | ✅ | Pre/Post/Fail/Prompt/Notif/Stop 등 11종 토글 |
| Issues Only 필터 | ✅ | Stop + PreToolUse만 표시 |
| Reset 필터 | ✅ | 모든 필터 초기화 + 세션 필터 해제 |
| 텍스트 검색 | ✅ | 300ms 디바운스, JSON 전체 검색 |
| 세션 필터링 | ✅ | 특정 세션 이벤트만 표시 + 해제 |
| List 뷰 | ✅ | @tanstack/react-virtual로 가상화 |
| Chart 뷰 | ✅ | SVG 타임라인 (세션별 행, 시간축) |
| Orphan 표시 | ✅ | 점선 테두리 + ORPHAN 뱃지 |
| Highlight | ✅ | 클릭 시 2초간 하이라이트 |
| 세션 태그 클릭 | ✅ | 해당 세션으로 필터링 |
| **빠진 기능** | ❌ | 이전 Issues 컴포넌트의 interrupt/orphan 목록 + scroll-to 기능 제거됨 |
| **빠진 기능** | ❌ | 이벤트 상세 펼치기/접기 없음 |
| **빠진 기능** | ❌ | 시간 범위 필터 없음 (전체 이벤트만) |

### 7. ChatPanel

| 기능 | 상태 | 설명 |
|---|---|---|
| SSE 스트리밍 | ✅ | 실시간 응답 스트리밍 |
| Markdown 렌더링 | ✅ | react-markdown으로 렌더링 |
| 프리셋 프롬프트 | ✅ | 4개 버튼 (최근 활동, 도구 사용, 세션 상세, 이슈) |
| 리사이즈 | ✅ | 좌측 드래그로 320-900px |
| Clear 버튼 | ✅ | 대화 내역 초기화 |
| Tool 뱃지 | ✅ | 사용된 MCP 도구 표시 |
| **빠진 기능** | ❌ | 대화 내역 persist 없음 (새로고침 시 소실) |

---

## 데이터 흐름

```
useLogData()  → files, events, summary (GET /api/events, /api/summary)
useAgents()   → agents (GET /api/agents?threshold=N)
useAutoRefresh() → 5초 간격 checkForUpdates + loadAgents
useChat()     → SSE streaming (POST /api/chat)
```

### API 엔드포인트

| Method | Path | 용도 |
|---|---|---|
| GET | /api/files | 로그 파일 목록 |
| GET | /api/events?file=X | 이벤트 전체 로드 |
| GET | /api/summary?file=X | 집계 통계 |
| GET | /api/agents?threshold=N | 에이전트 목록 |
| POST | /api/agents/:id/summary | AI 요약 생성 |
| POST | /api/agents/:id/open-tmux | tmux 윈도우 전환 |
| POST | /api/chat | Claude Agent SDK 채팅 |

---

## 빠진 기능 / 개선 포인트 요약

### 🔴 기능 후퇴 (이전에 있었으나 제거됨)

1. ~~**Issues 패널**~~ → 불필요하여 의도적 제거
2. **패널 최대화**: 각 패널을 전체 화면으로 최대화하는 기능 삭제됨

### ✅ 구현 완료

3. ~~**focus 모드에서 네비게이션 불가**~~ → TopBar 인라인 탭 + 키보드 1-4 구현
4. ~~**에이전트 정렬 없음**~~ → 상태순/활동순/이름순 정렬 드롭다운 구현
5. ~~**Tools/Skills 뷰가 너무 단순**~~ → 검색, 정렬(Count/A-Z/Z-A), Min count 필터, 클릭→Events 전환 구현
6. ~~**이벤트 상세 보기 없음**~~ → 이벤트 행 클릭 시 JSON 상세 펼치기/접기 구현
7. ~~**도구/스킬 클릭 → 이벤트 필터링**~~ → 구현 완료
8. ~~**시간 범위 필터**~~ → All/1h/6h/24h 드롭다운 구현
10. ~~**키보드 네비게이션**~~ → 1/2/3/4 뷰 전환 구현 (j/k 스크롤은 미구현)
- **Session ID 복사 + 명령어 제공**: claude -r / fork-session 명령어 복사 버튼 구현
- **복수 에이전트 필터**: AgentsView에서 multi-select → View Events 전환 구현
- **필드별 검색**: All/Tool name/Event type/Session ID/Data 검색 필드 선택 구현
- **tmux ancestor 탐색**: PID 부모 체인 역추적으로 안정적 tmux 매칭 구현
- **Session resume 감지**: SessionEnd 후 SessionStart 시 hasSessionEnd 리셋 구현

---

## Electron App 지원

| 기능 | 상태 | 설명 |
|---|---|---|
| 메인 프로세스 | ✅ | `electron/main.cts` — 내장 서버 + BrowserWindow |
| preload 스크립트 | ✅ | `electron/preload.cts` — electronAPI 노출 |
| dev 모드 | ✅ | `ELECTRON_DEV=1` 환경변수로 Vite dev server(5188) 연결 |
| prod 빌드 | ✅ | `electron:build` 명령어로 macOS .app 패키징 |
| 기존 웹 버전 호환 | ✅ | `just viewer`로 기존 방식 그대로 동작 |

상세 스펙은 [specs/electron-app.md](electron-app.md) 참조.
향후 아이디어는 [specs/ideas.md](ideas.md) 참조.
