export async function api<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, {
		...init,
		headers: { "content-type": "application/json", ...init?.headers },
	});
	const data = await response.json();
	if (!response.ok)
		throw new Error(data.error ?? "요청을 처리하지 못했습니다.");
	return data;
}

export const koreanToday = () =>
	new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
		new Date(),
	);
export const dateLabel = (value: string) =>
	new Intl.DateTimeFormat("ko-KR", {
		month: "long",
		day: "numeric",
		weekday: "short",
		timeZone: "Asia/Seoul",
	}).format(new Date(`${value}T12:00:00+09:00`));
