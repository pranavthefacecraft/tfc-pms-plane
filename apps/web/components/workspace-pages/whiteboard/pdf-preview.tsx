/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@makeplane/propel/components/button";
// Vite bundles the worker separately and supplies its URL as the default export.
// oxlint-disable-next-line import/default
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?worker&url";

export function PdfPreview({ url }: { url: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | undefined;
    setError(false);
    setPdf(undefined);
    setPageNumber(1);
    async function load() {
      const { GlobalWorkerOptions, getDocument } = await import("pdfjs-dist");
      if (cancelled) return;
      GlobalWorkerOptions.workerSrc = workerUrl;
      const task = getDocument({ url, useSystemFonts: true });
      destroy = () => task.destroy();
      const document = await task.promise;
      if (!cancelled) setPdf(document);
    }
    void load().catch((err: unknown) => {
      if (!cancelled) {
        console.error("Whiteboard PDF preview failed", err);
        setError(true);
      }
    });
    return () => {
      cancelled = true;
      void destroy?.();
    };
  }, [url]);

  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let cancelled = false;
    let cancelRender: (() => void) | undefined;
    const target = canvas.current;
    setError(false);
    void pdf
      .getPage(pageNumber)
      .then(async (page) => {
        if (cancelled) return;
        const size = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(1.5, 900 / size.width, 1400 / size.height) });
        target.width = viewport.width;
        target.height = viewport.height;
        const task = page.render({ canvas: target, viewport });
        cancelRender = () => task.cancel();
        await task.promise;
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("Whiteboard PDF page failed", err);
          setError(true);
        }
      });
    return () => {
      cancelled = true;
      cancelRender?.();
    };
  }, [pdf, pageNumber]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {pdf && (
        <div className="flex shrink-0 items-center justify-center gap-3 p-2 text-13">
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label="Previous"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((value) => value - 1)}
          />
          <span>
            Page {pageNumber} of {pdf.numPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label="Next"
            disabled={pageNumber >= pdf.numPages}
            onClick={() => setPageNumber((value) => value + 1)}
          />
        </div>
      )}
      {error ? (
        <p role="alert" className="p-4 text-13">
          Could not render this PDF. It may be encrypted or damaged. Use Download to open the original.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          {!pdf && <p className="p-4 text-13">Loading PDF...</p>}
          <canvas ref={canvas} aria-label={`PDF page ${pageNumber}`} className="h-auto w-full" />
        </div>
      )}
    </div>
  );
}
