# AGENTS 탭 뷰 모드 정리

## Context

5가지 UI case를 토글로 비교한 결과, Original, Accordion, Dashboard, Split 4개를 유지하기로 결정. Case 1 (Table)과 Case 2 (Drill-down)을 제거하고, 나머지 4개를 정식 뷰 모드로 정리한다.

## 수정 대상 파일

- `web/src/components/AgentsView.tsx` — caseMode 타입에서 case1/case2 제거, 버튼 라벨 변경
- `web/src/styles.css` — case1/case2 전용 CSS 제거

## 변경 내용

### 1. caseMode 타입 정리
```typescript
// Before
type CaseMode = "original" | "case1" | "case2" | "case3" | "case4" | "case5";

// After  
type ViewMode = "cards" | "compact" | "teams" | "split";
```

### 2. 토글 버튼 라벨 변경
```
Before: [Original] [1:Table] [2:Drill-down] [3:Accordion] [4:Dashboard] [5:Split]
After:  [Cards] [Compact] [Teams] [Split]
```

기본값: `"cards"` (Original)

### 3. 제거할 코드
- `AgentTableRow` 컴포넌트 (Case 1)
- `TeamDashboardCard` 컴포넌트 (Case 2) — Case 4의 `TeamOverviewCard`가 상위호환
- Case 1, Case 2 렌더링 분기
- `.agent-table*` CSS (Case 1)
- `.team-dashboard-card*` CSS (Case 2) — Case 4의 `.team-overview-*`는 유지

### 4. 매핑
| 뷰 모드 | 기존 case | 설명 |
|---------|----------|------|
| cards | original | 팀 collapsible + AgentCard 리스트 |
| compact | case3 | 한 줄 mini card, 클릭 시 accordion 펼침 |
| teams | case4 | 2열 팀 대시보드, 클릭 시 detail view |
| split | case5 | 좌측 트리 + 우측 상세 패널 |

## Verification

- `just build-check` 타입 체크 통과
- `just build` 빌드 성공
- 4개 뷰 모드 토글 전환 정상 동작
- 제거된 Case 1/2 관련 코드/CSS 잔재 없음
