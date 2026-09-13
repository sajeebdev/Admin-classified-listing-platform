import { useRef, useState } from "react";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  /** Uploads the file via the existing blog image endpoint and returns its real URL — see `uploadBlogImage` in lib/blog.ts. Never a second upload pipeline. */
  onUploadImage: (file: File) => Promise<string>;
}

/**
 * A minimal formatting toolbar over the plain content textarea — inserts
 * Markdown syntax around the current selection/cursor, nothing more. No
 * WYSIWYG editor dependency (TipTap/Slate/Quill/etc.) was added: this is
 * the same "type snippets into a plain textarea" pattern GitHub's own
 * comment-box toolbar uses, and it's enough to cover every element the
 * brief asks for (headings, bold, italic, links, lists, blockquote,
 * code/code block, image, horizontal rule) with zero new dependencies.
 * `BlogContent`/`renderMarkdownToSafeHtml` on the frontend is what
 * actually renders the result — this component only ever edits text.
 */
export function MarkdownToolbar({ textareaRef, value, onChange, onUploadImage }: MarkdownToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function focusSelection(start: number, end: number) {
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
    });
  }

  /** Wraps the current selection (or a placeholder, if nothing is selected) in `before`/`after`. */
  function wrapSelection(before: string, after: string = before, placeholder = "text") {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    onChange(value.slice(0, start) + before + selected + after + value.slice(end));
    focusSelection(start + before.length, start + before.length + selected.length);
  }

  /** Prefixes the current line(s) with `prefix` — used for headings/lists/blockquote. */
  function prefixLine(prefix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart));
    focusSelection(start + prefix.length, end + prefix.length);
  }

  function insertAtCursor(text: string, cursorOffset = text.length) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + text + value.slice(end));
    focusSelection(start + cursorOffset, start + cursorOffset);
  }

  function handleLink() {
    const el = textareaRef.current;
    if (!el) return;
    // A plain `prompt` — the smallest possible UI for one URL input,
    // consistent with "no complicated new UI" for a toolbar helper.
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const label = value.slice(start, end) || "link text";
    const snippet = `[${label}](${url})`;
    onChange(value.slice(0, start) + snippet + value.slice(end));
    focusSelection(start + 1, start + 1 + label.length);
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG, WebP, and GIF images are supported.");
      return;
    }
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      insertAtCursor(`\n![](${url})\n`);
    } catch {
      setError("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-t-md border border-b-0 border-slate-300 bg-slate-50 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <ToolbarButton title="Heading" onClick={() => prefixLine("## ")}>
          H2
        </ToolbarButton>
        <ToolbarButton title="Subheading" onClick={() => prefixLine("### ")}>
          H3
        </ToolbarButton>
        <ToolbarButton title="Bold" onClick={() => wrapSelection("**")}>
          B
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => wrapSelection("_")}>
          I
        </ToolbarButton>
        <ToolbarButton title="Link" onClick={handleLink}>
          Link
        </ToolbarButton>
        <ToolbarButton title="Bulleted list" onClick={() => prefixLine("- ")}>
          • List
        </ToolbarButton>
        <ToolbarButton title="Numbered list" onClick={() => prefixLine("1. ")}>
          1. List
        </ToolbarButton>
        <ToolbarButton title="Blockquote" onClick={() => prefixLine("> ")}>
          Quote
        </ToolbarButton>
        <ToolbarButton title="Inline code" onClick={() => wrapSelection("`")}>
          Code
        </ToolbarButton>
        <ToolbarButton title="Code block" onClick={() => wrapSelection("\n```\n", "\n```\n", "code here")}>
          {"{ }"}
        </ToolbarButton>
        <ToolbarButton title="Horizontal rule" onClick={() => insertAtCursor("\n\n---\n\n")}>
          ―
        </ToolbarButton>
        <button
          type="button"
          title="Insert image"
          disabled={uploading}
          onClick={() => imageInputRef.current?.click()}
          className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Image"}
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          onChange={handleImageFile}
          className="hidden"
        />
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

/** Purely presentational — never touches `textareaRef` itself, so each call site's own inline `onClick` is the only place a ref is ever read, avoiding the `react-hooks/refs` "ref accessed during render" lint rule that a shared button-descriptor array + `.map()` would trip. */
function ToolbarButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
    >
      {children}
    </button>
  );
}
