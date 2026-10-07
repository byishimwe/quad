import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import {
  MockPostCard,
  MockPollCard,
  MockStoryCard,
  MockChatCard,
  MockNotificationCard,
  MockProfileCard,
} from "./MockCards";

const CARDS = [
  { id: "post", component: <MockPostCard /> },
  { id: "poll", component: <MockPollCard /> },
  { id: "story", component: <MockStoryCard /> },
  { id: "chat", component: <MockChatCard /> },
  { id: "notif", component: <MockNotificationCard /> },
  { id: "profile", component: <MockProfileCard /> },
];

// Duplicate first and last to allow seamless infinite wrapping
const DISPLAY_CARDS = [CARDS[CARDS.length - 1], ...CARDS, CARDS[0]];

/** Consistent gap between cards (px) */
const GAP = 16;

/** Seconds each card rests at center before advancing */
const DWELL_SECONDS = 3.8;

/** Duration of each scroll transition (seconds) */
const TRANSITION_DURATION = 0.45;

export function LeftPanelCarousel() {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeIndexRef = useRef(1); // keep a ref to avoid stale closures

  const [containerHeight, setContainerHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(1);
  const [cardCenters, setCardCenters] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(() => document.visibilityState === "visible");

  const y = useMotionValue(0);

  // Keep ref in sync with state
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    const onVisibilityChange = () => setIsVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  /**
   * Walk the card refs and compute the Y-center of each card using their
   * natural (intrinsic) rendered heights. This allows cards of completely
   * different sizes to coexist in the carousel.
   */
  const measure = useCallback((): number[] => {
    const centers: number[] = [];
    let cumY = 0;

    for (let i = 0; i < DISPLAY_CARDS.length; i++) {
      const el = cardRefs.current[i];
      const cardH = el ? el.offsetHeight : 200; // fallback
      centers.push(cumY + cardH / 2);
      cumY += cardH + GAP;
    }

    return centers;
  }, []);

  // --- Initial measurement after first paint --------------------------------
  useEffect(() => {
    // Small delay to allow images / layout to settle
    const timeout = setTimeout(() => {
      if (!containerRef.current) return;
      const h = containerRef.current.offsetHeight;
      setContainerHeight(h);

      const centers = measure();
      setCardCenters(centers);

      const target = h / 2 - centers[1];
      if (reducedMotion) y.set(target);
      else {
        y.set(target - 24);
        animate(y, target, { duration: 0.35, ease: "easeOut" });
      }
      setReady(true);
    }, 50);

    return () => clearTimeout(timeout);
  }, [measure, y, reducedMotion]);

  // --- Resize handling -------------------------------------------------------
  useEffect(() => {
    const onResize = () => {
      if (!containerRef.current) return;
      const h = containerRef.current.offsetHeight;
      setContainerHeight(h);

      const centers = measure();
      setCardCenters(centers);

      // Re-center whichever card is currently active
      y.set(h / 2 - centers[activeIndexRef.current]);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure, y]);

  // --- Re-measure when a card's intrinsic size changes (e.g. image load) -----
  useEffect(() => {
    if (!ready) return;

    const observer = new ResizeObserver(() => {
      const centers = measure();
      setCardCenters(centers);

      // Maintain centering of the currently active card
      if (containerRef.current) {
        const h = containerRef.current.offsetHeight;
        y.set(h / 2 - centers[activeIndexRef.current]);
      }
    });

    cardRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [ready, measure, y]);

  // --- Auto-advance timer ----------------------------------------------------
  useEffect(() => {
    if (!ready || containerHeight === 0 || isHovered || !isVisible || reducedMotion) return;

    const timer = setTimeout(() => {
      // Fresh measurement right before animating
      const centers = measure();
      setCardCenters(centers);

      const nextIndex = activeIndex + 1;
      const viewportCenter = containerHeight / 2;
      const targetY = viewportCenter - centers[nextIndex];

      animate(y, targetY, {
        duration: TRANSITION_DURATION,
        // More "Weighted" Snap Easing
        ease: [0.22, 1, 0.36, 1],
        onComplete: () => {
          if (nextIndex === DISPLAY_CARDS.length - 1) {
            // Reached the duplicated first card – silently snap to real first
            const freshCenters = measure();
            setCardCenters(freshCenters);
            y.set(viewportCenter - freshCenters[1]);
            setActiveIndex(1);
            return;
          }

          setActiveIndex(nextIndex);
        },
      });
    }, DWELL_SECONDS * 1000);

    return () => clearTimeout(timer);
  }, [ready, containerHeight, activeIndex, measure, y, isHovered, isVisible, reducedMotion]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative h-full w-full overflow-hidden flex flex-col items-center select-none"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)",
      }}>
      <motion.div
        className="flex flex-col w-full"
        style={{
          y,
          gap: `${GAP}px`,
          opacity: ready ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}>
        {DISPLAY_CARDS.map((card, index) => (
          <CarouselItem
            key={`${card.id}-${index}`}
            ref={(el: HTMLDivElement | null) => {
              cardRefs.current[index] = el;
            }}
            y={y}
            containerHeight={containerHeight}
            cardCenterY={cardCenters[index] ?? 0}>
            {card.component}
          </CarouselItem>
        ))}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carousel Item – applies visual transforms without constraining height
// ---------------------------------------------------------------------------
const CarouselItem = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    y: MotionValue<number>;
    containerHeight: number;
    cardCenterY: number;
  }
>(({ children, y, containerHeight, cardCenterY }, ref) => {
  const viewportCenter = containerHeight / 2;

  // --- Scale: center card = 1, edges slightly smaller ---
  const scale = useTransform(y, (latestY) => {
    const currentCenter = cardCenterY + latestY;
    const distanceFromCenter = Math.abs(viewportCenter - currentCenter);
    const maxDist = containerHeight * 0.6;
    const factor = Math.min(distanceFromCenter / maxDist, 1);
    return 1 - factor * 0.08;
  });

  // --- Opacity: center = full, edges fade ---
  const opacity = useTransform(y, (latestY) => {
    const currentCenter = cardCenterY + latestY;
    const distanceFromCenter = Math.abs(viewportCenter - currentCenter);
    const maxDist = containerHeight * 0.6;
    const factor = Math.min(distanceFromCenter / maxDist, 1);
    return 1 - factor * 0.35;
  });

  // --- Shadow: strongest at center ---
  const shadow = useTransform(y, (latestY) => {
    const currentCenter = cardCenterY + latestY;
    const distanceFromCenter = Math.abs(viewportCenter - currentCenter);
    const maxDist = containerHeight * 0.25;
    const factor = 1 - Math.min(distanceFromCenter / maxDist, 1);
    return `0 ${4 * factor}px ${12 * factor}px -4px hsla(var(--primary) / ${0.1 * factor})`;
  });

  return (
    <motion.div
      ref={ref}
      style={{
        scale,
        opacity,
        boxShadow: shadow,
      }}
      className="w-full shrink-0 rounded-[2rem] overflow-hidden">
      {children}
    </motion.div>
  );
});

CarouselItem.displayName = "CarouselItem";
