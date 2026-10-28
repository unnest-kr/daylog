import {
	CalendarDays,
	Check,
	ChevronDown,
	FolderOpen,
	Search,
	UploadCloud,
	X,
} from "lucide-react";
import type { Report } from "./types";
import { useState } from "react";
import { dateLabel } from "./api";

interface Props {
	reports: Report[];
	total: number;
	departments: { name: string; count: number }[];
	department: string;
	date: string;
	busy: boolean;
	selected: string[];
	onFilter: (department: string, date: string) => void;
	onSelection: (ids: string[]) => void;
	onShow: (id: string) => void;
	onUpload: () => void;
	onSamples: () => void;
}
export default function ReportLibrary({
	reports,
	total,
	departments,
	department,
	date,
	busy,
	selected,
	onFilter,
	onSelection,
	onShow,
	onUpload,
	onSamples,
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
		<section className="pane library-pane" aria-label="보고서 목록">
			<div className="library-filters">
				<label className="select-filter">
					<select
						aria-label="부서 필터"
						value={department}
						disabled={busy}
						onChange={(event) => onFilter(event.target.value, date)}
					>
						{departments.map((item) => (
							<option key={item.name} value={item.name}>
								{item.name} {item.count}
							</option>
						))}
					</select>
					<ChevronDown size={14} />
				</label>
				<label className="date-filter">
					<CalendarDays size={14} />
					<span>{date ? dateLabel(date) : "전체 기간"}</span>
					<input
						type="date"
						aria-label="보고 날짜 필터"
						value={date}
						disabled={busy}
						onChange={(event) => onFilter(department, event.target.value)}
					/>
					{date && (
						<button
							aria-label="전체 기간 보기"
							disabled={busy}
							onClick={(event) => {
								event.preventDefault();
								onFilter(department, "");
							}}
						>
							<X size={12} />
						</button>
					)}
				</label>
			</div>
			<label className="search-box">
				<Search size={15} />
				<input
					aria-label="보고서 검색"
					placeholder="제목, 부서 검색"
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
				<span>{visible.length}개 보고서</span>
				<button
					disabled={!visible.length || busy}
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
						<FolderOpen size={28} strokeWidth={1.4} />
						<strong>
							{search
								? "검색 결과가 없어요"
								: total
									? "이 조건의 보고서가 없어요"
									: "아직 보고서가 없어요"}
						</strong>
						<p>
							{search
								? "다른 제목이나 부서로 찾아보세요."
								: total
									? "부서나 날짜를 바꿔 보세요."
									: "Markdown 보고서를 올리고\n팀의 하루를 모아보세요."}
						</p>
						{!search && !total && (
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
				{visible.map((report) => {
					const checked = selected.includes(report.id);
					return (
						<div
							className={`report-row ${checked ? "selected" : ""}`}
							key={report.id}
						>
							<label className="report-check">
								<input
									type="checkbox"
									checked={checked}
									disabled={busy}
									onChange={() => toggle(report.id)}
									aria-label={`${report.title} 선택`}
								/>
								<span className="check-visual">
									<Check size={12} strokeWidth={3} />
								</span>
							</label>
							<button
								className="report-row-main"
								disabled={!checked}
								onClick={() => onShow(report.id)}
								title={
									checked
										? `${report.title} · 본문에서 보기`
										: `${report.title} · 선택하면 본문에 표시돼요`
								}
							>
								<span className="department-badge">{report.department}</span>
								<span className="report-row-title">
									{report.title.replace(/^\[샘플\]\s*/, "")}
								</span>
								<time>{report.report_date.slice(5).replace("-", ".")}</time>
							</button>
						</div>
					);
				})}
			</div>
			<p className="library-note">
				선택한 보고서만 대화에 사용돼요.
				<br />
				선택을 바꾸면 새 대화가 시작됩니다.
			</p>
		</section>
	);
}
