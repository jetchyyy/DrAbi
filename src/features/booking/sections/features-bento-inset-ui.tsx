/**
 * High-fidelity inset dashboards for the portal features bento.
 * Visual language: dashed grids, uppercase micro-labels, dual series, rounded bar caps, soft borders.
 */

const gridLine = '#e2e8f0';
const inkMuted = '#64748b';
const inkFaint = '#94a3b8';
/** Inspo-adjacent accent pair (soft violet + clinic blue) */
const seriesA = '#8b7ae8';
const seriesB = '#ef282c';
const seriesGreen = '#5ecf7a';

type LegendItem = { color: string; label: string };

function ChartLegend({ items, light }: { items: LegendItem[]; light?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-px rounded-full" style={{ backgroundColor: item.color, width: '3px' }} />
          <span
            className={`font-sans text-[9px] font-semibold uppercase tracking-[0.12em] ${light ? 'text-white/70' : 'text-slate-400'}`}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Grouped vertical bars with dashed horizontal grid and rounded tops. */
function GroupedBarChart({
  title,
  categories,
  series,
  yTicks,
  maxY,
  light,
  compact,
}: {
  title: string;
  categories: string[];
  series: { key: string; color: string; values: number[] }[];
  yTicks: number[];
  maxY: number;
  light?: boolean;
  compact?: boolean;
}) {
  const W = 320;
  const H = compact ? 88 : 128;
  const padL = compact ? 30 : 34;
  const padR = 8;
  const padT = compact ? 2 : 6;
  const padB = compact ? 12 : 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const groupCount = categories.length;
  const barGap = 2.5;
  const slotW = innerW / groupCount;
  const gutter = 6;
  const usableW = Math.max(16, slotW - gutter);

  const yScale = (v: number) => padT + innerH - (v / maxY) * innerH;

  const gridYs = yTicks.filter((t) => t <= maxY);

  return (
    <div
      className={`w-full overflow-hidden rounded-xl border ${light ? 'border-white/20 bg-white/[0.08]' : 'border-slate-200/90 bg-white'} ${compact ? 'px-2.5' : 'px-3'} shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ${compact ? 'pb-1.5 pt-1' : 'pb-3 pt-2'}`}
    >
      <div
        className={`flex items-start justify-between gap-2 border-b border-dashed ${compact ? 'pb-1' : 'pb-2'}`}
        style={{ borderColor: light ? 'rgba(255,255,255,0.12)' : '#e2e8f0' }}
      >
        <p className={`font-sans text-[9px] font-semibold uppercase tracking-[0.14em] ${light ? 'text-white/55' : 'text-slate-400'}`}>
          {title}
        </p>
        <ChartLegend
          light={light}
          items={series.map((s) => ({ color: s.color, label: s.key }))}
        />
      </div>
      <svg className={`w-full overflow-visible ${compact ? 'mt-0.5' : 'mt-1'}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* Y-axis labels */}
        {gridYs.map((tick) => (
          <text
            key={tick}
            x={padL - 6}
            y={yScale(tick) + 3}
            textAnchor="end"
            className="font-sans"
            fill={light ? 'rgba(255,255,255,0.45)' : inkFaint}
            fontSize="9"
          >
            {tick}
          </text>
        ))}

        {/* Horizontal dashed grid */}
        {gridYs.map((tick) => (
          <line
            key={`g-${tick}`}
            x1={padL}
            x2={W - padR}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke={light ? 'rgba(255,255,255,0.14)' : gridLine}
            strokeWidth="1"
            strokeDasharray="4 5"
          />
        ))}

        {categories.map((cat, gi) => {
          const gx0 = padL + gi * slotW + (slotW - usableW) / 2;
          const nBars = series.length;
          const bw = Math.max(4, (usableW - barGap * (nBars - 1)) / nBars);
          const baseY = padT + innerH;

          return (
            <g key={cat}>
              {series.map((s, si) => {
                const v = Math.min(maxY, s.values[gi] ?? 0);
                const x = gx0 + si * (bw + barGap);
                const y = yScale(v);
                const h = Math.max(0, baseY - y);
                return (
                  <rect key={s.key} x={x} y={y} width={bw} height={h} rx={4} fill={s.color} opacity={light ? 0.92 : 1} />
                );
              })}
              <text
                x={padL + gi * slotW + slotW / 2}
                y={H - 4}
                textAnchor="middle"
                fill={light ? 'rgba(255,255,255,0.5)' : inkMuted}
                fontSize="9"
                className="font-sans font-medium uppercase tracking-wide"
              >
                {cat}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function smoothLinePath(
  xs: number[],
  ys: number[],
  width: number,
  height: number,
  padX: number,
  padY: number,
  yDomain?: [number, number],
) {
  const n = xs.length;
  if (n < 2) return '';
  const minY = yDomain?.[0] ?? Math.min(...ys);
  const maxY = yDomain?.[1] ?? Math.max(...ys);
  const spanY = maxY - minY || 1;
  const innerW = width - 2 * padX;
  const innerH = height - 2 * padY;
  const pts = xs.map((_, i) => ({
    x: padX + (i / (n - 1)) * innerW,
    y: padY + innerH - ((ys[i]! - minY) / spanY) * innerH * 0.88 - innerH * 0.06,
  }));
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i]!;
    const p1 = pts[i + 1]!;
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

function DualLineChart({
  title,
  legend,
  xLabels,
  seriesAValues,
  seriesBValues,
  compact,
}: {
  title: string;
  legend: LegendItem[];
  xLabels: string[];
  seriesAValues: number[];
  seriesBValues: number[];
  compact?: boolean;
}) {
  const W = 320;
  const H = compact ? 92 : 132;
  const padX = 22;
  const padY = compact ? 8 : 14;
  const yMin = Math.min(...seriesAValues, ...seriesBValues);
  const yMax = Math.max(...seriesAValues, ...seriesBValues);
  const yPad = (yMax - yMin) * 0.08 || 80;
  const domain: [number, number] = [yMin - yPad, yMax + yPad];
  const pathA = smoothLinePath(xLabels.map((_, i) => i), seriesAValues, W, H, padX, padY, domain);
  const pathB = smoothLinePath(xLabels.map((_, i) => i), seriesBValues, W, H, padX, padY, domain);

  return (
    <div
      className={`w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white ${compact ? 'px-2.5 pb-0.5 pt-1' : 'px-3 pb-2 pt-2'} shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]`}
    >
      <div className={`flex items-start justify-between gap-2 border-b border-dashed border-slate-200 ${compact ? 'pb-1' : 'pb-2'}`}>
        <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</p>
        <ChartLegend items={legend} />
      </div>
      <svg className={compact ? 'mt-0 w-full' : 'mt-1 w-full'} viewBox={`0 0 ${W} ${H}`}>
        {[0, 1, 2, 3].map((i) => {
          const y = padY + (i / 3) * (H - 2 * padY);
          return (
            <line
              key={i}
              x1={padX}
              x2={W - padX}
              y1={y}
              y2={y}
              stroke={gridLine}
              strokeWidth="1"
              strokeDasharray="4 5"
            />
          );
        })}
        <path d={pathA} fill="none" stroke={seriesA} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathB} fill="none" stroke={seriesGreen} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        {xLabels.map((lab, i) => {
          const x = padX + (i / (xLabels.length - 1)) * (W - 2 * padX);
          return (
            <text key={lab} x={x} y={H - 3} textAnchor="middle" fill={inkMuted} fontSize="9" className="font-sans font-medium">
              {lab}
            </text>
          );
        })}
        {['0', '0.8K', '1.6K', '2.4K'].map((t, i) => (
          <text
            key={t}
            x={10}
            y={padY + (i / 3) * (H - 2 * padY) + 3}
            fill={inkFaint}
            fontSize="9"
            className="font-sans"
          >
            {t}
          </text>
        ))}
      </svg>
    </div>
  );
}

function SegmentedMetricBar({
  title,
  metricLabel,
  metricValue,
  segments,
  channels,
  compact,
}: {
  title: string;
  metricLabel: string;
  metricValue: string;
  segments: { widthPct: number; color: string }[];
  channels: { name: string; value: string; color: string }[];
  compact?: boolean;
}) {
  return (
    <div
      className={`w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ${compact ? 'pb-2 pt-1.5' : 'pb-3 pt-2'}`}
    >
      <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <div className={compact ? 'mt-2 flex items-baseline gap-2' : 'mt-3 flex items-baseline gap-2'}>
        <span
          className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 ${compact ? 'size-7' : 'h-8 w-8'}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </span>
        <div>
          <p className={`font-sans font-semibold tabular-nums tracking-tight text-slate-900 ${compact ? 'text-base' : 'text-lg'}`}>
            {metricValue}
          </p>
          <p className={`font-sans font-medium text-slate-500 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>{metricLabel}</p>
        </div>
      </div>
      <div className={`flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80 ${compact ? 'mt-2.5' : 'mt-4'}`}>
        {segments.map((s, i) => (
          <span key={i} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${s.widthPct}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <div
        className={`grid grid-cols-3 gap-2 border-t border-dashed border-slate-200 ${compact ? 'mt-2 pt-2' : 'mt-4 pt-3'}`}
      >
        {channels.map((ch) => (
          <div key={ch.name} className="text-center">
            <div className="mx-auto mb-1 flex items-center justify-center gap-1">
              <span className="h-2 w-px rounded-full" style={{ backgroundColor: ch.color, width: '3px' }} />
              <span className="font-sans text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">{ch.name}</span>
            </div>
            <p className={`font-sans font-semibold tabular-nums text-slate-900 ${compact ? 'text-xs' : 'text-sm'}`}>{ch.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Telehealth: grouped bars on glass (virtual vs in-clinic). */
export function TeleconsultInsetUI() {
  return (
    <div className="pointer-events-none mt-3 w-full select-none lg:mt-3.5">
      <GroupedBarChart
        light
        compact
        title="Virtual vs. in-clinic (sessions)"
        categories={['Mon', 'Tue', 'Wed', 'Thu']}
        yTicks={[0, 8, 16, 24]}
        maxY={24}
        series={[
          { key: 'Virtual', color: 'rgba(255,255,255,0.9)', values: [14, 18, 16, 20] },
          { key: 'In-clinic', color: 'rgba(255,255,255,0.32)', values: [10, 9, 11, 8] },
        ]}
      />
      <p className="mt-1 text-center font-sans text-[9px] font-medium leading-snug text-white/50">Live quality checks before each join.</p>
    </div>
  );
}

/** Credential throughput: grouped comparison. */
export function VerifiedInsetUI() {
  return (
    <div className="pointer-events-none mt-3 w-full select-none lg:mt-3.5">
      <GroupedBarChart
        compact
        title="Checks vs. target (hours to clear)"
        categories={['Lic.', 'Board', 'Dept.', 'Bio']}
        yTicks={[0, 24, 48, 72]}
        maxY={72}
        series={[
          { key: 'Actual', color: seriesA, values: [28, 36, 22, 18] },
          { key: 'Target', color: seriesB, values: [48, 48, 48, 48] },
        ]}
      />
    </div>
  );
}

/** Lab SLA style MTTR chart. */
export function LabInsetUI() {
  return (
    <div className="pointer-events-none mt-3 w-full select-none lg:mt-4">
      <GroupedBarChart
        compact
        title="Turnaround vs. SLA (hours)"
        categories={['Stat', 'Urgent', 'Routine', 'Ref.']}
        yTicks={[0, 24, 48, 72]}
        maxY={72}
        series={[
          { key: 'Turnaround', color: seriesB, values: [12, 20, 36, 28] },
          { key: 'SLA cap', color: '#c7e8f5', values: [24, 36, 48, 56] },
        ]}
      />
    </div>
  );
}

export function SummaryInsetUI() {
  return (
    <div className="pointer-events-none mt-3 w-full select-none lg:mt-4">
      <DualLineChart
        compact
        title="Encounters vs. summaries delivered"
        legend={[
          { color: seriesA, label: 'Encounters' },
          { color: seriesGreen, label: 'Summaries' },
        ]}
        xLabels={['JAN', 'MAR', 'MAY', 'JUL', 'SEP', 'NOV']}
        seriesAValues={[820, 1100, 980, 1250, 1180, 1320]}
        seriesBValues={[640, 920, 860, 1020, 980, 1150]}
      />
    </div>
  );
}

export function SupportInsetUI() {
  return (
    <div className="pointer-events-none mt-3 w-full select-none lg:mt-4">
      <SegmentedMetricBar
        compact
        title="Inbound resolution mix"
        metricValue="247"
        metricLabel="patient touches resolved this week"
        segments={[
          { widthPct: 38, color: '#5eb8f7' },
          { widthPct: 34, color: '#ef282c' },
          { widthPct: 28, color: '#1d8dc4' },
        ]}
        channels={[
          { name: 'Phone', value: '94', color: '#5eb8f7' },
          { name: 'Chat', value: '83', color: '#ef282c' },
          { name: 'Portal', value: '70', color: '#1d8dc4' },
        ]}
      />
    </div>
  );
}
