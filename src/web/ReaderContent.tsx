import { ImageOff } from "lucide-react";
import { memo, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { readerImageUrl, readerMarkdown, readerUrl } from "./lib/reader-markdown";

const ReaderContent = memo(function ReaderContent({
	content,
	url,
	title,
	showImages,
}: {
	content: string;
	url: string;
	title: string;
	showImages: boolean;
}) {
	const markdown = useMemo(() => readerMarkdown(content, url, title), [content, url, title]);
	const components = useMemo<Components>(
		() => ({
			a: ({ href, children, title }) =>
				href ? (
					<a href={href} title={title} target="_blank" rel="noopener noreferrer">
						{children}
					</a>
				) : (
					<span>{children}</span>
				),
			img: ({ src, alt, title }) =>
				showImages && src ? (
					<ContentImage key={src} src={src} alt={alt ?? ""} title={title} />
				) : null,
			table: ({ children }) => (
				<section className="reader-table" aria-label="数据表格">
					<table>{children}</table>
				</section>
			),
		}),
		[showImages],
	);
	return (
		<div className="prose">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={components}
				skipHtml
				urlTransform={(value, property) =>
					property === "src" ? readerImageUrl(value, url) : readerUrl(value, url)
				}
			>
				{markdown}
			</ReactMarkdown>
		</div>
	);
});

function ContentImage({ src, alt, title }: { src: string; alt: string; title?: string }) {
	const [failed, setFailed] = useState(false);
	return failed ? (
		<span className="reader-image-unavailable" role="img" aria-label={alt || "图片暂不可用"}>
			<ImageOff size={18} aria-hidden="true" />
			{alt || "图片暂不可用"}
		</span>
	) : (
		<img
			src={src}
			alt={alt}
			title={title}
			loading="lazy"
			decoding="async"
			referrerPolicy="no-referrer"
			onError={() => setFailed(true)}
		/>
	);
}

export default ReaderContent;
