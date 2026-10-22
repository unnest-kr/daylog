import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Markdown({ children }: { children: string }) {
	return (
		<div className="markdown">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				skipHtml
				components={{
					a: ({ children, href }) => (
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
				{children}
			</ReactMarkdown>
		</div>
	);
}
