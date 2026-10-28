import { once } from "node:events";
import { createApp } from "../server/index.mjs";
import { sampleReports } from "../server/samples.mjs";
import { startFlowMcp } from "../test/fixtures/flow-mcp.mjs";

// This demo uses only synthetic credentials, an isolated in-memory DB and a local SDK server.
const cleanup = [];
try {
	const provider = await startFlowMcp({ after: (operation) => cleanup.push(operation) });
	const app = createApp({ database: ":memory:", env: {
		MCP_URL: provider.settings.mcpUrl,
		MCP_TOOL: provider.settings.toolName,
		UNNESTFLOW_API_KEY: provider.settings.apiKey,
	} });
	const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
	app.store.addReports(sampleReports(date));
	cleanup.push(async () => {
		const closed = new Promise((resolve) => app.server.close(resolve));
		app.server.closeAllConnections();
		await closed;
	});
	app.server.listen(3091, "127.0.0.1");
	await once(app.server, "listening");
	console.log("MCP 모의 검증: http://127.0.0.1:3091");
	console.log("합성 보고서·고정 테스트 응답만 사용합니다. Unnestflow와 실제 모델은 호출하지 않습니다.");
	console.log("보고서 선택 → 질문 → MCP 호출 → 응답 표시와 최근 대화 재개를 확인할 수 있습니다.");
	console.log("데이터는 메모리에만 보관하며 종료하면 사라집니다. 종료: Ctrl+C");
	for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => {
		for (const operation of cleanup.reverse()) await operation();
		process.exit(0);
	});
} catch (error) {
	for (const operation of cleanup.reverse()) await operation();
	console.error(error.code === "EADDRINUSE" ? "모의 검증 포트 3091이 이미 사용 중입니다." : "MCP 모의 검증 서버를 시작하지 못했습니다.");
	process.exitCode = 1;
}
