# URL 상태 저장

## Purpose
웹 대시보드의 UI 상태(뷰, 필터, 검색, 탭)를 URL query params에 저장하여 새로고침 후에도 상태가 유지되고, URL 공유로 동일한 뷰를 재현할 수 있도록 한다.

## Requirements
- `useUrlState<T>(key, defaultValue)` 훅을 생성하여 useState 드롭인 대체로 사용
- `useUrlSetState(key, defaultSet)` 래퍼를 제공하여 Set<string> 타입 상태를 comma-separated로 직렬화
- 모듈 레벨 공유 write buffer + 100ms debounce로 `history.replaceState` 호출 (히스토리 오염 방지)
- 기본값과 동일한 상태는 URL에서 제거하여 깔끔한 URL 유지
- useUrlState 교체 시, 기존 useEffect에서 해당 상태를 리셋하는 코드가 최초 마운트에도 실행되어 URL 복원 값을 덮어쓰지 않도록 useRef로 이전 값을 추적하여 실제 변경 시에만 리셋할 것

## Approach
외부 라이브러리 없이 URLSearchParams + history.replaceState만으로 구현한다. `useUrlState` 훅은 useState와 동일한 `[value, setValue]` API를 제공하며, string/number/boolean 자동 직렬화를 지원한다. 여러 컴포넌트에서 동시에 상태를 변경할 때 replaceState 호출을 모듈 레벨 100ms debounce로 배치 처리하여 성능을 확보한다. AgentsView의 `selectedTeam` 리셋처럼 useEffect에서 상태를 초기화하는 패턴은 useRef로 이전 의존값을 추적하여 최초 마운트 시 URL 복원 값이 덮어씌워지지 않도록 방어한다.

## Verification
- 각 뷰에서 필터/검색/탭 변경 후 URL에 해당 파라미터가 반영되는지 확인
- 새로고침 후 동일한 상태가 복원되는지 확인
- 기본값 상태에서 URL에 파라미터가 없는지 (깨끗한 URL) 확인
- `just build-check` 타입 에러 없음, `just test` 기존 테스트 통과 확인
- Playwright E2E 테스트 (`e2e/url-state.spec.ts`)로 URL 파라미터 저장/복원 시나리오 검증
