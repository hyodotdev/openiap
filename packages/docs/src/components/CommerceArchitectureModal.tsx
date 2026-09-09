import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import {
  closeCommerceArchitectureModal,
  getCommerceArchitectureSnapshot,
  subscribeToCommerceArchitecture,
} from '../lib/signals';
import PackageInstall from './PackageInstall';
import '../styles/commerce-protocol.css';

function CommerceArchitectureModal(): React.JSX.Element {
  const modal = useSyncExternalStore(
    subscribeToCommerceArchitecture,
    getCommerceArchitectureSnapshot,
    () => null
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPointerDown = useRef(false);
  const afterClose = useRef<(() => void) | null>(null);
  const [closing, setClosing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!modal || !dialog) return;

    setClosing(false);
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      afterClose.current = null;
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [modal]);

  const part = modal?.part;
  const step = part?.step;
  const close = (
    action: () => void = modal?.onClose ?? closeCommerceArchitectureModal
  ): void => {
    if (afterClose.current) return;
    afterClose.current = action;
    setClosing(true);
  };

  return (
    <dialog
      ref={dialogRef}
      id="commerce-architecture-detail"
      className="commerce-architecture-modal"
      data-closing={closing}
      aria-labelledby="commerce-architecture-title"
      aria-describedby="commerce-architecture-description"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onAnimationEnd={(event) => {
        if (
          event.target !== event.currentTarget ||
          event.animationName !== 'commerce-overlay-exit'
        )
          return;
        const action = afterClose.current;
        afterClose.current = null;
        setClosing(false);
        closeCommerceArchitectureModal();
        action?.();
      }}
      onPointerDown={(event) => {
        backdropPointerDown.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (
          backdropPointerDown.current &&
          event.target === event.currentTarget
        ) {
          close();
        }
      }}
    >
      {part && (
        <div className="commerce-architecture-modal-content">
          <div className="commerce-architecture-modal-heading">
            <span>{part.label}</span>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => close()}
              aria-label="Close architecture details"
              autoFocus
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <h2 id="commerce-architecture-title">{part.title}</h2>
          <p id="commerce-architecture-description">{part.description}</p>
          {part.packageName && (
            <PackageInstall packageName={part.packageName} />
          )}
          <div className="commerce-actions">
            <Link
              className="btn btn-secondary"
              to={part.reference}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                close(() => navigate(part.reference));
              }}
            >
              {part.referenceLabel}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            {step !== undefined && (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  close(() => modal.onShowExample(step));
                }}
              >
                See working example
              </button>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}

export default CommerceArchitectureModal;
