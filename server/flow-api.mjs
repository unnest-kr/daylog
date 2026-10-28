import { readFlowAnswer } from "./mcp.mjs";
import { request as httpsRequest } from "node:https";
import { readFileSync } from "node:fs";

export function flowApiId(address) {
	try {
		return new URL(address).pathname.match(
			/^\/api\/v1\/run\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\/?$/i,
		)?.[1] ?? null;
	} catch {
		return null;
	}
}

async function request(settings, address, init = {}, signal) {
	const options = {
		...init,
		redirect: "error",
		headers: {
			"content-type": "application/json",
			...(settings.apiKey ? { "x-api-key": settings.apiKey } : {}),
		},
		signal: AbortSignal.any([
			AbortSignal.timeout(init.method === "POST" ? 140_000 : 12_000),
			...(signal ? [signal] : []),
		]),
	};
	const response = settings.caCertFile && new URL(address).protocol === "https:"
		? await requestWithCertificate(address, options, settings.caCertFile)
		: await fetch(address, options);
	if (!response.ok) throw new Error(`Unnestflow Flow API returned HTTP ${response.status}`);
	return response.json();
}

function requestWithCertificate(address, options, certificateFile) {
	return new Promise((resolve, reject) => {
		const req = httpsRequest(address, {
			method: options.method ?? "GET",
			headers: options.headers,
			signal: options.signal,
			ca: readFileSync(certificateFile),
		}, (res) => {
			const chunks = [];
			res.on("data", (chunk) => chunks.push(chunk));
			res.on("error", reject);
			res.on("end", () => resolve({
				ok: res.statusCode >= 200 && res.statusCode < 300,
				status: res.statusCode,
				json: () => JSON.parse(Buffer.concat(chunks).toString("utf8")),
			}));
		});
		req.on("error", reject);
		req.end(options.body);
	});
}

export async function checkFlowApi(settings) {
	const id = flowApiId(settings.mcpUrl);
	if (!id) throw new Error("Invalid Flow execution URL");
	const published = await request(settings, new URL("/api/v1/flows/published", settings.mcpUrl));
	if (!Array.isArray(published)) throw new Error("Invalid published Flow response");
	const flow = published.find((item) => typeof item?.id === "string" && item.id.toLowerCase() === id.toLowerCase());
	if (!flow) throw new Error("The configured Flow is not published or executable by this account");
	return {
		connected: true,
		server: "Unnestflow Flow API",
		tools: [{
			name: flow.name,
			description: flow.description ?? "",
			compatible: true,
		}],
	};
}

export function readFlowApiAnswer(result) {
	const texts = [];
	for (const run of result.outputs ?? []) {
		for (const component of run.outputs ?? []) {
			const messages = (component.messages ?? [])
				.map((message) => message.message)
				.filter((value) => typeof value === "string" && value.trim());
			const values = Object.values(component.results ?? {})
				.map((value) => typeof value === "string" ? value : value?.text)
				.filter((value) => typeof value === "string" && value.trim());
			texts.push(...(messages.length ? messages : values));
		}
	}
	return readFlowAnswer({
		isError: result.isError,
		content: texts.map((text) => ({ type: "text", text })),
	});
}

export async function callFlowApi(settings, input, sessionId, signal) {
	if (!flowApiId(settings.mcpUrl)) throw new Error("Invalid Flow execution URL");
	const result = await request(settings, settings.mcpUrl, {
		method: "POST",
		body: JSON.stringify({
			input_request: {
				input_value: input,
				input_type: "chat",
				output_type: "chat",
				session_id: sessionId,
			},
		}),
	}, signal);
	return readFlowApiAnswer(result);
}
