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
    ? 'text-[#DC2626] bg-[#FFF5F5]'
    : 'text-[#D97706] bg-[#FEF9C3]';

  const confirmButtonClass = variant === 'danger'
    ? 'bg-[#DC2626] hover:opacity-85 text-white'
    : 'bg-[#D97706] hover:opacity-85 text-white';

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
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-opacity duration-150 ${confirmButtonClass}`}
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
        <p className="text-sm text-[#94A3B8] leading-relaxed pt-1.5">
          {message}
        </p>
      </div>
    </Modal>
  );
}
