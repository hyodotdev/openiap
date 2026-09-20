import { useEffect, type RefObject } from 'react';

interface DetailsTransition {
  expanded: boolean;
  stop: () => void;
  finish: () => void;
}

export function useDetailsTransition(
  containerRef: RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const transitions = new Map<HTMLDetailsElement, DetailsTransition>();

    const finishAll = (): void => {
      for (const transition of transitions.values()) transition.finish();
    };

    const handleClick = (event: MouseEvent): void => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      const summary = event.target.closest('summary');
      const details = summary?.parentElement;
      if (
        !summary ||
        !(details instanceof HTMLDetailsElement) ||
        !container.contains(details) ||
        event.target.closest('a, button, input, select, textarea')
      )
        return;

      event.preventDefault();
      summary.focus({ preventScroll: true });
      const previous = transitions.get(details);
      const expanded = !(previous?.expanded ?? details.open);

      // Nested disclosures must measure against their parent's natural height.
      for (const [other, transition] of transitions) {
        if (other === details) continue;
        if (other.contains(details)) transition.stop();
        else if (details.contains(other)) transition.finish();
      }

      const startHeight = details.getBoundingClientRect().height;
      previous?.stop();
      if (reducedMotion.matches) {
        details.open = expanded;
        return;
      }

      const originalHeight = details.style.height;
      const originalOverflow = details.style.overflow;
      let frame = 0;
      let animation: Animation | undefined;
      const stop = (): void => {
        cancelAnimationFrame(frame);
        if (animation) {
          animation.onfinish = null;
          animation.oncancel = null;
          animation.cancel();
        }
        details.style.height = originalHeight;
        details.style.overflow = originalOverflow;
        transitions.delete(details);
      };
      const finish = (): void => {
        stop();
        details.open = expanded;
      };

      transitions.set(details, { expanded, stop, finish });
      details.style.height = `${startHeight}px`;
      details.style.overflow = 'hidden';
      details.open = true;

      // Allow native toggle handlers to render any lazy content before measuring.
      frame = requestAnimationFrame(() => {
        if (!details.isConnected) {
          stop();
          return;
        }
        details.style.height = originalHeight;
        details.open = expanded;
        const endHeight = details.getBoundingClientRect().height;
        details.open = true;
        animation = details.animate(
          { height: [`${startHeight}px`, `${endHeight}px`] },
          {
            duration: 280,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'both',
          }
        );
        animation.onfinish = finish;
        animation.oncancel = stop;
      });
    };

    let width = container.getBoundingClientRect().width;
    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = container.getBoundingClientRect().width;
      if (nextWidth !== width) finishAll();
      width = nextWidth;
    });
    resizeObserver.observe(container);
    container.addEventListener('click', handleClick);
    reducedMotion.addEventListener('change', finishAll);

    return () => {
      container.removeEventListener('click', handleClick);
      reducedMotion.removeEventListener('change', finishAll);
      resizeObserver.disconnect();
      for (const transition of transitions.values()) transition.stop();
    };
  }, [containerRef]);
}
