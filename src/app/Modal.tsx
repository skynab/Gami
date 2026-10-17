import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * A dialog on top of the page, using the browser's own <dialog>: focus moves into it, Escape and clicking
 * outside close it, and the page behind can't be reached until it closes.
 */
export function Modal({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
