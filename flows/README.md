# Unnestflow Flow 생성 템플릿

2026-10-26에 사용한 세 그래프를 공유용 생성 요청 JSON으로 정리했다. 모델 키는 비워 두었고, MCP 실행 경로와 런타임 저장 위치는 자리표시자로 바꿨다. 실제 인증 정보와 기존 Flow·프로젝트 ID는 포함하지 않는다.

| 파일 | 구성 |
| --- | --- |
| `daylog-review.json` | Chat Input → Language Model → Chat Output |
| `notion-readonly.json` | Chat Input → Agent → Chat Output, MCP Tools → Agent Tools |
| `notion-weekly-publish.json` | 위 Agent 구성에 Daylog 전용 게시 MCP 연결 |

각 JSON의 `data`가 노드·연결 그래프다. 바깥에는 `/api/v1/flows/` 생성 요청에서 사용한 `name`, `description`, 접근 수준 등의 필드를 포함했다. 대상 프로젝트가 필요하면 실제 `folder_id`를 지정한다. UI 가져오기는 설치 버전이 요구하는 포맷과 맞는지 확인해야 하며, 파일을 넣기만 하면 인증·커넥터 설치·publication이 자동으로 만들어지는 것은 아니다.

1. 설치된 Unnestflow 버전의 컴포넌트와 그래프 형식을 확인한다. JSON에는 당시 컴포넌트 정의도 들어 있어 버전 차이가 있으면 대응이 필요하다.
2. `api_key`는 플랫폼의 모델 자격 증명 방식으로 연결한다. 템플릿에 키를 저장하지 않는다.
3. Notion Flow는 먼저 [커넥터 배포](../connectors/README.md)를 준비하고 MCP 연결 이름·실행 경로·환경변수를 실제 값으로 바꾼다.
4. 노드의 허용 Notion 영역·프롬프트와 `server/weekly.mjs`의 게시 대상이 해당 환경에 적절한지 확인한다. 시연 대상 ID·링크는 의도적으로 남아 있으며 범용 자동 설정이 아니다.
5. Flow를 생성하고 권한·publication을 설정한다. 새 Flow ID를 사용해 Daylog의 실행 주소를 갱신한다.
6. 검토·조회부터 확인한 뒤 게시·저장본 재조회·재시도를 확인한다.

세 템플릿의 `mcp_enabled`는 `false`다. Flow 내부에서 외부 MCP를 사용하는 것과 Flow 자체를 Unnestflow MCP 도구로 노출하는 설정은 별개다. 현재 Daylog 시연은 Flow API 실행을 사용한다.
