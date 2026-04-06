# 프로젝트 경로 표시 개선

## Purpose
AgentsView에서 프로젝트 경로가 마지막 3 segments로 잘려 표시되어 실제 위치 파악이 어렵다. Home 디렉토리를 `~/`로 축약한 전체 절대경로를 표시하여 가독성과 정보량을 모두 확보한다.

## Requirements
- `extractProjectName` 함수가 HOME 경로를 `~/`로 치환한 전체 절대경로를 반환한다
- HOME 경로 밖의 경로는 절대경로 그대로 반환한다
- 기존 3-segment 잘림 로직을 제거한다

## Approach
`viewer/data.ts`의 `extractProjectName` 함수(407-415행)에서 마지막 3개 segment만 추출하는 분기를 제거하고, HOME 경로를 `~/`로 치환한 전체 경로를 반환하도록 단순화한다. HOME이 빈 문자열이거나 cwd가 HOME으로 시작하지 않으면 원래 경로를 그대로 반환한다.

## Verification
- HOME이 `/Users/foo`일 때 `/Users/foo/works/project/.claude`가 `~/works/project/.claude`로 표시된다
- HOME 밖 경로 `/opt/project`는 그대로 `/opt/project`로 표시된다
- 기존 테스트가 모두 통과한다

## Implementation Status
- [x] `extractProjectName` 함수 — HOME을 `~/`로 치환한 전체 절대경로 반환
- [x] 3-segment 잘림 로직 제거
- [x] HOME 밖 경로 절대경로 유지
- [x] 테스트 커버리지 97% 달성
