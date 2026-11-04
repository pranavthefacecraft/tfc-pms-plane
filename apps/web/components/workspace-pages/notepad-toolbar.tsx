import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { EditorRefApi } from "@plane/editor";
import { Bold, Italic, Link2, List } from "lucide-react";

const textStyles = [
  { key: "text", label: "Normal text" },
  { key: "h1", label: "Heading 1" },
  { key: "h2", label: "Heading 2" },
  { key: "h3", label: "Heading 3" },
] as const;

export function NotepadToolbar({
  editorRef,
  ready,
  disabled,
  onAttach,
}: {
  editorRef: RefObject<Pick<EditorRefApi, "isMenuItemActive" | "onStateChange" | "executeMenuItemCommand"> | null>;
  ready: boolean;
  disabled: boolean;
  onAttach: () => void;
}) {
  const [formatting, setFormatting] = useState({ bold: false, italic: false, list: false, style: "text" });
  useEffect(() => {
    if (!ready || !editorRef.current) return;
    const editor = editorRef.current;
    const sync = () =>
      setFormatting({
        bold: editor.isMenuItemActive({ itemKey: "bold" }),
        italic: editor.isMenuItemActive({ itemKey: "italic" }),
        list: editor.isMenuItemActive({ itemKey: "bulleted-list" }),
        style: textStyles.find((style) => editor.isMenuItemActive({ itemKey: style.key }))?.key ?? "text",
      });
    sync();
    return editor.onStateChange(sync);
  }, [editorRef, ready]);
  const controlsDisabled = disabled || !ready;
  return (
    <div
      role="toolbar"
      aria-label="Notepad formatting"
      className="flex flex-wrap items-center gap-2 border-y border-subtle py-3 text-12 text-secondary"
    >
      <select
        aria-label="Text style"
        value={formatting.style}
        disabled={controlsDisabled}
        className="rounded bg-transparent px-2 py-1 outline-none focus:ring-2 focus:ring-[#135DDD]"
        onChange={(event) => {
          const style = textStyles.find((item) => item.key === event.target.value);
          if (style) editorRef.current?.executeMenuItemCommand({ itemKey: style.key });
        }}
      >
        {textStyles.map((style) => (
          <option key={style.key} value={style.key}>
            {style.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label="Bold"
        aria-pressed={formatting.bold}
        disabled={controlsDisabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editorRef.current?.executeMenuItemCommand({ itemKey: "bold" })}
        className="rounded p-2 hover:bg-layer-1 disabled:opacity-50 aria-pressed:bg-layer-1"
      >
        <Bold size={14} />
      </button>
      <button
        type="button"
        aria-label="Italic"
        aria-pressed={formatting.italic}
        disabled={controlsDisabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editorRef.current?.executeMenuItemCommand({ itemKey: "italic" })}
        className="rounded p-2 hover:bg-layer-1 disabled:opacity-50 aria-pressed:bg-layer-1"
      >
        <Italic size={14} />
      </button>
      <button
        type="button"
        aria-label="Bulleted list"
        aria-pressed={formatting.list}
        disabled={controlsDisabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editorRef.current?.executeMenuItemCommand({ itemKey: "bulleted-list" })}
        className="flex items-center gap-1 rounded px-2 py-1 hover:bg-layer-1 disabled:opacity-50 aria-pressed:bg-layer-1"
      >
        <List size={14} /> List
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onAttach}
        className="flex items-center gap-1 rounded px-2 py-1 hover:bg-layer-1 disabled:opacity-50"
      >
        <Link2 size={14} /> Link Task / Project
      </button>
    </div>
  );
}
