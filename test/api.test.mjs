import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { createApp } from "../server/index.mjs";

const report = (overrides = {}) => ({
	title: "개발팀 일일 보고",
	department: "개발팀",
	report_date: "2026-10-21",
	filename: "report.md",
	markdown: "# 업무\n검색 API 310ms 개선 완료.",
	...overrides,
});
async function start(t, options = {}) {
	const calls = [];
	const app = createApp({
		database: ":memory:",
		env: {
			MCP_URL: "http://127.0.0.1:7890/mcp",
			MCP_TOOL: "daily_report_assistant",
			UNNESTFLOW_API_KEY: "synthetic-test-only-key",
		},
		invokeFlow: async (settings, input, sessionId) => {
			calls.push({ settings, input, sessionId });
			return "검색 API 개선 완료. [R1]";
		},
		...options,
	});
	app.server.listen(0, "127.0.0.1");
	await once(app.server, "listening");
	const base = `http://127.0.0.1:${app.server.address().port}`;
	t.after(() => new Promise((resolve) => app.server.close(resolve)));
	const request = async (
		path,
		body,
		method = body ? "POST" : "GET",
		headers = {},
	) => {
		const response = await fetch(base + path, {
			method,
			headers: { "content-type": "application/json", ...headers },
			...(body ? { body: JSON.stringify(body) } : {}),
		});
		return { status: response.status, data: await response.json() };
	};
	return { ...app, base, request, calls };
}

test("standalone startup stores reports without requiring an MCP server", async (t) => {
	const app = await start(t, { env: {} });
	const health = await app.request("/api/health");
	assert.equal(health.status, 200);
	assert.equal(health.data.mcpConfigured, false);
	const uploaded = await app.request("/api/reports", { reports: [report()] });
	assert.equal(uploaded.status, 201);
	assert.equal(uploaded.data.settings.mcpUrl, "");
	assert.equal(uploaded.data.settings.hasApiKey, false);
	assert.equal(
		(await app.request(`/api/reports/${uploaded.data.ids[0]}`)).data.markdown,
		report().markdown,
	);
	const chat = await app.request("/api/chat", {
		reportIds: uploaded.data.ids,
		question: "업무를 정리해 줘.",
	});
	assert.equal(chat.status, 503);
	assert.equal(app.calls.length, 0);
	assert.equal(
		(await app.request("/api/bootstrap")).data.conversations.length,
		0,
	);
});

test("report content and metadata survive a database reopen", async (t) => {
	const folder = mkdtempSync(join(tmpdir(), "daylog-persist-"));
	t.after(() => rmSync(folder, { recursive: true, force: true }));
	const database = join(folder, "reports.sqlite");
	const first = await start(t, { database });
	const uploaded = await first.request("/api/reports", {
		reports: [report({ title: "제목'; DROP TABLE reports; --" })],
	});
	assert.equal(uploaded.status, 201);
	const second = await start(t, { database });
	const fetched = await second.request(`/api/reports/${uploaded.data.ids[0]}`);
	assert.equal(fetched.data.markdown, report().markdown);
	assert.equal(fetched.data.department, "개발팀");
	assert.equal(fetched.data.title, "제목'; DROP TABLE reports; --");
});

test("invalid batch is atomic and file/date validation precedes storage", async (t) => {
	const app = await start(t);
	for (const invalid of [
		{ filename: "payload.html" },
		{ filename: "../report.md" },
		{ report_date: "2026-13-99" },
		{ report_date: "2026-02-30" },
		{ markdown: "" },
	]) {
		const result = await app.request("/api/reports", {
			reports: [report(), report(invalid)],
		});
		assert.equal(result.status, 400, JSON.stringify(invalid));
	}
	assert.equal((await app.request("/api/bootstrap")).data.reports.length, 0);
});

test("only selected report enters the actual server-built context; keys never enter browser responses", async (t) => {
	const app = await start(t);
	const uploaded = await app.request("/api/reports", {
		reports: [
			report(),
			report({
				department: "영업팀",
				title: "보안 참고",
				markdown: "UNSELECTED-PRIVATE-REPORT-7392",
			}),
		],
	});
	const id = uploaded.data.ids[0];
	const result = await app.request("/api/chat", {
		reportIds: [id],
		question: "검색 개선 결과를 알려줘.",
	});
	assert.equal(result.status, 200);
	assert.equal(app.calls.length, 1);
	assert.ok(app.calls[0].input.includes("310ms"));
	assert.ok(!app.calls[0].input.includes("UNSELECTED-PRIVATE-REPORT-7392"));
	assert.equal(result.data.conversation.messages.length, 2);
	assert.deepEqual(
		result.data.conversation.messages[1].sources.map((source) => source.id),
		[id],
	);
	assert.ok(!JSON.stringify(result.data).includes("synthetic-test-only-key"));
	const publicData = await app.request("/api/bootstrap");
	assert.equal(publicData.data.settings.hasApiKey, true);
	assert.ok(
		!JSON.stringify(publicData.data).includes("synthetic-test-only-key"),
	);
});

test("a conversation cannot silently switch to another report context", async (t) => {
	const app = await start(t);
	const {
		data: { ids },
	} = await app.request("/api/reports", {
		reports: [report(), report({ department: "영업팀" })],
	});
	const first = await app.request("/api/chat", {
		reportIds: [ids[0]],
		question: "첫 질문",
	});
	const conversationId = first.data.conversation.id;
	const changed = await app.request("/api/chat", {
		reportIds: [ids[1]],
		conversationId,
		question: "다른 부서 질문",
	});
	assert.equal(changed.status, 409);
	assert.equal(app.calls.length, 1);
	const followup = await app.request("/api/chat", {
		reportIds: [ids[0]],
		conversationId,
		question: "더 자세히 알려줘",
	});
	assert.equal(followup.status, 200);
	assert.equal(followup.data.conversation.messages.length, 4);
	assert.equal(app.calls[0].sessionId, app.calls[1].sessionId);
	assert.ok(app.calls[1].input.includes("첫 질문"));
});

test("unknown, empty and oversized contexts are rejected before provider calls", async (t) => {
	const app = await start(t);
	assert.equal(
		(await app.request("/api/chat", { reportIds: [], question: "질문" }))
			.status,
		400,
	);
	assert.equal(
		(
			await app.request("/api/chat", {
				reportIds: [randomUUID()],
				question: "질문",
			})
		).status,
		409,
	);
	assert.equal(
		(
			await app.request("/api/chat", {
				reportIds: ["../secret"],
				question: "질문",
			})
		).status,
		400,
	);
	const uploaded = await app.request("/api/reports", {
		reports: [report({ markdown: "가".repeat(50_000) })],
	});
	assert.equal(uploaded.status, 201);
	assert.equal(
		(
			await app.request("/api/chat", {
				reportIds: uploaded.data.ids,
				question: "질문",
			})
		).status,
		413,
	);
	assert.equal(app.calls.length, 0);
});

test("upstream failure does not create a fake answer or commit a failed turn", async (t) => {
	const app = await start(t, {
		invokeFlow: async () => {
			throw Error("upstream failure with private information");
		},
	});
	const uploaded = await app.request("/api/reports", { reports: [report()] });
	const failed = await app.request("/api/chat", {
		reportIds: uploaded.data.ids,
		question: "질문",
	});
	assert.equal(failed.status, 502);
	assert.ok(!JSON.stringify(failed.data).includes("private information"));
	assert.equal(
		(await app.request("/api/bootstrap")).data.conversations.length,
		0,
	);
});

test("deleting a selected source prevents later calls while preserving old conversation provenance", async (t) => {
	const app = await start(t);
	const uploaded = await app.request("/api/reports", { reports: [report()] });
	const first = await app.request("/api/chat", {
		reportIds: uploaded.data.ids,
		question: "첫 질문",
	});
	const id = uploaded.data.ids[0];
	assert.equal(
		(await app.request(`/api/reports/${id}`, undefined, "DELETE")).status,
		200,
	);
	assert.equal((await app.request(`/api/reports/${id}`)).status, 404);
	assert.equal(
		(
			await app.request("/api/chat", {
				reportIds: [id],
				conversationId: first.data.conversation.id,
				question: "추가 질문",
			})
		).status,
		409,
	);
	assert.equal(app.calls.length, 1);
	assert.equal(
		(await app.request(`/api/conversations/${first.data.conversation.id}`)).data
			.messages[1].sources[0].id,
		id,
	);
});

test("cross-origin and untrusted Host requests cannot mutate the local workspace", async (t) => {
	const app = await start(t);
	const cross = await app.request(
		"/api/reports",
		{ reports: [report()] },
		"POST",
		{ origin: "https://untrusted.example" },
	);
	assert.equal(cross.status, 403);
	const rebound = await new Promise((resolveStatus, reject) => {
		const request = httpRequest(
			new URL("/api/bootstrap", app.base),
			{ headers: { host: "untrusted.example" } },
			(response) => {
				response.resume();
				resolveStatus(response.statusCode);
			},
		);
		request.on("error", reject);
		request.end();
	});
	assert.equal(rebound, 403);
	assert.equal((await app.request("/api/bootstrap")).data.reports.length, 0);
});

test("connection settings reject executable URLs and credentials in URLs", async (t) => {
	const app = await start(t);
	for (const mcpUrl of [
		"file:///etc/passwd",
		"javascript:alert(1)",
		"http://user:password@localhost/mcp",
		"http://localhost/mcp?api_key=secret",
	]) {
		assert.equal(
			(
				await app.request(
					"/api/settings",
					{ mcpUrl, toolName: "daily_report_assistant" },
					"PUT",
				)
			).status,
			400,
		);
	}
	const valid = await app.request(
		"/api/settings",
		{
			mcpUrl: "http://127.0.0.1:7890/api/v1/mcp/project/test/streamable",
			toolName: "daily_report_assistant",
		},
		"PUT",
	);
	assert.equal(valid.status, 200);
	assert.ok(!JSON.stringify(valid.data).includes("synthetic-test-only-key"));
});

test("one conversation allows only one in-flight turn", async (t) => {
	let release, entered;
	const ready = new Promise((resolve) => {
		entered = resolve;
	});
	const waiting = new Promise((resolve) => {
		release = resolve;
	});
	let count = 0;
	const app = await start(t, {
		invokeFlow: async () => {
			count++;
			if (count === 2) {
				entered();
				await waiting;
			}
			return "실제 경로에서 반환한 테스트 답변 [R1]";
		},
	});
	const uploaded = await app.request("/api/reports", { reports: [report()] });
	const first = await app.request("/api/chat", {
		reportIds: uploaded.data.ids,
		question: "첫 질문",
	});
	const payload = {
		reportIds: uploaded.data.ids,
		conversationId: first.data.conversation.id,
		question: "후속 질문",
	};
	const second = app.request("/api/chat", payload);
	await ready;
	const duplicate = await app.request("/api/chat", payload);
	assert.equal(duplicate.status, 409);
	release();
	assert.equal((await second).status, 200);
	assert.equal(count, 2);
});
