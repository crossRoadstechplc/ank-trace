import type { ReactNode } from "react";

type SpinnerSize = "sm" | "md" | "lg";

const SIZE_PX: Record<SpinnerSize, number> = {
  sm: 14,
  md: 22,
  lg: 32,
};

/** Inline CSS spinner. */
export function Spinner({
  size = "md",
  label,
  className = "",
}: {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}) {
  const px = SIZE_PX[size];
  return (
    <span className={`ui-spinner-wrap ${className}`.trim()} role="status" aria-live="polite">
      <span
        className="ui-spinner"
        style={{ width: px, height: px, borderWidth: Math.max(2, Math.round(px / 8)) }}
        aria-hidden
      />
      {label ? <span className="ui-spinner-label">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

/** Centered page / panel loading state. */
export function LoadingScreen({
  message = "Loading…",
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={`ui-loading-screen ${className}`.trim()}>
      <Spinner size="lg" label={message} />
    </div>
  );
}

/** Button contents: spinner while busy, otherwise children. */
export function BusyLabel({
  busy,
  children,
  busyText,
}: {
  busy: boolean;
  children: ReactNode;
  busyText?: string;
}) {
  if (!busy) return <>{children}</>;
  return (
    <span className="ui-busy-label">
      <Spinner size="sm" />
      <span>{busyText ?? children}</span>
    </span>
  );
}
