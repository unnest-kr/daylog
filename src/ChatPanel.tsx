import {
	ArrowRight,
	ChevronDown,
	FileText,
	MessageSquare,
	Square,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";
import type { Conversation, Message, Report, Settings } from "./types";

interface Props {
	reports: Report[];
	messages: Message[];
	conversations: Conversation[];
	conversationId: string | null;
	connected: boolean;
	settings: Settings;
	busy: boolean;
	pendingQuestion: string;
	error: string;
	draft: string;
	onDraft: (text: string) => void;
	onSend: (text: string) => void;
	onStop: () => void;
	onShowReport: (id: string) => void;
	onRemove: (id: string) => void;
	onNew: () => void;
	onLoadConversation: (id: string) => void;
	onSettings: () => void;
	onUpload: () => void;
}
const suggestions = [
	{
		title: "오늘의 핵심 업무",
		question: "부서별로 오늘 완료한 핵심 업무를 간결하게 요약해 줘.",
	},
	{
		title: "리스크와 협업 요청",
		question: "보고서에서 일정 지연 위험과 부서 간 협업 요청을 찾아 정리해 줘.",
	},
	{
		title: "내일의 우선순위",
		question: "보고서를 바탕으로 내일 우선 처리할 업무와 그 이유를 정리해 줘.",
	},
];
export default function ChatPanel(props: Props) {
	const {
		reports,
		messages,
		conversations,
		conversationId,
		connected,
		settings,
		busy,
		pendingQuestion,
		error,
		draft,
	} = props;
	const end = useRef<HTMLDivElement>(null);
	const historyMenu = useRef<HTMLDivElement>(null);
	const [historyOpen, setHistoryOpen] = useState(false);
	useEffect(() => {
		if (!messages.length && !pendingQuestion && !error)
			end.current?.parentElement?.scrollTo({ top: 0 });
		else end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
	}, [messages, pendingQuestion, error]);
	useEffect(() => {
		if (!historyOpen) return;
		const close = (event: MouseEvent | KeyboardEvent) => {
			if (
				event instanceof KeyboardEvent
					? event.key === "Escape"
					: !historyMenu.current?.contains(event.target as Node)
			)
				setHistoryOpen(false);
		};
		document.addEventListener("mousedown", close);
		document.addEventListener("keydown", close);
		return () => {
			document.removeEventListener("mousedown", close);
			document.removeEventListener("keydown", close);
		};
	}, [historyOpen]);
	const canSend = connected && reports.length > 0 && !busy;
	return (
		<aside className="pane chat-pane" aria-label="AI 검토 대화">
			<div className="chat-header">
				<div className="chat-title">
					<span className="ai-mark">AI</span>
					<div>
						<strong>AI 검토</strong>
						<span>
							선택한 보고서 {reports.length}개 ·{" "}
							{settings.toolName || "Unnestflow MCP"}
						</span>
					</div>
				</div>
				<div className="chat-header-actions">
					<div className="history-menu" ref={historyMenu}>
						<button
							className="text-button"
							aria-expanded={historyOpen}
							aria-haspopup="true"
							onClick={() => setHistoryOpen(!historyOpen)}
						>
							최근 대화
							<ChevronDown size={14} className={historyOpen ? "flipped" : ""} />
						</button>
						{historyOpen && (
							<div className="history-popover">
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
										disabled={busy}
										onClick={() => {
											setHistoryOpen(false);
											props.onLoadConversation(conversation.id);
										}}
									>
										<MessageSquare size={13} />
										<span>{conversation.title}</span>
									</button>
								))}
							</div>
						)}
					</div>
					<button className="text-button" onClick={props.onNew} disabled={busy}>
						새 대화
					</button>
				</div>
			</div>
			<div className="context-bar">
				<div className="context-label">
					<FileText size={13} />
					<span>
						대화 컨텍스트 <b>{reports.length}</b>
					</span>
				</div>
				<div className="context-chips">
					{!reports.length && (
						<span className="no-context">목록에서 보고서를 선택해 주세요</span>
					)}
					{reports.map((report) => (
						<span className="context-chip" key={report.id}>
							<button
								onClick={() => props.onShowReport(report.id)}
								title={`${report.title} · 본문에서 보기`}
							>
								{report.department} · {report.title.replace(/^\[샘플\]\s*/, "")}
							</button>
							<button
								aria-label={`${report.title} 컨텍스트 제외`}
								disabled={busy}
								onClick={() => props.onRemove(report.id)}
							>
								<X size={11} />
							</button>
						</span>
					))}
				</div>
			</div>
			<div className="chat-scroll">
				{!messages.length && !busy && (
					<div className="chat-row bot">
						<span className="ai-mark small">AI</span>
						<div className="bot-bubble">
							{!connected ? (
								<>
									<p>
										Unnestflow 연결을 먼저 확인해 주세요. 연결되면 선택한
										보고서를 함께 볼 수 있어요.
									</p>
									<div className="chip-row">
										<button className="chip primary" onClick={props.onSettings}>
											연결 설정
										</button>
									</div>
								</>
							) : !reports.length ? (
								<>
									<p>목록에서 보고서를 선택하면 대화를 시작할 수 있어요.</p>
									<div className="chip-row">
										<button className="chip" onClick={props.onUpload}>
											보고서 올리기
										</button>
									</div>
								</>
							) : (
								<>
									<p>
										선택한 보고서 {reports.length}개를 함께 볼게요. 무엇을
										정리해 드릴까요?
									</p>
									<div className="chip-row">
										{suggestions.map(({ title, question }, index) => (
											<button
												key={title}
												className={`chip ${index === 0 ? "primary" : ""}`}
												disabled={!canSend}
												onClick={() => props.onSend(question)}
											>
												{title}
											</button>
										))}
									</div>
								</>
							)}
						</div>
					</div>
				)}
				{messages.map((message) =>
					message.role === "user" ? (
						<div className="chat-row user" key={message.id}>
							<div className="user-bubble">{message.content}</div>
						</div>
					) : (
						<div className="chat-row bot" key={message.id}>
							<span className="ai-mark small">AI</span>
							<div className="bot-bubble">
								<Markdown
									references={message.sources.map((source) => source.reference)}
									onReference={(reference) => {
										const source = message.sources.find(
											(item) => item.reference === reference,
										);
										if (source) props.onShowReport(source.id);
									}}
								>
									{message.content}
								</Markdown>
								{message.sources.length > 0 && (
									<div className="source-links">
										<span>본문에서 보기 ↗</span>
										{message.sources.map((source) => (
											<button
												key={source.id}
												onClick={() => props.onShowReport(source.id)}
												title={`${source.title} · ${source.report_date}`}
											>
												<b>{source.reference}</b>
												{source.department}
											</button>
										))}
									</div>
								)}
							</div>
						</div>
					),
				)}
				{busy && (
					<>
						<div className="chat-row user">
							<div className="user-bubble">{pendingQuestion}</div>
						</div>
						<div className="chat-row bot">
							<span className="ai-mark small">AI</span>
							<div className="bot-bubble">
								<div className="thinking" role="status">
									<span className="thinking-dots">
										<i />
										<i />
										<i />
									</span>
									Flow가 보고서를 검토하고 있어요
								</div>
							</div>
						</div>
					</>
				)}
				{error && (
					<div className="chat-error" role="alert">
						{error}
					</div>
				)}
				<div ref={end} />
			</div>
			<form
				className="composer"
				onSubmit={(event) => {
					event.preventDefault();
					if (canSend && draft.trim()) props.onSend(draft);
				}}
			>
				<div className="composer-row">
					<input
						type="text"
						aria-label="업무 보고서에 질문하기"
						placeholder={
							reports.length
								? "선택한 보고서에 대해 궁금한 걸 물어보세요"
								: "보고서를 선택하면 대화를 시작할 수 있어요"
						}
						value={draft}
						maxLength={4000}
						disabled={busy}
						onChange={(event) => props.onDraft(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && event.nativeEvent.isComposing)
								event.preventDefault();
						}}
					/>
					{busy ? (
						<button
							type="button"
							className="send-button"
							aria-label="응답 중단"
							onClick={props.onStop}
						>
							<Square size={14} />
						</button>
					) : (
						<button
							className="send-button"
							aria-label="질문 보내기"
							disabled={!canSend || !draft.trim()}
						>
							<ArrowRight size={18} />
						</button>
					)}
				</div>
				<p className="composer-note">
					선택한 보고서와 질문이 Unnestflow로 전달됩니다.
				</p>
			</form>
		</aside>
	);
}
