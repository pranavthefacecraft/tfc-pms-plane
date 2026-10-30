import { useParams } from "react-router";
import useSWR from "swr";
import { personalTaskService } from "@/services/personal-task.service";

export default function SharedPersonalTaskPage() {
  const { token } = useParams();
  const { data, error, mutate } = useSWR(
    token ? ["shared-personal-task", token] : null,
    () => personalTaskService.shared(token!),
    { shouldRetryOnError: false }
  );
  return (
    <div className="h-full overflow-auto bg-surface-1 px-5 py-12">
      <meta name="robots" content="noindex, nofollow" />
      <meta name="referrer" content="no-referrer" />
      <div className="mx-auto max-w-2xl rounded-xl border border-subtle p-6">
        <p className="mb-4 text-12 text-secondary">Shared personal task · Read only</p>
        {error ? (
          <div role="alert">
            This task is unavailable. The link may have been revoked or the task removed.{" "}
            <button type="button" className="underline" onClick={() => void mutate()}>
              Retry
            </button>
          </div>
        ) : !data ? (
          <p role="status">Loading task...</p>
        ) : (
          <>
            <h1 className="text-24 font-semibold break-words">{data.name}</h1>
            <dl className="my-5 grid grid-cols-[100px_1fr] gap-3 text-13">
              <dt>Status</dt>
              <dd>{data.completed_at ? "Completed" : "Open"}</dd>
              <dt>Priority</dt>
              <dd>{data.priority}</dd>
              <dt>Start date</dt>
              <dd>{data.start_date ?? "Not set"}</dd>
              <dt>Due date</dt>
              <dd>{data.target_date ?? "Not set"}</dd>
            </dl>
            <p className="text-14 break-words whitespace-pre-wrap">{data.description}</p>
          </>
        )}
      </div>
    </div>
  );
}
