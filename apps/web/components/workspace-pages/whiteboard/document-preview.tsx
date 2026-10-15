/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import type { WhiteboardDocument } from "./documents";
import { documentService } from "./documents";
import { PdfPreview } from "./pdf-preview";

type Sheet = { name: string; rows: { id: string; cells: { id: string; text: string }[] }[]; truncated: boolean };
type Preview = { url: string; html?: string; sheets?: Sheet[] };
const MAX_ROWS = 200;
const MAX_COLUMNS = 30;

export function DocumentPreview({
  workspaceSlug,
  boardId,
  document,
}: {
  workspaceSlug: string;
  boardId: string;
  document: WhiteboardDocument;
}) {
  const [preview, setPreview] = useState<Preview>();
  const [downloadUrl, setDownloadUrl] = useState<string>();
  const [error, setError] = useState(false);
  const [sheetIndex, setSheetIndex] = useState(0);
  const { id, name, extension } = document;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    setPreview(undefined);
    setDownloadUrl(undefined);
    setError(false);
    setSheetIndex(0);
    async function load() {
      const blob = await documentService.load(workspaceSlug, boardId, { id, name, extension });
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setDownloadUrl(objectUrl);
      const result: Preview = { url: objectUrl };
      if (extension === ".docx") {
        const mammoth = await import("mammoth");
        const converted = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
        result.html = converted.value;
      } else if (extension === ".xlsx") {
        const { Workbook } = await import("exceljs");
        const workbook = new Workbook();
        await workbook.xlsx.load(await blob.arrayBuffer());
        result.sheets = workbook.worksheets.map((sheet) => ({
          name: sheet.name,
          truncated: sheet.rowCount > MAX_ROWS || sheet.columnCount > MAX_COLUMNS,
          rows: Array.from({ length: Math.min(sheet.rowCount, MAX_ROWS) }, (_, row) => ({
            id: `${sheet.id}:${row + 1}`,
            cells: Array.from({ length: Math.min(sheet.columnCount, MAX_COLUMNS) }, (_, col) => {
              const cell = sheet.getCell(row + 1, col + 1);
              return { id: cell.address, text: cell.text };
            }),
          })),
        }));
      }
      if (!cancelled) setPreview(result);
    }
    void load().catch((err: unknown) => {
      console.error("Whiteboard document preview failed", err);
      if (!cancelled) setError(true);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [workspaceSlug, boardId, id, name, extension]);

  const sheet = preview?.sheets?.[sheetIndex];
  return (
    <section
      aria-label={`Document preview: ${document.name}`}
      className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-subtle bg-white text-[#111827]"
      style={{ colorScheme: "light" }}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#e2e8f0] p-2 text-13">
        <span className="truncate" title={document.name}>
          {document.name}
        </span>
        {downloadUrl && (
          <a className="shrink-0 text-[#135ddd] underline" href={downloadUrl} download={document.name}>
            Download
          </a>
        )}
      </header>
      {error ? (
        <p role="alert" className="p-4 text-13">
          Could not load this preview. Refresh the board to retry, or download the original if available.
        </p>
      ) : !preview ? (
        <p role="status" className="p-4 text-13">
          Loading document...
        </p>
      ) : document.extension === ".pdf" ? (
        <PdfPreview url={preview.url} />
      ) : document.extension === ".docx" ? (
        <iframe
          title={document.name}
          sandbox=""
          srcDoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'"><style>body{font:14px system-ui;color:#111827;background:white;padding:16px;overflow-wrap:anywhere}img,table{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #e2e8f0;padding:6px}</style></head><body>${preview.html}</body></html>`}
          className="min-h-0 w-full flex-1 border-0"
        />
      ) : (
        <>
          <label className="flex items-center gap-2 p-2 text-13">
            Sheet
            <select
              value={sheetIndex}
              onChange={(event) => setSheetIndex(Number(event.target.value))}
              className="min-w-0 flex-1 rounded border border-[#e2e8f0] p-1"
            >
              {preview.sheets?.map((item, index) => (
                <option key={item.name} value={index}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {sheet?.truncated && (
            <p className="px-2 text-11">
              Preview limited to {MAX_ROWS} rows and {MAX_COLUMNS} columns. Download for the full workbook.
            </p>
          )}
          <div className="min-h-0 flex-1 overflow-auto">
            {sheet?.rows.length ? (
              <table className="border-collapse text-11">
                <tbody>
                  {sheet.rows.map((row) => (
                    <tr key={row.id}>
                      {row.cells.map((cell) => (
                        <td key={cell.id} className="min-w-24 border border-[#e2e8f0] px-2 py-1 whitespace-pre-wrap">
                          {cell.text}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-4 text-13">This sheet is empty.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
