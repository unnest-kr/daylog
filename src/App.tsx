import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Plus, Settings2, X } from "lucide-react";
import { api, fullDateLabel, koreanToday } from "./api";
import type {
	Bootstrap,
	Connection,
	Conversation,
	Message,
	Report,
	Settings,
	UploadResult,
} from "./types";
import ReportLibrary from "./ReportLibrary";
import ReportBody from "./ReportBody";
import ChatPanel from "./ChatPanel";
import { SettingsDialog, UploadDialog } from "./Dialogs";

const emptySettings: Settings = {
	mcpUrl: "",
	toolName: "daily_report_assistant",
	hasApiKey: false,
	flowUrl: "",
};
type Tab = "list" | "body" | "chat";
export default function App() {
	const [reports, setReports] = useState<Report[]>([]);
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [settings, setSettings] = useState(emptySettings);
	const [connection, setConnection] = useState<Connection | null>(null);
	const [connecting, setConnecting] = useState(true);
	const [loaded, setLoaded] = useState(false);
	const [selected, setSelected] = useState<string[]>([]);
	const [department, setDepartment] = useState("전체 부서");
	const [date, setDate] = useState(koreanToday());
	const [messages, setMessages] = useState<Message[]>([]);
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [draft, setDraft] = useState("");
	const [pendingQuestion, setPendingQuestion] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [toast, setToast] = useState("");
	const [uploadOpen, setUploadOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [bodies, setBodies] = useState<Record<string, string | null>>({});
	const [focus, setFocus] = useState<{ id: string } | null>(null);
	const [tab, setTab] = useState<Tab>("list");
	const controller = useRef<AbortController | null>(null);
	const requested = useRef(new Set<string>());
	const departments = [
		...new Set(reports.map((report) => report.department)),
	].sort((a, b) => a.localeCompare(b, "ko"));
	const visible = reports.filter(
		(report) =>
			(department === "전체 부서" || report.department === department) &&
			(!date || report.report_date === date),
	);
	const selectedReports = reports.filter((report) =>
		selected.includes(report.id),
	);

	const checkConnection = useCallback(async () => {
		setConnecting(true);
		try {
			setConnection(await api<Connection>("/api/status"));
		} catch {
			setConnection(null);
		} finally {
			setConnecting(false);
		}
	}, []);
	useEffect(() => {
		void api<Bootstrap>("/api/bootstrap")
			.then((data) => {
				setReports(data.reports);
				setConversations(data.conversations);
				setSettings(data.settings);
				setSelected(
					data.reports
						.filter((report) => report.report_date === koreanToday())
						.map((report) => report.id),
				);
				setLoaded(true);
				void checkConnection();
			})
			.catch((error: Error) => {
				setError(error.message);
				setConnecting(false);
			});
		return () => controller.current?.abort();
	}, [checkConnection]);
	useEffect(() => {
		if (toast) {
			const timer = setTimeout(() => setToast(""), 4000);
			return () => clearTimeout(timer);
		}
	}, [toast]);
	// 본문에 표시할 원문은 선택된 보고서만 그때그때 불러온다.
	useEffect(() => {
		for (const report of reports) {
			if (!selected.includes(report.id) || requested.current.has(report.id))
				continue;
			requested.current.add(report.id);
			api<Report>(`/api/reports/${report.id}`)
				.then((data) =>
					setBodies((current) => ({
						...current,
						[report.id]: data.markdown ?? "",
					})),
				)
				.catch(() =>
					setBodies((current) => ({ ...current, [report.id]: null })),
				);
		}
	}, [reports, selected]);
	useEffect(() => {
		if (!focus) return;
		document
			.getElementById(`report-${focus.id}`)
			?.scrollIntoView({ behavior: "smooth", block: "start" });
		const timer = setTimeout(() => setFocus(null), 2000);
		return () => clearTimeout(timer);
	}, [focus]);
	function newChat() {
		if (busy) return;
		setConversationId(null);
		setMessages([]);
		setError("");
		setDraft("");
	}
	function changeSelection(ids: string[]) {
		if (busy) return;
		setSelected(ids);
		newChat();
	}
	function filter(dept: string, nextDate: string) {
		if (busy) return;
		setDepartment(dept);
		setDate(nextDate);
		changeSelection(
			reports
				.filter(
					(report) =>
						(dept === "전체 부서" || report.department === dept) &&
						(!nextDate || report.report_date === nextDate),
				)
				.map((report) => report.id),
		);
	}
	function uploaded(data: UploadResult) {
		setReports(data.reports);
		setConversations(data.conversations);
		setSettings(data.settings);
		setDepartment("전체 부서");
		setDate("");
		changeSelection(data.ids);
		setUploadOpen(false);
		setToast(`${data.ids.length}개의 보고서를 올렸습니다.`);
	}
	function showReport(id: string) {
		if (!selectedReports.some((report) => report.id === id)) {
			setToast("본문에 없는 보고서입니다. 삭제되었을 수 있습니다.");
			return;
		}
		setTab("body");
		setFocus({ id });
	}
	async function loadConversation(id: string) {
		if (busy) return;
		try {
			const data = await api<Conversation>(`/api/conversations/${id}`);
			setDepartment("전체 부서");
			setDate("");
			setSelected(data.report_ids);
			setMessages(data.messages ?? []);
			setConversationId(id);
			setError("");
			setDraft("");
		} catch (error) {
			setToast(
				error instanceof Error ? error.message : "대화를 열지 못했습니다.",
			);
		}
	}
	async function send(question: string) {
		if (busy || !question.trim()) return;
		setBusy(true);
		setError("");
		setPendingQuestion(question);
		setDraft("");
		const abort = new AbortController();
		controller.current = abort;
		try {
			const data = await api<{
				conversation: Conversation;
				conversations: Conversation[];
			}>("/api/chat", {
				method: "POST",
				body: JSON.stringify({ question, reportIds: selected, conversationId }),
				signal: abort.signal,
			});
			setConversationId(data.conversation.id);
			setMessages(data.conversation.messages ?? []);
			setConversations(data.conversations);
		} catch (error) {
			setDraft(question);
			setError(
				abort.signal.aborted
					? "응답 요청을 중단했습니다. 질문은 입력창에 남겨두었습니다."
					: error instanceof Error
						? error.message
						: "답변을 받지 못했습니다.",
			);
		} finally {
			setBusy(false);
			setPendingQuestion("");
			controller.current = null;
		}
	}
	async function removeReport(id: string) {
		try {
			const data = await api<Bootstrap>(`/api/reports/${id}`, {
				method: "DELETE",
			});
			setReports(data.reports);
			requested.current.delete(id);
			setBodies(({ [id]: _removed, ...rest }) => rest);
			changeSelection(selected.filter((item) => item !== id));
			setToast("보고서를 삭제했습니다.");
		} catch (error) {
			setToast(error instanceof Error ? error.message : "삭제하지 못했습니다.");
		}
	}
	async function samples() {
		try {
			uploaded(
				await api<UploadResult>("/api/samples", { method: "POST", body: "{}" }),
			);
			setToast("명확히 표시된 샘플 보고서 4개를 불러왔습니다.");
		} catch (error) {
			setToast(
				error instanceof Error ? error.message : "샘플을 불러오지 못했습니다.",
			);
		}
	}
	const countFor = (item: string) =>
		reports.filter(
			(report) =>
				(item === "전체 부서" || report.department === item) &&
				(!date || report.report_date === date),
		).length;
	return (
		<div className="app">
			<header className="topbar">
				<div className="topbar-left">
					<a className="brand" href="/" aria-label="솔리데이 일일보고 홈">
						솔리데이 <span>/ 일일보고</span>
					</a>
					<span className="topbar-divider" />
					<h1 className="topbar-title">
						{department} 일일보고 · {date ? fullDateLabel(date) : "전체 기간"}
					</h1>
				</div>
				<div className="topbar-right">
					<button
						className={`status-pill ${connecting ? "" : connection?.connected ? "online" : "offline"}`}
						onClick={() => setSettingsOpen(true)}
					>
						{connecting ? (
							<LoaderCircle size={12} className="spin" />
						) : (
							connection?.connected && <Check size={13} strokeWidth={3} />
						)}
						{connecting
							? "연결 확인 중"
							: connection?.connected
								? "Unnestflow 연결됨"
								: "연결 확인 필요"}
					</button>
					<button
						className="header-button primary"
						aria-label="보고서 올리기"
						onClick={() => setUploadOpen(true)}
						disabled={busy}
					>
						<Plus size={15} />
						<span>보고서 올리기</span>
					</button>
					<button
						className="header-button"
						aria-label="연결 설정"
						onClick={() => setSettingsOpen(true)}
					>
						<Settings2 size={15} />
						<span>연결 설정</span>
					</button>
				</div>
			</header>
			<nav className="pane-tabs" aria-label="화면 전환">
				{(
					[
						["list", "목록", visible.length],
						["body", "본문", selectedReports.length],
						["chat", "AI 검토", null],
					] as const
				).map(([value, label, count]) => (
					<button
						key={value}
						className={tab === value ? "active" : ""}
						aria-pressed={tab === value}
						onClick={() => setTab(value)}
					>
						{label}
						{count !== null && <span>{count}</span>}
					</button>
				))}
			</nav>
			{!loaded ? (
				<div className="app-loading">
					<LoaderCircle className="spin" size={24} />
					{error || "워크스페이스를 준비하고 있어요"}
				</div>
			) : (
				<div className={`workspace show-${tab}`}>
					<ReportLibrary
						reports={visible}
						total={reports.length}
						departments={["전체 부서", ...departments].map((name) => ({
							name,
							count: countFor(name),
						}))}
						department={department}
						date={date}
						busy={busy}
						selected={selected}
						onFilter={filter}
						onSelection={changeSelection}
						onShow={showReport}
						onUpload={() => setUploadOpen(true)}
						onSamples={() => void samples()}
					/>
					<ReportBody
						reports={selectedReports}
						bodies={bodies}
						highlighted={focus?.id ?? null}
						total={reports.length}
						busy={busy}
						onDelete={(id) => void removeReport(id)}
						onUpload={() => setUploadOpen(true)}
						onSamples={() => void samples()}
					/>
					<ChatPanel
						reports={selectedReports}
						messages={messages}
						conversations={conversations}
						conversationId={conversationId}
						connected={Boolean(connection?.connected)}
						settings={settings}
						busy={busy}
						pendingQuestion={pendingQuestion}
						error={error}
						draft={draft}
						onDraft={setDraft}
						onSend={(question) => void send(question)}
						onStop={() => controller.current?.abort()}
						onShowReport={showReport}
						onRemove={(id) =>
							changeSelection(selected.filter((item) => item !== id))
						}
						onNew={newChat}
						onLoadConversation={(id) => void loadConversation(id)}
						onSettings={() => setSettingsOpen(true)}
						onUpload={() => setUploadOpen(true)}
					/>
				</div>
			)}
			{uploadOpen && (
				<UploadDialog
					departments={departments}
					onClose={() => setUploadOpen(false)}
					onComplete={uploaded}
				/>
			)}
			{settingsOpen && (
				<SettingsDialog
					settings={settings}
					onClose={() => setSettingsOpen(false)}
					onSave={(saved, result) => {
						setSettings(saved);
						setConnection(result);
						if (result.connected)
							setToast("Unnestflow MCP 연결을 확인했습니다.");
					}}
				/>
			)}
			{toast && (
				<div className="toast" role="status">
					<Check size={15} />
					{toast}
					<button aria-label="알림 닫기" onClick={() => setToast("")}>
						<X size={13} />
					</button>
				</div>
			)}
		</div>
	);
}
