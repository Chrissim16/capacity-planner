/**
 * Full-screen loading screen shown while the app fetches data from Supabase
 * on startup (US-002).
 */

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading your data…' }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-slate-900">
      {/* Mileway logo */}
      <img
        src="/mileway-logo.svg"
        alt="Mileway"
        className="h-10 mb-10 dark:brightness-0 dark:invert"
        draggable={false}
      />

      {/* Spinner */}
      <div className="w-7 h-7 border-[3px] border-slate-200 dark:border-slate-700 border-t-[#0089DD] rounded-full animate-spin mb-5" />

      {/* Messages */}
      <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">{message}</p>
      <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Connecting to database…</p>
    </div>
  );
}
