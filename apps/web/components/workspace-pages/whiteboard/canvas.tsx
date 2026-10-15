/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CaptureUpdateAction,
  Excalidraw,
  MainMenu,
  WelcomeScreen,
  convertToExcalidrawElements,
  hashElementsVersion,
  newElementWith,
  serializeAsJSON,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawEmbeddableElement } from "@excalidraw/excalidraw/element/types";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { API_BASE_URL } from "@plane/constants";
import { DocumentPreview } from "./document-preview";
import { documentPath, documentService, isWhiteboardDocument, safeTextLink } from "./documents";
import "@excalidraw/excalidraw/index.css";

type TOnChange = NonNullable<ExcalidrawProps["onChange"]>;
type TSceneSnapshot = {
  elements: Parameters<TOnChange>[0];
  appState: Parameters<TOnChange>[1];
  files: Parameters<TOnChange>[2];
};

export type TWhiteboardCanvasProps = {
  boardId: string;
  workspaceSlug: string;
  initialScene: Record<string, unknown> | undefined;
  theme: "light" | "dark";
  readOnly: boolean;
  onSave: (scene: Record<string, unknown>) => Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
};

const SAVE_DEBOUNCE_MS = 1200;

const getSceneSignature = ({ elements, appState, files }: TSceneSnapshot) =>
  `${hashElementsVersion(elements)}:${Object.keys(files).length}:${appState.viewBackgroundColor}`;

export default function WhiteboardCanvas(props: TWhiteboardCanvasProps) {
  const { boardId, workspaceSlug, initialScene, theme, readOnly, onSave, onDirtyChange } = props;
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const uploadingRef = useRef(false);
  const mounted = useRef(true);
  const latestScene = useRef<TSceneSnapshot | null>(null);
  const lastSavedSignature = useRef<string | null>(null);
  const hasLoadedScene = useRef(false);
  const saveInFlight = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  const onDirtyChangeRef = useRef(onDirtyChange);
  onSaveRef.current = onSave;
  onDirtyChangeRef.current = onDirtyChange;

  // Only computed once per board: Excalidraw owns the scene after mount.
  const initialData = useMemo<ExcalidrawInitialDataState>(
    () => ({
      elements: (initialScene?.elements as ExcalidrawInitialDataState["elements"]) ?? [],
      appState: (initialScene?.appState as ExcalidrawInitialDataState["appState"]) ?? {},
      files: (initialScene?.files as ExcalidrawInitialDataState["files"]) ?? {},
      scrollToContent: true,
    }),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [boardId]
  );

  const flush = useCallback(
    function savePendingScene() {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const scene = latestScene.current;
      if (!scene || readOnly || saveInFlight.current) return;
      const signature = getSceneSignature(scene);
      if (signature === lastSavedSignature.current) return;
      saveInFlight.current = true;
      const payload = JSON.parse(serializeAsJSON(scene.elements, scene.appState, scene.files, "local")) as Record<
        string,
        unknown
      >;
      void onSaveRef
        .current(payload)
        .then(() => {
          saveInFlight.current = false;
          lastSavedSignature.current = signature;
          const latest = latestScene.current;
          if (latest && getSceneSignature(latest) === signature) onDirtyChangeRef.current?.(false);
          else savePendingScene();
        })
        .catch((error: unknown) => {
          saveInFlight.current = false;
          // The page hook notifies the user; retain the dirty scene for the next edit/flush.
          console.error("Whiteboard save failed", error);
        });
    },
    [readOnly]
  );

  const handleChange = useCallback<TOnChange>(
    (elements, appState, files) => {
      const selected = elements.filter((element) => !element.isDeleted && appState.selectedElementIds[element.id]);
      setSelectedTextId(selected.length === 1 && selected[0].type === "text" ? selected[0].id : null);
      const scene = { elements, appState, files };
      latestScene.current = scene;
      const signature = getSceneSignature(scene);
      // The first onChange after mount reflects the loaded scene; treat it as already saved.
      if (!hasLoadedScene.current) {
        hasLoadedScene.current = true;
        lastSavedSignature.current = signature;
        return;
      }
      if (readOnly || signature === lastSavedSignature.current) return;
      onDirtyChangeRef.current?.(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush, readOnly]
  );

  // Save pending changes when leaving the board or closing the tab.
  useEffect(() => {
    mounted.current = true;
    window.addEventListener("beforeunload", flush);
    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [flush]);

  const attachFiles = async (files: File[], clientPoint?: { clientX: number; clientY: number }) => {
    if (!api || readOnly || uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    const bounds = wrapper.current?.getBoundingClientRect();
    const point = viewportCoordsToSceneCoords(
      clientPoint ?? { clientX: (bounds?.left ?? 0) + 80, clientY: (bounds?.top ?? 0) + 80 },
      api.getAppState()
    );
    try {
      for (const [index, file] of files.entries()) {
        if (!/\.(pdf|docx|xlsx)$/i.test(file.name)) {
          setToast({
            type: "error",
            title: "Unsupported document",
            message: `${file.name}: use PDF, DOCX or XLSX. Drop images separately.`,
          });
          continue;
        }
        try {
          // Keep large document uploads sequential to bound memory and preserve drop order.
          // oxlint-disable-next-line no-await-in-loop
          const document = await documentService.upload(workspaceSlug, boardId, file);
          if (!mounted.current) return;
          const [base] = convertToExcalidrawElements([
            {
              type: "rectangle",
              x: point.x + index * 40,
              y: point.y + index * 40,
              width: 480,
              height: 560,
            },
          ]);
          const element: ExcalidrawEmbeddableElement = {
            ...base,
            type: "embeddable",
            link: new URL(documentPath(workspaceSlug, boardId, document.id), API_BASE_URL || window.location.origin)
              .href,
            customData: { document },
          };
          api.updateScene({
            elements: [...api.getSceneElements(), element],
            appState: { selectedElementIds: { [element.id]: true } },
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
        } catch (error) {
          console.error("Whiteboard document upload failed", error);
          setToast({
            type: "error",
            title: "Document upload failed",
            message: `${file.name} could not be attached. Check the file type and size, then retry.`,
          });
        }
      }
    } finally {
      uploadingRef.current = false;
      if (mounted.current) setUploading(false);
    }
  };

  const saveTextLink = () => {
    if (!api || !selectedTextId || readOnly) return;
    const link = linkValue.trim() ? safeTextLink(linkValue.trim()) : null;
    if (linkValue.trim() && !link) {
      setToast({ type: "error", title: "Invalid link", message: "Enter a full https://, http:// or mailto: URL." });
      return;
    }
    api.updateScene({
      elements: api
        .getSceneElements()
        .map((element) => (element.id === selectedTextId ? newElementWith(element, { link }) : element)),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setLinkEditorOpen(false);
  };

  return (
    <div
      ref={wrapper}
      className="flex h-full w-full flex-col"
      onDragOverCapture={(event) => {
        if (!readOnly && event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDropCapture={(event) => {
        const files = Array.from(event.dataTransfer.files);
        if (
          !files.length ||
          files.every((file) => file.type.startsWith("image/") || /\.(excalidraw|json)$/i.test(file.name))
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        if (readOnly) return;
        if (uploadingRef.current) {
          setToast({
            type: "error",
            title: "Upload in progress",
            message: "Wait for the current files to finish, then drop your files again.",
          });
          return;
        }
        void attachFiles(files, { clientX: event.clientX, clientY: event.clientY });
      }}
    >
      {!readOnly && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-subtle p-2">
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,.xlsx"
            multiple
            className="hidden"
            aria-label="Choose whiteboard documents"
            onChange={(event) => {
              void attachFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label={uploading ? "Uploading..." : "Attach documents"}
            disabled={!api || uploading}
            onClick={() => fileInput.current?.click()}
          />
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label="Add / edit text link"
            disabled={!selectedTextId}
            onClick={() => {
              setLinkValue(api?.getSceneElements().find((element) => element.id === selectedTextId)?.link ?? "");
              setLinkEditorOpen(true);
            }}
          />
          <span className="text-11 text-secondary">
            Drop PDF, DOCX or XLSX files. Double-click a preview to scroll.
          </span>
          {linkEditorOpen && selectedTextId && (
            <form
              className="flex w-full items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                saveTextLink();
              }}
            >
              <input
                aria-label="Text link URL"
                className="min-w-0 flex-1 rounded border border-subtle bg-surface-1 px-2 py-1 text-13"
                placeholder="https://example.com (leave empty to remove)"
                value={linkValue}
                onChange={(event) => setLinkValue(event.target.value)}
              />
              <Button type="submit" variant="primary" size="sm" stretch="auto" label="Save link" />
              <Button
                variant="secondary"
                size="sm"
                stretch="auto"
                label="Cancel"
                onClick={() => setLinkEditorOpen(false)}
              />
            </form>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Excalidraw
          excalidrawAPI={setApi}
          key={boardId}
          initialData={initialData}
          onChange={handleChange}
          theme={theme}
          viewModeEnabled={readOnly}
          validateEmbeddable={(link) => {
            try {
              const url = new URL(link);
              return (
                url.origin === new URL(API_BASE_URL || window.location.origin).origin &&
                url.pathname.startsWith(documentPath(workspaceSlug, boardId))
              );
            } catch {
              return false;
            }
          }}
          renderEmbeddable={(element) => {
            const document = element.customData?.document;
            return isWhiteboardDocument(document) ? (
              // Excalidraw disables double-click activation in view mode.
              <div className="h-full w-full" style={{ pointerEvents: readOnly ? "auto" : undefined }}>
                <DocumentPreview workspaceSlug={workspaceSlug} boardId={boardId} document={document} />
              </div>
            ) : null;
          }}
          onLinkOpen={(element, event) => {
            if (isWhiteboardDocument(element.customData?.document)) {
              event.preventDefault();
              return;
            }
            if (element.link && !safeTextLink(element.link)) event.preventDefault();
          }}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: null,
              export: { saveFileToDisk: true },
            },
          }}
        >
          <MainMenu>
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.DefaultItems.Help />
            {!readOnly && <MainMenu.DefaultItems.ClearCanvas />}
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
          <WelcomeScreen>
            <WelcomeScreen.Hints.ToolbarHint />
            <WelcomeScreen.Hints.MenuHint />
            <WelcomeScreen.Hints.HelpHint />
          </WelcomeScreen>
        </Excalidraw>
      </div>
    </div>
  );
}
