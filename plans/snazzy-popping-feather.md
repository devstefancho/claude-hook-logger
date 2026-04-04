# PermissionRequest 로그 기반 자동 허용 패턴 설정 (관대한 버전)

## Context

PermissionRequest 훅으로 152건의 권한 요청이 기록되었다. 사용자는 거의 항상 approve를 누르므로, 최대한 많은 패턴을 allow에 넣어 불필요한 클릭을 줄인다. deny는 치명적 명령만, ask는 외부에 영향을 주는 명령만.

## 수정 파일

- `~/.claude/settings.json` — permissions 섹션

## 추가할 패턴

### `permissions.allow` 추가 (최대한 관대하게)

**읽기 전용 & 출력 명령어**:
```
Bash(ls *)
Bash(find *)
Bash(grep *)
Bash(cat *)
Bash(head *)
Bash(tail *)
Bash(echo *)
Bash(stat *)
Bash(wc *)
Bash(which *)
Bash(file *)
Bash(env *)
Bash(xattr *)
```

**npm/node/pnpm**:
```
Bash(npm *)
Bash(npx *)
Bash(pnpm *)
Bash(node *)
```

**디렉토리/파일 생성**:
```
Bash(mkdir *)
Bash(touch *)
```

**GitHub CLI**:
```
Bash(gh search *)
Bash(gh repo view *)
Bash(gh api *)
Bash(gh run *)
Bash(gh pr list *)
Bash(gh pr view *)
Bash(gh pr checks *)
```

**Python/스크립트**:
```
Bash(python3 *)
Bash(python *)
```

**환경 & 시스템 조회**:
```
Bash(crontab -l *)
Bash(brew *)
Bash(source *)
Bash(curl *)
```

**Claude 설정 경로 Write/Edit/Read**:
```
Write(//Users/stefancho/.claude/hooks/**)
Edit(//Users/stefancho/.claude/hooks/**)
Write(//Users/stefancho/.claude/scheduled-tasks/**)
Edit(//Users/stefancho/.claude/scheduled-tasks/**)
Write(//Users/stefancho/.claude/skills/**)
Edit(//Users/stefancho/.claude/skills/**)
Read(//Users/stefancho/.claude/**)
```

### `permissions.ask` 추가 (외부 영향이 있는 명령만)

```
Bash(gh repo create *)    — 원격 레포 생성
Bash(gh pr create *)      — PR 생성
Bash(gh issue create *)   — 이슈 생성
Bash(crontab *)           — 시스템 스케줄 변경 (crontab -l 제외, 이미 allow)
```

### `permissions.deny` 추가 (치명적 명령만)

```
Bash(rm -rf /*)           — 루트 경로 재귀 삭제만 차단
```

> 참고: `rm -rf *` 전체 차단은 하지 않음. 프로젝트 내 data/ 같은 디렉토리 삭제는 정상 워크플로우. 루트(`/`) 기준 삭제만 차단.

### 기존 deny 유지

```
Read(~/.zsh_secrets)
Read(.env)
```

## 예상 효과

- **allow**: 약 130건 (85%) 자동 해결
- **ask**: 약 5건 (3%) — gh create 계열 + crontab 변경
- **deny**: secrets 읽기 + 루트 삭제
- **default**: 약 17건 (12%) — 복잡한 multi-line 스크립트

## 검증

1. 변경 후 새 세션 시작
2. `Bash(ls *)`, `Bash(npm run build)`, `Bash(python3 script.py)` 등이 권한 요청 없이 실행되는지 확인
3. `Bash(gh pr create *)` 실행 시 ask 모달이 뜨는지 확인
4. `Bash(rm -rf /tmp/test)` 실행 시 차단되는지 확인
