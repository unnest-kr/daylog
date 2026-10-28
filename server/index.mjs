import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname, join, relative, isAbsolute, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createStore } from "./store.mjs";
import { withMcp, listTools, compatibleFlowTool, callFlow as callMcpFlow } from "./mcp.mjs";
import { FlowError, flowFailure } from "./flow-errors.mjs";
import { flowApiId, checkFlowApi, callFlowApi } from "./flow-api.mjs";
import { buildContext, MAX_CONTEXT_BYTES } from "./context.mjs";
import { sampleReports } from "./samples.mjs";
import { createWeeklyPublisher } from "./weekly.mjs";

const fail = (status, message) => Object.assign(new Error(message), { status });
const callFlow = (settings, ...args) =>
	flowApiId(settings.mcpUrl) ? callFlowApi(settings, ...args) : callMcpFlow(settings, ...args);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const today = () =>
	new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
		new Date(),
	);
const send = (res, status, data) => {
	if (!res.destroyed)
		res
			.writeHead(status, {
				"content-type": "application/json; charset=utf-8",
				"cache-control": "no-store",
			})
			.end(JSON.stringify(data));
};

function readJson(req) {
	if (!req.headers["content-type"]?.startsWith("application/json"))
		throw fail(415, "JSON 형식으로 요청해 주세요.");
	return new Promise((resolveBody, reject) => {
		let size = 0,
			settled = false;
		const chunks = [];
		req.on("data", (chunk) => {
			if (settled) return;
			size += chunk.length;
			if (size > 2_000_000) {
				settled = true;
				chunks.length = 0;
				reject(fail(413, "업로드는 한 번에 2MB까지 가능합니다."));
			} else chunks.push(chunk);
		});
		req.once("error", reject);
		req.once("end", () => {
			if (settled) return;
			try {
				const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
				if (!value || Array.isArray(value) || typeof value !== "object")
					throw Error();
				resolveBody(value);
			} catch {
				reject(fail(400, "요청 내용을 확인해 주세요."));
			}
		});
	});
}

function text(value, label, max) {
	if (typeof value !== "string" || !value.trim() || value.trim().length > max)
		throw fail(
			400,
			`${label}을(를) 확인해 주세요. (최대 ${max.toLocaleString()}자)`,
		);
	return value.trim();
}

function validateReport(report) {
	if (!report || typeof report !== "object")
		throw fail(400, "보고서 형식을 확인해 주세요.");
	const date = text(report.report_date, "보고 날짜", 10);
	const parsedDate = new Date(`${date}T00:00:00Z`);
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
		!Number.isFinite(parsedDate.getTime()) ||
		parsedDate.toISOString().slice(0, 10) !== date
	)
		throw fail(400, "올바른 보고 날짜를 선택해 주세요.");
	const filename = text(report.filename, "파일명", 200);
	if (!/\.(md|markdown)$/i.test(filename) || /[\/\\\x00]/.test(filename))
		throw fail(400, ".md 또는 .markdown 파일을 선택해 주세요.");
	const markdown = text(report.markdown, "보고서 본문", 200_000);
	if (Buffer.byteLength(markdown) > 200_000)
		throw fail(413, "보고서 한 개는 200KB까지 가능합니다.");
	return {
		title: text(report.title, "보고서 제목", 160),
		department: text(report.department, "부서", 50),
		report_date: date,
		filename,
		markdown,
		sample: false,
	};
}

export function createApp({
	database = join(process.env.DATA_DIR ?? ".data", "reports.sqlite"),
	env = process.env,
	dist = resolve("dist"),
	invokeFlow = callFlow,
} = {}) {
	const store = createStore(database);
	const pending = new Set();
	const settings = () => ({
		mcpUrl: store.getSetting("mcpUrl") ?? env.MCP_URL ?? "",
		toolName:
			store.getSetting("toolName") ?? env.MCP_TOOL ?? "daily_report_assistant",
		apiKey: env.UNNESTFLOW_API_KEY ?? "",
		caCertFile: env.UNNESTFLOW_CA_CERT_FILE ?? "",
		flowUrl: env.FLOW_URL ?? "",
	});
	const publicSettings = () => {
		const { apiKey, caCertFile, ...rest } = settings();
		return { ...rest, hasApiKey: Boolean(apiKey) };
	};
	const bootstrap = () => ({
		reports: store.listReports(),
		conversations: store.listConversations(),
		settings: publicSettings(),
	});
	const publishWeekly = createWeeklyPublisher({ env, invokeFlow, getSettings: settings });

	const server = createServer(async (req, res) => {
		res.setHeader("x-content-type-options", "nosniff");
		res.setHeader("referrer-policy", "no-referrer");
		res.setHeader(
			"content-security-policy",
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
		);
		try {
			const port = server.address()?.port;
			const allowedHosts = new Set([
				`127.0.0.1:${port}`,
				`localhost:${port}`,
				`[::1]:${port}`,
			]);
			if (!allowedHosts.has(req.headers.host))
				throw fail(403, "허용되지 않은 호스트입니다.");
			if (
				req.headers.origin &&
				new URL(req.headers.origin).host !== req.headers.host
			)
				throw fail(403, "동일한 사이트에서 요청해 주세요.");
			const path = new URL(req.url, "http://localhost").pathname;
			const method = req.method;
			if (path === "/api/health" && method === "GET")
				return send(res, 200, {
					status: "ok",
					mcpConfigured: Boolean(settings().mcpUrl),
				});
			if (path === "/api/bootstrap" && method === "GET")
				return send(res, 200, bootstrap());
			if (path === "/api/status" && method === "GET") {
				if (!settings().mcpUrl)
					throw fail(503, "Unnestflow 연결을 먼저 설정해 주세요.");
				try {
					if (flowApiId(settings().mcpUrl))
						return send(res, 200, await checkFlowApi(settings()));
					const result = await withMcp(settings(), async (client) => ({
						tools: (await listTools(client)).map(
							({ name, description, inputSchema }) => ({
								name,
								description,
								compatible: compatibleFlowTool({ inputSchema }),
							}),
						),
						server: client.getServerVersion()?.name,
					}));
					return send(res, 200, {
						...result,
						verification: "discovery",
						connected: result.tools.some(
							(tool) => tool.name === settings().toolName && tool.compatible,
						),
					});
				} catch (error) {
					throw flowFailure(error);
				}
			}
			if (path === "/api/settings" && method === "PUT") {
				const body = await readJson(req);
				let url;
				try {
					url = new URL(body.mcpUrl);
				} catch {
					throw fail(400, "올바른 Unnestflow 연결 주소를 입력해 주세요.");
				}
				if (
					!["http:", "https:"].includes(url.protocol) ||
					url.username ||
					url.password ||
					url.search ||
					url.hash
				)
					throw fail(
						400,
						"인증 정보나 query가 없는 HTTP(S) 연결 주소를 입력해 주세요.",
					);
				store.setSettings({
					mcpUrl: url.href,
					toolName: text(body.toolName, "Flow 도구 이름", 100),
				});
				return send(res, 200, publicSettings());
			}
			if (path === "/api/reports" && method === "POST") {
				const body = await readJson(req);
				if (
					!Array.isArray(body.reports) ||
					!body.reports.length ||
					body.reports.length > 10
				)
					throw fail(400, "보고서는 한 번에 1~10개를 올릴 수 있습니다.");
				const ids = store.addReports(body.reports.map(validateReport));
				return send(res, 201, { ...bootstrap(), ids });
			}
			if (path === "/api/samples" && method === "POST") {
				await readJson(req);
				if (
					store.db
						.prepare("SELECT id FROM reports WHERE sample=1 LIMIT 1")
						.get()
				)
					throw fail(409, "샘플 보고서가 이미 있습니다.");
				const ids = store.addReports(sampleReports(today()));
				return send(res, 201, { ...bootstrap(), ids });
			}
			const reportMatch = path.match(/^\/api\/reports\/([0-9a-f-]+)$/i);
			if (reportMatch && ["GET", "DELETE"].includes(method)) {
				const report = store.getReport(reportMatch[1]);
				if (!report)
					throw fail(404, "보고서를 찾을 수 없습니다. 삭제되었을 수 있습니다.");
				if (method === "GET") return send(res, 200, report);
				store.deleteReport(report.id);
				return send(res, 200, bootstrap());
			}
			const conversationMatch = path.match(
				/^\/api\/conversations\/([0-9a-f-]+)$/i,
			);
			if (conversationMatch && method === "GET") {
				const conversation = store.getConversation(conversationMatch[1]);
				if (!conversation) throw fail(404, "대화를 찾을 수 없습니다.");
				return send(res, 200, conversation);
			}
			if (path === "/api/notion/weekly" && method === "POST") {
				const body = await readJson(req);
				if (typeof body.conversationId !== "string" || !uuid.test(body.conversationId))
					throw fail(400, "게시할 검토 대화를 선택해 주세요.");
				const conversation = store.getConversation(body.conversationId);
				if (!conversation) throw fail(404, "검토 대화를 찾을 수 없습니다.");
				try { return send(res, 200, await publishWeekly(conversation)); }
				catch (error) { throw fail(error.status ?? 502, error.status ? error.message : "Notion 게시를 확인하지 못했습니다. 검토 결과는 최근 대화에 보관되어 있습니다. 같은 대화를 다시 게시하면 중복 여부를 확인합니다."); }
			}
			if (path === "/api/chat" && method === "POST") {
				const body = await readJson(req);
				const question = text(body.question, "질문", 4000);
				if (
					!Array.isArray(body.reportIds) ||
					!body.reportIds.length ||
					body.reportIds.length > 30 ||
					body.reportIds.some((id) => typeof id !== "string" || !uuid.test(id))
				)
					throw fail(400, "대화에 사용할 보고서를 1~30개 선택해 주세요.");
				const reportIds = [...new Set(body.reportIds)].sort();
				const reports = reportIds.map((id) => store.getReport(id));
				if (reports.some((report) => !report))
					throw fail(
						409,
						"선택한 보고서가 삭제되었습니다. 보고서를 다시 선택해 주세요.",
					);
				let conversation;
				if (body.conversationId) {
					if (
						typeof body.conversationId !== "string" ||
						!uuid.test(body.conversationId)
					)
						throw fail(400, "대화 ID를 확인해 주세요.");
					conversation = store.getConversation(body.conversationId);
					if (!conversation) throw fail(404, "대화를 찾을 수 없습니다.");
					if (
						JSON.stringify(conversation.report_ids) !==
						JSON.stringify(reportIds)
					)
						throw fail(409, "보고서 선택이 바뀌면 새 대화를 시작해 주세요.");
				}
				const conversationId = conversation?.id ?? randomUUID();
				if (pending.has(conversationId))
					throw fail(
						409,
						"이 대화의 답변을 생성하고 있습니다. 잠시 기다려 주세요.",
					);
				if (!settings().mcpUrl)
					throw fail(503, "Unnestflow MCP 연결을 먼저 설정해 주세요.");
				const { input, sources } = buildContext(
					reports,
					question,
					conversation?.messages,
				);
				if (Buffer.byteLength(input) > MAX_CONTEXT_BYTES)
					throw fail(
						413,
						"선택한 보고서와 대화가 컨텍스트 한도를 넘었습니다. 보고서를 줄이거나 새 대화를 시작해 주세요.",
					);
				const controller = new AbortController();
				res.once("close", () => {
					if (!res.writableEnded) controller.abort();
				});
				pending.add(conversationId);
				try {
					let answer;
					try {
						answer = await invokeFlow(
							settings(),
							input,
							conversationId,
							controller.signal,
						);
					} catch (error) {
						if (controller.signal.aborted) return;
						throw flowFailure(error, "FLOW_EXECUTION_FAILED");
					}
					if (controller.signal.aborted) return;
					const saved = store.saveTurn({
						conversationId,
						reportIds,
						question,
						answer,
						sources,
					});
					return send(res, 200, {
						conversation: saved,
						conversations: store.listConversations(),
					});
				} finally {
					pending.delete(conversationId);
				}
			}
			if (path.startsWith("/api/"))
				throw fail(404, "API 경로를 찾을 수 없습니다.");
			if (method !== "GET" && method !== "HEAD")
				throw fail(405, "지원하지 않는 요청입니다.");
			const file = resolve(
				dist,
				`.${path === "/" ? "/index.html" : decodeURIComponent(path)}`,
			);
			const localPath = relative(dist, file);
			if (
				localPath === ".." || localPath.startsWith(`..${sep}`) || isAbsolute(localPath) ||
				!existsSync(file) ||
				!statSync(file).isFile()
			)
				throw fail(404, "페이지를 찾을 수 없습니다.");
			const types = {
				".html": "text/html; charset=utf-8",
				".js": "text/javascript; charset=utf-8",
				".css": "text/css; charset=utf-8",
				".svg": "image/svg+xml",
				".png": "image/png",
			};
			res.writeHead(200, {
				"content-type": types[extname(file)] ?? "application/octet-stream",
				"cache-control": path.startsWith("/assets/")
					? "public,max-age=31536000,immutable"
					: "no-cache",
			});
			return res.end(method === "HEAD" ? undefined : readFileSync(file));
		} catch (error) {
			return send(res, error.status ?? 500, {
				error: error instanceof FlowError ? error.publicMessage : error.status
					? error.message
					: "서버에서 요청을 처리하지 못했습니다.",
				...(error instanceof FlowError ? { code: error.code } : {}),
			});
		}
	});
	server.requestTimeout = 30_000;
	server.headersTimeout = 10_000;
	server.once("close", () => store.close());
	return { server, store };
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	const { server } = createApp();
	server.listen(
		Number(process.env.PORT ?? 3090),
		process.env.HOST ?? "127.0.0.1",
		() =>
			console.log(
				`Daylog ready: http://${process.env.HOST ?? "127.0.0.1"}:${server.address().port}`,
			),
	);
	for (const signal of ["SIGTERM", "SIGINT"])
		process.once(signal, () => server.close(() => process.exit(0)));
}
