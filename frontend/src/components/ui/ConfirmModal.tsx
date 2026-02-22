import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

/**
 * Styled confirmation dialog — replaces all browser confirm() calls.
 * Supports "danger" (red) and "warning" (amber) variants.
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const iconColor = variant === 'danger'
    ? 'text-red-500 bg-red-100 dark:bg-red-900/30'
    : 'text-amber-500 bg-amber-100 dark:bg-amber-900/30';

  const confirmButtonClass = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-amber-500 hover:bg-amber-600 text-white';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${confirmButtonClass}`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconColor}`}>
          <AlertTriangle size={20} />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-1.5">
          {message}
        </p>
      </div>
    </Modal>
  );
}
