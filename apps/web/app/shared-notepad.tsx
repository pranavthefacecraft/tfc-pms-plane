import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";
import { WorkspacePageDetailRoot } from "@/components/workspace-pages/page-detail-root";
import { WorkspacePageService } from "@/services/page/workspace-page.service";

const service = new WorkspacePageService();

export default function SharedNotepadPage() {
  const { workspaceSlug, pageId } = useParams();
  return (
    <AuthenticationWrapper>
      {workspaceSlug && pageId && (
        <SharedNotepadEntry key={`${workspaceSlug}:${pageId}`} workspaceSlug={workspaceSlug} pageId={pageId} />
      )}
    </AuthenticationWrapper>
  );
}

function SharedNotepadEntry({ workspaceSlug, pageId }: { workspaceSlug: string; pageId: string }) {
  const [params, setParams] = useSearchParams();
  const token = params.get("invitation");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!token)
    return (
      <WorkspacePageDetailRoot
        key={`${workspaceSlug}:${pageId}`}
        workspaceSlug={workspaceSlug}
        pageId={pageId}
        shared
      />
    );
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-1">
      <meta name="referrer" content="no-referrer" />
      <meta name="robots" content="noindex, nofollow" />
      <div className="max-w-md space-y-4 rounded-lg border border-subtle p-6 text-center">
        <h1 className="text-20 font-semibold">Collaborate on a notepad</h1>
        <p className="text-13 text-secondary">
          Accept using the email address that received this invitation. You will be able to edit this notepad only,
          without joining its workspace or projects.
        </p>
        <button
          type="button"
          disabled={busy}
          className="rounded bg-[#135DDD] px-4 py-2 text-13 text-white disabled:opacity-50"
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await service.acceptInvitation(workspaceSlug, pageId, token);
              setParams({}, { replace: true });
            } catch (cause) {
              console.error("Could not accept notepad invitation", cause);
              setError(
                "Could not accept. Check that you are signed in with the invited email. The link may have expired or been revoked."
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Accepting..." : "Accept invitation"}
        </button>
        <button
          type="button"
          className="block w-full text-12 text-accent-primary"
          onClick={() => setParams({}, { replace: true })}
        >
          Already accepted? Open notepad
        </button>
        {error && (
          <p role="alert" className="text-12 text-danger-primary">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
