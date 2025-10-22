// ================================================
// ADVANCED PERFORMANCE UTILITIES
// Thêm file này vào shared/utils/performance.ts
// ================================================

/**
 * 1. Intersection Observer Hook - Lazy load khi element vào viewport
 */
export function useInView(options: IntersectionObserverInit = {}) {
  const [ref, setRef] = React.useState<Element | null>(null);
  const [isInView, setIsInView] = React.useState(false);

  React.useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    }, { threshold: 0.1, ...options });

    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref, options]);

  return [setRef, isInView] as const;
}

/**
 * 2. Image Lazy Loader với BlurHash placeholder
 */
interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string; // BlurHash or low-res image
}

export const LazyImage: React.FC<LazyImageProps> = ({ 
  src, 
  alt, 
  className, 
  placeholder 
}) => {
  const [ref, isInView] = useInView({ rootMargin: '50px' });
  const [loaded, setLoaded] = React.useState(false);
  const [currentSrc, setCurrentSrc] = React.useState(placeholder || '');

  React.useEffect(() => {
    if (isInView && src && !loaded) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setCurrentSrc(src);
        setLoaded(true);
      };
    }
  }, [isInView, src, loaded]);

  return (
    <div ref={ref as any} className={`relative overflow-hidden ${className}`}>
      <img
        src={currentSrc}
        alt={alt}
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
      />
      {!loaded && placeholder && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
};

/**
 * 3. Debounce Hook - Giảm số lần re-render
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 4. Throttle Hook - Giới hạn tần suất execution
 */
export function useThrottle<T>(value: T, limit: number = 100): T {
  const [throttledValue, setThrottledValue] = React.useState<T>(value);
  const lastRan = React.useRef(Date.now());

  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => clearTimeout(handler);
  }, [value, limit]);

  return throttledValue;
}

/**
 * 5. Virtual Scroll - Render chỉ items visible
 */
interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
}

export function VirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3
}: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;

  return (
    <div
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => renderItem(item, startIndex + i))}
        </div>
      </div>
    </div>
  );
}

/**
 * 6. Prefetch Helper - Preload data khi hover
 */
export const prefetchCache = new Map<string, Promise<any>>();

export async function prefetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  if (prefetchCache.has(key)) {
    return prefetchCache.get(key)!;
  }

  const promise = fetcher();
  prefetchCache.set(key, promise);
  
  try {
    const data = await promise;
    return data;
  } catch (error) {
    prefetchCache.delete(key);
    throw error;
  }
}

export function usePrefetch() {
  const prefetchOnHover = React.useCallback((key: string, fetcher: () => Promise<any>) => {
    return {
      onMouseEnter: () => prefetch(key, fetcher),
      onTouchStart: () => prefetch(key, fetcher),
    };
  }, []);

  return { prefetchOnHover };
}

/**
 * 7. Request Deduplication - Tránh duplicate requests
 */
const requestCache = new Map<string, Promise<any>>();

export async function dedupedFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const key = `${url}-${JSON.stringify(options)}`;

  if (requestCache.has(key)) {
    return requestCache.get(key)!;
  }

  const promise = fetch(url, options)
    .then(res => res.json())
    .finally(() => {
      // Clear after request completes
      setTimeout(() => requestCache.delete(key), 100);
    });

  requestCache.set(key, promise);
  return promise;
}

/**
 * 8. Smart Batch Loader - Combine multiple requests
 */
interface BatchLoaderOptions {
  batchSize: number;
  delay: number;
}

export class BatchLoader<K, V> {
  private queue: Array<{ key: K; resolve: (value: V) => void; reject: (error: any) => void }> = [];
  private timer: NodeJS.Timeout | null = null;
  
  constructor(
    private fetcher: (keys: K[]) => Promise<V[]>,
    private options: BatchLoaderOptions = { batchSize: 10, delay: 10 }
  ) {}

  load(key: K): Promise<V> {
    return new Promise((resolve, reject) => {
      this.queue.push({ key, resolve, reject });

      if (this.queue.length >= this.options.batchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.options.delay);
      }
    });
  }

  private async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const batch = this.queue.splice(0, this.options.batchSize);
    if (batch.length === 0) return;

    try {
      const keys = batch.map(item => item.key);
      const results = await this.fetcher(keys);
      
      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }
  }
}

/**
 * 9. Web Worker Hook - Offload heavy computation
 */
export function useWebWorker<T, R>(
  workerFn: (data: T) => R
): [(data: T) => Promise<R>, () => void] {
  const workerRef = React.useRef<Worker | null>(null);

  React.useEffect(() => {
    const blob = new Blob([`
      self.onmessage = function(e) {
        const result = (${workerFn.toString()})(e.data);
        self.postMessage(result);
      }
    `], { type: 'application/javascript' });
    
    workerRef.current = new Worker(URL.createObjectURL(blob));

    return () => {
      workerRef.current?.terminate();
    };
  }, [workerFn]);

  const execute = React.useCallback((data: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handler = (e: MessageEvent) => {
        workerRef.current?.removeEventListener('message', handler);
        resolve(e.data);
      };

      workerRef.current.addEventListener('message', handler);
      workerRef.current.addEventListener('error', reject);
      workerRef.current.postMessage(data);
    });
  }, []);

  const terminate = React.useCallback(() => {
    workerRef.current?.terminate();
  }, []);

  return [execute, terminate];
}

/**
 * 10. Optimistic Updates Helper
 */
export function useOptimisticUpdate<T>(
  initialData: T,
  updateFn: (data: T) => Promise<T>
) {
  const [data, setData] = React.useState<T>(initialData);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const previousDataRef = React.useRef<T>(initialData);

  const update = React.useCallback(async (optimisticData: T) => {
    previousDataRef.current = data;
    setData(optimisticData);
    setIsUpdating(true);

    try {
      const result = await updateFn(optimisticData);
      setData(result);
    } catch (error) {
      // Rollback on error
      setData(previousDataRef.current);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [data, updateFn]);

  return { data, update, isUpdating };
}

/**
 * 11. Resource Hints - Preconnect, Prefetch, Preload
 */
export const ResourceHints = {
  preconnect(url: string) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  },

  dnsPrefetch(url: string) {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = url;
    document.head.appendChild(link);
  },

  prefetch(url: string) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  },

  preload(url: string, as: string) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = as;
    document.head.appendChild(link);
  }
};

/**
 * 12. Performance Monitor
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  mark(name: string) {
    performance.mark(name);
  }

  measure(name: string, startMark: string, endMark?: string) {
    const end = endMark || `${name}-end`;
    this.mark(end);
    
    try {
      performance.measure(name, startMark, end);
      const measure = performance.getEntriesByName(name, 'measure')[0];
      
      if (!this.metrics.has(name)) {
        this.metrics.set(name, []);
      }
      this.metrics.get(name)!.push(measure.duration);
      
      return measure.duration;
    } catch (e) {
      console.warn(`Failed to measure ${name}:`, e);
      return 0;
    }
  }

  getMetrics(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return null;

    return {
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      last: values[values.length - 1]
    };
  }

  clear(name?: string) {
    if (name) {
      this.metrics.delete(name);
      performance.clearMarks(name);
      performance.clearMeasures(name);
    } else {
      this.metrics.clear();
      performance.clearMarks();
      performance.clearMeasures();
    }
  }

  report() {
    const report: Record<string, any> = {};
    this.metrics.forEach((_, name) => {
      report[name] = this.getMetrics(name);
    });
    return report;
  }
}

export const perfMonitor = new PerformanceMonitor();

/**
 * 13. Component Performance Tracker
 */
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  name: string
) {
  return React.memo((props: P) => {
    React.useEffect(() => {
      perfMonitor.mark(`${name}-mount`);
      return () => {
        perfMonitor.measure(`${name}-lifetime`, `${name}-mount`);
      };
    }, []);

    return <Component {...props} />;
  });
}

/**
 * 14. Idle Callback Hook - Run tasks when browser is idle
 */
export function useIdleCallback(
  callback: () => void,
  options?: IdleRequestOptions
) {
  React.useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(callback, options);
      return () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(callback, 1);
      return () => clearTimeout(id);
    }
  }, [callback, options]);
}