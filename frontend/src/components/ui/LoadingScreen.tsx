/**
 * Full-screen loading screen shown while the app fetches data from Supabase
 * on startup (US-002).
 */

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading your data…' }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
      {/* Logo */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-xl shadow-xl shadow-blue-500/30 mb-6">
        MW
      </div>

      {/* Spinner */}
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />

      {/* Message */}
      <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">{message}</p>
      <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">
        Connecting to database…
      </p>
    </div>
  );
}
