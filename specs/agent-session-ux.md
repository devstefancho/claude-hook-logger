# 에이전트 세션 UX 강화

## Purpose
AgentsView에 세션 ID 복사, 활성 시간 표시, 세션 접속 명령어 제공 기능을 추가하여 에이전트 관리와 디버깅 효율을 높인다.

## Requirements
- Session ID 전체를 클립보드에 복사하는 버튼 제공
- SessionStart 시점부터의 경과 시간을 실시간으로 표시 (활성 에이전트는 라이브 업데이트)
- 세션 접속 명령어 제공 및 클릭 시 클립보드 복사: `cd {cwd} && claude -r {sessionId}` (resume), `cd {cwd} && claude -r {sessionId} --fork-session` (fork)
- 기본 정렬: 상태 우선순위 (ACTIVE > IDLE > WAITING > ENDED) + 최근 활동순
- 정렬 드롭다운으로 기준 선택 가능 (상태순, 최근 활동순, 이름순)
- filter 버튼으로 에이전트 복수 선택 → "View Events" 버튼으로 Events 뷰 전환 시 선택된 세션만 필터링

## Approach
에이전트 카드의 메타 영역에 session ID를 truncate 표시 + 복사 아이콘을 배치하고, navigator.clipboard.writeText로 복사한다. 경과 시간은 기존 duration 표시를 보강하여 활성 에이전트에 대해 setInterval로 1분 단위 라이브 업데이트한다. 세션 접속 명령어는 카드 하단에 버튼으로 제공하며, cwd와 sessionId를 조합하여 명령어 문자열을 생성하고 클릭 시 클립보드에 복사한다. select 버튼으로 복수 에이전트를 선택하면 상단에 "N selected + View Events" 바가 표시되고, 클릭 시 Events 뷰로 전환된다. tmux 버튼은 에이전트 PID에서 부모 체인을 역추적하여 tmux 패널을 매칭한다. 서버의 세션 상태 판정은 SessionEnd 후 SessionStart(resume)가 오면 hasSessionEnd를 리셋하여 활성 상태를 정확히 반영한다.

## Verification
- Session ID 복사 버튼 클릭 시 전체 ID가 클립보드에 복사됨
- 활성 에이전트의 경과 시간이 실시간으로 갱신됨
- resume/fork 명령어가 `claude -r {sessionId}` / `claude -r {sessionId} --fork-session` 형태로 생성되고 클릭 시 복사됨
- 정렬 드롭다운 변경 시 목록이 즉시 재정렬됨
- resume된 세션이 ended가 아닌 active/idle로 정확히 표시됨

## Implementation Status
- [x] Session ID 복사 버튼 (`navigator.clipboard.writeText`)
- [x] 경과 시간 라이브 업데이트 (`setInterval` 60초, active/idle 에이전트 대상)
- [x] resume/fork 명령어 복사 (`claude -r {sessionId}`, `--fork-session`)
- [x] 정렬 드롭다운 (Status / Activity / Name)
- [x] 복수 에이전트 필터 → Events 뷰 전환 (`selectedSessions` Set)
- [x] tmux ancestor PID 역추적 매칭
- [x] Session resume 감지 (hasSessionEnd 리셋)
