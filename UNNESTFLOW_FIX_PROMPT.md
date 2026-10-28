# Unnestflow 외부 MCP 연계 개선 지시문

아래 내용을 Unnestflow 플랫폼 개발 에이전트의 작업 지시로 사용한다.

---

현재 작업 대상은 `C:/Users/SIL/Desktop/sil_lab/unnest-mvp`의 Unnestflow 플랫폼이다. 저장소의 `AGENTS.md`를 먼저 읽고, 아래 인계 문서를 읽은 뒤 실제 코드를 수정하고 검증해 줘.

`C:/Users/SIL/Desktop/sil_lab/daylog/UNNESTFLOW_HANDOFF.md`

목표는 **Runtime 운영 모드를 유지한 상태에서 외부 MCP 연결을 관리하고, Notion을 인증·조회하며, 외부 MCP 클라이언트가 게시된 Unnestflow Flow를 정상 실행할 수 있게 하는 것**이다. 단순 설명이나 임시 연결 설정에 그치지 말고 플랫폼의 정식 기능과 회귀 검증까지 마무리해 줘.

## 확인된 현상

1. Runtime에서 관리자 계정으로 `GET /api/v2/mcp/servers`를 호출해도 HTTP 423이 나온다.

   ```json
   {
     "detail": {
       "code": "BUILDER_FEATURE_DISABLED",
       "message": "This feature is disabled while the server is in Runtime mode."
     }
   }
   ```

   `api/router.py`에서 v2 MCP 라우터 전체에 `_BUILDER_ONLY`가 적용된다. 그래서 운영 중 연결 목록 확인과 신규 연결 등록을 위해 서버 전체를 Builder로 전환해야 했다.

2. **Runtime에서 외부 MCP 실행이 전부 불가능한 것은 아니다.** 임시로 Builder에서 Notion MCP 연결과 비공개 Flow를 등록·게시하고 Runtime으로 복원한 뒤, 실제 게시 Flow의 Agent가 `notion-fetch`를 호출하여 성공했다. 실행 API는 HTTP 200, 소요 시간은 18,515ms였다.

3. Notion OAuth는 플랫폼 밖의 `mcp-remote@0.15.2`와 Daylog 폴더의 로컬 어댑터가 처리하고 있다. 사용자가 OAuth 승인을 완료했다. 최종 노출 도구는 `notion-fetch` 1개이며, 허용된 보고 영역의 ID만 읽는다. 플랫폼 내 인증·재인증·갱신·연결 해제 기능으로 정리해야 한다.

4. 별개 방향의 문제도 있다. 외부 클라이언트가 Unnestflow 자체의 `/api/v1/mcp/streamable`에 연결하면 initialize와 tools/list는 성공하지만, Daylog Flow의 tools/call은 다음 본문을 반환했다.

   ```text
   'Flow' object has no attribute 'execution_context'
   ```

   이때 HTTP는 200이고 `result.isError`도 false였다. 실제 실행 실패가 프로토콜상 성공처럼 보이는 문제도 함께 고쳐야 한다. 프로젝트 MCP 경로도 Runtime에서 Builder 라우터 제한을 받으므로 관리와 실행 경로를 함께 검토해 줘.

5. Windows MCP 설정에서 `command: "C:/Program Files/nodejs/node.exe"`를 등록하자 HTTP 422와 `Command 'Program' is not allowed`가 나왔다. 이번에는 `command: "node"`로 등록했다. 실행 파일 경로를 공백 기준으로 잘못 자르는 검증도 개선 대상이다.

## 구현 요구사항

### 1 Runtime의 외부 연결 관리 분리

- 서버 전체 모드 전환 없이, 권한 있는 관리자가 운영용 외부 연결을 조회·등록·수정·점검·비활성화할 수 있게 해 줘.
- 연결 관리와 Flow 생성·편집·게시 권한을 분리해 줘. Runtime에서 외부 연결을 허용한다고 Flow 편집이나 임의 파일·코드 실행 기능까지 열면 안 된다.
- 기존 고정 역할, 소유자 경계, `mcp_servers_locked`, 감사 기록과 자격 증명 정책을 재사용해 줘. viewer에게 연결 변경이나 토큰 조회를 허용하지 마.
- Runtime에서 지원하는 연결 유형을 명확히 해 줘. HTTP/SSE, OAuth 연결 및 승인된 로컬 커넥터의 정책을 구분하고, 임의 STDIO 명령 실행을 일반 사용자에게 허용하는 방식으로 해결하지 마.
- UI에서 연결 여부, 인증 필요 여부, 도구 목록, 마지막 점검/실행 결과를 구분해 보여 줘. 도구 목록 조회 성공만으로 업무 실행까지 성공했다고 표시하지 마.
- 연결 URL·소유자·허용 도구 범위가 바뀔 때 기존 게시 Flow의 승인·정책 의존성을 어떻게 재검증할지 정하고 적용해 줘. 자격 증명 갱신과 권한 확대를 같은 종류의 변경으로 처리하지 마.

### 2 Notion OAuth를 플랫폼 기능으로 정리

- 공식 MCP 주소 `https://mcp.notion.com/mcp`를 사용하는 OAuth 연결을 지원해 줘. 기존 인증 구현이 있으면 먼저 재사용 가능성을 확인해 줘.
- 필요한 OAuth discovery, 클라이언트 등록, Authorization Code와 PKCE, state 검증, 콜백, 만료·갱신, 재인증과 해제를 처리해 줘.
- 토큰과 인증 세션을 연결 소유자별로 격리해 줘. Flow JSON, 응답, 프런트 상태, 일반 로그에 비밀값이 노출되지 않게 해 줘.
- 현재 Daylog의 절대 경로와 OAuth 캐시에 의존하는 구성을 플랫폼이 관리하는 저장 위치와 커넥터 실행 방식으로 옮겨 줘. 기존 승인 정보를 무조건 복사하거나 출력하지 말고, 정책상 필요한 경우 사용자 재승인으로 이전해 줘.
- **현재 어댑터의 조회 제한은 OAuth 자체의 읽기 전용 scope를 의미하지 않는다.** 도구 허용 목록과 문서 접근 범위를 별도로 강제해 줘. 이번 검증에서는 Notion 문서 수정이 필요하지 않다.
- 기존에 동작하는 `Notion 주차별 보고 조회` Flow는 정상 경로를 확보하기 전까지 보존해 줘. 새 구현으로 전환한 뒤 같은 실제 페이지의 조회 결과를 비교해 줘.

### 3 Unnestflow가 제공하는 MCP 실행 경로 수정

- `mcp_utils.py`의 Flow 검색부터 `simple_run_flow` 호출까지 추적해 줘. 현재 코드는 `get_flow_snake_case`로 얻은 Flow를 전달하며, 실행 경로는 `execution_context`를 요구한다.
- 단순히 ORM Flow에 빈 `execution_context` 속성을 붙이거나 권한 검사를 건너뛰지 마. REST 실행 경로에서 사용하는 `resolve_execution_flow` 등 정식 resolver를 확인하여 같은 게시 버전·권한·실행 문맥 계약을 적용해 줘.
- Runtime에서는 활성 publication이 가리키는 승인된 버전을 실행해야 한다. draft 데이터나 미게시 Flow가 우회 실행되지 않게 해 줘.
- 사용자 공유, 최소 접근 수준, 프로젝트 범위, 실행 주체/소유자, session namespace, request variables와 예약된 실행 정책 키를 보존해 줘. 사용자 입력으로 실행 정책을 덮어쓸 수 없게 해 줘.
- tools/list와 tools/call이 같은 권한 기준을 따르는지 확인해 줘. 프로젝트 MCP의 실행용 라우터와 프로젝트 편집용 API의 모드 제한을 분리해 줘.
- 실패한 도구 실행은 SDK 규약에 맞는 오류 응답으로 전달해 줘. HTTP 200으로 JSON-RPC 응답을 전송하더라도 tools/call 실패가 `isError: false`로 보이면 안 된다.

### 4 Windows 실행 명령 경로 처리

- 구조화된 `command`와 `args`를 문자열 shell 명령처럼 취급하지 않게 해 줘.
- 공백이 있는 절대 경로, `.exe` 접미사, Windows 경로 구분자를 올바르게 처리하면서 기존 실행 파일 allowlist, 위험 인자와 환경변수 검증을 유지해 줘.
- 정상 경로를 지원하기 위해 실행 파일 제한 전체를 해제하거나 shell 실행으로 바꾸지 마.

## 시작할 코드 위치

모든 경로는 Unnestflow 저장소 기준이다. 실제 현재 코드와 대조한 뒤 변경해 줘.

- `src/backend/base/unnestflow/api/router.py`
- `src/backend/base/unnestflow/api/v1/server_mode_dependencies.py`
- `src/backend/base/unnestflow/api/v2/mcp.py`
- `src/backend/base/unnestflow/api/v2/schemas.py`
- `src/backend/base/unnestflow/api/v1/mcp.py`
- `src/backend/base/unnestflow/api/v1/mcp_projects.py`
- `src/backend/base/unnestflow/api/v1/mcp_utils.py`
- `src/backend/base/unnestflow/api/v1/endpoints.py`
- `src/backend/base/unnestflow/services/authorization/publication.py`
- `src/ufx/src/ufx/base/mcp/util.py`
- `src/ufx/src/ufx/components/models_and_agents/mcp_component.py`
- 프런트의 MCP 서버 설정 UI, 인증 UI 및 Runtime 모드 가드

## 검증과 완료 기준

1. Runtime을 유지한 채 관리자 연결 목록 조회, 연결 등록/변경과 점검을 수행한다. 허용되지 않은 사용자 변경, 다른 사용자 토큰 접근, 일반 Flow 편집은 거절된다.
2. Runtime에서 Notion 로그인과 연결 복원, 만료 토큰 갱신 또는 필요한 재인증이 동작한다. OAuth state 오류와 다른 사용자 세션 재사용을 거절한다.
3. 실제 게시 Flow에서 Notion 조회 도구 호출과 응답을 확인한다. 페이지 제목은 `주차별 보고 자료`이며, 팀별 링크·제출 현황 DB·보고 아카이브가 원문과 일치해야 한다. 문서는 수정하지 않는다.
4. 외부 MCP 클라이언트의 initialize → tools/list → tools/call로 승인된 Unnestflow 게시 Flow를 실제 실행한다. execution_context 오류가 없어야 한다.
5. 미게시·중지된 publication, 미허용 사용자, 잘못된 프로젝트 범위, 요청으로 변조한 실행 정책은 실행되지 않아야 한다. REST와 MCP가 동일한 승인 버전과 정책을 따르는지 확인한다.
6. 모델/도구 실행 실패가 MCP 오류로 전달되고 성공 답변으로 저장·표시되지 않아야 한다.
7. Windows의 공백 포함 실행 파일 경로가 정상 검증되며, 위험한 명령·인자·환경변수는 계속 거절된다.
8. 자동 테스트에는 실제 외부 비밀값이 필요하지 않도록 적절한 계약/회귀 검증을 추가하고, 승인된 현재 로컬 연결로 별도 실제 연동 검증을 수행한다.
9. 기존 Daylog Flow API 연계도 재확인한다. 작업 후 서버 모드와 기존 publication 상태를 기록한다. 운영 모드를 몰래 바꾼 상태로 두거나 기존 리소스를 지우지 않는다.

작업 결과에는 원인, 변경 파일, 테스트 결과, 실제 호출 증빙, 기존 연결 이전 방법과 남은 제약을 적어 줘. 단지 Builder로 잠시 전환하거나 현재 외부 브리지를 다시 등록하는 것은 이 개선 작업의 완료가 아니다.
