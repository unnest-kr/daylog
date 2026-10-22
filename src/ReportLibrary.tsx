import {
	Check,
	FileText,
	Search,
	UploadCloud,
	Eye,
	FolderOpen,
	X,
} from "lucide-react";
import type { Report } from "./types";
import { useState } from "react";

interface Props {
	reports: Report[];
	selected: string[];
	onSelection: (ids: string[]) => void;
	onPreview: (id: string) => void;
	onUpload: () => void;
}
export default function ReportLibrary({
	reports,
	selected,
	onSelection,
	onPreview,
	onUpload,
}: Props) {
	const [search, setSearch] = useState("");
	const visible = reports.filter((report) =>
		`${report.title} ${report.department}`
			.toLowerCase()
			.includes(search.toLowerCase()),
	);
	const allSelected =
		visible.length > 0 &&
		visible.every((report) => selected.includes(report.id));
	function toggle(id: string) {
		onSelection(
			selected.includes(id)
				? selected.filter((item) => item !== id)
				: [...selected, id],
		);
	}
	return (
		<section className="library-panel" aria-label="보고서 라이브러리">
			<div className="panel-heading">
				<h2>
					보고서 라이브러리 <span>{reports.length}</span>
				</h2>
				<button
					className="icon-button"
					title="보고서 올리기"
					aria-label="보고서 올리기"
					onClick={onUpload}
				>
					<UploadCloud size={17} />
				</button>
			</div>
			<label className="search-box">
				<Search size={16} />
				<input
					aria-label="보고서 검색"
					placeholder="보고서 제목, 부서 검색"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
				/>
				{search && (
					<button aria-label="검색 지우기" onClick={() => setSearch("")}>
						<X size={14} />
					</button>
				)}
			</label>
			<div className="selection-toolbar">
				<span>{visible.length}개의 보고서</span>
				<button
					disabled={!visible.length}
					onClick={() =>
						onSelection(
							allSelected
								? selected.filter(
										(id) => !visible.some((report) => report.id === id),
									)
								: [
										...new Set([
											...selected,
											...visible.map((report) => report.id),
										]),
									],
						)
					}
				>
					{allSelected ? "선택 해제" : "전체 선택"}
				</button>
			</div>
			<div className="report-list">
				{!visible.length && (
					<div className="library-empty">
						<FolderOpen size={33} strokeWidth={1.3} />
						<strong>
							{search ? "검색 결과가 없어요" : "아직 보고서가 없어요"}
						</strong>
						<p>
							{search
								? "다른 제목이나 부서로 찾아보세요."
								: "Markdown 보고서를 올리고\n팀의 하루를 모아보세요."}
						</p>
						{!search && (
							<button className="text-link" onClick={onUpload}>
								첫 보고서 올리기 <UploadCloud size={14} />
							</button>
						)}
					</div>
				)}
				{visible.map((report) => (
					<article
						className={`report-card ${selected.includes(report.id) ? "selected" : ""}`}
						key={report.id}
					>
						<label className="report-select">
							<input
								type="checkbox"
								checked={selected.includes(report.id)}
								onChange={() => toggle(report.id)}
								aria-label={`${report.title} 선택`}
							/>
							<span className="check-visual">
								<Check size={12} />
							</span>
							<span className="report-meta">
								<span className="department-badge">{report.department}</span>
								{Boolean(report.sample) && (
									<span className="sample-badge">샘플</span>
								)}
							</span>
							<time>{report.report_date.slice(5).replace("-", ".")}</time>
						</label>
						<button
							className="report-title"
							onClick={() => onPreview(report.id)}
						>
							{report.title.replace(/^\[샘플\]\s*/, "")}
						</button>
						<p>
							{report.preview
								.replace(/[#*`>\-]/g, "")
								.replace(/\n/g, " ")
								.trim()}
						</p>
						<div className="report-card-footer">
							<span>
								<FileText size={12} />
								{report.filename}
							</span>
							<button
								aria-label={`${report.title} 미리보기`}
								onClick={() => onPreview(report.id)}
							>
								<Eye size={14} />
							</button>
						</div>
					</article>
				))}
			</div>
			<div className="library-bottom">
				<span className="tiny-dot" />
				<p>
					선택한 보고서만 대화에 사용돼요.
					<br />
					선택을 바꾸면 새 대화가 시작됩니다.
				</p>
			</div>
		</section>
	);
}
