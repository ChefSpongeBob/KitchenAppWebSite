type PollingOptions = {
  intervalMs: number;
  runImmediately?: boolean;
  refreshOnVisible?: boolean;
};

export function startVisiblePolling(
  callback: () => void | Promise<void>,
  options: PollingOptions
) {
  const { intervalMs, runImmediately = true, refreshOnVisible = true } = options;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const start = () => {
    if (intervalId || typeof document === 'undefined' || document.visibilityState !== 'visible') {
      return;
    }

    intervalId = setInterval(() => {
      void callback();
    }, intervalMs);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      if (refreshOnVisible) {
        void callback();
      }
      start();
      return;
    }

    stop();
  };

  if (runImmediately) {
    void callback();
  }

  start();
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    stop();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
