# 세션 이름 유무 시각적 구분 및 이름 설정 유도

## Purpose
대시보드 AGENTS 뷰에서 이름이 설정된 세션과 UUID만 표시되는 이름 없는 세션을 시각적으로 차별화하고, 사용자가 이름 없는 세션에 `/rename`으로 이름을 설정하도록 유도하는 UX를 제공한다.

## Requirements
- 이름 없는 세션(UUID prefix)에 `.agent-name-unnamed` CSS 클래스를 적용하여 시각적으로 구분 (흐린 색상 + 모노스페이스 폰트 + italic)
- 이름 없는 세션 카드에 "unnamed" 라벨 또는 아이콘을 표시하여 이름 미설정 상태를 명시
- 이름 없는 세션에 마우스 호버 시 `/rename` 사용을 안내하는 툴팁 표시
- Dashboard/SplitPanel 모드의 카드와 Accordion/List 모드의 리스트 항목 모두에 일관되게 적용
- 기존 카드 레이아웃 구조와 디자인 시스템(CSS 변수, 컴포넌트 패턴) 유지

## Approach
`AgentsView.tsx`의 5개 이름 표시 위치(line 155, 306, 809, 832, 860)에서 `agent.name` 유무에 따라 조건부 클래스와 라벨을 추가한다. 이름 없는 세션은 `.agent-name-unnamed` 클래스로 `color: var(--text-muted)`, `font-family: monospace`, `font-style: italic`을 적용하고, 이름 옆에 작은 `(unnamed)` 텍스트를 추가한다. 카드 뷰(Dashboard/SplitPanel)에서는 호버 시 `title` 속성으로 "Use /rename to set a name" 툴팁을 표시한다. CSS-only 구현으로 새 컴포넌트 없이 기존 스타일 파일에 3-4개 규칙만 추가한다.

## Verification
- Dashboard 모드에서 이름 있는 세션은 기존처럼 따옴표로 감싼 볼드체, 이름 없는 세션은 흐린 italic 모노스페이스로 표시되는지 확인
- 이름 없는 세션 호버 시 `/rename` 안내 툴팁이 표시되는지 확인
- Accordion/List 모드에서도 동일한 시각적 구분이 적용되는지 확인
- `just build-check` 타입 에러 없음, `just test` 기존 테스트 통과 확인
