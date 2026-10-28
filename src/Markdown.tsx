import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MdNode = {
	type: string;
	value?: string;
	url?: string;
	children?: MdNode[];
};
const referencePattern = /\[(R\d+(?:\s*,\s*R\d+)*)\]/g;

// Some Flow responses insert blank lines between table rows. Keep fenced code intact.
function reviewMarkdown(value: string) {
	const lines = value.split("\n");
	const result: string[] = [];
	let fence: { character: string; length: number } | null = null;
	const tableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
		if (marker) {
			if (!fence) fence = { character: marker[1][0], length: marker[1].length };
			else if (new RegExp(`^ {0,3}${fence.character}{${fence.length},}\\s*$`).test(line)) fence = null;
		}
		if (!fence && !line.trim() && tableRow(result.at(-1) ?? "")) {
			let next = i + 1;
			while (next < lines.length && !lines[next].trim()) next++;
			if (tableRow(lines[next] ?? "")) continue;
		}
		result.push(line);
	}
	return result.join("\n");
}

// 답변의 [R1], [R1, R2] 표기 중 실제 근거에 있는 것만 링크로 바꾼다.
function remarkReferences(references: string[]) {
	function split(value: string): MdNode[] {
		const nodes: MdNode[] = [];
		let last = 0;
		for (const match of value.matchAll(referencePattern)) {
			const index = match.index ?? 0;
			if (index > last)
				nodes.push({ type: "text", value: value.slice(last, index) });
			nodes.push({ type: "text", value: "[" });
			match[1].split(/\s*,\s*/).forEach((reference, i) => {
				if (i) nodes.push({ type: "text", value: ", " });
				nodes.push(
					references.includes(reference)
						? {
								type: "link",
								url: `#ref-${reference}`,
								children: [{ type: "text", value: reference }],
							}
						: { type: "text", value: reference },
				);
			});
			nodes.push({ type: "text", value: "]" });
			last = index + match[0].length;
		}
		if (last < value.length) nodes.push({ type: "text", value: value.slice(last) });
		return nodes;
	}
	function visit(node: MdNode) {
		if (!node.children || node.type === "link") return;
		node.children = node.children.flatMap((child) => {
			if (child.type === "text" && child.value) return split(child.value);
			visit(child);
			return [child];
		});
	}
	return () => (tree: MdNode) => visit(tree);
}

export default function Markdown({
	children,
	references,
	onReference,
}: {
	children: string;
	references?: string[];
	onReference?: (reference: string) => void;
}) {
	return (
		<div className="markdown">
			<ReactMarkdown
				remarkPlugins={
					references && onReference
						? [remarkGfm, remarkReferences(references)]
						: [remarkGfm]
				}
				skipHtml
				components={{
					a: ({ children, href }) =>
						onReference && href?.startsWith("#ref-") ? (
							<button
								type="button"
								className="reference-link"
								title="본문에서 보기"
								onClick={() => onReference(href.slice(5))}
							>
								{children}
							</button>
						) : (
							<a href={href} target="_blank" rel="noopener noreferrer">
								{children}
							</a>
						),
					img: ({ alt }) => (
						<span className="image-placeholder">
							[이미지: {alt ?? "첨부 이미지"}]
						</span>
					),
				}}
			>
				{references?.length ? reviewMarkdown(children) : children}
			</ReactMarkdown>
		</div>
	);
}
