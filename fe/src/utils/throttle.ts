// Throttle: limit function execution rate
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastRan: number | null = null;

  const throttledFunc = function (this: any, ...args: Parameters<T>) {
    const now = Date.now();

    if (!lastRan || now - lastRan >= delay) {
      func.apply(this, args);
      lastRan = now;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastRan = Date.now();
      }, delay - (now - lastRan));
    }
  } as T & { cancel: () => void };

  throttledFunc.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return throttledFunc;
}
