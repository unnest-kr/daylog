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
	fullDateLabel(value).replace(/^\d+\./, "");
export const fullDateLabel = (value: string) => {
	const [year, month, day] = value.split("-").map(Number);
	const weekday = new Intl.DateTimeFormat("ko-KR", {
		weekday: "short",
		timeZone: "Asia/Seoul",
	}).format(new Date(`${value}T12:00:00+09:00`));
	return `${year}.${month}.${day}.(${weekday})`;
};
