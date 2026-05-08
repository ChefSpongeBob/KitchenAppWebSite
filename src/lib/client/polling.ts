type PollingOptions = {
  intervalMs: number;
  maxIntervalMs?: number;
  runImmediately?: boolean;
  refreshOnVisible?: boolean;
  pauseWhenOffline?: boolean;
  onError?: (error: unknown) => void;
  errorBackoffFactor?: number;
  jitterMs?: number;
  visibleRefreshThrottleMs?: number;
};

export function startVisiblePolling(
  callback: () => void | Promise<void>,
  options: PollingOptions
) {
  const {
    intervalMs,
    maxIntervalMs = Math.max(intervalMs, intervalMs * 6),
    runImmediately = true,
    refreshOnVisible = true,
    pauseWhenOffline = true,
    onError,
    errorBackoffFactor = 2,
    jitterMs = 0,
    visibleRefreshThrottleMs = Math.min(intervalMs, 30000)
  } = options;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let stopped = false;
  let rerunRequested = false;
  let currentIntervalMs = intervalMs;
  let lastRunAt = 0;

  const isVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
  const isOnline = () => typeof navigator === 'undefined' || navigator.onLine;

  const nextDelay = () => currentIntervalMs + (jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0);

  const clearTimer = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const schedule = (delayMs = nextDelay()) => {
    clearTimer();
    if (stopped || !isVisible()) {
      return;
    }

    timeoutId = setTimeout(() => {
      void runCallback();
    }, Math.max(0, delayMs));
  };

  const runCallback = async () => {
    if (stopped || !isVisible()) return;
    if (pauseWhenOffline && !isOnline()) {
      schedule();
      return;
    }

    if (inFlight) {
      rerunRequested = true;
      return;
    }

    inFlight = true;
    lastRunAt = Date.now();
    try {
      await callback();
      currentIntervalMs = intervalMs;
    } catch (error) {
      currentIntervalMs = Math.min(
        maxIntervalMs,
        Math.max(intervalMs, Math.floor(currentIntervalMs * Math.max(errorBackoffFactor, 1)))
      );
      onError?.(error);
    } finally {
      inFlight = false;
      if (stopped) return;

      if (rerunRequested) {
        rerunRequested = false;
        schedule(0);
        return;
      }

      schedule();
    }
  };

  const stop = () => {
    clearTimer();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const elapsedMs = Date.now() - lastRunAt;
      if (refreshOnVisible && elapsedMs >= visibleRefreshThrottleMs) {
        void runCallback();
      } else {
        schedule(Math.max(0, intervalMs - elapsedMs));
      }
      return;
    }

    stop();
  };

  const handleOnline = () => {
    void runCallback();
  };

  if (runImmediately) {
    void runCallback();
  } else {
    schedule();
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);
  if (pauseWhenOffline) {
    window.addEventListener('online', handleOnline);
  }

  return () => {
    stopped = true;
    stop();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (pauseWhenOffline) {
      window.removeEventListener('online', handleOnline);
    }
  };
}
