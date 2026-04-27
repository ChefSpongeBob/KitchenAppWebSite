type PollingOptions = {
  intervalMs: number;
  runImmediately?: boolean;
  refreshOnVisible?: boolean;
  pauseWhenOffline?: boolean;
  onError?: (error: unknown) => void;
};

export function startVisiblePolling(
  callback: () => void | Promise<void>,
  options: PollingOptions
) {
  const {
    intervalMs,
    runImmediately = true,
    refreshOnVisible = true,
    pauseWhenOffline = true,
    onError
  } = options;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let rerunRequested = false;

  const isVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
  const isOnline = () => typeof navigator === 'undefined' || navigator.onLine;

  const runCallback = async () => {
    if (!isVisible()) return;
    if (pauseWhenOffline && !isOnline()) return;

    if (inFlight) {
      rerunRequested = true;
      return;
    }

    inFlight = true;
    try {
      await callback();
    } catch (error) {
      onError?.(error);
    } finally {
      inFlight = false;
      if (rerunRequested) {
        rerunRequested = false;
        void runCallback();
      }
    }
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const start = () => {
    if (intervalId || !isVisible()) {
      return;
    }

    intervalId = setInterval(() => {
      void runCallback();
    }, intervalMs);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      if (refreshOnVisible) {
        void runCallback();
      }
      start();
      return;
    }

    stop();
  };

  const handleOnline = () => {
    void runCallback();
    start();
  };

  if (runImmediately) {
    void runCallback();
  }

  start();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  if (pauseWhenOffline) {
    window.addEventListener('online', handleOnline);
  }

  return () => {
    stop();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (pauseWhenOffline) {
      window.removeEventListener('online', handleOnline);
    }
  };
}
