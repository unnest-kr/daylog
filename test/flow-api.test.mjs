import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createApp } from "../server/index.mjs";
import { callFlowApi, checkFlowApi, readFlowApiAnswer } from "../server/flow-api.mjs";

const flowId = "12345678-1234-4234-8234-123456789012";
async function upstream(t, handle) {
	const server = createServer(async (req, res) => {
		let body = "";
		for await (const part of req) body += part;
		const response = await handle(req, body ? JSON.parse(body) : null);
		res.writeHead(response.status ?? 200, { "content-type": "application/json" });
		res.end(JSON.stringify(response.data));
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const base = `http://127.0.0.1:${server.address().port}`;
	return { base, settings: { mcpUrl: `${base}/api/v1/run/${flowId}`, apiKey: "synthetic-flow-api-key" } };
}

test("Runtime status and chat use the published Flow API with server-held credentials and only selected reports", async (t) => {
	const calls = [];
	const provider = await upstream(t, (req, body) => {
		assert.equal(req.headers["x-api-key"], "synthetic-flow-api-key");
		if (req.url === "/api/v1/flows/published") return { data: [{ id: flowId, name: "보고서 검토" }] };
		assert.equal(req.url, `/api/v1/run/${flowId}`);
		assert.equal(req.method, "POST");
		assert.equal(body.input_request.input_type, "chat");
		assert.equal(body.input_request.output_type, "chat");
		assert.ok(body.input_request.session_id);
		assert.ok(body.input_request.input_value.includes("SELECTED-REPORT"));
		assert.ok(!body.input_request.input_value.includes("UNSELECTED-REPORT"));
		calls.push(body);
		return { data: { outputs: [{ outputs: [{
			messages: [{ message: "사업안 수정이 필요합니다. [R1]" }],
			results: { message: { text: "사업안 수정이 필요합니다. [R1]" } },
		}] }] } };
	});
	const app = createApp({ database: ":memory:", env: {
		MCP_URL: provider.settings.mcpUrl, MCP_TOOL: "보고서 검토", UNNESTFLOW_API_KEY: provider.settings.apiKey,
		UNNESTFLOW_CA_CERT_FILE: "synthetic-server-only-ca.pem",
	} });
	app.server.listen(0, "127.0.0.1");
	await once(app.server, "listening");
	t.after(() => new Promise((resolve) => app.server.close(resolve)));
	const base = `http://127.0.0.1:${app.server.address().port}`;
	const status = await (await fetch(`${base}/api/status`)).json();
	assert.equal(status.connected, true);
	assert.equal(status.server, "Unnestflow Flow API");
	assert.equal(calls.length, 0);
	const reports = ["SELECTED-REPORT", "UNSELECTED-REPORT"].map((markdown) => ({
		title: markdown, department: "기획팀", report_date: "2026-10-26", filename: "report.md", markdown,
	}));
	const uploaded = await (await fetch(`${base}/api/reports`, {
		method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reports }),
	})).json();
	const response = await fetch(`${base}/api/chat`, {
		method: "POST", headers: { "content-type": "application/json" },
		body: JSON.stringify({ reportIds: [uploaded.ids[0]], question: "사업안을 검토해 줘." }),
	});
	assert.equal(response.status, 200);
	const result = await response.json();
	assert.equal(calls.length, 1);
	assert.equal(result.conversation.messages[1].content, "사업안 수정이 필요합니다. [R1]");
	assert.equal(result.conversation.messages[1].sources[0].id, uploaded.ids[0]);
	assert.ok(!JSON.stringify(result).includes(provider.settings.apiKey));
	const bootstrap = await (await fetch(`${base}/api/bootstrap`)).json();
	assert.ok(!JSON.stringify(bootstrap).includes("synthetic-server-only-ca.pem"));
	assert.ok(!JSON.stringify(bootstrap).includes(provider.settings.apiKey));
	const restored = await (await fetch(`${base}/api/conversations/${result.conversation.id}`)).json();
	assert.equal(restored.messages[1].content, result.conversation.messages[1].content);
});

test("Flow API connection rejects a Flow absent from executable publications", async (t) => {
	const provider = await upstream(t, () => ({ data: [] }));
	await assert.rejects(checkFlowApi(provider.settings), /not published or executable/);
});

test("Flow API rejects provider failures and respects cancellation", async (t) => {
	let requests = 0;
	const provider = await upstream(t, () => { requests++; return { status: 500, data: { detail: "failed" } }; });
	await assert.rejects(callFlowApi(provider.settings, "test", "session"), /HTTP 500/);
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(callFlowApi(provider.settings, "test", "session", controller.signal), { name: "AbortError" });
	assert.equal(requests, 1);
});

test("Flow API accepts result-only answers and rejects empty or failed outputs", () => {
	assert.equal(readFlowApiAnswer({ outputs: [{ outputs: [{ results: { message: { text: "검토 완료 [R1]" } } }] }] }), "검토 완료 [R1]");
	for (const result of [
		{}, { outputs: [] },
		{ isError: true, outputs: [{ outputs: [{ messages: [{ message: "failed" }] }] }] },
		{ outputs: [{ outputs: [{ messages: [{ message: "Error Executing the review tool. Error: failure" }] }] }] },
	]) assert.throws(() => readFlowApiAnswer(result), /Flow execution failed/);
});
