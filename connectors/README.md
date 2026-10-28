# Daylog 전용 Notion MCP 커넥터

이 폴더는 2026-10-26 시연에서 `.data/`에 두었던 두 어댑터의 공유용 실행 소스다. 노출 도구와 업무 규칙을 유지하고, 설정·작업·증빙 저장 경로를 환경변수로 지정할 수 있도록 분리했다. 기존 플랫폼이 실행하는 `.data/` 복사본을 자동 교체하거나 MCP 연결을 변경하지 않는다.

## 하는 일

| 프로그램 | Unnestflow Agent에 노출하는 도구 | 처리 범위 |
| --- | --- | --- |
| `notion-readonly-server.mjs` | `notion-fetch` | 지정된 8개 Notion ID만 조회하도록 제한 |
| `notion-weekly-server.mjs` | `publish_weekly_report(job_id)` | 저장된 Daylog 작업으로 지정 페이지에 게시, 중복·수정본 처리, 저장본 재조회, 영수증 생성 |

두 프로그램은 Unnestflow를 향해 STDIO MCP 서버로 동작하고, 하위 `mcp-remote`를 향해서는 MCP 클라이언트다. OAuth와 원격 통신은 `mcp-remote`, 실제 문서 읽기·쓰기는 Notion 공식 MCP 서버가 맡는다.

이들은 Daylog 업무용 커넥터다. 새로운 외부 서비스마다 이와 같은 어댑터를 만들어야 한다는 뜻은 아니다. 일반적인 Notion 조회는 호환되는 MCP 클라이언트가 공식 MCP 서버에 직접 연결할 수 있다. 이 코드는 조회 범위 제한과 Daylog 게시 절차를 추가한다.

## 설치와 설정

Unnestflow가 MCP 프로세스를 실행하는 호스트에 Daylog 저장소와 Node.js를 준비한다. 저장소 루트에서 `npm ci`로 SDK 등 의존성을 설치한다. Daylog 앱을 다른 호스트에 두는 경우에도 커넥터 실행 호스트에는 이 코드와 필요한 의존성이 있어야 한다.

시연에서 사용한 브리지 버전을 재현하려면 다음처럼 별도 경로에 설치할 수 있다.

```powershell
npm.cmd install --prefix .data/notion-mcp-bridge mcp-remote@0.15.2
Copy-Item connectors/notion-mcp-config.example.json .data/notion-mcp-config.json
```

예제 JSON의 `/ABSOLUTE/...`, `/PRIVATE/...`를 실제 호스트 경로로 바꾼다. 자리표시자는 자동 확장되지 않는다. 사용자 OAuth 승인은 해당 실행 환경에서 완료해야 하며, 인증 캐시나 실제 키를 Git에 올리지 않는다. 브리지의 콜백·브라우저 인증이 가능한 환경도 준비한다.

| 환경변수 | 기본값 | 의미 |
| --- | --- | --- |
| `DAYLOG_CONNECTOR_DATA_DIR` | 저장소 루트의 `.data` | 커넥터 런타임 데이터 기본 위치 |
| `NOTION_MCP_CONFIG` | 위 데이터 위치의 `notion-mcp-config.json` | 브리지 실행 설정 파일 |
| `WEEKLY_JOBS_DIR` | 위 데이터 위치의 `weekly-jobs` | Daylog와 게시 커넥터가 공유하는 작업·영수증 위치 |
| `WEEKLY_EVIDENCE_DIR` | 위 데이터 위치의 `weekly-evidence` | 커넥터가 원격 조회 증빙을 저장할 위치 |

경로 환경변수의 상대 경로는 저장소 루트를 기준으로 해석한다. 서로 다른 프로세스나 컨테이너에서는 절대 경로를 권장한다. 두 프로세스의 경로 문자열이 달라도 같은 공유 저장소를 가리켜야 한다.

Unnestflow에 등록하는 조회용 MCP 설정 예:

```json
{
  "command": "node",
  "args": ["/ABSOLUTE/DAYLOG/connectors/notion-readonly-server.mjs"],
  "env": {
    "NOTION_MCP_CONFIG": "/PRIVATE/notion-mcp-config.json"
  }
}
```

게시용 MCP 설정 예:

```json
{
  "command": "node",
  "args": ["/ABSOLUTE/DAYLOG/connectors/notion-weekly-server.mjs"],
  "env": {
    "NOTION_MCP_CONFIG": "/PRIVATE/notion-mcp-config.json",
    "WEEKLY_JOBS_DIR": "/SHARED/weekly-jobs",
    "WEEKLY_EVIDENCE_DIR": "/PRIVATE/weekly-evidence"
  }
}
```

그다음 Flow의 MCP Tools에 각각 `notion-report-readonly`, `daylog-weekly-append-only` 연결을 선택한다. Daylog 서버에는 같은 작업 저장소를 가리키는 `WEEKLY_JOBS_DIR`과 게시 Flow의 `NOTION_WEEKLY_FLOW_URL`을 설정한다. Unnestflow가 MCP 자식 프로세스를 유지하고 있다면 연결을 다시 시작해야 코드·환경변수 변경이 반영된다.

## 대상 범위와 이전 제약

- 조회 허용 목록은 `notion-readonly-server.mjs`에 있는 시연 대상 8개 ID다.
- 게시 대상은 `server/weekly.mjs`의 `WEEKLY_PAGE_ID` 상수다. 새로운 대상은 이 값과 연결 정책을 검토해 설정해야 한다.
- 게시 커넥터는 `../server/weekly.mjs`를 import하므로 `.mjs` 한 파일만 떼어 복사할 수 없다.
- 작업 파일과 영수증을 함께 보존해야 같은 대화 수정본과 재시도 동작을 이어갈 수 있다.
- 영수증 재사용은 원격 문서가 이후 변경됐는지 매번 새로 확인하지 않는다.
- 원격 본문 전체 해시 비교가 아니라 작업 표시·원문 ID·하위 링크 보존을 확인한다.
- 기본 Daylog Docker 이미지는 이 커넥터를 포함하거나 실행하지 않는다. Unnestflow 측 실행 호스트에 별도로 배포하고, 컨테이너를 나누면 작업 저장소도 공유해야 한다.
- 이 공유용 소스는 모의 MCP 서버를 사용하는 실제 STDIO 프로세스 테스트로 검증했다. 새 소스로 실제 Notion을 다시 호출하거나 기존 운영 연결을 이전한 상태는 아니다.

플랫폼 전달 내용은 [UNNESTFLOW_PLATFORM_MESSAGE.md](../UNNESTFLOW_PLATFORM_MESSAGE.md), 전체 과거 증빙은 [상세 인계](../UNNESTFLOW_DAYLOG_NOTION_HANDOFF.md)를 참고한다.
