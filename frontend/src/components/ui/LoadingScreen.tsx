/**
 * Full-screen loading screen shown while the app fetches data from Supabase
 * on startup.
 */

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading your data…' }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-mw-dark">
      {/* Mileway logo */}
      <img
        src="/mileway-logo.png"
        alt="Mileway"
        className="h-10 mb-10 dark:brightness-0 dark:invert"
        draggable={false}
      />

      {/* Spinner — border-t uses the brand primary blue */}
      <div className="w-7 h-7 border-[3px] border-mw-grey-light dark:border-mw-card-border-dark border-t-mw-primary rounded-full animate-spin mb-5" />

      <p className="text-mw-grey dark:text-mw-muted-text-dark text-sm font-medium">{message}</p>
      <p className="text-mw-grey-light dark:text-mw-card-border-dark text-xs mt-1">Connecting to database…</p>
    </div>
  );
}
