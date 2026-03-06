const TYPE_STYLES = {
  info: 'bg-blue-600/90 border-blue-400',
  success: 'bg-green-600/90 border-green-400',
  warning: 'bg-yellow-600/90 border-yellow-400',
  error: 'bg-red-600/90 border-red-400',
};

export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[1100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-slide-in backdrop-blur-sm border rounded-lg px-4 py-3 shadow-lg flex items-start gap-3 text-white text-sm ${TYPE_STYLES[toast.type] || TYPE_STYLES.info}`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="text-white/70 hover:text-white font-bold text-lg leading-none mt-[-2px]"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
