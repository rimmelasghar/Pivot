/** Keep the phone screen on while controlling; re-acquire when the page becomes visible. */
export function keepScreenOn(): () => void {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return () => {};
  let lock: WakeLockSentinel | null = null;
  let released = false;

  const acquire = async () => {
    if (released || document.visibilityState !== "visible") return;
    try {
      lock = await navigator.wakeLock.request("screen");
    } catch {
      // Denied (e.g. battery saver): the controller still works, the screen may dim.
    }
  };
  const onVisible = () => void acquire();

  void acquire();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    released = true;
    document.removeEventListener("visibilitychange", onVisible);
    void lock?.release().catch(() => {});
  };
}
