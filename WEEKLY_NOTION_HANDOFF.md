# Daylog 주간보고 Notion 게시 인계

검증일: 2026-10-26 KST. 기존 플랫폼 개선 과제는 [UNNESTFLOW_FIX_PROMPT.md](./UNNESTFLOW_FIX_PROMPT.md), 이전 연결 배경은 [UNNESTFLOW_HANDOFF.md](./UNNESTFLOW_HANDOFF.md)를 함께 확인한다.

## 완료한 실제 흐름

Daylog http://127.0.0.1:3090 에서 Markdown 문서 4개를 실제 업로드하고, 기존 Unnestflow 검토 Flow로 전달했다. 부서별 활동과 사업별 단계·진행 수치·리스크·다음 조치를 받은 뒤 별도 게시 Flow의 Agent가 MCP 도구를 호출하여 지정한 Notion 페이지에 저장했다. 원격 저장본을 다시 읽어 성공을 확인했다.

첫 검토는 약 10.5초, 검토 요청부터 첫 Notion 저장 확인까지 약 20.1초였다. 교정과 후속 검증 시간은 제외한 한 번의 측정이며 성능 보장 수치가 아니다. 초안의 분자/분모 오기와 근거 없는 표현을 Codex가 원문 대조 후 후속 대화로 교정했다. 사람이 검토·승인한 결과라고 보고하지 않는다.

최종 Notion 보고 영역은 1개, 표는 2개, 원문 ID는 4개다. 초기 초안은 최종본으로 정리했고 동일 결과 재실행은 사본을 추가하지 않았다. 기존 팀별 페이지와 DB 링크 7개를 유지했다.

```text
문서 업로드 → 기존 Unnestflow 검토 Flow API → 대화와 원문 근거 저장
  → Daylog 서버가 게시 작업 저장 → 별도 Unnestflow 게시 Flow API
  → Agent의 publish_weekly_report(job_id) → 페이지 전용 MCP 커넥터
  → Notion notion-update-page → notion-fetch로 저장 확인
  → 검증 영수증과 Notion 링크를 Daylog에 반환
```

## 리소스와 사용 방법

| 항목 | 값 |
| --- | --- |
| 플랫폼과 모드 | https://127.0.0.1:7860 / 검증 당시 Runtime |
| 기존 검토 Flow | `61b91688-c559-496a-b5d5-ec990055a414` |
| 새 게시 Flow | `1c48f49f-d846-4a57-8815-98c1f990172e` |
| 게시 Flow 이름 | Daylog 주간보고 Notion 게시 |
| 게시 Flow 화면 | https://127.0.0.1:7860/playground/1c48f49f-d846-4a57-8815-98c1f990172e/ |
| MCP 서버 이름 | `daylog-weekly-append-only` |
| 대상 페이지 | https://app.notion.com/p/4054587c9925805da1bfeb84deae06ab |
| 시연 대화 | `c0b258d6-80b1-4710-97c6-2a57b92e5ca6` |

기존 `notion-report-readonly` 연결과 게시 연결은 별도다. 조회 전용 연결의 허용 범위를 변경하지 않았다. OAuth 승인은 기존 로컬 브리지의 인증을 재사용하며 ChatGPT Notion 플러그인 설치를 뜻하지 않는다. 서버 이름에는 append-only가 남아 있지만 최종 구현은 같은 대화로 자신이 만든 보고 영역의 수정본 갱신도 지원한다.

1. 문서를 올리고 대상 문서만 선택한다. 시연 문서 날짜는 **2026-10-23**, 보고 기간은 **2026-10-19~10-25**다.
2. **Notion 주간보고**로 검토부터 게시까지 실행한다.
3. 수정이 필요하면 같은 대화에서 원문을 대조해 전체 주간보고 수정본을 요청한다. **이 검토 결과 게시**로 최신 답변을 게시한다.
4. 같은 답변은 검증 영수증을 재사용한다. 같은 대화의 새 답변은 같은 생성 영역을 갱신한다. 다른 대화는 다른 보고 영역을 추가하므로 주차별 버전 정책은 추가 설계가 필요하다.

현재 버튼에는 별도 사람 승인 단계가 없다. 운영 도입 시 검토 초안과 확정 게시를 구분할 절차가 필요하다.

## 변경 파일과 폴더 의존성

- `server/weekly.mjs`: 저장된 검토와 근거로 작업 생성, 내용 해시, 게시 Flow 호출, 일치하는 검증 영수증 요구.
- `server/index.mjs`: `POST /api/notion/weekly`. 클라이언트는 대화 ID만 전달하며 본문·대상·Flow 주소는 정하지 못한다.
- `src/App.tsx`, `src/styles.css`: 주간보고 실행, 최근 검토 결과 게시, 저장 확인 및 Notion 링크.
- `test/weekly.test.mjs`: 성공 문장만으로 성공 처리하지 않기, 작업·대상·해시 일치, 중복 방지, Notion 표 행 정규화.
- `.env`: 서버 전용 `NOTION_WEEKLY_FLOW_URL` 추가. 기존 검토 연결을 유지한다. 비밀값은 문서·채팅·Git에 복사하지 않는다.
- `.data/notion-weekly-server.mjs`: 페이지 전용 MCP 어댑터. 작업 ID만 받아 저장된 본문을 전송한다. Markdown 규격을 읽은 뒤 쓰고, 자신이 만든 같은 대화의 영역만 교체하며 저장본을 재조회한다.
- `.data/weekly-jobs/`: 작업 및 검증 영수증. `.data/weekly-evidence/`: 실제 원격 저장본.
- `.data/notion-mcp-config.json`, `.data/notion-mcp-auth/`, `.data/notion-mcp-bridge/`: 기존 브리지 설정·인증 캐시·실행 의존성. 인증 내용을 출력하거나 공유하지 않는다.

등록된 커넥터 경로는 `C:/Users/SIL/Desktop/sil_lab/daylog/.data/notion-weekly-server.mjs`다. **Daylog 폴더를 이동하거나 삭제하면 현재 연결이 깨진다.** 플랫폼 폴더로 이전할 때 커넥터, 작업 저장소 및 OAuth 보관 위치를 함께 이전해야 한다. 서버와 커넥터가 같은 `.data/weekly-jobs/`를 보는 현재 구성을 전제로 한다.

플랫폼은 MCP 자식 프로세스를 유지할 수 있으므로 어댑터 파일 수정이 즉시 반영되지는 않는다. 이번에는 주간보고 전용 커넥터 프로세스만 새로 연결했다. 플랫폼은 재시작하지 않았다.

## 증빙 파일

| 경로 | 내용 |
| --- | --- |
| `output/weekly-notion/verification.json` | 최종 판정, 모드, 중복 검사, 표 수, 원문 수, 실제 Agent 도구 실행 |
| `output/weekly-notion/weekly-report.md` | 최종 게시용 주간보고와 원문 ID 및 해시 |
| `output/weekly-notion/evidence/01-document-upload.png` | 실제 업로드 UI |
| `output/weekly-notion/evidence/06-corrected-weekly-published.png` | 실제 최종 Daylog 화면 |
| `output/weekly-notion/evidence/07-corrected-review-detail.png` | 실제 교정된 AI 검토 패널 |
| `output/weekly-notion/evidence/08-unnestflow-runtime.png` | 실제 게시 Flow의 저장된 실행 세션 |
| `output/weekly-notion/evidence/09-notion-saved-overview.png` | Notion MCP 저장본의 조회 결과 시각화 |
| `output/weekly-notion/evidence/10-notion-business-status.png` | 저장본의 사업별 현황과 검수 내용 시각화 |
| `output/weekly-notion/notion-web/` | 로그인된 실제 Notion 웹 화면 12장 |
| `output/weekly-notion/notion-web/capture-manifest.json` | 실제 촬영 URL·시각·화면 크기·파일 SHA-256 |
| `output/weekly-notion/evidence/notion-saved-view.html` | 저장본을 표시한 증빙 조회 화면 |
| `.data/weekly-platform-run-response.json` | 실제 Flow의 Agent Steps 및 도구 사용 |
| `.data/weekly-ui-verification.json` | 최초 실제 UI 실행과 업로드·시간 기록 |
| `.data/weekly-corrected-review.json` | 교정 후 전체 대화와 근거 |

`evidence/09`, `10`, `11`은 MCP 저장본을 렌더링한 이전 조회 증빙이다. 추가로 **2026-10-26 18:21~18:24 KST에 실제 로그인된 Notion 웹 화면 12장을 촬영**했다. 실제 웹 사진은 `notion-web/`에 있으며, 전체 화면과 부서·사업 표 및 원문 근거 확대 화면을 포함한다. 사용자가 캡처 전용 브라우저에 직접 로그인했고 촬영은 읽기·스크롤·캡처만 수행했다. 기존 브라우저 인증 저장소나 인증 상태를 내보내지 않았다.

최신 PDF는 `explain-process` 형식의 15쪽 보고서다. 문서 등록부터 검토·원문 대조·게시·저장 확인·재시도까지 번호 단계로 설명하고 실제 Notion 웹 사진 12장을 6쪽에 배치했다. 기존 MCP 조회 시각화와 실제 웹 사진을 혼동하지 않도록 경로와 설명을 구분했다. 허브의 기존 제출 현황 DB와 Daylog가 게시한 주간보고 본문은 별도 영역이다.

## 남은 과제

플랫폼 소스 패치와 플랫폼 재시작은 수행하지 않았다. 등록 과정에서 Builder로 일시 전환한 뒤 Runtime으로 복원했으며 실제 실행은 Runtime에서 성공했다.

Daylog → Unnestflow는 **Flow API**, Unnestflow → Notion이 **MCP**다. 기존 플랫폼 자체 MCP의 `execution_context` 오류가 해결됐다고 보고하면 안 된다. Runtime 연결 관리 제약과 플랫폼 내 OAuth 수명 주기 관리도 별도 과제로 남아 있다.

현재는 단일 PC의 수동 실행 시연이다. 자동 예약·가져오기, 부서별 권한, 사람 승인, 다른 호스트·컨테이너 배포와 다중 사용자 부하는 검증하지 않았다. 사업 진행률은 가상 원문 기준으로 현재 구현의 개발 완료율이 아니다.

기존 기능과 신규 게시 로직의 테스트 22개 및 TypeScript/Vite 빌드를 통과했다. PDF 개정은 저장된 증빙을 사용했으며 서비스 동작이나 테스트를 재실행하지 않았다. 이전 보고서의 사업 5개 검토와 자체 MCP 오류는 새 보고서의 제약 설명과 부록으로 재구성했다.
