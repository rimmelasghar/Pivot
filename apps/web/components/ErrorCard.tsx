import type { ErrorScreen } from "@/lib/errors";

interface Props {
  screen: ErrorScreen;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorCard({ screen, actionLabel = "Reload", onAction }: Props) {
  return (
    <div
      role="alert"
      data-testid="error-screen"
      className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-2xl text-red-400">
        !
      </div>
      <h2 className="text-2xl font-semibold">{screen.title}</h2>
      <p className="max-w-sm text-white/60">{screen.body}</p>
      {onAction && (
        <button onClick={onAction} className="mt-2 rounded-xl bg-white/10 px-5 py-3 font-medium">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
