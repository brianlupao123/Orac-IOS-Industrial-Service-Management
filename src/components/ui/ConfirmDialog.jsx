import React from "react";
import Modal from "../Modal.jsx";
import Button from "./Button.jsx";

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message,
  detail,
  confirmText = "Confirm",
  cancelText = "Cancel",
  tone = "warning",
  busy = false
}) {
  if (!isOpen) return null;

  const isDanger = tone === "danger";
  const isSuccess = tone === "success";

  return (
    <Modal title={title} isOpen={isOpen} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 pt-0.5">
            {isSuccess ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orac-success-bg text-orac-success-text border border-orac-success-border">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : isDanger ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orac-danger-bg text-orac-danger-text border border-orac-danger-border">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orac-warning-bg text-orac-warning-text border border-orac-warning-border">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ux-body font-medium text-orac-text-primary leading-relaxed">{message}</p>
            {detail && (
              <p className="mt-2 text-ux-caption text-orac-text-muted leading-normal rounded-lg bg-orac-surface-muted p-2.5 border border-orac-border-default">
                {detail}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-orac-border-default">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelText}
          </Button>
          <Button
            variant={isDanger ? "danger" : isSuccess ? "success" : "primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Processing..." : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
