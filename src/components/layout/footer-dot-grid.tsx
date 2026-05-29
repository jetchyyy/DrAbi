import { useEffect, useMemo, useRef, useState } from "react";

const SPACING = 20;
const DOT_R = 2.5;
const ROWS = 22;

// 13-wide × 11-tall heart bitmap (symmetric, tip pointing down)
const HEART_BITMAP = [
  [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
] as const;

const HEART_H = HEART_BITMAP.length;
const HEART_W = HEART_BITMAP[0].length;

export function FooterDotGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(72);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setCols(Math.ceil(el.offsetWidth / SPACING));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const heartStartCol = Math.round((cols - HEART_W) / 2);
  const heartStartRow = Math.floor((ROWS - HEART_H) / 2);

  const dots = useMemo(() => {
    const result: { key: string; x: number; y: number; isHeart: boolean }[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < cols; col++) {
        const hRow = row - heartStartRow;
        const hCol = col - heartStartCol;
        const isHeart =
          hRow >= 0 &&
          hRow < HEART_H &&
          hCol >= 0 &&
          hCol < HEART_W &&
          HEART_BITMAP[hRow][hCol] === 1;
        result.push({
          key: `${row}-${col}`,
          x: col * SPACING + SPACING / 2,
          y: row * SPACING + SPACING / 2,
          isHeart,
        });
      }
    }
    return result;
  }, [cols, heartStartCol, heartStartRow]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <svg
        width={cols * SPACING}
        height={ROWS * SPACING}
        aria-hidden="true"
        style={{ display: "block" }}
      >
        {dots.map(({ key, x, y, isHeart }) => (
          <circle
            key={key}
            cx={x}
            cy={y}
            r={DOT_R}
            fill={isHeart ? "var(--color-primary)" : "#d1d5db"}
          />
        ))}
      </svg>
    </div>
  );
}
