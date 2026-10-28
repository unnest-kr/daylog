# Daylog

부서별 Markdown 업무 보고서를 모으고, 선택한 자료에 대해 질문하는 웹 애플리케이션입니다. React 화면과 Node.js API 서버를 **하나의 컨테이너**로 빌드합니다. 보고서와 대화는 SQLite에 저장하고, 답변은 외부 Unnestflow의 Flow 실행 API 또는 MCP를 호출해 생성합니다.

![보고서 목록·본문·AI 검토 3단 화면 예시 (답변은 화면 설명용 예시 문구)](docs/screenshots/sample-conversation.png)

## 빠른 시작

Docker Engine 또는 Docker Desktop과 Docker Compose v2가 필요합니다. 소스 빌드에 로컬 Node.js나 Unnestflow 소스는 필요하지 않습니다.

```bash
git clone https://github.com/unnest-kr/daylog.git
cd daylog
docker compose up -d --build
```

**http://127.0.0.1:3090** 에서 엽니다. 최초에는 빈 워크스페이스이며, 보고서를 직접 올리거나 표시가 있는 샘플 보고서 4개로 시작할 수 있습니다. MCP 연결 없이도 업로드·조회·필터·삭제를 사용할 수 있습니다. 채팅 답변에는 별도로 연결한 Unnestflow와 모델이 필요합니다.

기본 포트가 사용 중이면 다음처럼 다른 포트를 지정합니다.

```bash
DAYLOG_PORT=3091 docker compose up -d --build
```

이 경우 http://127.0.0.1:3091 로 접속합니다. Windows PowerShell에서는 `.env`의 `DAYLOG_PORT=3091` 설정을 사용하면 됩니다. 기본 공개 범위는 호스트의 loopback 주소입니다.

컨테이너 이미지만 빌드하고 실행할 수도 있습니다.

```bash
docker build -t daylog:local .
docker run -d --name daylog \
  -p 127.0.0.1:3090:3090 \
  -v daylog-data:/data \
  daylog:local
```

Compose와 직접 실행 방식 중 하나를 선택합니다. 두 방식의 볼륨 이름은 다르므로 같은 데이터를 공유하려면 동일한 볼륨을 지정해야 합니다.

## Unnestflow 연결

Daylog는 Unnestflow 서버·Flow·모델을 자동으로 설치하거나 생성하지 않습니다. 실행 중인 Unnestflow에서 다음을 준비합니다.

1. `Chat Input → 모델 → Chat Output` Flow를 만듭니다. 보고서 분석과 `[R1]` 같은 근거 표기를 지시하는 프롬프트는 Daylog가 전달합니다.
2. Flow를 프로젝트의 MCP 도구로 노출하고 도구 이름을 정합니다. 기본값은 `daily_report_assistant`입니다.
3. 해당 Flow를 실행할 권한이 있는 API 키를 발급합니다. 필요한 실행·공유·게시 정책은 Unnestflow 설정을 따릅니다.
4. `.env.example`을 `.env`로 복사하고 연결 정보를 입력합니다.

```dotenv
MCP_URL=https://your-unnestflow.example/api/v1/mcp/project/PROJECT_ID/streamable
MCP_TOOL=daily_report_assistant
UNNESTFLOW_API_KEY=your-server-side-api-key
FLOW_URL=https://your-unnestflow.example/flow/FLOW_ID
DAYLOG_PORT=3090
```

```bash
# Linux/macOS에서는 비밀 파일을 현재 사용자만 읽도록 설정
chmod 600 .env
docker compose up -d
```

오른쪽 위 **연결 설정 → 저장하고 연결 확인**에서 실제 MCP 도구를 확인합니다. API 키는 서버 환경변수로만 읽으며 브라우저에 반환하지 않습니다. `.env`는 Git과 이미지 빌드에서 제외합니다. `FLOW_URL`은 브라우저에서 열 수 있는 편집 화면 주소이며 선택 사항입니다.

화면에서 저장한 MCP 주소·도구 이름은 DB에 보관하며 환경변수보다 우선합니다. 기존 설치의 `.env` 주소를 변경했는데 반영되지 않으면 연결 설정 화면에서도 주소를 변경합니다. API 키 변경은 컨테이너를 재생성해야 반영됩니다.

Runtime 모드에서 MCP 편집 기능이 제한된 Unnestflow에는 게시된 Flow의 실행 주소를 **연결 설정**에 입력합니다. `MCP_URL`에 `http://127.0.0.1:7860/api/v1/run/FLOW_UUID`를 설정해도 됩니다. 기존 환경변수 이름은 그대로 사용하며 `/api/v1/run/UUID` 주소를 자동으로 구분합니다. 연결 확인은 같은 서버의 `/api/v1/flows/published`에서 해당 계정이 실행할 수 있는 Flow인지 조회합니다. 실제 호출은 `input_request`에 `input_value`, `input_type: "chat"`, `output_type: "chat"`, `session_id`를 담아 전송하고 Chat Output의 텍스트를 사용합니다. 이 방식에서는 별도의 MCP 도구 노출이 필요하지 않습니다. API 키는 `UNNESTFLOW_API_KEY`에 설정하고, Node로 직접 실행 중이면 Daylog API 서버를 재시작해야 반영됩니다.

로컬 HTTPS Flow API에서 자체 인증서를 사용하면 `UNNESTFLOW_CA_CERT_FILE`에 신뢰할 공개 인증서 또는 CA의 PEM 파일 경로를 설정합니다. 서버 인증서와 호스트 이름 검증은 유지됩니다. 이 파일 경로와 API 키는 브라우저에 반환하지 않습니다.

연동 서버는 MCP 도구 목록 조회뿐 아니라 실제 Flow 실행도 지원해야 합니다. 일부 Unnestflow MCP 핸들러에서 `'Flow' object has no attribute 'execution_context'` 오류가 발생하는 것을 확인했습니다. 현재 로컬 검증에서는 해당 서버를 수정하지 않았으며, Daylog의 실제 검토 실행은 게시된 Flow API 경로로 확인했습니다. 이 MCP 도구 실행 오류는 별도 해결과 재검증이 필요합니다.

### Notion MCP 연계 검증

2026-10-26 로컬 Unnestflow에서 `Chat Input → Agent → Chat Output`과 `MCP Tools → Agent Tools`를 연결한 별도 비공개 Flow의 실제 실행을 확인했습니다. Notion OAuth 승인 후, Agent의 `notion-fetch` 호출과 원문에 있는 보고 페이지·DB·아카이브 링크가 응답에 포함되는 것을 검증했습니다. 한 번의 종합 조회는 약 18.5초였으며 성능 보장 수치는 아닙니다.

이 경로는 **Unnestflow가 외부 Notion MCP를 호출**하는 연결입니다. 위에서 설명한 **Daylog가 Unnestflow 자체 MCP 도구를 호출**하는 경로와 구분합니다. Notion 공식 원격 MCP 주소는 `https://mcp.notion.com/mcp`이며 OAuth 인증은 `mcp-remote` 브리지에서 처리합니다. 조회 어댑터는 지정한 보고 영역의 `notion-fetch` 하나만 노출합니다.

Daylog의 연결 설정에 Notion 공식 MCP URL을 직접 입력하는 기능은 제공하지 않습니다. 앱에서는 Unnestflow Flow와 전용 커넥터를 거쳐 Notion을 사용합니다. Daylog 폴더에서 수행했던 별도 스크립트의 직접 조회는 앱의 연결 설정 기능과 구분하며, 공유용 브리지·어댑터 구성은 `connectors/`에 있습니다.

현재 설정·브리지·OAuth 캐시는 이 PC의 Git 제외 경로인 `.data/`에 있습니다. 다른 PC나 컨테이너에 배포하려면 실행 경로와 인증 보관을 따로 구성해야 합니다. 이 연결은 Notion 문서를 Daylog SQLite로 자동 가져오는 동기화 기능을 추가하지 않습니다. 내부 공유용 실행 증빙은 `output/notion-integration/verification.json`에서 확인할 수 있습니다.

### Notion 주간보고 작성 시연

2026-10-26에는 **문서 업로드 → Unnestflow 검토 → Notion 주간보고 저장 및 재조회**도 실제 실행했습니다. 상단 **Notion 주간보고**를 누르면 선택 문서로 부서별 활동, 사업별 진행 수치와 분모, 위험 및 다음 조치를 정리해 지정한 페이지에 게시합니다. 최근 대화를 열고 **이 검토 결과 게시**를 누르면 저장된 답변을 게시하거나 다시 확인할 수 있습니다.

- 게시 대상은 사용자가 수정을 승인한 [주차별 보고 자료 (1)](https://app.notion.com/p/4054587c9925805da1bfeb84deae06ab) 하나입니다. 기존 팀별 페이지와 DB 링크 7개를 유지했습니다.
- 기존 검토 Flow와 별도의 비공개 게시 Flow를 사용합니다. 서버 전용 `NOTION_WEEKLY_FLOW_URL`과 기존 API 키 및 CA 설정이 필요합니다.
- Agent에는 `publish_weekly_report(job_id)`만 노출합니다. 본문과 대상은 서버가 저장한 작업으로 고정하며, Notion 저장본의 작업 표시와 원문 ID를 확인한 뒤에만 성공을 반환합니다.
- 같은 검토 결과는 중복 추가하지 않습니다. 같은 대화의 수정본은 이 연결이 만든 해당 보고 영역만 갱신합니다. 다른 대화는 별도 보고 영역으로 추가됩니다.
- AI 초안은 원문 대조가 필요합니다. 이번에도 분모 오기와 근거 없는 표현을 교정했습니다. 실행 버튼은 사람의 업무 승인을 의미하지 않습니다.

입력은 `examples/weekly-notion-demo/`의 가상 문서 4개입니다. 결과는 `output/weekly-notion/verification.json`, `output/weekly-notion/weekly-report.md`에 보관했습니다. Daylog·Unnestflow 화면과 MCP 조회 결과는 `output/weekly-notion/evidence/`, 실제 로그인된 Notion 웹 화면 12장과 촬영 기록은 `output/weekly-notion/notion-web/`에 있습니다. 자세한 인계는 [WEEKLY_NOTION_HANDOFF.md](./WEEKLY_NOTION_HANDOFF.md)를 참고하세요.

현재는 **이 PC용 시연**으로, 서버와 MCP 커넥터가 `.data/weekly-jobs/`를 함께 사용하고 커넥터 및 OAuth 캐시도 Daylog 폴더에 의존합니다. Flow 주소만 설정한다고 다른 PC나 컨테이너에서 바로 동작하지는 않습니다. 플랫폼 내 OAuth 관리, 사람의 승인 단계, 예약 실행과 자동 동기화는 구현하지 않았습니다.

### 공유용 소스와 다른 환경으로 이전

Git 공유용 어댑터 소스와 설정 예제는 [connectors/](./connectors/README.md), 세 Flow의 생성 템플릿은 [flows/](./flows/README.md)에 있습니다. 공유용 어댑터는 `NOTION_MCP_CONFIG`, `WEEKLY_JOBS_DIR`, `WEEKLY_EVIDENCE_DIR`로 개인 설정과 런타임 저장 경로를 지정할 수 있습니다. 기존 `.data/` 실행본은 자동으로 교체하지 않습니다.

Unnestflow 쪽에 전달할 배포·설정 요청은 [UNNESTFLOW_PLATFORM_MESSAGE.md](./UNNESTFLOW_PLATFORM_MESSAGE.md), 당시 Flow ID·프롬프트·실행 증빙을 포함한 전체 기록은 [상세 인계](./UNNESTFLOW_DAYLOG_NOTION_HANDOFF.md)에 있습니다. Flow JSON만 가져와서는 커넥터 설치, OAuth 인증, 작업 저장소 공유와 publication 설정이 준비되지 않습니다. 기본 Daylog Docker 이미지에는 커넥터를 포함하지 않으며 Unnestflow 측 실행 환경에 따로 배포합니다.

### 컨테이너에서 연결 가능한 주소

기본 Compose는 bridge 네트워크를 사용합니다. 컨테이너 안의 `127.0.0.1`은 Daylog 컨테이너 자신이므로, 다른 서버의 Unnestflow는 컨테이너에서 도달 가능한 주소를 사용합니다.

Docker Desktop에서 호스트 서비스를 연결하려면 `host.docker.internal`을 사용할 수 있습니다. 실제 도달 여부는 호스트 서비스의 바인딩과 방화벽 설정에 따라 달라집니다.

Linux 호스트에서 **loopback에만 열린 기존 Unnestflow**에 연결할 때는 아래처럼 host 네트워크로 실행합니다. `.env`의 MCP 주소는 `http://127.0.0.1:7890/...`처럼 실제 서비스 주소로 설정합니다. 먼저 같은 포트의 Daylog 인스턴스가 실행 중이지 않은지 확인합니다.

```bash
docker build -t daylog:local .
docker run -d --name daylog \
  --network host \
  --env-file .env \
  -e HOST=127.0.0.1 \
  -v daylog-app_report-data:/data \
  daylog:local
```

이 명령은 Compose의 기본 볼륨과 같은 이름을 사용합니다. Linux host 네트워크 실행의 포트는 `PORT` 환경변수로 정하며, `.env`의 `DAYLOG_PORT`는 Compose 전용 설정입니다.

## 보고서와 대화

- UTF-8 `.md` / `.markdown` 업로드, 직접 작성, Markdown 미리보기
- 부서·날짜 필터와 제목·부서 검색
- 왼쪽 목록에서 체크한 보고서의 원문을 가운데 본문에 이어서 표시, 본문에서 삭제
- 선택한 보고서를 Context로 사용하는 오른쪽 AI 검토 대화와 최근 대화 복원
- 답변의 `[R1]` 등 근거를 누르면 본문의 해당 보고서로 이동해 강조
- 좁은 화면(1120px 미만)에서는 목록·본문·AI 검토 탭 전환, 요청 중단·실패 시 재시도

선택한 문서 ID를 서버에서 다시 조회해 원문·부서·날짜·SHA-256과 함께 전달합니다. 최근 대화는 마지막 6개 메시지, 메시지당 최대 6,000자입니다. 문서 선택을 바꾸면 새 대화를 시작합니다. Flow 오류를 임의의 정상 답변으로 저장하지 않습니다.

MCP 전송은 Streamable HTTP이며, `initialize → tools/list → tools/call`을 수행합니다. 호출 인자는 `input_value`와 `session_id`, 결과는 MCP text content입니다. 연결한 도구는 이 입력 계약을 지원해야 합니다.

## 데이터 보관과 운영

| 항목 | 저장 위치 |
| --- | --- |
| SQLite DB | 컨테이너의 `/data/reports.sqlite` |
| Compose 영속 볼륨 | `daylog-app_report-data` |
| 보고서 | 제목·부서·보고 날짜·원래 파일명·Markdown 원문·등록 시각 |
| 대화 | 선택 문서 ID·질문·답변·근거 문서 정보 |
| 연결 설정 | MCP 주소·도구 이름. API 키는 환경변수만 사용 |

보고서를 다시 올리면 새 문서로 등록합니다. 원문 삭제 후에도 기존 답변과 근거 제목·날짜·hash는 남습니다. 문서 버전 관리·자동 보관기간·자동 백업은 제공하지 않습니다.

```bash
docker compose ps
docker compose logs --tail 100 daylog
docker compose restart daylog

# 데이터 볼륨을 보존하며 종료
docker compose down
```

`docker compose down -v`와 볼륨 삭제는 데이터를 지웁니다. 컨테이너 재시작이나 재빌드는 백업이 아닙니다. SQLite가 WAL을 사용하므로 가동 중인 DB 파일 하나만 복사해 백업하지 마세요. DB와 WAL 상태가 일관되도록 SQLite backup 기능을 쓰거나 서비스를 정지한 뒤 볼륨을 보관해야 합니다.

## 로컬 개발과 검증

Node.js **22.13 이상**이 필요합니다. Docker 운영 이미지는 Node 22를 사용합니다.

```bash
npm ci
npm test
npm run build
npm start
```

`npm start`는 `.env`를 읽고 기본 http://127.0.0.1:3090 에서 API와 빌드된 화면을 제공합니다. Docker와 달리 로컬 데이터는 `.data/reports.sqlite`에 저장합니다. 프런트 개발은 API 서버를 실행한 상태에서 별도 터미널의 `npm run dev`를 사용합니다. `npm run up`은 `docker compose up -d --build`의 단축 명령입니다.

GitHub Actions는 서버 테스트, TypeScript 검사, Vite 빌드, **운영 Docker 이미지 빌드와 해당 이미지의 테스트**를 수행합니다. 외부 모델이나 API 키 없이 실행되며, 실제 Unnestflow·모델 응답은 별도의 연동 환경에서 확인해야 합니다. 이미지는 레지스트리에 자동 게시하지 않습니다.

### Unnestflow 없이 MCP 계약 검증

```bash
npm run test:mcp
```

실제 MCP SDK의 Streamable HTTP 서버를 임시 localhost 포트에 띄워 **Daylog HTTP API → MCP 클라이언트 → 모의 MCP 도구 → 대화 저장·재조회**를 검증합니다. `invokeFlow`를 고정 응답 함수로 대체하지 않고 실제 `initialize → tools/list → tools/call`을 전송합니다. 시간 초과 사례만 내부 대기 시간을 줄이며, 모의 서버의 답변은 합성 고정 문구입니다. Unnestflow, 실제 모델, Notion, `.env`, 기존 SQLite DB는 사용하지 않습니다.

검증 항목은 도구 목록 페이지 처리, SSE·JSON 응답, 선택 보고서만 전달, 근거 ID·hash, 대화 재개 시 `session_id` 유지, 보고서 변경 시 새 대화, 서버 전용 API 키, 인증 실패, 도구 미노출·입력 불일치, 실행 오류·빈 응답, 시간 초과·취소, 실패 저장 방지와 재시도입니다. 연결 확인의 `verification: "discovery"`는 도구 목록 확인만 뜻하며 Flow 실행 성공을 보증하지 않습니다.

| 실패 코드 | Daylog 응답 | 확인할 사항 |
| --- | --- | --- |
| `FLOW_AUTH_FAILED` | HTTP 502 | 서버 API 키·실행 권한 |
| `FLOW_TOOL_NOT_FOUND` | HTTP 502 | 도구 이름·프로젝트·게시·공유 상태 |
| `FLOW_INPUT_INCOMPATIBLE` | HTTP 502 | 문자열 `input_value`·`session_id`, 추가 필수 입력 여부 |
| `FLOW_EXECUTION_FAILED` | HTTP 502 | MCP `isError`, 실행 오류·빈 text 응답 |
| `FLOW_TIMEOUT` | HTTP 504 | 응답 대기 시간 초과 |
| `FLOW_CONNECTION_FAILED` | HTTP 502 | 주소·서버·도구 목록 응답 |

브라우저에서 같은 모의 경로를 직접 확인하려면 다음 명령을 실행하고 **http://127.0.0.1:3091** 을 엽니다. Windows PowerShell에서 실행 정책이 `npm.ps1`을 막으면 `npm.cmd`를 사용합니다.

```bash
npm run build
npm run demo:mcp
```

합성 보고서 4개가 있는 별도 메모리 워크스페이스입니다. 질문을 보내면 실제 MCP 통신을 거친 **테스트 응답**이 표시됩니다. 기존 Daylog 설정·DB와 Unnestflow 서버는 변경하지 않으며, Ctrl+C로 종료하면 데모 데이터는 사라집니다. 이 명령은 저장소의 `scripts/`·`test/`를 사용하므로 기본 운영 Docker 이미지에서는 제공하지 않습니다.

이 검증만으로 [Unnestflow #247](https://github.com/unnest-kr/unnestflow/issues/247)을 완료 처리하지 않습니다. Unnestflow 작업 후 실제 프로젝트 주소·도구·인증으로 연결해 **활성 publication·실행 권한·실제 Flow와 모델 답변·HTTPS 인증서**를 확인하고 두 저장소 revision과 실행 증거를 남겨야 합니다. Flow API 또는 Notion MCP 연동 성공은 이 MCP 경로의 검증을 대신하지 않습니다.

## 현재 범위

- 단일 공용 워크스페이스입니다. 사용자 로그인·SSO·부서별 ACL은 없으며 부서 필터는 접근 권한이 아닙니다.
- Compose는 localhost 접속을 기본으로 하며 서버도 localhost Host 헤더를 검사합니다. 외부 공개·도메인 프록시·여러 사용자용 배포는 별도 인증과 배포 설정이 필요합니다.
- 업로드는 한 번에 10개, 문서당 200KB, 요청 전체 2MB까지입니다. 질문은 4,000자, 선택은 30개, 조립한 Context는 UTF-8 120KB까지입니다.
- 선택한 문서 원문을 전달하는 방식입니다. 대규모 검색·임베딩·벡터 DB·PDF·OCR은 포함하지 않습니다.
- Markdown raw HTML은 실행하지 않으며 원격 이미지는 alt 텍스트로 표시합니다.
- 요청 중단이 이미 시작된 외부 모델 계산의 즉시 종료를 보장하지 않습니다.
- 답변 품질·보고서 내 지시문에 대한 방어·실행 기록의 보관은 연결한 Flow와 모델 설정도 함께 검토해야 합니다.

## 구성

| 경로 | 역할 |
| --- | --- |
| `src/` | React 화면 |
| `server/` | HTTP API·SQLite·Context 구성·MCP 클라이언트 |
| `test/` | 서버와 MCP 결과 처리 테스트 |
| `examples/` | 합성 샘플 보고서 |
| `Dockerfile` | 프런트 빌드와 Node API를 담은 단일 이미지 |
| `compose.yaml` | Daylog 한 개 서비스와 전용 데이터 볼륨 |
| `.github/workflows/ci.yml` | 테스트와 Docker 빌드 검증 |

이 저장소에는 Unnestflow 제품 소스·서버 이미지·모델 가중치·실제 업로드 문서·DB·API 키를 포함하지 않습니다. 화면 예시는 샘플 보고서로 생성했으며, 스크린샷 속 AI 답변은 실제 Flow 응답이 아닌 화면 설명용 예시 문구입니다.
