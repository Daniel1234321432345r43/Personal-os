"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import { formatCurrency, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

type BalancePoint = { date: string; balance: number; net: number };
type ChartRange = "week" | "month" | "year" | "all";

const RANGE_OPTIONS: { value: ChartRange; label: string; days: number | null }[] = [
  { value: "week", label: "Semana", days: 7 },
  { value: "month", label: "Mes", days: 30 },
  { value: "year", label: "Año", days: 365 },
  { value: "all", label: "Todo", days: null },
];

const DAY_MS = 86_400_000;

const RANGE_CAPTION: Record<ChartRange, string> = {
  week: "en la última semana",
  month: "en el último mes",
  year: "en el último año",
  all: "desde el primer movimiento",
};

function keyToUtc(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * Serie DIARIA del saldo acumulado: desde el día anterior al primer movimiento
 * (saldo 0) hasta hoy, arrastrando el saldo en los días sin movimientos. Así la
 * gráfica enseña el tiempo real transcurrido y no solo los días con actividad.
 */
function buildDailyBalance(transactions: Transaction[], today: string): BalancePoint[] {
  if (transactions.length === 0) return [];

  const netByDate = new Map<string, number>();
  for (const t of transactions) {
    if (!t.date) continue;
    const amount = Number(t.amount) || 0;
    const signed = t.type === "income" ? amount : -amount;
    netByDate.set(t.date, (netByDate.get(t.date) ?? 0) + signed);
  }
  const dates = [...netByDate.keys()].sort();
  if (dates.length === 0) return [];

  const lastKey = dates[dates.length - 1] > today ? dates[dates.length - 1] : today;
  const end = keyToUtc(lastKey);
  let running = 0;
  const points: BalancePoint[] = [];
  for (let t = keyToUtc(dates[0]) - DAY_MS; t <= end; t += DAY_MS) {
    const date = utcToKey(t);
    const net = netByDate.get(date) ?? 0;
    running += net;
    points.push({ date, balance: running, net });
  }
  return points;
}

function formatAxisDate(key: string, longSpan: boolean): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(
    "es-ES",
    longSpan ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" },
  ).format(new Date(y, m - 1, d));
}

function formatFullDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

const compactFormatter = new Intl.NumberFormat("es-ES", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function BalanceHistoryChart({ transactions }: { transactions: Transaction[] }) {
  const [range, setRange] = useState<ChartRange>("all");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // La gráfica se dibuja al ancho REAL del contenedor: en móvil no se corta ni
  // obliga a hacer scroll horizontal.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const today = todayKey();
  const allPoints = useMemo(() => buildDailyBalance(transactions, today), [transactions, today]);

  const points = useMemo(() => {
    const option = RANGE_OPTIONS.find((o) => o.value === range);
    if (!option?.days || allPoints.length === 0) return allPoints;
    const cutoff = utcToKey(keyToUtc(today) - option.days * DAY_MS);
    const filtered = allPoints.filter((p) => p.date >= cutoff);
    return filtered.length > 0 ? filtered : allPoints.slice(-1);
  }, [allPoints, range, today]);

  const isCompact = width > 0 && width < 520;
  const height = isCompact ? 220 : 300;
  const padding = { top: 16, right: 14, bottom: 30, left: isCompact ? 46 : 62 };
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;

  const hasData = points.length > 0 && width > 0;

  let chart: React.ReactNode = null;
  let headerPoint: BalancePoint | null = null;
  let change = 0;

  if (hasData) {
    const values = points.map((p) => p.balance);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const rawRange = rawMax - rawMin;
    const pad = rawRange === 0 ? Math.max(Math.abs(rawMax) * 0.15, 10) : rawRange * 0.12;
    const minValue = rawMin - pad;
    const maxValue = rawMax + pad;
    const valueRange = maxValue - minValue || 1;

    const x = (i: number) =>
      padding.left + (points.length === 1 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
    const y = (v: number) => padding.top + ((maxValue - v) / valueRange) * plotHeight;

    const linePoints = points.map((p, i) => `${x(i)},${y(p.balance)}`).join(" ");
    const baseY = padding.top + plotHeight;
    const areaPoints = `${x(0)},${baseY} ${linePoints} ${x(points.length - 1)},${baseY}`;

    const ticks = Array.from({ length: 5 }, (_, i) => {
      const value = maxValue - (i / 4) * valueRange;
      return { value, y: y(value) };
    });

    const spanDays = points.length;
    const longSpan = spanDays > 120;
    const labelCount = Math.max(
      2,
      Math.min(points.length, Math.floor(plotWidth / (isCompact ? 72 : 96))),
    );
    const labelIndexes =
      points.length === 1
        ? [0]
        : Array.from(
            new Set(
              Array.from({ length: labelCount }, (_, i) =>
                Math.round((i * (points.length - 1)) / (labelCount - 1)),
              ),
            ),
          );

    const first = points[0];
    const last = points[points.length - 1];
    change = last.balance - first.balance;
    const positive = change >= 0;
    const active = hoverIndex != null ? points[Math.min(hoverIndex, points.length - 1)] : null;
    headerPoint = active ?? last;
    const activeIndex = active ? Math.min(hoverIndex!, points.length - 1) : points.length - 1;

    const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const ratio = (px - padding.left) / plotWidth;
      const idx = Math.round(Math.min(1, Math.max(0, ratio)) * (points.length - 1));
      setHoverIndex(idx);
    };

    chart = (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn("block select-none", positive ? "text-emerald-500" : "text-red-500")}
        style={{ touchAction: "pan-y" }}
        role="img"
        aria-label="Evolución del saldo acumulado"
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="balance-area-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              x2={padding.left + plotWidth}
              y1={tick.y}
              y2={tick.y}
              className="stroke-border"
              strokeDasharray="3 5"
            />
            <text
              x={padding.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={isCompact ? 10 : 11}
            >
              {compactFormatter.format(tick.value)} €
            </text>
          </g>
        ))}

        {minValue < 0 && maxValue > 0 && (
          <line
            x1={padding.left}
            x2={padding.left + plotWidth}
            y1={y(0)}
            y2={y(0)}
            className="stroke-muted-foreground/40"
          />
        )}

        <polygon points={areaPoints} fill="url(#balance-area-gradient)" />
        <polyline
          points={linePoints}
          fill="none"
          stroke="currentColor"
          strokeWidth={isCompact ? 2.5 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {active && (
          <line
            x1={x(activeIndex)}
            x2={x(activeIndex)}
            y1={padding.top}
            y2={baseY}
            className="stroke-muted-foreground/50"
            strokeDasharray="4 4"
          />
        )}
        <circle
          cx={x(activeIndex)}
          cy={y(headerPoint.balance)}
          r={5}
          className="fill-card"
          stroke="currentColor"
          strokeWidth={3}
        />

        {labelIndexes.map((index, i) => (
          <text
            key={index}
            x={x(index)}
            y={height - 8}
            textAnchor={i === 0 ? "start" : i === labelIndexes.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground"
            fontSize={isCompact ? 10 : 11}
          >
            {formatAxisDate(points[index].date, longSpan)}
          </text>
        ))}
      </svg>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {headerPoint ? (
            <>
              <p
                className={cn(
                  "text-2xl font-semibold tracking-tight",
                  headerPoint.balance >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {formatCurrency(headerPoint.balance)}
              </p>
              <p className="text-xs text-muted-foreground">
                {hoverIndex != null ? (
                  <>
                    {formatFullDate(headerPoint.date)}
                    {headerPoint.net !== 0 &&
                      ` · ${headerPoint.net > 0 ? "+" : "−"}${formatCurrency(Math.abs(headerPoint.net))} ese día`}
                  </>
                ) : (
                  <>
                    <span
                      className={cn(
                        "font-medium",
                        change >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {change >= 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(change))}
                    </span>{" "}
                    {RANGE_CAPTION[range]}
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Saldo acumulado día a día</p>
          )}
        </div>

        <div className="inline-flex rounded-lg bg-muted p-1" role="tablist" aria-label="Periodo de la gráfica">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={range === option.value}
              onClick={() => {
                setRange(option.value);
                setHoverIndex(null);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:px-3",
                range === option.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="w-full overflow-hidden">
        {transactions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <TrendingUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Añade movimientos para ver cómo evoluciona tu saldo con el tiempo.
            </p>
          </div>
        ) : (
          chart ?? <div style={{ height }} />
        )}
      </div>
    </div>
  );
}
