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
  let inFlight = false;
  let rerunRequested = false;

  const runCallback = async () => {
    if (inFlight) {
      rerunRequested = true;
      return;
    }

    inFlight = true;
    try {
      await callback();
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
    if (intervalId || typeof document === 'undefined' || document.visibilityState !== 'visible') {
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

  if (runImmediately) {
    void runCallback();
  }

  start();
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    stop();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
