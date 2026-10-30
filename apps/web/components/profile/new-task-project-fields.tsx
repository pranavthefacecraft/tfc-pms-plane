import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import type { ISearchIssueResponse } from "@plane/types";
import type { IState } from "@plane/types";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { ExistingIssuesListModal } from "@/components/core/modals/existing-issues-list-modal";
import { useProjectState } from "@/hooks/store/use-project-state";
import { customFields } from "@/components/projects/custom-fields/service";
import type { CustomField } from "@/components/projects/custom-fields/service";
import type { TNewTaskDraft } from "./new-task.helpers";
import { taskValueClass } from "./new-task.helpers";

export function TaskProperty({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-start gap-2 py-2 sm:grid-cols-[132px_minmax(0,1fr)]">
      <span className="py-1 text-12 text-secondary">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function PrivateProjectFields() {
  return (
    <>
      <TaskProperty label="Assigned to">
        <span className="text-13">You (private task)</span>
      </TaskProperty>
    </>
  );
}

function CustomChoice({
  field,
  value,
  disabled,
  placeholder,
  onChange,
}: {
  field?: CustomField;
  value: string;
  disabled: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={field?.name ?? "Status"}
      className={taskValueClass}
      value={value}
      disabled={disabled || !field}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {field?.options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
}

export function NewTaskProjectFields({
  slug,
  draft,
  disabled,
  onChange,
  onReady,
  scheduleFields,
  priorityField,
}: {
  slug: string;
  draft: TNewTaskDraft;
  disabled: boolean;
  onChange: (patch: Partial<TNewTaskDraft>) => void;
  onReady: (ready: boolean) => void;
  scheduleFields: ReactNode;
  priorityField: ReactNode;
}) {
  const { fetchProjectStates } = useProjectState();
  const [choosingDependencies, setChoosingDependencies] = useState(false);
  const states = useSWR(["new-task-states", slug, draft.projectId], () => fetchProjectStates(slug, draft.projectId));
  const fields = useSWR(["project-custom-fields", slug, draft.projectId], () =>
    customFields.list(slug, draft.projectId)
  );
  const loading = !states.data || !fields.data;
  const ready = !loading && !states.error && !fields.error;
  return (
    <ProjectFieldsContent
      ready={ready}
      onReady={onReady}
      error={Boolean(states.error || fields.error)}
      loading={loading}
      retry={() => {
        void states.mutate();
        void fields.mutate();
      }}
    >
      <TaskProperty label="Assigned to">
        <MemberSelect
          projectId={draft.projectId}
          value={draft.assignees}
          onChange={(assignees) => onChange({ assignees })}
          multiple
          variant="select-ghost-md"
          placeholder="Choose teammate"
          disabled={disabled || !ready}
        />
      </TaskProperty>
      {scheduleFields}
      <TaskProperty label="Dependencies">
        <button
          type="button"
          className="py-1 text-13 text-[#135DDD] disabled:text-placeholder"
          disabled={disabled || !ready}
          onClick={() => setChoosingDependencies(true)}
        >
          Add dependencies
        </button>
        {draft.dependencies.map((dependency) => (
          <div key={dependency.id} className="flex items-center gap-2 text-12">
            <span className="truncate">{dependency.name}</span>
            <button
              type="button"
              aria-label={`Remove dependency ${dependency.name}`}
              disabled={disabled}
              onClick={() => onChange({ dependencies: draft.dependencies.filter((task) => task.id !== dependency.id) })}
            >
              Remove
            </button>
          </div>
        ))}
      </TaskProperty>
      {priorityField}
      <TaskStageStatus
        draft={draft}
        fields={fields.data ?? []}
        states={states.data ?? []}
        defaultState={states.data?.find((state) => state.default)?.id ?? ""}
        disabled={disabled || !ready}
        ready={ready}
        onChange={onChange}
      />
      {choosingDependencies && (
        <ExistingIssuesListModal
          workspaceSlug={slug}
          projectId={draft.projectId}
          isOpen
          handleClose={() => setChoosingDependencies(false)}
          searchParams={{}}
          selectedWorkItemIds={draft.dependencies.map((task) => task.id)}
          handleOnSubmit={async (tasks: ISearchIssueResponse[]) => {
            const merged = new Map(draft.dependencies.map((task) => [task.id, task]));
            for (const task of tasks) merged.set(task.id, { id: task.id, name: task.name });
            onChange({ dependencies: Array.from(merged.values()) });
          }}
        />
      )}
    </ProjectFieldsContent>
  );
}

function TaskStageStatus({
  draft,
  fields,
  states,
  defaultState,
  disabled,
  ready,
  onChange,
}: {
  draft: TNewTaskDraft;
  fields: CustomField[];
  states: IState[];
  defaultState: string;
  disabled: boolean;
  ready: boolean;
  onChange: (patch: Partial<TNewTaskDraft>) => void;
}) {
  const stage = fields.find((field) => field.name.toLowerCase() === "stage" && field.field_type === "single_select");
  const status = fields.find((field) => field.name.toLowerCase() === "status" && field.field_type === "single_select");
  return (
    <>
      <TaskProperty label="Stage">
        {stage ? (
          <CustomChoice
            field={stage}
            value={draft.fieldValues[stage.id] ?? ""}
            placeholder="No stage"
            disabled={disabled}
            onChange={(value) => onChange({ fieldValues: { ...draft.fieldValues, [stage.id]: value } })}
          />
        ) : (
          <select
            aria-label="Stage"
            className={taskValueClass}
            disabled={disabled}
            value={draft.stateId || defaultState}
            onChange={(event) => onChange({ stateId: event.target.value })}
          >
            <option value="">Project default</option>
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
        )}
      </TaskProperty>
      <TaskProperty label="Status">
        <CustomChoice
          field={status}
          value={status ? (draft.fieldValues[status.id] ?? "") : ""}
          placeholder="No status"
          disabled={disabled}
          onChange={(value) => {
            if (status) onChange({ fieldValues: { ...draft.fieldValues, [status.id]: value } });
          }}
        />
        {ready && !status && <p className="text-11 text-secondary">No Status field is configured for this project.</p>}
      </TaskProperty>
    </>
  );
}

function ProjectFieldsContent({
  ready,
  onReady,
  error,
  loading,
  retry,
  children,
}: {
  ready: boolean;
  onReady: (ready: boolean) => void;
  error: boolean;
  loading: boolean;
  retry: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    onReady(ready);
  }, [ready, onReady]);
  return (
    <>
      {error ? (
        <p role="alert" className="text-13 text-danger-primary">
          Project fields could not be loaded.{" "}
          <button type="button" onClick={retry} className="underline">
            Retry
          </button>
        </p>
      ) : (
        loading && (
          <p role="status" className="text-12 text-secondary">
            Loading project fields...
          </p>
        )
      )}
      {children}
    </>
  );
}
