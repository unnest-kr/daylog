import { useEffect, useRef, useState, type ReactNode } from "react";
import {
	AlertCircle,
	ArrowUpRight,
	CheckCircle2,
	FileText,
	Link2,
	LoaderCircle,
	UploadCloud,
	X,
} from "lucide-react";
import { api, koreanToday } from "./api";
import Markdown from "./Markdown";
import type { Connection, Settings, UploadResult } from "./types";

export function Modal({
	children,
	onClose,
	className = "",
}: {
	children: ReactNode;
	onClose: () => void;
	className?: string;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		dialog.current?.showModal();
	}, []);
	return (
		<dialog
			ref={dialog}
			className={`modal ${className}`}
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div className="modal-content">
				{children}
				<button
					className="modal-close icon-button"
					aria-label="닫기"
					onClick={onClose}
				>
					<X size={19} />
				</button>
			</div>
		</dialog>
	);
}

type DraftFile = { filename: string; title: string; markdown: string };
export function UploadDialog({
	departments,
	onClose,
	onComplete,
}: {
	departments: string[];
	onClose: () => void;
	onComplete: (result: UploadResult) => void;
}) {
	const [mode, setMode] = useState<"file" | "write">("file");
	const [department, setDepartment] = useState(departments[0] ?? "개발팀");
	const [date, setDate] = useState(koreanToday());
	const [files, setFiles] = useState<DraftFile[]>([]);
	const [title, setTitle] = useState("");
	const [markdown, setMarkdown] = useState("");
	const [preview, setPreview] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const input = useRef<HTMLInputElement>(null);
	async function readFiles(selected: FileList | File[]) {
		setError("");
		try {
			if (selected.length > 10)
				throw Error("한 번에 10개까지 올릴 수 있습니다.");
			const result = await Promise.all(
				Array.from(selected).map(async (file) => {
					if (!/\.(md|markdown)$/i.test(file.name))
						throw Error("Markdown(.md, .markdown) 파일을 선택해 주세요.");
					if (file.size > 200_000)
						throw Error(`${file.name}: 파일 한 개는 200KB까지 가능합니다.`);
					const body = new TextDecoder("utf-8", { fatal: true }).decode(
						await file.arrayBuffer(),
					);
					return {
						filename: file.name,
						title:
							body.match(/^#\s+(.+)$/m)?.[1] ??
							file.name.replace(/\.(md|markdown)$/i, ""),
						markdown: body,
					};
				}),
			);
			setFiles(result);
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "파일을 읽지 못했습니다.",
			);
		}
	}
	async function submit() {
		setError("");
		setBusy(true);
		try {
			const drafts =
				mode === "file"
					? files
					: [{ filename: "업무보고.md", title, markdown }];
			const result = await api<UploadResult>("/api/reports", {
				method: "POST",
				body: JSON.stringify({
					reports: drafts.map((file) => ({
						...file,
						department,
						report_date: date,
					})),
				}),
			});
			onComplete(result);
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "보고서를 올리지 못했습니다.",
			);
		} finally {
			setBusy(false);
		}
	}
	return (
		<Modal
			onClose={() => {
				if (!busy) onClose();
			}}
			className="upload-modal"
		>
			<span className="modal-symbol">
				<UploadCloud size={23} />
			</span>
			<h2>보고서 올리기</h2>
			<p className="modal-description">
				팀의 하루를 Markdown으로 기록하고, 대화의 맥락으로 연결하세요.
			</p>
			<div className="form-row">
				<label>
					부서
					<input
						list="department-options"
						value={department}
						onChange={(event) => setDepartment(event.target.value)}
						maxLength={50}
						required
					/>
					<datalist id="department-options">
						{[
							...new Set([
								...departments,
								"개발팀",
								"마케팅팀",
								"영업팀",
								"경영지원팀",
							]),
						].map((item) => (
							<option key={item} value={item} />
						))}
					</datalist>
				</label>
				<label>
					보고 날짜
					<input
						type="date"
						value={date}
						onChange={(event) => setDate(event.target.value)}
						required
					/>
				</label>
			</div>
			<div className="tabs">
				<button
					className={mode === "file" ? "active" : ""}
					onClick={() => setMode("file")}
				>
					파일 업로드
				</button>
				<button
					className={mode === "write" ? "active" : ""}
					onClick={() => setMode("write")}
				>
					직접 작성
				</button>
			</div>
			{mode === "file" ? (
				<>
					<button
						className="drop-zone"
						onClick={() => input.current?.click()}
						onDragOver={(event) => event.preventDefault()}
						onDrop={(event) => {
							event.preventDefault();
							void readFiles(event.dataTransfer.files);
						}}
					>
						<UploadCloud size={30} strokeWidth={1.3} />
						<strong>Markdown 파일을 여기에 놓아주세요</strong>
						<span>또는 클릭해서 파일 선택 · 최대 10개 / 각 200KB</span>
					</button>
					<input
						ref={input}
						type="file"
						accept=".md,.markdown"
						multiple
						hidden
						aria-label="Markdown 파일 선택"
						onChange={(event) => {
							if (event.target.files) void readFiles(event.target.files);
						}}
					/>
					<div className="file-drafts">
						{files.map((file, index) => (
							<label key={file.filename}>
								<FileText size={16} />
								<input
									aria-label={`${file.filename} 제목`}
									value={file.title}
									maxLength={160}
									onChange={(event) =>
										setFiles(
											files.map((item, i) =>
												i === index
													? { ...item, title: event.target.value }
													: item,
											),
										)
									}
								/>
								<small>{file.filename}</small>
								<button
									className="icon-button"
									aria-label={`${file.filename} 제외`}
									onClick={() => setFiles(files.filter((_, i) => i !== index))}
								>
									<X size={14} />
								</button>
							</label>
						))}
					</div>
				</>
			) : (
				<>
					<label className="field">
						보고서 제목
						<input
							placeholder="예: 10월 21일 개발팀 업무 보고"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							maxLength={160}
						/>
					</label>
					<div className="editor-heading">
						<span>
							보고 내용 <small>Markdown</small>
						</span>
						<button className="text-link" onClick={() => setPreview(!preview)}>
							{preview ? "편집하기" : "미리보기"}
						</button>
					</div>
					{preview ? (
						<div className="editor-preview">
							<Markdown>{markdown || "아직 작성한 내용이 없습니다."}</Markdown>
						</div>
					) : (
						<textarea
							className="markdown-editor"
							aria-label="Markdown 보고 내용"
							placeholder={
								"# 오늘의 업무 보고\n\n## 완료한 일\n- \n\n## 진행 중 / 리스크\n- \n\n## 내일 계획\n- "
							}
							value={markdown}
							onChange={(event) => setMarkdown(event.target.value)}
							maxLength={200_000}
						/>
					)}
				</>
			)}
			{error && (
				<div className="inline-error" role="alert">
					<AlertCircle size={15} />
					{error}
				</div>
			)}
			<div className="modal-footer">
				<span>보고서는 서버 볼륨에 보관됩니다.</span>
				<button
					className="primary-button"
					disabled={
						busy ||
						!department.trim() ||
						!date ||
						(mode === "file"
							? !files.length
							: !title.trim() || !markdown.trim())
					}
					onClick={() => void submit()}
				>
					{busy ? (
						<LoaderCircle size={15} className="spin" />
					) : (
						<UploadCloud size={15} />
					)}
					보고서 올리기
				</button>
			</div>
		</Modal>
	);
}

export function SettingsDialog({
	settings,
	onClose,
	onSave,
}: {
	settings: Settings;
	onClose: () => void;
	onSave: (settings: Settings, connection: Connection) => void;
}) {
	const [url, setUrl] = useState(settings.mcpUrl);
	const [tool, setTool] = useState(settings.toolName);
	const [connection, setConnection] = useState<Connection | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	async function save() {
		setBusy(true);
		setError("");
		try {
			const saved = await api<Settings>("/api/settings", {
				method: "PUT",
				body: JSON.stringify({ mcpUrl: url, toolName: tool }),
			});
			const result = await api<Connection>("/api/status");
			setConnection(result);
			onSave(saved, result);
			if (!result.connected)
				setError(
					"서버에 연결했지만 선택한 Flow를 찾지 못했습니다. 아래 목록에서 선택해 주세요.",
				);
		} catch (error) {
			setError(error instanceof Error ? error.message : "연결하지 못했습니다.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<Modal
			onClose={() => {
				if (!busy) onClose();
			}}
			className="settings-modal"
		>
			<span className="modal-symbol">
				<Link2 size={22} />
			</span>
			<h2>Unnestflow 연결</h2>
			<p className="modal-description">
				Unnestflow의 Flow 실행 API 또는 MCP에 연결해,
				<br />
				Daylog 서버가 선택한 보고서와 질문을 전달합니다.
			</p>
			<label className="field">
				Unnestflow 연결 주소
				<input
					value={url}
					onChange={(event) => setUrl(event.target.value)}
					placeholder="http://127.0.0.1:7860/api/v1/run/Flow-ID"
				/>
			</label>
			<label className="field">
				Flow 이름 / MCP 도구 이름
				{connection?.tools.length ? (
					<select
						value={tool}
						onChange={(event) => setTool(event.target.value)}
					>
						{connection.tools.map((item) => (
							<option
								key={item.name}
								value={item.name}
								disabled={!item.compatible}
							>
								{item.name}
								{!item.compatible ? " (보고서·대화 입력 미지원)" : ""}
							</option>
						))}
					</select>
				) : (
					<input
						value={tool}
						onChange={(event) => setTool(event.target.value)}
						placeholder="daily_report_assistant"
					/>
				)}
			</label>
			<div className="credential-note">
				<CheckCircle2 size={16} />
				<div>
					<strong>
						{settings.hasApiKey
							? "API 키가 서버에 설정되어 있습니다"
							: "서버 API 키가 설정되지 않았습니다"}
					</strong>
					<p>
						키는 브라우저에 저장하거나 반환하지 않습니다. 변경은 서버의{" "}
						<code>UNNESTFLOW_API_KEY</code> 설정에서 할 수 있습니다.
					</p>
				</div>
			</div>
			{settings.flowUrl && (
				<a
					className="flow-editor-link"
					href={settings.flowUrl}
					target="_blank"
					rel="noreferrer"
				>
					Unnestflow에서 Flow 보기 <ArrowUpRight size={14} />
				</a>
			)}
			{error && (
				<div className="inline-error" role="alert">
					{error}
				</div>
			)}
			{connection?.connected && (
				<div className="success-note">
					<CheckCircle2 size={16} />
					연결과 도구 목록을 확인했습니다. 실제 답변은 질문을 보내 확인해 주세요.
				</div>
			)}
			<div className="modal-footer">
				<button className="secondary-button" onClick={onClose} disabled={busy}>
					닫기
				</button>
				<button
					className="primary-button"
					disabled={busy || !url || !tool}
					onClick={() => void save()}
				>
					{busy ? (
						<LoaderCircle size={15} className="spin" />
					) : (
						<Link2 size={15} />
					)}
					저장하고 연결 확인
				</button>
			</div>
		</Modal>
	);
}
