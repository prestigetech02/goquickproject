import { useId, useState, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9.3 3.1 11 7-.5 1.2-1.2 2.3-2.1 3.2M6.1 6.1C4.4 7.3 3.1 8.9 2.1 10.7c1.7 3.9 6 7 9.9 7 1.4 0 2.7-.3 3.9-.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function PasswordInput({ label, id, className, ...props }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <>
      <label htmlFor={inputId}>{label}</label>
      <div className={`password-field${className ? ` ${className}` : ""}`}>
        <input
          {...props}
          id={inputId}
          type={visible ? "text" : "password"}
          className="password-field-input"
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={0}
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </>
  );
}
