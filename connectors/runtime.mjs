import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

// Runtime state stays outside the versioned connector sources.
export const root = fileURLToPath(new URL("../", import.meta.url));
export const dataDirectory = resolve(root, process.env.DAYLOG_CONNECTOR_DATA_DIR || ".data");
export const jobsDirectory = resolve(root, process.env.WEEKLY_JOBS_DIR || join(dataDirectory, "weekly-jobs"));
export const evidenceDirectory = resolve(root, process.env.WEEKLY_EVIDENCE_DIR || join(dataDirectory, "weekly-evidence"));

export function readBridgeConfig() {
	const file = resolve(root, process.env.NOTION_MCP_CONFIG || join(dataDirectory, "notion-mcp-config.json"));
	const config = JSON.parse(readFileSync(file, "utf8")).mcpServers?.["notion-readonly"];
	if (!config || typeof config.command !== "string" || !Array.isArray(config.args)) {
		throw new Error("Configure the notion-readonly bridge command and args in NOTION_MCP_CONFIG");
	}
	return { ...config, args: [...config.args], cwd: config.cwd || root };
}
