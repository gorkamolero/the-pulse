import { useEffect, useRef, type RefObject } from 'react';

export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T>,
  RefObject<T>,
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (container && end) {
      // Function to check if user is already near bottom
      const isNearBottom = () => {
        const threshold = 100; // pixels from bottom to trigger auto-scroll
        return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      };

      const observer = new MutationObserver(() => {
        // Only scroll to bottom if user is already near bottom
        if (isNearBottom()) {
          end.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      return () => observer.disconnect();
    }
  }, []);

  return [containerRef, endRef];
}
