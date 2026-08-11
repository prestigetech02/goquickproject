type AvatarUploadProgressProps = {
  /** 0–100 while uploading; null/undefined hides the overlay */
  progress: number | null;
  /** Accessible label, e.g. "Uploading photo" */
  label?: string;
};

/** Circular progress overlay for avatar buttons. */
export function AvatarUploadProgress({
  progress,
  label = "Uploading photo",
}: AvatarUploadProgressProps) {
  if (progress == null) return null;

  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const size = 100;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <span className="avatar-upload-progress" aria-live="polite" aria-label={`${label} ${clamped}%`}>
      <svg className="avatar-upload-ring" viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="avatar-upload-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="avatar-upload-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="avatar-upload-pct">{clamped}%</span>
    </span>
  );
}
