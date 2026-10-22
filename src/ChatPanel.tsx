import {
	ArrowUp,
	BookOpen,
	Bot,
	Check,
	Copy,
	FileText,
	Plus,
	Sparkles,
	Square,
	User,
	X,
	ArrowUpRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";
import type { Message, Report, Settings } from "./types";

interface Props {
	reports: Report[];
	messages: Message[];
	connected: boolean;
	settings: Settings;
	busy: boolean;
	pendingQuestion: string;
	error: string;
	draft: string;
	onDraft: (text: string) => void;
	onSend: (text: string) => void;
	onStop: () => void;
	onPreview: (id: string) => void;
	onRemove: (id: string) => void;
	onNew: () => void;
	onSettings: () => void;
	onUpload: () => void;
}
const suggestions = [
	{
		icon: BookOpen,
		title: "오늘의 핵심 업무",
		question: "부서별로 오늘 완료한 핵심 업무를 간결하게 요약해 줘.",
	},
	{
		icon: Sparkles,
		title: "리스크와 협업 요청",
		question: "보고서에서 일정 지연 위험과 부서 간 협업 요청을 찾아 정리해 줘.",
	},
	{
		icon: ArrowUpRight,
		title: "내일의 우선순위",
		question: "보고서를 바탕으로 내일 우선 처리할 업무와 그 이유를 정리해 줘.",
	},
];
export default function ChatPanel(props: Props) {
	const {
		reports,
		messages,
		connected,
		settings,
		busy,
		pendingQuestion,
		error,
		draft,
	} = props;
	const end = useRef<HTMLDivElement>(null);
	const [copied, setCopied] = useState("");
	useEffect(() => {
		if (!messages.length && !pendingQuestion && !error)
			end.current?.parentElement?.scrollTo({ top: 0 });
		else end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
	}, [messages, pendingQuestion, error]);
	async function copy(id: string, content: string) {
		try {
			await navigator.clipboard.writeText(content);
			setCopied(id);
			setTimeout(() => setCopied(""), 1800);
		} catch {
			setCopied("");
		}
	}
	const canSend = connected && reports.length > 0 && !busy;
	return (
		<section className="chat-panel" aria-label="보고서와 대화">
			<div className="chat-heading">
				<span className="assistant-icon">
					<Sparkles size={20} />
				</span>
				<div>
					<h2>업무 보고 어시스턴트</h2>
					<p>흩어진 업무에서, 함께 봐야 할 맥락을 찾습니다.</p>
				</div>
				<button
					className="new-chat icon-button"
					aria-label="새 대화"
					title="새 대화"
					onClick={props.onNew}
					disabled={busy}
				>
					<Plus size={18} />
				</button>
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
						<span className="no-context">왼쪽에서 보고서를 선택해 주세요</span>
					)}
					{reports.map((report) => (
						<span className="context-chip" key={report.id}>
							<button
								onClick={() => props.onPreview(report.id)}
								title={report.title}
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
					<div className="chat-welcome">
						<div className="welcome-symbol">
							<Sparkles size={33} strokeWidth={1.25} />
							<i />
							<i />
						</div>
						<span className="eyebrow">YOUR TEAM, IN CONTEXT</span>
						<h3>
							팀의 하루에
							<br />
							<em>좋은 질문</em>을 더해보세요.
						</h3>
						<p>
							부서별 보고서를 함께 읽고 핵심 업무부터
							<br />
							놓치기 쉬운 리스크까지 정리해 드릴게요.
						</p>
						<div className="suggestion-grid">
							{suggestions.map(({ icon: Icon, title, question }) => (
								<button
									key={title}
									disabled={!canSend}
									onClick={() => props.onSend(question)}
								>
									<Icon size={17} />
									<span>{title}</span>
									<ArrowUpRight size={14} />
								</button>
							))}
						</div>
						{!connected && (
							<button className="connection-prompt" onClick={props.onSettings}>
								Unnestflow 연결을 확인해 주세요 <ArrowUpRight size={13} />
							</button>
						)}
						{connected && !reports.length && (
							<button className="connection-prompt" onClick={props.onUpload}>
								보고서를 올려 대화를 시작해 보세요 <ArrowUpRight size={13} />
							</button>
						)}
					</div>
				)}
				<div className="messages">
					{messages.map((message) => (
						<div className={`message ${message.role}`} key={message.id}>
							{message.role === "assistant" && (
								<div className="message-avatar">
									<Sparkles size={16} />
								</div>
							)}
							<div className="message-body">
								{message.role === "assistant" && (
									<div className="message-name">
										Daylog <span>Unnestflow Flow</span>
									</div>
								)}
								{message.role === "assistant" ? (
									<Markdown>{message.content}</Markdown>
								) : (
									<div className="user-bubble">{message.content}</div>
								)}
								{message.role === "assistant" && (
									<>
										<div className="answer-sources">
											<span>
												<BookOpen size={12} />
												전달한 근거 자료
											</span>
											{message.sources.map((source) => (
												<button
													key={source.id}
													onClick={() => props.onPreview(source.id)}
													title={`${source.title} · ${source.report_date}`}
												>
													<b>{source.reference}</b>
													{source.department}
													<ArrowUpRight size={10} />
												</button>
											))}
										</div>
										<button
											className="copy-answer"
											aria-label="답변 복사"
											onClick={() => copy(message.id, message.content)}
										>
											{copied === message.id ? (
												<Check size={12} />
											) : (
												<Copy size={12} />
											)}{" "}
											{copied === message.id ? "복사됨" : "답변 복사"}
										</button>
									</>
								)}
							</div>
							{message.role === "user" && (
								<span className="user-avatar">
									<User size={15} />
								</span>
							)}
						</div>
					))}
				</div>
				{busy && (
					<div className="messages">
						<div className="message user">
							<div className="user-bubble">{pendingQuestion}</div>
							<span className="user-avatar">
								<User size={15} />
							</span>
						</div>
						<div className="message assistant">
							<div className="message-avatar">
								<Sparkles size={16} />
							</div>
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
				)}
				{error && (
					<div className="inline-error" role="alert">
						{error}
					</div>
				)}
				<div ref={end} />
			</div>
			<form
				className="composer-area"
				onSubmit={(event) => {
					event.preventDefault();
					if (canSend && draft.trim()) props.onSend(draft);
				}}
			>
				<div className={`composer ${busy ? "busy" : ""}`}>
					<textarea
						aria-label="업무 보고서에 질문하기"
						placeholder={
							reports.length
								? "선택한 보고서에 대해 무엇이든 물어보세요"
								: "보고서를 선택하면 대화를 시작할 수 있어요"
						}
						value={draft}
						maxLength={4000}
						disabled={busy}
						onChange={(event) => props.onDraft(event.target.value)}
						onKeyDown={(event) => {
							if (
								event.key === "Enter" &&
								!event.shiftKey &&
								!event.nativeEvent.isComposing
							) {
								event.preventDefault();
								if (canSend && draft.trim()) props.onSend(draft);
							}
						}}
					/>
					<div className="composer-actions">
						<span>
							<Bot size={13} />
							{settings.toolName || "Unnestflow MCP"}
						</span>
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
								<ArrowUp size={19} />
							</button>
						)}
					</div>
				</div>
				<p className="composer-note">
					선택한 보고서와 질문이 Unnestflow로 전달됩니다.{" "}
					<span>Enter 전송 · Shift + Enter 줄바꿈</span>
				</p>
			</form>
		</section>
	);
}
