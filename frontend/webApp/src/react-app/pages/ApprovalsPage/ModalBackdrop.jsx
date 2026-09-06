export function ModalBackdrop({ children, className = '', onClose }) {
  return (
    <div
      className={`approvalModalBackdrop ${className}`}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
