import useSWR from "swr";
import { renderFormattedDate, renderFormattedTime } from "@plane/utils";
import { workspaceMessageService } from "@/services/workspace-message.service";

export function WorkspaceMessageDetail({
  workspaceSlug,
  messageId,
  onClose,
  onRead,
}: {
  workspaceSlug: string;
  messageId: string;
  onClose?: () => void;
  onRead?: () => void;
}) {
  const { data, error, mutate } = useSWR(
    ["workspace-message", workspaceSlug, messageId],
    () => workspaceMessageService.retrieve(workspaceSlug, messageId),
    { onSuccess: () => onRead?.() }
  );
  const backButton = onClose && (
    <button type="button" className="mb-4 text-13 text-secondary underline" onClick={onClose}>
      Back to Inbox
    </button>
  );
  if (error)
    return (
      <div role="alert" className="p-6">
        {backButton}
        Could not open this message. It may be unavailable or you may not have access.{" "}
        <button type="button" className="underline" onClick={() => void mutate()}>
          Retry
        </button>
      </div>
    );
  if (!data)
    return (
      <p role="status" className="p-6">
        Loading message...
      </p>
    );
  return (
    <article className="h-full overflow-y-auto p-6">
      {backButton}
      <h1 className="text-24 font-semibold break-words">{data.subject}</h1>
      <div className="my-4 space-y-1 border-b border-subtle pb-4 text-13 text-secondary">
        <p>From: {data.sender.display_name || data.sender.first_name}</p>
        <p>To: {data.recipients.map((recipient) => recipient.display_name || recipient.first_name).join(", ")}</p>
        <time dateTime={data.created_at}>
          {renderFormattedDate(data.created_at)}, {renderFormattedTime(data.created_at)}
        </time>
      </div>
      <p className="text-14 break-words whitespace-pre-wrap">{data.body}</p>
      <p className="mt-8 text-12 text-tertiary">This is a send-only message. Replies are not supported.</p>
    </article>
  );
}
