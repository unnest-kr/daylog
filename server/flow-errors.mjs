import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";

const failures = {
	FLOW_AUTH_FAILED: ["Flow authentication failed", "Unnestflow 인증 또는 실행 권한을 확인해 주세요. 서버 API 키와 Flow 공유 권한을 확인한 뒤 다시 시도해 주세요."],
	FLOW_TOOL_NOT_FOUND: ["Configured Flow tool not found", "설정한 MCP 도구가 목록에 없습니다. 도구 이름, 프로젝트, Flow 게시·공유 상태를 확인해 주세요."],
	FLOW_INPUT_INCOMPATIBLE: ["Configured Flow has incompatible inputs", "선택한 MCP 도구가 보고서 입력을 지원하지 않습니다. input_value와 session_id를 문자열로 받는 Flow를 선택해 주세요."],
	FLOW_EXECUTION_FAILED: ["Flow execution failed", "Flow 실행에 실패했거나 답변이 비어 있습니다. Unnestflow 실행 기록을 확인한 뒤 다시 시도해 주세요."],
	FLOW_TIMEOUT: ["Flow request timed out", "Unnestflow 응답 대기 시간이 초과되었습니다. 실행 기록을 확인한 뒤 다시 시도해 주세요."],
	FLOW_CONNECTION_FAILED: ["Flow connection failed", "Unnestflow에 연결하지 못했습니다. 연결 주소와 서버 상태를 확인해 주세요."],
};

export class FlowError extends Error {
	constructor(code) {
		super(failures[code][0]);
		this.code = code;
		this.publicMessage = failures[code][1];
		this.status = code === "FLOW_TIMEOUT" ? 504 : 502;
	}
}

// Only fixed messages cross the browser boundary; upstream messages can contain credentials.
export function flowFailure(error, fallback = "FLOW_CONNECTION_FAILED") {
	if (error instanceof FlowError) return error;
	if (error instanceof UnauthorizedError || [401, 403].includes(error?.code))
		return new FlowError("FLOW_AUTH_FAILED");
	if (
		error?.code === ErrorCode.RequestTimeout ||
		error?.name === "TimeoutError" || error?.cause?.name === "TimeoutError"
	)
		return new FlowError("FLOW_TIMEOUT");
	return new FlowError(fallback);
}
