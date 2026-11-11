import { useState } from "react";
import { observer } from "mobx-react";
import { ChevronRight, CircleHelp, LogOut } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { useUser } from "@/hooks/store/user";

export const SidebarFooter = observer(function SidebarFooter({ compact = false }: { compact?: boolean }) {
  const { signOut } = useUser();
  const { t } = useTranslation();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      setToast({
        type: "error",
        title: t("auth.sign_out.toast.error.title"),
        message: t("auth.sign_out.toast.error.message"),
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div
      className={
        compact
          ? "mt-auto shrink-0 border-t border-subtle px-2 py-2"
          : "mt-auto shrink-0 border-t border-subtle px-3 py-2"
      }
    >
      <a
        href="https://docs.plane.so/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={compact ? "Help Center" : undefined}
        title={compact ? "Help Center" : undefined}
        className={`flex items-center gap-2 rounded-md px-2 py-3 text-13 text-secondary hover:bg-layer-1 ${compact ? "justify-center" : ""}`}
      >
        <CircleHelp className="size-4 shrink-0" />
        {!compact && "Help Center"}
      </a>
      <button
        type="button"
        disabled={isSigningOut}
        aria-label={compact ? "Logout Account" : undefined}
        title={compact ? "Logout Account" : undefined}
        onClick={() => void handleSignOut()}
        className={`flex w-full items-center gap-2 border-t border-subtle px-2 py-3 text-left text-13 text-[#D50000] hover:bg-layer-1 disabled:opacity-50 ${compact ? "justify-center" : ""}`}
      >
        <LogOut className="size-4 shrink-0" />
        {!compact && (
          <>
            Logout Account
            <ChevronRight className="ml-auto size-4 shrink-0" />
          </>
        )}
      </button>
    </div>
  );
});
