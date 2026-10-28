import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export const flowTool = {
	name: "daily_report_assistant",
	description: "Synthetic Daylog contract fixture; no Flow or model is executed.",
	inputSchema: {
		type: "object",
		properties: { input_value: { type: "string" }, session_id: { type: "string" } },
		required: ["input_value"],
		additionalProperties: false,
	},
};
export const textResult = (text) => ({ content: [{ type: "text", text }], isError: false });

// A real SDK Streamable HTTP server on an ephemeral loopback port, with synthetic tool output.
export async function startFlowMcp(t, { enableJsonResponse = false } = {}) {
	const state = {
		apiKey: "synthetic-mcp-contract-key",
		authStatus: 401,
		tools: [flowTool],
		requests: [],
		calls: [],
		reply: () => textResult("합성 MCP 테스트 응답입니다. 실제 모델 답변이 아닙니다. [R1]"),
	};
	const sessions = new Map();
	const servers = new Set();
	const http = createServer(async (req, res) => {
		try {
			if (req.headers["x-api-key"] !== state.apiKey) {
				res.writeHead(state.authStatus, { "content-type": "application/json" });
				res.end(JSON.stringify({ detail: "synthetic-private-upstream-auth-detail" }));
				return;
			}
			// A standalone GET stream is optional in MCP Streamable HTTP.
			if (req.method === "GET") { res.writeHead(405).end(); return; }
			let raw = "";
			for await (const chunk of req) raw += chunk;
			const body = raw ? JSON.parse(raw) : undefined;
			state.requests.push({ method: req.method, url: req.url, headers: req.headers, body });
			let transport = sessions.get(req.headers["mcp-session-id"]);
			if (!transport && body?.method === "initialize") {
				const server = new Server({ name: "daylog-contract-fixture", version: "1.0.0" }, { capabilities: { tools: {} } });
				server.setRequestHandler(ListToolsRequestSchema, async (request, extra) =>
					state.list ? state.list(request.params, extra) : { tools: state.tools });
				server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
					state.calls.push(request.params);
					return state.reply(request.params, extra);
				});
				transport = new StreamableHTTPServerTransport({
					sessionIdGenerator: randomUUID,
					enableJsonResponse,
					onsessioninitialized: (id) => sessions.set(id, transport),
				});
				servers.add(server);
				await server.connect(transport);
			}
			if (!transport) { res.writeHead(400).end(); return; }
			await transport.handleRequest(req, res, body);
		} catch {
			if (!res.headersSent) res.writeHead(500);
			res.end();
		}
	});
	http.listen(0, "127.0.0.1");
	await once(http, "listening");
	t.after(async () => {
		for (const server of servers) await server.close();
		const closed = new Promise((resolve) => http.close(resolve));
		http.closeAllConnections();
		await closed;
	});
	return {
		state,
		settings: {
			mcpUrl: `http://127.0.0.1:${http.address().port}/api/v1/mcp/project/12345678-1234-4234-8234-123456789012/streamable`,
			toolName: flowTool.name,
			apiKey: state.apiKey,
		},
	};
}
