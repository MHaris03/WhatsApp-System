/**
 * Reusable confirmation dialog — replaces native window.confirm() with a styled,
 * on-brand popup. Controlled via the `open` prop.
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2">
          <h3 className="text-lg font-bold text-wa-dark">{title}</h3>
          {message && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{message}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-wa-green hover:bg-wa-teal'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
