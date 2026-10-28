import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { createApp } from "../server/index.mjs";
import { callFlow } from "../server/mcp.mjs";
import { startFlowMcp, flowTool, textResult } from "./fixtures/flow-mcp.mjs";

const report = (markdown) => ({
	title: markdown, department: "개발팀", report_date: "2026-10-28", filename: "synthetic.md", markdown,
});

async function startDaylog(t, provider, { apiKey = provider.settings.apiKey, timeouts } = {}) {
	const app = createApp({
		database: ":memory:",
		env: { MCP_URL: provider.settings.mcpUrl, MCP_TOOL: provider.settings.toolName, UNNESTFLOW_API_KEY: apiKey },
		...(timeouts ? { invokeFlow: (settings, input, id, signal) => callFlow(settings, input, id, signal, timeouts) } : {}),
	});
	app.server.listen(0, "127.0.0.1");
	await once(app.server, "listening");
	t.after(() => new Promise((resolve) => app.server.close(resolve)));
	const base = `http://127.0.0.1:${app.server.address().port}`;
	const request = async (path, body) => {
		const response = await fetch(base + path, {
			...(body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
		});
		return { status: response.status, data: await response.json() };
	};
	const uploaded = await request("/api/reports", { reports: [report("SELECTED-SYNTHETIC-310ms"), report("OTHER-SYNTHETIC-REPORT")] });
	return { ...app, request, ids: uploaded.data.ids };
}

test("MCP wire contract: paginated discovery, selected context, resumed conversation and changed reports", async (t) => {
	const provider = await startFlowMcp(t);
	provider.state.list = (params) => params?.cursor === "second-page"
		? { tools: [flowTool] }
		: { tools: [], nextCursor: "second-page" };
	const app = await startDaylog(t, provider);
	const status = await app.request("/api/status");
	assert.equal(status.data.connected, true);
	assert.equal(status.data.verification, "discovery");
	assert.equal(provider.state.calls.length, 0, "discovery must not be reported as successful Flow execution");
	const first = await app.request("/api/chat", { reportIds: [app.ids[0]], question: "첫 합성 질문" });
	assert.equal(first.status, 200);
	const id = first.data.conversation.id;
	const firstArgs = provider.state.calls[0].arguments;
	assert.deepEqual(Object.keys(firstArgs).sort(), ["input_value", "session_id"]);
	assert.equal(firstArgs.session_id, id);
	assert.ok(firstArgs.input_value.includes("SELECTED-SYNTHETIC-310ms"));
	assert.ok(!firstArgs.input_value.includes("OTHER-SYNTHETIC-REPORT"));
	const context = JSON.parse(firstArgs.input_value.slice(firstArgs.input_value.indexOf("{")));
	assert.equal(context.question, "첫 합성 질문");
	assert.equal(context.reports[0].id, app.ids[0]);
	assert.match(context.reports[0].sha256, /^[a-f0-9]{64}$/);
	assert.equal(first.data.conversation.messages[1].content, provider.state.reply().content[0].text);
	assert.equal(first.data.conversation.messages[1].sources[0].id, app.ids[0]);
	const restored = await app.request(`/api/conversations/${id}`);
	assert.deepEqual(restored.data.messages, first.data.conversation.messages);
	const resumed = await app.request("/api/chat", { reportIds: [app.ids[0]], conversationId: id, question: "이어지는 합성 질문" });
	assert.equal(resumed.status, 200);
	assert.equal(provider.state.calls[1].arguments.session_id, id);
	assert.ok(provider.state.calls[1].arguments.input_value.includes("첫 합성 질문"));
	assert.equal(resumed.data.conversation.messages.length, 4);
	const changed = await app.request("/api/chat", { reportIds: [app.ids[1]], conversationId: id, question: "잘못된 보고서 변경" });
	assert.equal(changed.status, 409);
	assert.equal(provider.state.calls.length, 2);
	const separate = await app.request("/api/chat", { reportIds: [app.ids[1]], question: "다른 보고서의 합성 질문" });
	assert.equal(separate.status, 200);
	assert.notEqual(separate.data.conversation.id, id);
	assert.ok(!provider.state.calls[2].arguments.input_value.includes("SELECTED-SYNTHETIC-310ms"));
	for (const item of [status, first, restored, resumed, separate, await app.request("/api/bootstrap")])
		assert.ok(!JSON.stringify(item).includes(provider.settings.apiKey));
	const methods = provider.state.requests.map((item) => item.body?.method);
	assert.deepEqual(methods.slice(0, 4), ["initialize", "notifications/initialized", "tools/list", "tools/list"]);
	assert.ok(methods.indexOf("tools/call") > methods.indexOf("tools/list"));
	assert.ok(provider.state.requests.some((item) => item.method === "DELETE"));
	for (const request of provider.state.requests) {
		assert.equal(request.url, new URL(provider.settings.mcpUrl).pathname);
		assert.equal(request.headers["x-api-key"], provider.settings.apiKey);
		if (request.body?.method === "tools/call") assert.ok(request.headers["mcp-session-id"]);
	}
});

test("MCP wire contract also accepts application/json tool responses", async (t) => {
	const provider = await startFlowMcp(t, { enableJsonResponse: true });
	assert.match(await callFlow(provider.settings, "합성 질문", "json-conversation"), /합성 MCP 테스트 응답/);
	assert.equal(provider.state.calls[0].arguments.session_id, "json-conversation");
});

test("MCP authentication failures are distinct, private and never saved as answers", async (t) => {
	for (const authStatus of [401, 403]) await t.test(`upstream HTTP ${authStatus}`, async (t) => {
		const provider = await startFlowMcp(t);
		provider.state.authStatus = authStatus;
		const app = await startDaylog(t, provider, { apiKey: "synthetic-wrong-key" });
		for (const response of [
			await app.request("/api/status"),
			await app.request("/api/chat", { reportIds: [app.ids[0]], question: "실패할 합성 질문" }),
		]) {
			assert.equal(response.status, 502);
			assert.equal(response.data.code, "FLOW_AUTH_FAILED");
			assert.ok(!JSON.stringify(response.data).includes("synthetic-private-upstream-auth-detail"));
			assert.ok(!JSON.stringify(response.data).includes("synthetic-wrong-key"));
		}
		assert.equal(provider.state.calls.length, 0);
		assert.equal((await app.request("/api/bootstrap")).data.conversations.length, 0);
	});
});

test("MCP unexposed or incompatible tools fail before tools/call", async (t) => {
	for (const [name, tools, code] of [
		["unexposed", [], "FLOW_TOOL_NOT_FOUND"],
		["missing Chat Input", [{ ...flowTool, inputSchema: { type: "object", properties: {} } }], "FLOW_INPUT_INCOMPATIBLE"],
		["no session input", [{ ...flowTool, inputSchema: { type: "object", properties: { input_value: { type: "string" } }, additionalProperties: false } }], "FLOW_INPUT_INCOMPATIBLE"],
		["extra required input", [{ ...flowTool, inputSchema: { ...flowTool.inputSchema, required: ["input_value", "other"] } }], "FLOW_INPUT_INCOMPATIBLE"],
	]) await t.test(name, async (t) => {
		const provider = await startFlowMcp(t);
		provider.state.tools = tools;
		const app = await startDaylog(t, provider);
		assert.equal((await app.request("/api/status")).data.connected, false);
		const result = await app.request("/api/chat", { reportIds: [app.ids[0]], question: "합성 질문" });
		assert.equal(result.status, 502);
		assert.equal(result.data.code, code);
		assert.equal(provider.state.calls.length, 0);
		assert.equal((await app.request("/api/bootstrap")).data.conversations.length, 0);
	});
});

test("MCP execution failures preserve the saved conversation and allow retry with the same context", async (t) => {
	const provider = await startFlowMcp(t);
	const app = await startDaylog(t, provider);
	const first = await app.request("/api/chat", { reportIds: [app.ids[0]], question: "성공한 합성 질문" });
	const id = first.data.conversation.id;
	for (const result of [
		{ ...textResult("synthetic-private-model-error"), isError: true },
		textResult("Error Executing the review tool. Error: synthetic-private-model-error"),
		textResult("Error executing tool: synthetic-private-model-error"),
		textResult("Flow build blocked: synthetic-private-model-error"),
		textResult("   "),
		{ content: [{ type: "image", data: "AA==", mimeType: "image/png" }] },
	]) {
		provider.state.reply = () => result;
		const failed = await app.request("/api/chat", { reportIds: [app.ids[0]], conversationId: id, question: "저장되면 안 되는 합성 질문" });
		assert.equal(failed.status, 502);
		assert.equal(failed.data.code, "FLOW_EXECUTION_FAILED");
		assert.ok(!JSON.stringify(failed.data).includes("synthetic-private-model-error"));
		assert.deepEqual((await app.request(`/api/conversations/${id}`)).data.messages, first.data.conversation.messages);
	}
	provider.state.reply = () => textResult("재시도한 합성 응답 [R1]");
	const retried = await app.request("/api/chat", { reportIds: [app.ids[0]], conversationId: id, question: "재시도 질문" });
	assert.equal(retried.status, 200);
	assert.equal(retried.data.conversation.messages.length, 4);
	const last = provider.state.calls.at(-1).arguments;
	assert.equal(last.session_id, id);
	assert.ok(last.input_value.includes("성공한 합성 질문"));
	assert.ok(!last.input_value.includes("저장되면 안 되는 합성 질문"));
});

test("MCP discovery and execution timeouts are distinguished from successful answers", async (t) => {
	for (const phase of ["discovery", "execution"]) await t.test(phase, async (t) => {
		const provider = await startFlowMcp(t);
		if (phase === "discovery") provider.state.list = async () => { await delay(250); return { tools: [flowTool] }; };
		else provider.state.reply = async () => { await delay(250); return textResult("늦은 합성 응답"); };
		const app = await startDaylog(t, provider, { timeouts: { timeout: 80, discoveryTimeout: phase === "discovery" ? 80 : 2000 } });
		const response = await app.request("/api/chat", { reportIds: [app.ids[0]], question: "시간 초과 합성 질문" });
		assert.equal(response.status, 504);
		assert.equal(response.data.code, "FLOW_TIMEOUT");
		assert.equal((await app.request("/api/bootstrap")).data.conversations.length, 0);
		await delay(280);
		assert.equal((await app.request("/api/bootstrap")).data.conversations.length, 0);
		provider.state.list = undefined;
		provider.state.reply = () => textResult("시간 초과 후 재시도 응답 [R1]");
		assert.equal((await app.request("/api/chat", { reportIds: [app.ids[0]], question: "재시도 질문" })).status, 200);
	});
});

test("MCP cancellation reaches discovery and execution without yielding a success answer", async (t) => {
	for (const phase of ["discovery", "execution"]) await t.test(phase, async (t) => {
		const provider = await startFlowMcp(t);
		const controller = new AbortController();
		const cancel = async () => { controller.abort(); await delay(20); return textResult("취소 후 늦은 합성 응답"); };
		if (phase === "discovery") provider.state.list = cancel;
		else provider.state.reply = cancel;
		await assert.rejects(callFlow(provider.settings, "취소할 합성 질문", "cancel-conversation", controller.signal), { name: "AbortError" });
		if (phase === "discovery") assert.equal(provider.state.calls.length, 0);
	});
});

test("MCP repeated pagination cursors fail instead of looping indefinitely", async (t) => {
	const provider = await startFlowMcp(t);
	provider.state.list = () => ({ tools: [], nextCursor: "repeated" });
	await assert.rejects(callFlow(provider.settings, "합성 질문", "pagination-conversation"), { code: "FLOW_CONNECTION_FAILED" });
	assert.equal(provider.state.requests.filter((item) => item.body?.method === "tools/list").length, 2);
	assert.equal(provider.state.calls.length, 0);
});
