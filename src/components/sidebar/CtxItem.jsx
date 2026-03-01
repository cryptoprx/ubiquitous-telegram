

function CtxItem({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
    >
      {Icon && <Icon size={12} className="text-white/30" />}
      {label}
    </button>
  );
}

export default CtxItem;
