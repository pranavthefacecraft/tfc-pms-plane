/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@makeplane/propel/components/dialog";
import { getAssetIdFromUrl, checkURLValidity } from "@plane/utils";
// plane ui
// helpers
// plane web components
import { CreateProjectForm } from "@/components/projects/create/root";
import { ChooseProjectTemplateDialog } from "@/components/projects/choose-project-template-dialog";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import type { TProjectTemplate } from "@/components/projects/project-templates";
// plane web types
import type { TProject } from "@plane/types";
// services
import { FileService } from "@/services/file.service";
const fileService = new FileService();
import { ProjectFeatureUpdate } from "./project-feature-update";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  setToFavorite?: boolean;
  workspaceSlug: string;
  data?: Partial<TProject>;
  templateId?: string;
};

enum EProjectCreationSteps {
  CREATE_PROJECT = "CREATE_PROJECT",
  FEATURE_SELECTION = "FEATURE_SELECTION",
}

function SimpleCreateProject({ isOpen, onClose, workspaceSlug }: Pick<Props, "isOpen" | "onClose" | "workspaceSlug">) {
  const [template, setTemplate] = useState<TProjectTemplate | null>(null);
  const close = () => {
    setTemplate(null);
    onClose();
  };
  return template ? (
    <CreateProjectDialog isOpen={isOpen} onClose={close} workspaceSlug={workspaceSlug} template={template} />
  ) : (
    <ChooseProjectTemplateDialog isOpen={isOpen} onClose={close} onChoose={setTemplate} />
  );
}

export function CreateProjectModal(props: Props) {
  const { isOpen, onClose, setToFavorite = false, workspaceSlug, data, templateId } = props;
  // states
  const [currentStep, setCurrentStep] = useState<EProjectCreationSteps>(EProjectCreationSteps.CREATE_PROJECT);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(EProjectCreationSteps.CREATE_PROJECT);
      setCreatedProjectId(null);
    }
  }, [isOpen]);

  const handleNextStep = (projectId: string) => {
    if (!projectId) return;
    setCreatedProjectId(projectId);
    setCurrentStep(EProjectCreationSteps.FEATURE_SELECTION);
  };

  const handleCoverImageStatusUpdate = async (projectId: string, coverImage: string) => {
    if (!checkURLValidity(coverImage)) {
      await fileService.updateBulkProjectAssetsUploadStatus(workspaceSlug, projectId, projectId, {
        asset_ids: [getAssetIdFromUrl(coverImage)],
      });
    }
  };

  // Plain "Create project" asks for Blank or General first, then uses the simplified dialog; prefilled/template
  // flows keep the full legacy form.
  if (!data && !templateId)
    return <SimpleCreateProject isOpen={isOpen} onClose={onClose} workspaceSlug={workspaceSlug} />;

  return (
    <Dialog
      open={isOpen}
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="lg">
        {currentStep === EProjectCreationSteps.CREATE_PROJECT && (
          // CreateProjectForm has no DialogBody scroller of its own yet, so this wrapper keeps the
          // whole form (including the submit footer) reachable on short viewports.
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CreateProjectForm
              setToFavorite={setToFavorite}
              workspaceSlug={workspaceSlug}
              onClose={onClose}
              updateCoverImageStatus={handleCoverImageStatusUpdate}
              handleNextStep={handleNextStep}
              data={data}
              templateId={templateId}
            />
          </div>
        )}
        {currentStep === EProjectCreationSteps.FEATURE_SELECTION && (
          <ProjectFeatureUpdate projectId={createdProjectId} workspaceSlug={workspaceSlug} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
