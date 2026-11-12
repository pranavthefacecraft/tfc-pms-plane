import { useParams } from "next/navigation";
import { PageHead } from "@/components/core/page-title";
import { RecorderRoot } from "@/components/recorder/recorder-root";

export default function RecorderPage() {
  const { workspaceSlug, recordingId } = useParams();
  return (
    <>
      <PageHead title="Recorder" />
      <RecorderRoot workspaceSlug={workspaceSlug?.toString() ?? ""} recordingId={recordingId?.toString()} />
    </>
  );
}
