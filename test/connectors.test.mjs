import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createWeeklyJob, WEEKLY_PAGE_ID } from "../server/weekly.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const originalLink = '<page url="https://notion.example/retained-child">Existing page</page>\n';
const conversation = {
	id: "synthetic-conversation",
	messages: [{ role: "assistant", content: "Synthetic weekly review [R1]", sources: [{
		reference: "R1", id: "synthetic-source-1", department: "Development", title: "Synthetic report",
		report_date: "2026-10-23", sha256: "synthetic-source-digest",
	}] }],
};

async function connect(t, entry, state = {}) {
	const directory = mkdtempSync(join(tmpdir(), "daylog-connectors-"));
	const jobs = join(directory, "jobs");
	const evidence = join(directory, "evidence");
	mkdirSync(jobs);
	const stateFile = join(directory, "state.json");
	const traceFile = join(directory, "trace.jsonl");
	writeFileSync(stateFile, JSON.stringify({ text: originalLink, ...state }));
	writeFileSync(traceFile, "");
	const configFile = join(directory, "bridge.json");
	writeFileSync(configFile, JSON.stringify({ mcpServers: { "notion-readonly": {
		command: process.execPath, args: [join(root, "test/fixtures/notion-mcp.mjs")],
		env: { FAKE_NOTION_STATE: stateFile, FAKE_NOTION_TRACE: traceFile },
	} } }));
	const transport = new StdioClientTransport({
		command: process.execPath, args: [join(root, "connectors", entry)], cwd: root,
		env: { ...process.env, NOTION_MCP_CONFIG: configFile, WEEKLY_JOBS_DIR: jobs, WEEKLY_EVIDENCE_DIR: evidence },
		stderr: "pipe",
	});
	const client = new Client({ name: "offline-connector-check", version: "1.0" });
	t.after(async () => {
		await client.close().catch(() => {});
		await transport.close().catch(() => {});
		if (resolve(dirname(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith("daylog-connectors-")) {
			throw new Error("Refusing cleanup outside the named temporary test directory");
		}
		rmSync(directory, { recursive: true, force: true });
	});
	await client.connect(transport, { timeout: 15_000 });
	const trace = () => readFileSync(traceFile, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line));
	const call = (name, args) => client.callTool({ name, arguments: args });
	return { client, call, trace, jobs, evidence, stateFile };
}

test("read-only connector forwards approved IDs while withholding writes and unrelated pages", async t => {
	const { client, call, trace } = await connect(t, "notion-readonly-server.mjs");
	assert.deepEqual((await client.listTools()).tools.map(tool => tool.name), ["notion-fetch"]);
	for (const id of [
		"3f94587c9925839a92b501acc6675a38",
		"https://app.notion.com/p/3f94587c9925839a92b501acc6675a38",
		"collection://1f016d8d-902f-4a9f-92f6-189041d2be00",
	]) assert.ok(!(await call("notion-fetch", { id })).isError);
	for (const [name, args] of [
		["notion-update-page", { page_id: WEEKLY_PAGE_ID }],
		["notion-fetch", { id: "0123456789abcdef0123456789abcdef" }],
		["notion-fetch", { id: "https://untrusted.example/3f94587c9925839a92b501acc6675a38" }],
	]) await assert.rejects(call(name, args));
	assert.equal(trace().length, 3);
});

test("publisher reads shared jobs, preserves links, avoids duplicates and replaces its own revision", async t => {
	const { client, call, trace, jobs, evidence, stateFile } = await connect(t, "notion-weekly-server.mjs");
	const tools = (await client.listTools()).tools;
	assert.deepEqual(tools.map(tool => tool.name), ["publish_weekly_report"]);
	assert.equal(tools[0].inputSchema.additionalProperties, false);
	const job = createWeeklyJob(conversation, jobs);
	const first = await call("publish_weekly_report", { job_id: job.jobId });
	assert.ok(!first.isError);
	const receipt = JSON.parse(readFileSync(join(jobs, `${job.jobId}.receipt.json`), "utf8"));
	assert.equal(receipt.pageId, WEEKLY_PAGE_ID);
	assert.equal(receipt.contentSha256, job.contentSha256);
	assert.equal(receipt.existingChildLinksPreserved, 1);
	assert.ok(existsSync(join(evidence, `${job.jobId}.notion.json`)));
	await call("publish_weekly_report", { job_id: job.jobId });
	assert.equal(trace().filter(item => item.name === "notion-update-page").length, 1);
	const revision = structuredClone(conversation);
	revision.messages[0].content = "Corrected weekly review [R1]";
	const revised = createWeeklyJob(revision, jobs);
	const updated = await call("publish_weekly_report", { job_id: revised.jobId });
	assert.ok(!updated.isError);
	const saved = JSON.parse(readFileSync(stateFile, "utf8")).text;
	assert.ok(saved.includes(originalLink.trim()));
	assert.ok(saved.includes(`DAYLOG-WEEKLY-${revised.jobId}`));
	assert.ok(!saved.includes(`DAYLOG-WEEKLY-${job.jobId}`));
	assert.equal(trace().filter(item => item.name === "notion-update-page").length, 2);
});

test("publisher rejects raw writes, extra destinations and tampered jobs before upstream calls", async t => {
	const { call, trace, jobs } = await connect(t, "notion-weekly-server.mjs");
	const job = createWeeklyJob(conversation, jobs);
	for (const [name, args] of [
		["notion-update-page", { page_id: WEEKLY_PAGE_ID }],
		["publish_weekly_report", { job_id: "../outside" }],
		["publish_weekly_report", { job_id: job.jobId, page_id: "other-page" }],
	]) assert.equal((await call(name, args)).isError, true);
	job.markdown += "tampered";
	writeFileSync(join(jobs, `${job.jobId}.json`), JSON.stringify(job));
	assert.equal((await call("publish_weekly_report", { job_id: job.jobId })).isError, true);
	assert.equal(trace().length, 0);
});

test("publisher withholds its receipt if remote readback loses a source identifier", async t => {
	const { call, jobs } = await connect(t, "notion-weekly-server.mjs", { removeToken: "synthetic-source-1" });
	const job = createWeeklyJob(conversation, jobs);
	const result = await call("publish_weekly_report", { job_id: job.jobId });
	assert.equal(result.isError, true);
	assert.equal(existsSync(join(jobs, `${job.jobId}.receipt.json`)), false);
});
