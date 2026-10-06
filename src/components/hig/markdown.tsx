import { Fragment, type ReactNode } from "react";

type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of markdown.split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (lines.length === 1 && /^#{2,3}\s/.test(lines[0])) {
      blocks.push({ kind: "heading", level: lines[0].startsWith("###") ? 3 : 2, text: lines[0].replace(/^#{2,3}\s+/, "") });
      continue;
    }
    if (lines.every((line) => line.startsWith("- "))) {
      blocks.push({ kind: "list", items: lines.map((line) => line.slice(2)) });
      continue;
    }
    let paragraph: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      if (list.length) blocks.push({ kind: "list", items: list });
      paragraph = [];
      list = [];
    };
    for (const line of lines) {
      if (/^#{2,3}\s/.test(line)) {
        flush();
        blocks.push({ kind: "heading", level: line.startsWith("###") ? 3 : 2, text: line.replace(/^#{2,3}\s+/, "") });
      } else if (line.startsWith("- ")) {
        if (paragraph.length) {
          blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
          paragraph = [];
        }
        list.push(line.slice(2));
      } else {
        if (list.length) {
          blocks.push({ kind: "list", items: list });
          list = [];
        }
        paragraph.push(line);
      }
    }
    flush();
  }
  return blocks;
}

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1]) {
      nodes.push(
        <strong key={match.index} className="font-semibold text-text">
          {match[1]}
        </strong>,
      );
    } else {
      nodes.push(
        <a key={match.index} href={match[3]} target="_blank" rel="noreferrer nofollow" className="text-tint underline-offset-2 hover:underline">
          {match[2]}
        </a>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className="flex max-w-[68ch] flex-col gap-3 text-body leading-6 text-text-muted">
      {blocks.map((block, index) => (
        <Fragment key={index}>
          {block.kind === "heading" ? (
            block.level === 2 ? (
              <h3 className="mt-2 text-headline text-text">{inline(block.text)}</h3>
            ) : (
              <h4 className="mt-1 text-callout font-semibold text-text">{inline(block.text)}</h4>
            )
          ) : block.kind === "list" ? (
            <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-text-dim">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item)}</li>
              ))}
            </ul>
          ) : (
            <p>{inline(block.text)}</p>
          )}
        </Fragment>
      ))}
    </div>
  );
}
