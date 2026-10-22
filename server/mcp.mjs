import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export async function withMcp(settings, operation, signal) {
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
						AbortSignal.timeout(150_000),
						...(init?.signal ? [init.signal] : []),
						...(signal ? [signal] : []),
					]),
				}),
		},
	);
	try {
		await client.connect(transport, { timeout: 12_000 });
		return await operation(client);
	} finally {
		if (transport.sessionId) await transport.terminateSession().catch(() => {});
		await client.close();
	}
}

export async function listTools(client) {
	const tools = [];
	let cursor;
	do {
		const result = await client.listTools(cursor ? { cursor } : undefined, {
			timeout: 12_000,
		});
		tools.push(...result.tools);
		cursor = result.nextCursor;
		if (tools.length > 500) throw new Error("Too many tools");
	} while (cursor);
	return tools;
}

export async function callFlow(settings, input, sessionId, signal) {
	return withMcp(
		settings,
		async (client) => {
			const tools = await listTools(client);
			const tool = tools.find((item) => item.name === settings.toolName);
			if (!tool?.inputSchema?.properties?.input_value)
				throw new Error("Configured Flow needs a Chat Input");
			const result = await client.callTool(
				{
					name: settings.toolName,
					arguments: { input_value: input, session_id: sessionId },
				},
				undefined,
				{ timeout: 140_000, signal },
			);
			return readFlowAnswer(result);
		},
		signal,
	);
}

export function readFlowAnswer(result) {
	const seen = new Set();
	const parts = (result.content ?? [])
		.filter((item) => item.type === "text")
		.map((item) => item.text)
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
		/^(Error Executing |Flow build blocked:)/m.test(text)
	)
		throw new Error("Flow execution failed");
	return text;
}
