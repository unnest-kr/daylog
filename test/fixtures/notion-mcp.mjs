// Offline upstream for exercising the real connector processes over MCP STDIO.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const server = new Server({ name: "synthetic-notion", version: "1.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: ["notion-fetch", "notion-update-page", "unrelated-tool"].map(name => ({
		name, inputSchema: { type: "object", additionalProperties: true },
	})),
}));
server.setRequestHandler(CallToolRequestSchema, async request => {
	appendFileSync(process.env.FAKE_NOTION_TRACE, JSON.stringify(request.params) + "\n");
	const state = JSON.parse(readFileSync(process.env.FAKE_NOTION_STATE, "utf8"));
	const args = request.params.arguments;
	let value;
	if (request.params.name === "notion-fetch") {
		value = args.id === "notion://docs/notion-flavored-markdown-spec"
			? { text: "Synthetic Markdown specification" }
			: { text: state.text, truncated: false, unknown_block_count: 0 };
	} else if (request.params.name === "notion-update-page") {
		if (args.command === "insert_content") state.text += args.content;
		else if (args.command === "update_content") {
			for (const edit of args.content_updates) state.text = state.text.replace(edit.old_str, edit.new_str);
		} else throw new Error("Unsupported synthetic write command");
		if (state.removeToken) state.text = state.text.replaceAll(state.removeToken, "");
		writeFileSync(process.env.FAKE_NOTION_STATE, JSON.stringify(state));
		value = { updated: true };
	} else throw new Error("Unsupported synthetic tool");
	return { content: [{ type: "text", text: JSON.stringify(value) }] };
});
await server.connect(new StdioServerTransport());
