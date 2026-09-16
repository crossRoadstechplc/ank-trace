"use client";

type ToastProps = {
  message: string | null;
  isError?: boolean;
  visible: boolean;
};

export function Toast({ message, isError, visible }: ToastProps) {
  if (!message) return null;
  return (
    <div className={`toast${isError ? " error" : ""}${visible ? " show" : ""}`} role="status">
      {message}
    </div>
  );
}
