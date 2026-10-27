# Unnestflow 외부 연계 작업 인계

> 후속 검증에서 Daylog 문서 업로드 → Unnestflow 검토 → Notion 주간보고 게시도 성공했다. 새 게시 연결과 최신 인계 사항은 [WEEKLY_NOTION_HANDOFF.md](./WEEKLY_NOTION_HANDOFF.md)를 먼저 확인한다. 아래 조회 전용 연결과 별도로 추가한 기능이다.

작성일: 2026-10-26 KST

이 문서는 Daylog에서 수행한 검증을 Unnestflow 플랫폼 개발 폴더에서 이어가기 위한 인계 자료다. 사용자 요청은 플랫폼 개발 에이전트에게 외부 연계 문제의 정식 수정을 지시하고, 이후 작업을 플랫폼에서 직접 진행하는 것이다.

수정 지시문: [UNNESTFLOW_FIX_PROMPT.md](./UNNESTFLOW_FIX_PROMPT.md)

## 1 현재 상태와 핵심 결론

**Notion 연결은 실제로 성공했다.** 사용자 OAuth 승인 후, Unnestflow의 비공개 게시 Flow가 MCP로 실제 Notion 페이지를 조회하고 모델 응답을 반환했다. 검증 시각은 **2026-10-26 16:48:35 KST**, HTTP 200, 소요 시간은 **18,515ms**였다. 응답의 `Agent Steps`에도 `type: tool_use`, `name: notion-fetch`가 남아 있다.

현재 서버는 **Runtime**이며 기존 Daylog 연결도 정상으로 재확인했다. 플랫폼 소스를 패치하거나 서버를 재시작하지는 않았다. 다만 Notion 등록 과정에서 설정 API를 사용하기 위해 Runtime → Builder → Runtime 모드 전환을 수행했고, 새 MCP 연결·프로젝트·Flow·publication을 추가했다.

따라서 **플랫폼 소스 변경 없음**과 **플랫폼 설정 변경 없음**을 혼동하면 안 된다. 설정은 추가했다.

## 2 폴더와 실행 환경

| 항목 | 위치 또는 주소 |
| --- | --- |
| 지금까지 작업한 Daylog | `C:/Users/SIL/Desktop/sil_lab/daylog` |
| 이후 수정할 Unnestflow 플랫폼 | `C:/Users/SIL/Desktop/sil_lab/unnest-mvp` |
| 플랫폼 작업 지침 | `C:/Users/SIL/Desktop/sil_lab/unnest-mvp/AGENTS.md` |
| Daylog 화면 및 API | `http://127.0.0.1:3090` |
| Daylog 개발 화면 | `http://127.0.0.1:5173` |
| Unnestflow | `https://127.0.0.1:7860` |
| 신뢰용 공개 인증서 | `C:/Users/SIL/Desktop/sil_lab/unnest-mvp/.tmp/local-platform-20261026/https/fullchain.pem` |

Daylog의 현재 정상 동작 확인 주소는 3090이다. 개발 서버 5173에서는 API 프록시를 통한 POST가 요청 Origin/Host 검사로 거절되는 현상을 확인했으며, 이 개발 프록시 문제는 별도 수정하지 않았다.

플랫폼 Python 명령은 저장소 지침에 따라 `uv run`을 사용한다. 지금까지는 Daylog 폴더에서 아래 형태로 플랫폼에 설치된 환경을 사용했다.

```powershell
uv --cache-dir .data/uv-cache --offline run --no-sync --project C:/Users/SIL/Desktop/sil_lab/unnest-mvp python SCRIPT_PATH
```

로컬 HTTPS 호출은 위 공개 인증서를 신뢰하도록 설정했다. 인증서 검증을 끄지 않았다. Node의 `NODE_EXTRA_CA_CERTS`는 Node 프로세스를 시작하기 전에 설정해야 한다.

## 3 사용자가 요청했고 완료한 일

1. Daylog 로컬 실행, 보고서 업로드 및 여러 사업 검토 사례 구성.
2. 선택 보고서를 한 번에 사업별로 검토하는 `검토하기` 버튼 추가.
3. Unnestflow와 Daylog의 실제 Flow API 연결 및 검토 응답·근거 저장 확인.
4. 실제 UI 화면과 외부 연계 검증을 담은 내부 공유용 PDF 작성 후 회사 보고용 형식으로 재작성.
5. 사용자 제공 Notion 페이지를 OAuth로 연결하고, Unnestflow Agent가 MCP로 실제 조회하는 비공개 Flow 등록 및 실행.

최초 보고서 검토에는 가상 자료 20개를 사용했다. 업무보고·사업 사례와 Notion에 실제 있는 내용은 별개의 데이터다.

### Daylog 사례와 기능

- SQLite에 저장된 보고서 25개. 그중 가상 사업 5개 × 부서별 4개 = 20개를 종합 검토했다.
- 캠페인핏: 고객군 전환 찬성과 개발 여력의 충돌.
- 리테일봇: 출시 찬성 다수와 보안 차단 조건의 충돌.
- 플로우데스크: 저가 요구와 고객당 수익성의 충돌.
- 로컬물류: 동일 표본 반복 인용, 서로 다른 분모, 실제 결제 전환 검토.
- 매장온: 최신 현장 관찰로 과거 확대 가정을 수정하는 사례.
- 실제 종합 검토 응답에 사업 5개와 근거 보고서 20개가 포함됐다. 최초 백엔드 검토는 17,609ms였다.
- AI 답변의 참조 버튼을 누르면 원문으로 이동한다. AI Markdown 표의 행 사이 빈 줄 처리를 보완했으며 코드 블록은 보존했다.
- Windows의 정적 화면 경로 검사도 수정했다. 당시 서버 테스트 18개와 프런트 빌드가 통과했다.

### 기존 PDF

`C:/Users/SIL/Desktop/sil_lab/daylog/output/pdf/Daylog_Unnestflow_Integration_Evidence.pdf`

현재 6쪽 사내 보고용 문서다. 지정한 Design Report DOCX 템플릿을 복제하여 핵심 판정과 후속 조치를 첫 장에 두었고, 모든 페이지를 렌더링해 확인했다.

**이 PDF는 Notion 연결 성공 전에 작성됐다.** Notion 결과는 아직 PDF에 추가하지 않았다. PDF의 ‘MCP 실행 오류’는 아래의 Unnestflow 자체 MCP 제공 경로를 가리키며, 이후 성공한 Notion 조회와 모순되지 않는다.

## 4 서로 다른 세 가지 연계 경로

| 경로 | 검증 결과 | 비고 |
| --- | --- | --- |
| Daylog → Unnestflow 게시 Flow API | 성공 | 보고서 20개 검토와 응답·근거 저장 |
| 외부 MCP 클라이언트 → Unnestflow 자체 MCP → Daylog Flow | 실행 실패 | initialize/list 성공, tools/call의 execution_context 오류 |
| Unnestflow 게시 Flow → 외부 Notion MCP | 성공 | OAuth 승인 후 Agent가 notion-fetch 실제 호출 |

### A Daylog와 Unnestflow의 Flow API 연결

| 항목 | 값 |
| --- | --- |
| 프로젝트 | `Daylog 보고서 검토` |
| 프로젝트 ID | `3165cb40-ae2b-40e9-84f8-57038219bdc8` |
| Flow | `Daylog 사업 보고서 검토` |
| Flow ID | `61b91688-c559-496a-b5d5-ec990055a414` |
| 실행 주소 | `https://127.0.0.1:7860/api/v1/run/61b91688-c559-496a-b5d5-ec990055a414` |
| 게시 상태 | 검증 당시 active |
| 접근 범위 | 비공개, 최소 admin |

실행 API는 `x-api-key`를 사용했다. 관리 API의 Bearer 로그인 토큰만으로 실행 API를 호출하면 `An API key must be passed as query or header`와 HTTP 403이 나왔다. 이것은 Notion 인증 실패와 다른 문제다.

요청은 아래처럼 `input_request`로 감싼다.

```json
{
  "input_request": {
    "input_value": "질문 또는 서버가 조립한 보고서 원문과 질문",
    "input_type": "chat",
    "output_type": "chat",
    "session_id": "새 검증 세션 ID"
  }
}
```

### B Unnestflow가 제공하는 MCP 실행 오류

검증 주소는 `https://127.0.0.1:7860/api/v1/mcp/streamable`이다.

| 단계 | 실제 결과 |
| --- | --- |
| initialize | HTTP 200 |
| notifications/initialized | HTTP 202 |
| tools/list | HTTP 200, Daylog 도구 발견 |
| tools/call | HTTP 200이지만 본문에 실행 오류 |

도구 이름은 `daylog_saeop_bogoseo_geomto`였고, 오류는 다음과 같다.

```text
Error Executing the Daylog 사업 보고서 검토 tool. Error: 'Flow' object has no attribute 'execution_context'
```

오류 응답의 `result.isError`는 false였다. 실행 성공으로 판정하지 않았다. `mcp_utils.py`가 검색한 Flow를 실행 경로에 직접 전달하고 `endpoints.py`는 `flow.execution_context`를 사용하는 코드 차이를 확인했다. 정식 publication resolver와 권한 계약을 따라 고쳐야 하며, 단순 속성 추가가 정답이라고 가정하면 안 된다.

프로젝트별 MCP 경로 `/api/v1/mcp/project/{project_id}/streamable`도 Runtime의 Builder 제한을 받는다. 글로벌 MCP 경로와 프로젝트별 경로를 구분해서 재현해야 한다.

### C Unnestflow에서 Notion MCP 조회

| 항목 | 값 |
| --- | --- |
| Notion 페이지 | `주차별 보고 자료` |
| 페이지 주소 | `https://app.notion.com/p/3f94587c9925839a92b501acc6675a38` |
| 공식 원격 MCP | `https://mcp.notion.com/mcp` |
| 등록된 MCP 서버 이름 | `notion-report-readonly` |
| 프로젝트 | `Notion 주차별 보고` |
| 프로젝트 ID | `bae6cb25-9137-4b1d-be5d-36fa294e7a1a` |
| Flow | `Notion 주차별 보고 조회` |
| Flow ID | `05ffe86e-9a6d-4fe4-8d04-9fe82743cd0a` |
| Playground | `https://127.0.0.1:7860/playground/05ffe86e-9a6d-4fe4-8d04-9fe82743cd0a/` |
| 실행 주소 | `https://127.0.0.1:7860/api/v1/run/05ffe86e-9a6d-4fe4-8d04-9fe82743cd0a` |
| 게시 상태 | 검증 당시 active / 비공개 / 최소 admin |

구성은 다음과 같다.

```text
Chat Input ────────────────→ Agent → Chat Output
MCP Tools의 Toolset ──────→ Agent의 Tools

MCP Tools
  → 로컬 조회 전용 STDIO 어댑터
  → mcp-remote 0.15.2
  → 사용자 승인 Notion OAuth
  → 공식 Notion MCP의 Streamable HTTP
```

모델은 기존 플랫폼 설정의 OpenAI `gpt-4.1`을 사용했다. 새 API 키를 Flow JSON에 넣지 않았다. 이번 실행에서는 플랫폼이 보관한 기존 실행용 API 자격 증명으로 호출했고, Agent Steps에 실제 `notion-fetch`가 기록됐다.

확인한 원문 구성은 다음과 같다. 각 페이지의 모든 하위 보고서나 DB의 모든 행을 조회한 것은 아니다.

| 구성 | Notion ID |
| --- | --- |
| 대표이사 | `0292686402b24485b38f1de445fadb31` |
| 개발팀 | `efd3939406604eac9adc5e8fb7f001f4` |
| 사업팀 | `25e2e5e60f7b4aae9146dc4b693f53ec` |
| 인사팀 | `45a8bbeeb7c6493c885142f746cc642d` |
| 팀별 제출 현황 DB | `e688ca559de5446bb068c023aee7eb52` |
| DB data source | `1f016d8d-902f-4a9f-92f6-189041d2be00` |
| 보고 아카이브 | `a458ce823d494112be97e1ea81509bff` |

검증 질문 예:

```text
반드시 notion-fetch 도구로 실제 주차별 보고 자료 페이지를 읽어 줘.
페이지 제목, 연결된 팀 또는 직책 4개, 제출 현황 데이터베이스와
보고 아카이브의 이름과 링크를 한국어로 정리해 줘.
```

## 5 Runtime 제약을 어떻게 처리했는가

관리자 계정으로도 `GET /api/v2/mcp/servers`가 HTTP 423을 반환했다. 원인은 v2 MCP 라우터 전체의 Builder 전용 의존성이다. 현재의 Notion 연결 성공은 이 제품 제약을 수정한 결과가 아니다.

처리 과정은 다음과 같다.

1. 플랫폼과 별개인 로컬 브리지에서 Notion OAuth 승인과 지정 페이지 조회를 먼저 확인했다.
2. 플랫폼에 설치된 실제 `ufx.base.mcp.util.MCPStdioClient`를 별도 검증 프로세스에서 실행하여 조회를 확인했다.
3. `/api/v1/server-mode/preview`로 전환 가능 여부를 확인했다. 당시 활성 publication은 3개였고 blockers와 disabled_features는 비어 있었다.
4. 모드를 잠시 Builder로 전환했다.
5. 새 조회 전용 MCP 서버, 비공개 프로젝트와 Flow를 등록하고 publication을 활성화했다.
6. 스크립트의 `finally`에서 Runtime으로 복원했다. 최초 등록 시 Windows 명령 경로 검증에 실패한 경우도 Runtime으로 복원한 뒤 설정을 바로잡아 재시도했다.
7. Runtime 상태에서 실제 게시 Flow를 실행하여 Notion 응답을 확인했다. 마지막 점검에서 새 게시 Flow와 기존 Daylog 연결이 모두 정상임을 확인했다.

남은 제품 과제는 **Runtime 상태에서 관리자 연결 관리와 OAuth를 플랫폼 내에서 수행할 수 있게 하는 것**이다. 전역 Builder 전환을 일반 운영 절차로 삼으면 안 된다.

## 6 현재 Notion 연결의 로컬 의존성

플랫폼에 저장한 서버 설정은 다음과 같다. 토큰은 들어 있지 않다.

```json
{
  "command": "node",
  "args": [
    "C:/Users/SIL/Desktop/sil_lab/daylog/.data/notion-readonly-server.mjs"
  ]
}
```

이 어댑터가 같은 Daylog `.data` 폴더의 브리지 설정과 OAuth 캐시를 읽는다.

- `notion-readonly-server.mjs`: 플랫폼에 연결된 조회 전용 MCP 서버. 최종 도구 허용 목록은 `notion-fetch` 하나다.
- `notion-mcp-config.json`: 하위 `mcp-remote` 실행 설정. 내부 별칭 `notion-readonly`와 플랫폼에 등록된 이름 `notion-report-readonly`는 다르다.
- `notion-mcp-bridge/node_modules/mcp-remote/`: 작업 폴더에 설치한 0.15.2 버전.
- `notion-mcp-auth/`: 사용자 OAuth 승인과 갱신 정보 보관. **비밀값이 있으므로 문서·채팅·Git에 내용을 복사하지 않는다.**

**작업 폴더만 Unnestflow로 바꾸는 것은 괜찮지만, 기존 Daylog `.data`를 삭제하거나 옮기면 현재 연결이 깨진다.** 다른 폴더에서 이어서 개발하더라도 정식 이전이 끝날 때까지 이 경로를 유지해야 한다.

현재 어댑터는 위에 나열한 허브·연결 페이지·DB ID의 허용 목록을 사용한다. 새 주차나 새 페이지를 자동으로 허용하는 재귀 수집기는 아니다. OAuth가 발급한 원격 권한 전체를 읽기 전용으로 바꾼 것도 아니며, 로컬 어댑터가 노출 도구와 접근 범위를 제한하는 방식이다.

이 구성은 이 Windows PC에서 확인했다. 다른 사용자 계정, 서비스 계정, PC 또는 컨테이너에서 바로 재사용된다고 가정하면 안 된다. 네이티브 OAuth나 플랫폼 관리 커넥터로 이전할 때 실행 주체, 경로, 인증 정보 격리를 정리해야 한다.

## 7 증빙과 재현 파일

모든 상대 경로는 **Daylog 폴더 기준**이다. 대부분의 실행 스크립트와 캐시는 `.data` 아래에 있어 Git에서 제외된다. 플랫폼 폴더만 열면 자동으로 따라오지 않는다.

| 파일 | 용도 |
| --- | --- |
| `output/notion-integration/verification.json` | 내부 공유용 Notion 최종 검증 결과. 토큰 없음 |
| `.data/notion-platform-connection.json` | 등록한 서버·프로젝트·Flow·publication 및 Runtime 복원 상태 |
| `.data/notion-platform-run-verification.json` | 실제 게시 Flow 실행 HTTP 상태, 답변, 시간 |
| `.data/notion-platform-run-response.json` | 실제 응답 원본 및 Agent Steps의 notion-fetch 호출 기록 |
| `.data/unnest-notion-client-verification.json` | 플랫폼 MCP 클라이언트 구현을 사용한 별도 프로세스 검증 |
| `.data/notion-connection-discovery.json` | Runtime MCP 관리 API의 423 기록 |
| `.data/notion-platform-mode-preview.json` | 모드 전환 사전 점검 |
| `.data/build_notion_flow.py` | 기본 Chat Input·Agent·MCP Tools·Chat Output으로 그래프 작성 |
| `.data/notion-flow-graph.json` | 등록한 Flow 그래프. 키 대신 연결 참조 사용 |
| `.data/setup-notion-platform.mjs` | 등록·게시 후 Runtime 복원 스크립트. **실행하면 모드와 설정을 변경한다** |
| `.data/run-notion-platform.mjs` | 기존 게시 Flow의 실제 Notion 조회 재검증 |
| `.data/verify_unnest_notion.py` | 별도 프로세스에서 플랫폼의 MCPStdioClient로 조회 |
| `output/pdf/evidence/mcp-verification-redacted.json` | Unnestflow 자체 MCP 도구 실행 오류의 정리된 증빙 |
| `output/pdf/evidence/verification-summary.json` | Daylog와 기존 MCP 검증 및 PDF 정보 |
| `.data/connected-review-result.json` | 20개 가상 보고서에 대한 실제 검토 답변 |
| `.data/unnest-review-connection.json` | 기존 Daylog용 Flow 연결 정보 |

`.env`에는 Daylog 실행용 키가 있고 `.data/.unnest-session.json`에는 관리 API 로그인 토큰이 있다. 인계 문서에는 비밀값을 넣지 않았다. 파일을 읽을 때도 출력·첨부·커밋하지 않는다.

이전에 만든 `.data/patch-native-mcp.py`는 **미적용 임시안**이다. 자동 실행하지 말고, 플랫폼의 현재 publication resolver와 권한 계약에 맞춰 정식 수정하고 검증해야 한다.

### 현재 게시된 Notion Flow 재검증

Daylog 폴더에서 실행한다. Notion 문서를 읽고 모델을 실제 호출하므로 외부 API 사용이 발생한다.

```powershell
Set-Location C:/Users/SIL/Desktop/sil_lab/daylog
$env:NODE_EXTRA_CA_CERTS='C:/Users/SIL/Desktop/sil_lab/unnest-mvp/.tmp/local-platform-20261026/https/fullchain.pem'
node .data/run-notion-platform.mjs
```

이 스크립트는 재등록이나 Builder 전환 없이 현재 게시 Flow를 실행한다. 반면 `setup-notion-platform.mjs`를 무작정 재실행하면 다시 모드 전환을 수행하므로, 후속 개발의 기본 검증 명령으로 사용하지 않는다.

## 8 남은 작업과 변경 범위

플랫폼 개발 에이전트가 이어서 할 일:

1. Runtime 외부 연결 관리 API/UI의 권한과 Builder 제한 분리.
2. Notion OAuth 및 토큰 수명 주기를 플랫폼이 관리하도록 정리.
3. 현재 로컬 어댑터 경로·인증 캐시 의존성 이전. 기존 연결이 동작하는 동안 단계적으로 전환.
4. Unnestflow 자체 MCP의 execution_context 실행 계약과 오류 플래그 수정.
5. Windows 공백 포함 실행 파일 경로 검증 수정.
6. 관리자/일반 사용자, 게시/미게시, 공유/미공유, OAuth 갱신/오류, 실제 MCP 호출 회귀 검증.

**아직 구현하지 않은 기능:** Notion 보고서를 Daylog SQLite에 자동 가져오기, 주기적 동기화, 모든 하위 페이지·DB 행의 수집, Notion으로 검토 결과 쓰기. 이번에 확인한 것은 승인된 영역에 대한 조회 연계다.

현재 Daylog 저장소에는 UI·서버·테스트·README 등의 미커밋 변경과 `output/`, `tmp/` 산출물이 있다. 다른 작업을 시작하면서 초기화하거나 정리하지 않는다. 이 문서 작성 단계에서는 Unnestflow 소스를 수정하지 않았다.

## 9 새 폴더에서 시작할 때

Unnestflow 폴더를 작업 디렉터리로 선택한 뒤 다음과 같이 개발 에이전트에게 전달하면 된다.

```text
C:/Users/SIL/Desktop/sil_lab/daylog/UNNESTFLOW_FIX_PROMPT.md 와
C:/Users/SIL/Desktop/sil_lab/daylog/UNNESTFLOW_HANDOFF.md 를 읽고,
현재 Unnestflow 저장소의 AGENTS.md를 따라 외부 MCP 연계 개선 작업을 진행해 줘.
Notion OAuth 연결과 실제 게시 Flow 조회는 이미 성공했다.
기존 로컬 연결을 보존하면서 Runtime에서 직접 관리할 수 있도록 정식 기능으로 옮겨 줘.
```
