import { Fragment } from "react";
import { FileText, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import { fullDateLabel } from "./api";
import Markdown from "./Markdown";
import type { Report } from "./types";

interface Props {
	reports: Report[];
	bodies: Record<string, string | null>;
	highlighted: string | null;
	total: number;
	busy: boolean;
	onDelete: (id: string) => void;
	onUpload: () => void;
	onSamples: () => void;
}
export default function ReportBody({
	reports,
	bodies,
	highlighted,
	total,
	busy,
	onDelete,
	onUpload,
	onSamples,
}: Props) {
	return (
		<main className="pane document-pane" aria-label="보고서 본문">
			{!reports.length && (
				<div className="document-empty">
					<FileText size={30} strokeWidth={1.3} />
					<strong>
						{total ? "선택한 보고서가 없어요" : "아직 올린 보고서가 없어요"}
					</strong>
					<p>
						{total
							? "목록에서 보고서를 체크하면 본문이 여기에 이어서 표시돼요."
							: "Markdown 보고서를 올리거나 샘플 보고서로 시작해 보세요."}
					</p>
					{!total && (
						<div className="empty-actions">
							<button className="chip primary" onClick={onUpload}>
								<UploadCloud size={14} />
								보고서 올리기
							</button>
							<button className="chip" onClick={onSamples} disabled={busy}>
								샘플 보고서로 시작하기
							</button>
						</div>
					)}
				</div>
			)}
			{reports.map((report, index) => (
				<Fragment key={report.id}>
					{index > 0 && <hr className="document-divider" />}
					<section
						id={`report-${report.id}`}
						className={`document-section ${highlighted === report.id ? "highlighted" : ""}`}
						aria-label={report.title}
					>
						<header className="document-header">
							<span className="department-badge">{report.department}</span>
							<h2>{report.title.replace(/^\[샘플\]\s*/, "")}</h2>
							<span className="document-date">
								{fullDateLabel(report.report_date)}
							</span>
							{Boolean(report.sample) && (
								<span className="sample-badge">샘플</span>
							)}
							<span className="document-actions">
								<span className="document-file">
									{report.filename} · {report.characters.toLocaleString()}자
								</span>
								<button
									className="delete-button"
									disabled={busy}
									onClick={() => {
										if (
											window.confirm(
												`“${report.title}” 보고서를 삭제할까요? 기존 대화의 원문을 다시 열 수 없게 됩니다.`,
											)
										)
											onDelete(report.id);
									}}
								>
									<Trash2 size={13} />
									삭제
								</button>
							</span>
						</header>
						{bodies[report.id] === undefined ? (
							<div className="document-loading" role="status">
								<LoaderCircle size={15} className="spin" />
								본문을 불러오고 있어요
							</div>
						) : bodies[report.id] === null ? (
							<div className="inline-error" role="alert">
								본문을 불러오지 못했습니다. 삭제되었을 수 있습니다.
							</div>
						) : (
							<Markdown>{bodies[report.id] ?? ""}</Markdown>
						)}
					</section>
				</Fragment>
			))}
		</main>
	);
}
