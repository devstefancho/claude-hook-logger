# 에이전트 상태 하이라이팅 + UserPrompt 표시

## Context

대시보드에서 에이전트의 실시간 상태를 더 직관적으로 파악할 수 있도록:
- 작업 완료(Stop) 에이전트 하이라이팅
- Permission 대기 에이전트 하이라이팅
- UserPrompt 텍스트 표시

## 사용할 이벤트 데이터

| 이벤트 | 핵심 필드 | 용도 |
|--------|----------|------|
| `Stop` | `session_id`, `stop_hook_active` | 작업 완료 감지 |
| `Notification` (permission_prompt) | `session_id`, `message` | Permission 대기 감지 |
| `UserPromptSubmit` | `session_id`, `prompt` | 최신 프롬프트 표시 |

## 3가지 디자인 Variant

---

### Variant A: Inline Card Enhancement

기존 카드 레이아웃을 유지하면서 내부에 인라인 인디케이터 추가.

```
+--[green glow border]------------------------------------+
| o agent-name  [role]              [✓ COMPLETED] [ENDED] |
| project (branch)                                         |
| AI summary text...                                       |
| [NEW] ✓ COMPLETED — task finished  (5초 후 fade)        |
| USER> Fix the failing test...   ← 최신 프롬프트         |
| session-id  [copy]                                       |
| 2m ago . Bash . 1h 22m . 48 events                      |
+----------------------------------------------------------+

+--[orange pulse border]----------------------------------+
| o agent-name  [role]                         [WAITING]  |
| project (branch)                                         |
| [NEW] ⚠ PERMISSION NEEDED                               |
|       "Claude needs your permission to use Search"       |
| session-id  [copy]                                       |
| 12s ago . Search . 45m . 32 events                      |
+----------------------------------------------------------+
```

**구현**:
- CSS 클래스: `.just-completed` (5초 glow fade), `.permission-waiting` (pulse 애니메이션)
- 인라인 배너: completion banner (초록), permission banner (주황)
- `USER>` 프롬프트 표시 (기존 recentPrompts 대체)

**장점**: 최소 변경, 하위호환, CSS-only 애니메이션
**단점**: 카드 높이 변동, 여러 에이전트 동시 알림 시 시각적 노이즈

---

### Variant B: Status Overlay / Banner System

카드 위에 오버레이 배너를 표시. Permission은 가장 눈에 띄게.

```
+==============================================================+
| ⚠ PERMISSION REQUIRED                        [Go to tmux]   |  ← 주황 배너
| "Claude needs your permission to use Search"                  |
+==============================================================+
| o agent-name                                    [WAITING]     |
| project (branch)                                              |
| [▸ Latest Prompt]  ← 클릭 시 펼침                            |
| session-id  [copy]                                            |
+---------------------------------------------------------------+

+---------------------------------------------------------------+
|  .-------------------------------------------.                |
|  | ✓ Agent completed work              [x]   |  ← 플로팅 토스트
|  '-------------------------------------------'     (5초 후 사라짐)
| o agent-name                                      [ENDED]     |
| ...                                                           |
+---------------------------------------------------------------+
```

**구현**:
- Permission: 카드 상단 고정 배너 + "Go to tmux" 버튼
- Stop: 플로팅 토스트 오버레이 (5초 auto-dismiss)
- UserPrompt: 접이식 섹션 (클릭 토글)

**장점**: Permission 배너가 매우 눈에 띔, "Go to tmux" 원클릭 해결
**단점**: 카드 높이 변동 크고, 토스트가 카드 내용 가림, z-index 복잡

---

### Variant C: Activity Feed + Card Dots

카드에는 최소한의 dot 인디케이터, 별도 Activity Feed 패널에서 상세 확인.

```
카드:
+--+------------------------------------------------------+
|  | o "planner"  [implementer]  [●][●]  [ACTIVE]         |
|  |  project (branch)            ^  ^                     |
|  |  > recent prompt...          |  amber=permission      |
|  |  session-id  [copy]          green=completed           |
|  |  2m ago . Write . 47 events                           |
+--+------------------------------------------------------+

Activity Feed 패널 (우측 슬라이드, ChatPanel 패턴):
+--activity-feed-panel (340px)---+
| ACTIVITY FEED                  |
| [All|Stop|Perm|Prompt]         |
|                                |
| 14:32  planner                 |
| [⚠] Permission Waiting        |
| "Allow Write to src/types.ts"  |
| [Jump to agent]                |
|                                |
| 14:30  worker-2                |
| [✓] Completed                  |
|                                |
| 14:28  planner                 |
| [>] Prompt                     |
| "Fix the test failures..."     |
+--------------------------------+
```

**구현**:
- 카드 dot: 8px 원형 (green=Stop, amber=Permission, blue=Prompt), pulse 애니메이션
- Activity Feed: 새 컴포넌트 + `/api/activity-feed` API + `useActivityFeed` 훅
- TopBar에 bell 아이콘 + unread count 배지
- Feed 항목 클릭 → 해당 에이전트 카드 하이라이트 + 스크롤

**장점**: 카드 깔끔, 전체 에이전트 이벤트를 한 스트림에서 확인, 필터링 가능, 확장성 좋음
**단점**: 구현량 많음 (새 API + 컴포넌트 + 훅), 정보 분산 (dot → feed 확인 필요)

---

## 공통 백엔드 변경 (모든 Variant)

### AgentInfo 타입 확장 (`viewer/data.ts`, `web/src/types.ts`)

```typescript
// 새로 추가할 필드
justCompleted: boolean;           // Stop 이벤트가 최근 30초 내
permissionMessage: string | null; // Notification(permission_prompt)의 message
latestUserPrompt: string | null;  // UserPromptSubmit의 prompt 텍스트
```

### `buildAgentList()` 수정 (`viewer/data.ts`)

기존 이벤트 스캔 루프에서 Stop, Notification, UserPromptSubmit도 세션별로 추적.

## Variant별 비교

| 항목 | A: Inline | B: Overlay | C: Feed+Dots |
|------|-----------|------------|--------------|
| 구현 난이도 | ★☆☆ 낮음 | ★★☆ 중간 | ★★★ 높음 |
| 시각적 임팩트 | 중간 | 높음 | 낮음(dot) + 높음(feed) |
| 카드 레이아웃 변경 | 소 | 대 | 최소 |
| 확장성 | 낮음 | 중간 | 높음 |
| Permission 가시성 | 중간 | 매우 높음 | 중간(dot) |
| 새 컴포넌트 수 | 0 | 0 | 2 (Feed + Hook) |
| 새 API 필요 | 아니오 | 아니오 | 예 |

## 수정 대상 파일

**공통**: `viewer/data.ts`, `web/src/types.ts`, `web/src/components/AgentsView.tsx`, `web/src/styles.css`
**Variant C 추가**: `web/src/components/ActivityFeedPanel.tsx` (신규), `web/src/hooks/useActivityFeed.ts` (신규), `viewer/server.ts`, `web/src/App.tsx`, `web/src/components/TopBar.tsx`

## 구현 전략: 3 Variant 동시 구현 + 스위처

### Variant 스위처
- URL 파라미터 `?variant=a|b|c` (useUrlState 활용)
- TopBar에 드롭다운 토글 추가: `[A: Inline] [B: Overlay] [C: Feed+Dots]`
- AgentsView에서 variant 값에 따라 조건부 렌더링

### 구현 순서

**Phase 1: 공통 백엔드** (모든 variant가 공유)
1. `viewer/data.ts` — AgentInfo에 `justCompleted`, `permissionMessage`, `latestUserPrompt` 필드 추가, `buildAgentList()` 수정
2. `web/src/types.ts` — 프론트엔드 타입 미러링

**Phase 2: Variant A (Inline)**
3. AgentsView에서 `variant === "a"` 일 때 인라인 배너 렌더링
4. CSS: `.just-completed`, `.permission-waiting`, `.agent-completion-banner`, `.agent-permission-banner`, `.agent-user-prompt`

**Phase 3: Variant B (Overlay)**
5. AgentsView에서 `variant === "b"` 일 때 오버레이 배너 + 토스트 렌더링
6. CSS: `.agent-banner-permission`, `.agent-toast-overlay`, `.agent-prompt-toggle`

**Phase 4: Variant C (Feed + Dots)**
7. AgentsView에서 `variant === "c"` 일 때 dot 인디케이터 렌더링
8. `ActivityFeedPanel.tsx` 신규 생성
9. `useActivityFeed.ts` 훅 생성
10. `viewer/server.ts` — `/api/activity-feed` 엔드포인트 추가
11. TopBar에 bell 아이콘 + feed 패널 토글

**Phase 5: 스위처 UI**
12. `useUrlState("variant", "a")` — TopBar에 variant 드롭다운
13. App.tsx에서 variant를 DetailPanel → AgentsView로 전달

### 스위처 동작
- `http://localhost:7777` → 기본값 Variant A
- `http://localhost:7777/?variant=b` → Variant B
- `http://localhost:7777/?variant=c` → Variant C
- TopBar 드롭다운으로도 전환 가능

## 버그 수정: permissionMessage가 해결 후에도 계속 표시됨

### 원인
`viewer/data.ts:508-509` — `lastPermissionBySession`에서 마지막 permission Notification을 가져오지만, 그 이후에 다른 이벤트(PostToolUse, UserPromptSubmit, Stop)가 발생했는지 확인하지 않음. Permission이 해결된 후에도 배너가 계속 남음.

### 수정 (`viewer/data.ts:508-509`)
```typescript
// 기존
const lastPerm = lastPermissionBySession.get(sess.id);
const permissionMessage = lastPerm?.data?.message ? String(lastPerm.data.message) : null;

// 수정: permission 이후에 다른 이벤트가 없을 때만 표시
const lastPerm = lastPermissionBySession.get(sess.id);
const lastSignificant = lastSignificantBySession.get(sess.id);
const permResolved = lastPerm && lastSignificant && 
  new Date(lastSignificant.ts).getTime() > new Date(lastPerm.ts).getTime();
const permissionMessage = lastPerm?.data?.message && !permResolved
  ? String(lastPerm.data.message) : null;
```

핵심: `lastSignificantBySession`(PreToolUse, PostToolUse, Stop, UserPromptSubmit 등)의 timestamp가 permission 이벤트보다 이후면 이미 해결된 것.

### 추가: Variant B/C 제거 (Variant A 선택)

사용자가 Variant A(Inline)를 선택했으므로:
1. Variant B, C 관련 코드 제거 (또는 유지하되 기본값을 A로)
2. variant 스위처는 유지해도 되고 제거해도 됨 — 사용자 확인 필요

## 검증 방법

1. `just build-check` 타입 체크
2. `pnpm test` 기존 테스트 통과
3. `just dev` 서버 시작 후 브라우저에서:
   - `?variant=a` → Inline 배너 확인
   - `?variant=b` → Overlay 배너 + 토스트 확인
   - `?variant=c` → Dot + Activity Feed 패널 확인
   - 각 variant에서 Stop/Permission/UserPrompt 표시 확인
4. TopBar 드롭다운으로 variant 전환 확인
