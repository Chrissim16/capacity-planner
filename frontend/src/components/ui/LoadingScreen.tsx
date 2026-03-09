interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading your data…' }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FAF9F7]">
      <img
        src="/mileway-logo.png"
        alt="Mileway"
        className="h-10 mb-10"
        draggable={false}
      />

      <div className="w-6 h-6 border-[2px] border-[#E5E5E3] border-t-[#0ED3CF] rounded-full animate-spin mb-5" />

      <p className="text-[#6B7280] text-sm font-medium">{message}</p>
      <p className="text-[#9CA3AF] text-xs mt-1">Connecting to database…</p>
    </div>
  );
}
