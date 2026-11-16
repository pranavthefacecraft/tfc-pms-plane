import { EAuthModes } from "@plane/constants";
import { LegalPolicyLinks } from "../terms-and-conditions";

export type TAuthOptions = {
  acceptedTerms: boolean;
  rememberMe: boolean;
  onAcceptedTermsChange: (value: boolean) => void;
  onRememberMeChange: (value: boolean) => void;
};

export function AuthOptions({ mode, options }: { mode: EAuthModes; options: TAuthOptions }) {
  const signup = mode === EAuthModes.SIGN_UP;
  return (
    <label className="flex items-start gap-2 text-12 text-secondary">
      <input
        type="checkbox"
        name={signup ? "accepted_terms" : "remember_me"}
        value="true"
        checked={signup ? options.acceptedTerms : options.rememberMe}
        required={signup}
        onChange={(event) =>
          signup
            ? options.onAcceptedTermsChange(event.target.checked)
            : options.onRememberMeChange(event.target.checked)
        }
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#135DDD]"
      />
      {signup ? (
        <span>
          I agree to the <LegalPolicyLinks termsLabel="Terms & Conditions" />.
        </span>
      ) : (
        <span>Keep me signed in</span>
      )}
      {!signup && <input type="hidden" name="remember_me_choice" value={options.rememberMe ? "true" : "false"} />}
    </label>
  );
}
