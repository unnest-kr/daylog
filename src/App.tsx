import { useCallback, useEffect, useRef, useState } from "react";
import {
	ArrowUpRight,
	CalendarDays,
	Check,
	ChevronDown,
	CircleHelp,
	FileText,
	Layers2,
	LoaderCircle,
	MessageSquare,
	Plus,
	Settings2,
	Sparkles,
	UploadCloud,
	X,
} from "lucide-react";
import { api, dateLabel, koreanToday } from "./api";
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
import ChatPanel from "./ChatPanel";
import { ReportDialog, SettingsDialog, UploadDialog } from "./Dialogs";

const emptySettings: Settings = {
	mcpUrl: "",
	toolName: "daily_report_assistant",
	hasApiKey: false,
	flowUrl: "",
};
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
	const [preview, setPreview] = useState<Report | null>(null);
	const [historyOpen, setHistoryOpen] = useState(true);
	const controller = useRef<AbortController | null>(null);
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
	async function previewReport(id: string) {
		try {
			setPreview(await api<Report>(`/api/reports/${id}`));
		} catch (error) {
			setToast(
				error instanceof Error ? error.message : "보고서를 열지 못했습니다.",
			);
		}
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
			setPreview(null);
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
	return (
		<div className="app-shell">
			<aside className="sidebar">
				<a className="brand" href="/" aria-label="Daylog 홈">
					<span className="brand-mark">
						d<span />
					</span>
					<span>
						daylog<small>TEAM WORKSPACE</small>
					</span>
				</a>
				<div className="workspace-label">
					<span className="workspace-avatar">W</span>
					<span>
						우리 팀 워크스페이스<small>공용 업무 보고 공간</small>
					</span>
					<ChevronDown size={13} />
				</div>
				<div className="sidebar-section-label">WORKSPACE</div>
				<button className="nav-item active">
					<Layers2 size={17} />
					보고서와 대화
					<span className="nav-indicator" />
				</button>
				<button
					className="nav-item"
					onClick={() => setUploadOpen(true)}
					disabled={busy}
				>
					<FileText size={17} />새 보고서 올리기
					<Plus size={14} />
				</button>
				<button
					className="sidebar-section-label history-toggle"
					onClick={() => setHistoryOpen(!historyOpen)}
				>
					최근 대화
					<ChevronDown size={12} className={historyOpen ? "" : "collapsed"} />
				</button>
				{historyOpen && (
					<div className="history-list">
						{!conversations.length && (
							<p>
								보고서에 질문하면
								<br />
								대화가 여기에 남아요.
							</p>
						)}
						{conversations.map((conversation) => (
							<button
								className={conversation.id === conversationId ? "current" : ""}
								key={conversation.id}
								onClick={() => void loadConversation(conversation.id)}
								disabled={busy}
							>
								<MessageSquare size={13} />
								<span>{conversation.title}</span>
							</button>
						))}
					</div>
				)}
				<div className="sidebar-bottom">
					<div className="sidebar-note">
						<span className="note-spark">
							<Sparkles size={18} />
						</span>
						<strong>
							기록은 모으고,
							<br />
							맥락은 연결하세요.
						</strong>
						<p>
							매일의 업무가 팀의
							<br />
							다음 액션이 되도록.
						</p>
					</div>
					<button className="nav-item" onClick={() => setSettingsOpen(true)}>
						<Settings2 size={16} />
						연결 설정
					</button>
					<span className="powered">
						CONNECTED WITH <b>Unnestflow</b>
					</span>
				</div>
			</aside>
			<main className="main-shell">
				<header className="topbar">
					<div className="breadcrumb">
						워크스페이스 <span>/</span>
						<strong>일일 업무 보고</strong>
					</div>
					<div className="topbar-right">
						<button
							className={`connection-status ${connection?.connected ? "online" : ""}`}
							onClick={() => setSettingsOpen(true)}
						>
							{connecting ? (
								<LoaderCircle size={12} className="spin" />
							) : (
								<span />
							)}
							{connecting
								? "연결 확인 중"
								: connection?.connected
									? "Unnestflow 연결됨"
									: "연결 확인 필요"}
						</button>
						<span className="topbar-divider" />
						<span className="profile-avatar" title="공용 워크스페이스">
							W
						</span>
					</div>
				</header>
				<div className="page-heading">
					<div>
						<div className="page-kicker">
							<span />
							DAILY WORK, SHARED CONTEXT
						</div>
						<h1>
							일일 업무 보고<span>.</span>
						</h1>
						<p>팀의 오늘을 모으고, 더 나은 내일을 함께 준비하세요.</p>
					</div>
					<button
						className="primary-button upload-main"
						onClick={() => setUploadOpen(true)}
						disabled={busy}
					>
						<Plus size={16} />
						보고서 올리기
					</button>
				</div>
				<div className="filter-bar">
					<div className="department-filters">
						{["전체 부서", ...departments].map((item) => (
							<button
								key={item}
								className={item === department ? "active" : ""}
								onClick={() => filter(item, date)}
								disabled={busy}
							>
								{item}
								<span>
									{
										reports.filter(
											(report) =>
												(item === "전체 부서" || report.department === item) &&
												(!date || report.report_date === date),
										).length
									}
								</span>
							</button>
						))}
					</div>
					<label className="date-filter">
						<CalendarDays size={14} />
						<span>{date ? dateLabel(date) : "전체 기간"}</span>
						<input
							type="date"
							aria-label="보고 날짜 필터"
							value={date}
							disabled={busy}
							onChange={(event) => filter(department, event.target.value)}
						/>
						{date && (
							<button
								aria-label="전체 기간 보기"
								disabled={busy}
								onClick={(event) => {
									event.preventDefault();
									filter(department, "");
								}}
							>
								<X size={12} />
							</button>
						)}
					</label>
				</div>
				{!loaded ? (
					<div className="app-loading">
						<LoaderCircle className="spin" size={24} />
						{error || "워크스페이스를 준비하고 있어요"}
					</div>
				) : (
					<div className="work-area">
						<ReportLibrary
							reports={visible}
							selected={selected}
							onSelection={changeSelection}
							onPreview={(id) => void previewReport(id)}
							onUpload={() => setUploadOpen(true)}
						/>
						<ChatPanel
							reports={selectedReports}
							messages={messages}
							connected={Boolean(connection?.connected)}
							settings={settings}
							busy={busy}
							pendingQuestion={pendingQuestion}
							error={error}
							draft={draft}
							onDraft={setDraft}
							onSend={(question) => void send(question)}
							onStop={() => controller.current?.abort()}
							onPreview={(id) => void previewReport(id)}
							onRemove={(id) =>
								changeSelection(selected.filter((item) => item !== id))
							}
							onNew={newChat}
							onSettings={() => setSettingsOpen(true)}
							onUpload={() => setUploadOpen(true)}
						/>
					</div>
				)}
				<footer className="page-footer">
					<span>
						<span className="tiny-dot" />
						보고서 {reports.length}개 · {departments.length}개 부서 · 선택{" "}
						{selectedReports.length}개
					</span>
					<button
						onClick={() => void samples()}
						disabled={busy || reports.some((report) => report.sample)}
					>
						<CircleHelp size={12} />
						샘플 보고서로 시작하기
						<ArrowUpRight size={11} />
					</button>
				</footer>
			</main>
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
			{preview && (
				<ReportDialog
					report={preview}
					onClose={() => setPreview(null)}
					onDelete={(id) => void removeReport(id)}
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
