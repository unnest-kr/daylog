import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { FlowError, flowFailure } from "./flow-errors.mjs";

export function compatibleFlowTool(tool) {
	const properties = tool?.inputSchema?.properties;
	return ["input_value", "session_id"].every((name) => properties?.[name]?.type === "string") &&
		(tool.inputSchema.required ?? []).every((name) => ["input_value", "session_id"].includes(name));
}

export async function withMcp(settings, operation, signal, { timeout = 12_000 } = {}) {
	const client = new Client({ name: "daylog", version: "0.1.0" });
	const transport = new StreamableHTTPClientTransport(
		new URL(settings.mcpUrl),
		{
			requestInit: {
				headers: settings.apiKey ? { "x-api-key": settings.apiKey } : {},
			},
			fetch: (url, init) =>
				fetch(url, {
					...init,
					redirect: "error",
					signal: AbortSignal.any([
						AbortSignal.timeout(init?.method === "DELETE" ? 2_000 : 150_000),
						...(init?.signal ? [init.signal] : []),
						...(signal ? [signal] : []),
					]),
				}),
		},
	);
	try {
		await client.connect(transport, { timeout, signal });
		return await operation(client);
	} catch (error) {
		if (signal?.aborted) throw signal.reason;
		throw flowFailure(error);
	} finally {
		if (transport.sessionId) await transport.terminateSession().catch(() => {});
		await client.close();
	}
}

export async function listTools(client, { timeout = 12_000, signal } = {}) {
	const tools = [];
	const cursors = new Set();
	let cursor;
	do {
		const result = await client.listTools(cursor ? { cursor } : undefined, {
			timeout, signal,
		});
		tools.push(...result.tools);
		cursor = result.nextCursor;
		if (tools.length > 500 || (cursor && cursors.has(cursor)) || cursors.size >= 500)
			throw new FlowError("FLOW_CONNECTION_FAILED");
		if (cursor) cursors.add(cursor);
	} while (cursor);
	return tools;
}

export async function callFlow(settings, input, sessionId, signal, { timeout = 140_000, discoveryTimeout = 12_000 } = {}) {
	return withMcp(
		settings,
		async (client) => {
			const tools = await listTools(client, { timeout: discoveryTimeout, signal });
			const tool = tools.find((item) => item.name === settings.toolName);
			if (!tool) throw new FlowError("FLOW_TOOL_NOT_FOUND");
			if (!compatibleFlowTool(tool)) throw new FlowError("FLOW_INPUT_INCOMPATIBLE");
			let result;
			try {
				result = await client.callTool(
					{
						name: settings.toolName,
						arguments: { input_value: input, session_id: sessionId },
					},
					undefined,
					{ timeout, signal },
				);
			} catch (error) {
				throw flowFailure(error, "FLOW_EXECUTION_FAILED");
			}
			return readFlowAnswer(result);
		},
		signal,
		{ timeout: discoveryTimeout },
	);
}

export function readFlowAnswer(result) {
	const seen = new Set();
	const parts = (result.content ?? [])
		.filter((item) => item.type === "text")
		.map((item) => item.text)
		.filter((value) => typeof value === "string")
		.filter((value) => {
			// The same ChatOutput can be emitted as both a message and a result, with different blank lines.
			const key = value.replace(/\n(?:[ \t]*\n)+/g, "\n").trim();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	const text = parts.join("\n\n");
	// Unnestflow's legacy MCP handler can return execution failures as TextContent without isError.
	if (
		result.isError ||
		!text.trim() ||
		/^\s*(Error Executing\b|Error executing tool\b|Flow build blocked:)/im.test(text)
	)
		throw new FlowError("FLOW_EXECUTION_FAILED");
	return text;
}
