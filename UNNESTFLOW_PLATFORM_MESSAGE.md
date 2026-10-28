# Unnestflow 전달 — Daylog 연동 구성과 플랫폼 확인 요청

작성일: 2026-10-27 KST. 실제 Notion 연동 증빙은 2026-10-26 실행 기록이며, 이번 작업은 Git 공유용 소스·템플릿·문서를 정리한 것이다. 이 문서를 작성하면서 Unnestflow 설정을 변경하거나 실제 Notion에 게시하지 않았다.

## #247 Daylog 측 선행 검증 — 2026-10-28

[Unnestflow #247](https://github.com/unnest-kr/unnestflow/issues/247)의 Daylog → Unnestflow MCP 호출 계약을 플랫폼 개발과 별도로 검증할 수 있도록 `npm run test:mcp`와 `npm run demo:mcp`를 추가했다. 상세 실행 방법은 [README의 MCP 계약 검증](./README.md#unnestflow-없이-mcp-계약-검증)을 참고한다.

- 실제 MCP SDK 모의 서버로 initialize·도구 목록·도구 호출, 선택 보고서와 대화 연결, 실패 저장 방지·재시도를 검증한다. API 키는 합성 값이며 서버에서만 사용한다.
- Daylog에서 인증·도구 미노출·입력 불일치·실행 실패·시간 초과를 구분한다. 연결 확인은 도구 목록 조회까지이며 실제 실행 성공으로 표시하지 않는다.
- 공유되는 앱의 Notion 경로는 Daylog → Unnestflow Flow → 전용 커넥터·OAuth 브리지 → Notion 공식 MCP다. Daylog 연결 설정에 Notion URL을 직접 입력하는 기능은 이번 변경에 포함되지 않는다. 기존 브리지·어댑터 소스는 `connectors/`에서 재사용할 수 있다.
- 모의 응답은 고정된 테스트 문구다. 이 단계에서 Unnestflow 소스·서버·게시 설정이나 실제 모델·Notion을 호출 또는 변경하지 않는다.
- 플랫폼 작업이 끝나면 실제 프로젝트 MCP 주소와 게시 Flow로 다시 실행해야 한다. 활성 publication·권한·실제 모델 실행·HTTPS 및 두 저장소 revision의 증거를 확인하기 전까지 #247의 전체 완료는 보류한다.

## 1. 전달할 핵심

**Unnestflow 제품 소스를 수정해서 연동한 것이 아니다.** 기존 Chat Input, Language Model, Agent, MCP Tools, Chat Output과 Flow API를 사용해 세 Flow와 두 MCP 연결을 등록했다. 등록할 때는 Builder로 잠시 전환한 뒤 Runtime으로 복원했고, 실제 실행은 Runtime에서 확인했다.

**Daylog 쪽에는 검토·Notion 게시 기능과 전용 MCP 어댑터를 추가했다.** 어댑터는 원래 Daylog `.data/`에만 있었고, 이제 공유 가능한 실행 소스를 `connectors/`에 포함했다. Unnestflow의 기존 외부 MCP 실행 기능이 이 프로그램을 별도 Node 프로세스로 실행하는 구조다.

따라서 다른 설치 환경으로 옮길 때 우선 필요한 것은 Daylog 기능·어댑터의 배포, 실행 경로 등록, OAuth 인증, 작업 저장소 공유다. 같은 업무를 재현하기 위해 Unnestflow 코어에 전용 어댑터 코드를 반드시 넣어야 하는 것은 아니다.

## 2. 저장소에서 받을 것

- 저장소: `unnest-kr/daylog`
- 작업 브랜치: `ui/mockup-redesign`
- Daylog 기능: `server/flow-api.mjs`, `server/weekly.mjs`, `server/index.mjs`, `src/`
- 전용 어댑터: [connectors/](./connectors/README.md)
- Flow 템플릿: [flows/](./flows/README.md)
- 전체 과거 구성·ID·증빙: [UNNESTFLOW_DAYLOG_NOTION_HANDOFF.md](./UNNESTFLOW_DAYLOG_NOTION_HANDOFF.md)
- 내부 보고용 최종 자료: [PDF](./output/pdf/Daylog_Unnestflow_Integration_Evidence.pdf), [주간보고 검증 JSON](./output/weekly-notion/verification.json)

실제 `.env`, API 키, OAuth 인증 캐시, SQLite DB, 로컬 게시 작업·영수증은 Git 공유 대상이 아니다. 필요한 인증과 저장소는 실행 환경에서 따로 준비한다.

## 3. 연결 구조와 실행 주체

```text
Daylog 브라우저
  → Daylog 서버: 원문·대화·게시 작업 저장
      → HTTP Flow API → Unnestflow의 검토/게시 Flow
                            → MCP Tools가 로컬 MCP 어댑터를 실행
                                 → mcp-remote: OAuth·원격 통신
                                      → Notion 공식 MCP: 문서 읽기·쓰기
```

| 대상 | 역할과 설정 위치 |
| --- | --- |
| Daylog | Unnestflow 실행 주소·API 키·게시 작업 위치 설정 |
| Unnestflow | Flow 등록·모델 자격 증명·publication·MCP 서버 명령/환경 설정 |
| 어댑터 실행 호스트 | Daylog 코드 및 SDK·브리지 설치, 인증 캐시와 작업 경로 준비 |
| 공유 작업 저장소 | Daylog가 쓴 작업 JSON을 게시 어댑터가 읽고, 영수증을 Daylog가 읽음 |

어댑터 파일은 Daylog 저장소에 있지만 실행 주체는 Unnestflow다. 다른 PC의 Daylog 경로를 JSON에 넣는 것만으로 원격 실행되지 않는다. Unnestflow가 실행할 수 있는 호스트·컨테이너에 코드를 배포해야 한다.

## 4. 만든 Flow 세 개

| 이름 | 노드 구성 | 과거 Flow ID |
| --- | --- | --- |
| Daylog 사업 보고서 검토 | Chat Input → Language Model → Chat Output | `61b91688-c559-496a-b5d5-ec990055a414` |
| Notion 주차별 보고 조회 | Chat Input → Agent → Chat Output, MCP Tools → Agent Tools | `05ffe86e-9a6d-4fe4-8d04-9fe82743cd0a` |
| Daylog 주간보고 Notion 게시 | 위 Agent 구성에 게시용 MCP 도구 연결 | `1c48f49f-d846-4a57-8815-98c1f990172e` |

검토 Flow에는 Agent와 MCP Tools가 없다. Daylog가 전달한 보고서만 분석한다. 조회·게시 Flow가 외부 MCP를 사용한다. 다른 설치에 생성하면 새 Flow ID와 실행 주소로 Daylog 설정을 바꿔야 한다.

## 5. 두 어댑터가 추가한 업무 기능

### 조회용: `connectors/notion-readonly-server.mjs`

- 플랫폼 MCP 연결 이름: `notion-report-readonly`
- Agent에 `notion-fetch` 하나만 노출
- 요청 ID가 지정된 보고 영역 8개 ID에 속하는지 검사
- 허용 요청만 Notion 공식 MCP로 전달

### 게시용: `connectors/notion-weekly-server.mjs`

- 플랫폼 MCP 연결 이름: `daylog-weekly-append-only`
- Agent에 `publish_weekly_report(job_id)` 하나만 노출
- ID로 Daylog가 저장한 본문·대상·근거를 읽고 로컬 무결성 검사
- 지정 페이지에 쓰고, 같은 결과 중복을 피하며 같은 대화의 수정본은 관리 영역만 갱신
- 원격 저장본을 재조회해 작업 표시·원문 ID·기존 하위 링크 보존 확인
- 작업과 일치하는 영수증을 남겨 Daylog가 성공을 확인

이 어댑터가 Notion 로그인이나 일반 Notion API 전체를 새로 구현한 것은 아니다. 인증은 브리지가, 실제 기능은 공식 MCP가 제공한다. 또한 외부 서비스마다 전용 어댑터를 만들어야 한다는 뜻도 아니다. 이 두 개는 Daylog 업무 규칙을 위한 프로그램이다.

영수증은 원격 본문 전체의 해시 일치 보증이 아니다. 같은 작업의 기존 영수증을 Daylog가 재사용하면 원격 페이지를 매번 새로 조회하지 않는다. 사람의 업무 승인 단계도 별도로 구현하지 않았다.

## 6. 우선 진행할 배포·설정 작업

1. 저장소의 작업 브랜치를 받고 `npm ci`로 의존성을 준비한다.
2. Unnestflow가 실행되는 호스트에 커넥터 코드와 `mcp-remote` 브리지를 준비한다.
3. [브리지 설정 예제](./connectors/notion-mcp-config.example.json)를 개인 설정 파일로 복사하고 실제 실행 경로·OAuth 캐시 경로를 지정한다. 해당 환경에서 사용자 OAuth 승인을 완료한다.
4. Daylog와 게시 커넥터가 같은 작업 저장소를 보도록 `WEEKLY_JOBS_DIR`를 맞춘다. 이 위치에는 작업과 영수증을 함께 보존한다.
5. Unnestflow에 두 MCP 연결을 등록한다. `command: node`, `args`에는 실제 `connectors/notion-*-server.mjs` 경로를 사용하고 필요한 환경변수를 전달한다.
6. [Flow 템플릿](./flows/README.md)의 경로·대상·연결 설정을 맞춰 세 Flow를 만든 뒤 모델 자격 증명·권한·publication을 설정한다.
7. Daylog에 새 검토 Flow 실행 주소와 API 키, 별도 게시 Flow 주소를 설정한다.
8. 검토 → 조회 → 게시 → 저장본 확인 → 같은 결과 재시도 → 수정본 갱신 순으로 확인한다.

공유용 커넥터는 `NOTION_MCP_CONFIG`, `WEEKLY_JOBS_DIR`, `WEEKLY_EVIDENCE_DIR`를 지원한다. 기존 `.data/` 실행 소스는 상대 경로를 고정 참조하므로 혼용하지 말고, 전환 시 MCP 연결의 실행 경로를 명시적으로 바꿔야 한다.

기본 Daylog Docker 이미지에는 커넥터를 포함하지 않았다. Unnestflow 측 별도 프로세스로 배포하며, 분리된 컨테이너·호스트에서는 공유 저장소 구성이 필요하다. 현재 시연 대상 Notion ID는 코드·프롬프트에 남아 있으므로 다른 페이지에 쓰려면 먼저 대상 정책을 조정해야 한다.

## 7. 플랫폼 제품 개선으로 따로 검토할 사항

다음은 어댑터를 코어에 복사하는 작업과 다른 제품 과제다. 2026-10-26 기록에서 확인한 현상이므로 현재 코드와 다시 대조해야 한다.

| 항목 | 확인했던 현상 | 플랫폼 측 확인 요청 |
| --- | --- | --- |
| Runtime 연결 관리 | 관리자도 MCP 관리 API에서 HTTP 423 | 전역 Builder 전환 없이 권한 있는 운영 연결 관리가 가능한지 확인 |
| OAuth | 플랫폼 밖 `mcp-remote`와 로컬 캐시가 처리 | 플랫폼 내 인증·갱신·재인증·해제를 지원할지 결정 |
| Unnestflow 자체 MCP 실행 | initialize/list 성공, call은 `execution_context` 오류 | REST와 동일한 publication·권한·실행 문맥으로 실제 도구 실행 검증 |
| MCP 실패 표시 | 실행 실패인데 HTTP 200 및 `isError: false` | 도구 실패가 성공으로 표시되지 않도록 처리 |
| Windows 실행 경로 | 공백 포함 node.exe 경로 등록 실패 | 실행 파일·인자 검증과 공백 경로 처리 확인 |

Unnestflow가 외부 Notion MCP를 호출한 성공과 Unnestflow 자체 MCP 서버의 실행 오류는 방향이 다른 문제다. Flow API 시연 성공을 자체 MCP 오류 해결로 보고하지 않는다.

## 8. 이번 Git 정리에서 확인한 범위

- Daylog 서버·Flow API·게시 영수증 처리와 커넥터 STDIO 프로세스 검증을 포함한 자동 테스트 26개 통과
- TypeScript 검사 및 Vite 프로덕션 빌드 통과
- 커넥터 테스트는 모의 MCP 서버를 사용했으며 실제 Notion을 변경하지 않음
- 기존 운영 중 어댑터·OAuth 캐시·Flow 설정을 자동 이전하지 않음
- Unnestflow 플랫폼 소스 수정 및 실제 신규 배포를 수행한 상태가 아님

## 9. 담당자에게 전달할 실행 요청

```text
Unnestflow 저장소의 AGENTS.md와 Daylog 저장소의
UNNESTFLOW_PLATFORM_MESSAGE.md를 먼저 읽어 주세요.

Daylog 연동은 기존 플랫폼 노드와 Flow API/MCP 기능으로 구성했습니다.
Daylog 전용 어댑터 공유 소스는 connectors/에, 세 Flow 템플릿은 flows/에 있습니다.
현재 목표는 코어에 같은 어댑터를 중복 구현하는 것이 아니라,
실행 호스트에 이 코드를 배포하고 MCP 연결·Notion OAuth·공유 작업 저장소를
맞춰서 기존 업무 흐름을 재현하는 것입니다.

현재 설치의 코드·모드·연결 상태를 확인한 뒤 필요한 배포·설정을 진행해 주세요.
조회와 게시의 제한을 유지하고, 기존 동작 중 연결을 보존해 주세요.
Runtime 연결 관리, 플랫폼 OAuth와 자체 MCP execution_context 오류는
별도 제품 개선 항목으로 구분해서 현재 재현 여부와 해결 범위를 알려 주세요.

완료 시 실행 호스트, 커넥터 경로, Flow ID·실행 주소, 인증 방식,
공유 작업 저장소, 실제 도구 호출·저장본 확인 결과와 남은 제약을 기록해 주세요.
비밀키·토큰·OAuth 캐시를 Git이나 결과 문서에 포함하지 마세요.
```
