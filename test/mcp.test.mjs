import { test } from "node:test";
import assert from "node:assert/strict";
import { readFlowAnswer } from "../server/mcp.mjs";

test("message/result duplicates with different blank lines appear only once", () => {
	const answer = readFlowAnswer({
		content: [
			{ type: "text", text: "## 개선 결과\n\n- 310ms [R1]\n\n- 승인 예정" },
			{ type: "text", text: "## 개선 결과\n- 310ms [R1]\n- 승인 예정" },
			{ type: "text", text: "별도의 유효한 추가 출력" },
		],
	});
	assert.equal((answer.match(/310ms/g) ?? []).length, 1);
	assert.ok(answer.includes("별도의 유효한 추가 출력"));
});

test("upstream error text is never displayed as a successful assistant answer", () => {
	for (const result of [
		{ content: [], isError: false },
		{
			content: [
				{
					type: "text",
					text: "Error Executing the Daily Report Assistant tool. Error: failure",
				},
			],
			isError: false,
		},
		{
			content: [{ type: "text", text: "Flow build blocked: component policy" }],
			isError: false,
		},
		{ content: [{ type: "text", text: "An upstream error" }], isError: true },
	])
		assert.throws(() => readFlowAnswer(result), /Flow execution failed/);
});
