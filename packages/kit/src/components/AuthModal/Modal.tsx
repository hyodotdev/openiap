import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function Modal({
  isOpen,
  onClose,
  children,
  className = "",
  ariaLabel = "Dialog",
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        modalRef.current &&
        e.target instanceof Node &&
        !modalRef.current.contains(e.target)
      ) {
        onClose();
      }
    };

    if (!isOpen) {
      return;
    }

    // Snapshot the existing overflow value so cleanup can restore it
    // instead of clobbering with "unset" — the outer app or another
    // stacked modal may already be managing scroll lock.
    const previousOverflow = document.body.style.overflow;

    // Capture the element that had focus before the modal opened so we
    // can restore it on close (keyboard / screen-reader users don't get
    // punted back to document.body).
    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;

    // Focus trap: cycle Tab / Shift+Tab inside the modal so keyboard
    // users can't land on elements behind the backdrop while
    // `aria-modal="true"` is set.
    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      if (focusable.length === 0) {
        e.preventDefault();
        modalRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !modalRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("keydown", handleFocusTrap);
    document.addEventListener("mousedown", handleClickOutside);
    document.body.style.overflow = "hidden";

    // Move focus into the modal after paint so screen readers announce
    // the dialog and tabbing starts inside the dialog content.
    const focusTimer = window.setTimeout(() => {
      modalRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("keydown", handleFocusTrap);
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`relative w-full max-w-md bg-white dark:bg-[#18181f] rounded-2xl shadow-2xl animate-scale-in focus:outline-none ${className}`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="relative p-6 max-h-[90vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
