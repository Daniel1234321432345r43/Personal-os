"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { Moon, Sunrise } from "lucide-react";
import { formatDuration } from "@/lib/format";
import {
  SLEEP_LEVEL_STROKE,
  SLEEP_MAX_DURATION_MINUTES,
  SLEEP_MIN_DURATION_MINUTES,
  minutesToTime,
  signedMinuteDelta,
  sleepLevel,
  snapMinutes,
  timeToMinutes,
} from "@/lib/sleep";

/**
 * Selector circular de sueño (estilo Apple Salud / Bedtime).
 *
 * Un anillo de 24 horas con un arco arrastrable: un extremo es la hora de
 * acostarse (luna) y el otro la de despertar (sol). Arrastrar un extremo cambia
 * ese extremo; arrastrar el centro del arco mueve la noche entera.
 *
 * El estado real vive en el padre (`bedtime` / `wakeTime` en formato "HH:MM"),
 * porque así lo comparten el formulario, el guardado local y Supabase.
 */

/** Lienzo del dial: el SVG escala solo, así que estos números son 1:1 con el viewBox. */
const SIZE = 260;
const CENTER = SIZE / 2;
/** Grosor del anillo. */
const STROKE = 30;
/** Radio de la línea central del anillo (deja sitio a los rótulos de fuera). */
const RADIUS = CENTER - STROKE / 2 - 14;
/** Radio de los rótulos de hora (dentro del anillo). */
const LABEL_RADIUS = RADIUS - STROKE / 2 - 9;
/** Tolerancia (en minutos) para "agarrar" un extremo al tocar. */
const GRAB_MINUTES = 45;
/** Marcas de hora: rótulo cada 3 h, tick cada hora. */
const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21];

/** Minutos del día → grados, con las 00:00 arriba y sentido horario. */
function minuteToAngle(minutes: number): number {
  return (minutes / 60) * 15;
}

function polar(angle: number, radius = RADIUS): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

/** Arco de `fromAngle` a `toAngle` en sentido horario. */
function arcPath(fromAngle: number, toAngle: number, radius = RADIUS): string {
  const sweep = (((toAngle - fromAngle) % 360) + 360) % 360;
  if (sweep < 0.5) return "";
  const from = polar(fromAngle, radius);
  const to = polar(toAngle, radius);
  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${to.x} ${to.y}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function SleepRingDial({
  bedtime,
  wakeTime,
  targetHours,
  onChange,
}: {
  bedtime: string;
  wakeTime: string;
  targetHours: number;
  onChange: (bedtime: string, wakeTime: string) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  /** Arrastre en curso: qué se mueve y por dónde iba el dedo (para usar deltas). */
  const dragRef = useRef<{
    type: "bed" | "wake" | "arc";
    lastPointer: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const bedMinutes = timeToMinutes(bedtime) ?? 23 * 60;
  const wakeMinutes = timeToMinutes(wakeTime) ?? 7 * 60;
  /** Duración real de la noche en minutos (0 si las dos horas coinciden). */
  const duration = (wakeMinutes - bedMinutes + 1440) % 1440;
  /** Duración usada al arrastrar, acotada para que el arco no se vuelva loco. */
  const dragDuration = clamp(
    duration,
    SLEEP_MIN_DURATION_MINUTES,
    SLEEP_MAX_DURATION_MINUTES,
  );
  /** Extremo de despertar en "minutos sin envolver" (puede pasar de 1440). */
  const wakeAnchor = bedMinutes + dragDuration;

  const level = sleepLevel(duration / 60, targetHours);
  const color = SLEEP_LEVEL_STROKE[level];

  const bedAngle = minuteToAngle(bedMinutes);
  const wakeAngle = minuteToAngle(bedMinutes + duration);
  const bedPos = polar(bedAngle);
  const wakePos = polar(wakeAngle);

  /** Punto del puntero → minutos del día (0 = arriba, sentido horario). */
  function pointerMinutes(clientX: number, clientY: number): number | null {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = ((clientX - rect.left) / rect.width) * SIZE - CENTER;
    const y = ((clientY - rect.top) / rect.height) * SIZE - CENTER;
    const angle = (Math.atan2(y, x) * 180) / Math.PI + 90;
    return ((((angle % 360) + 360) % 360) / 360) * 1440;
  }

  /** Desplaza `type` los minutos indicados, respetando duración mínima y máxima. */
  function shift(type: "bed" | "wake" | "arc", delta: number) {
    if (delta === 0) return;
    if (type === "bed") {
      const nextBed = clamp(
        bedMinutes + delta,
        wakeAnchor - SLEEP_MAX_DURATION_MINUTES,
        wakeAnchor - SLEEP_MIN_DURATION_MINUTES,
      );
      onChange(minutesToTime(nextBed), minutesToTime(wakeAnchor));
      return;
    }
    if (type === "wake") {
      const nextWake = clamp(
        wakeAnchor + delta,
        bedMinutes + SLEEP_MIN_DURATION_MINUTES,
        bedMinutes + SLEEP_MAX_DURATION_MINUTES,
      );
      onChange(minutesToTime(bedMinutes), minutesToTime(nextWake));
      return;
    }
    const nextBed = bedMinutes + delta;
    onChange(minutesToTime(nextBed), minutesToTime(nextBed + dragDuration));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const minutes = pointerMinutes(event.clientX, event.clientY);
    if (minutes == null) return;

    const bedDistance = Math.abs(signedMinuteDelta(minutes, bedMinutes));
    const wakeDistance = Math.abs(signedMinuteDelta(minutes, wakeMinutes));
    const type =
      bedDistance <= GRAB_MINUTES ? "bed" : wakeDistance <= GRAB_MINUTES ? "wake" : "arc";

    dragRef.current = { type, lastPointer: snapMinutes(minutes) };
    setDragging(true);
    // Capturamos el puntero para que el arrastre no se corte al salir del dial.
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const minutes = pointerMinutes(event.clientX, event.clientY);
    if (minutes == null) return;

    // Se compara siempre contra la última posición del puntero (en pasos de
    // 5 min), así el arrastre es continuo aunque el arco dé la vuelta a las 12.
    const snapped = snapMinutes(minutes);
    const delta = signedMinuteDelta(snapped, drag.lastPointer);
    if (delta === 0) return;
    drag.lastPointer = snapped;
    shift(drag.type, delta);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
  }

  /** Ajuste con teclado (flechas) sobre cada extremo: ±5 min. */
  function handleKey(type: "bed" | "wake", event: ReactKeyboardEvent<HTMLButtonElement>) {
    const step = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -5 : 5;
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown"
    ) {
      return;
    }
    event.preventDefault();
    shift(type, step);
  }

  return (
    <div className="mx-auto w-full max-w-[300px] select-none sm:max-w-[340px]">
      <div
        ref={surfaceRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative aspect-square w-full touch-none ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-full w-full"
          role="img"
          aria-label={`Has dormido de ${bedtime} a ${wakeTime}`}
        >
          {/* Anillo de fondo + marcas de hora */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            className="text-muted/70"
          />
          {Array.from({ length: 24 }, (_, hour) => {
            const angle = minuteToAngle(hour * 60);
            const inner = polar(angle, RADIUS + STROKE / 2 - 4);
            const outer = polar(angle, RADIUS + STROKE / 2 + 2);
            return (
              <line
                key={hour}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                strokeWidth={hour % 3 === 0 ? 2 : 1}
                className="text-muted-foreground/40"
                stroke="currentColor"
              />
            );
          })}
          {HOUR_LABELS.map((hour) => {
            const pos = polar(minuteToAngle(hour * 60), LABEL_RADIUS);
            return (
              <text
                key={hour}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                className="fill-muted-foreground"
              >
                {String(hour).padStart(2, "0")}
              </text>
            );
          })}

          {/* Arco de la noche */}
          {duration > 0 && (
            <path
              d={arcPath(bedAngle, wakeAngle)}
              fill="none"
              stroke={color}
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Horas dormidas en el centro del dial */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
          <span className="text-2xl font-semibold tabular-nums">
            {formatDuration(duration)}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {bedtime} → {wakeTime}
          </span>
          <span className="text-[11px] text-muted-foreground">
            objetivo {targetHours} h
          </span>
        </div>

        {/* Extremos arrastrables */}
        <button
          type="button"
          aria-label={`Hora de dormir: ${bedtime}. Usa las flechas para ajustarla.`}
          onKeyDown={(event) => handleKey("bed", event)}
          style={{
            left: `${(bedPos.x / SIZE) * 100}%`,
            top: `${(bedPos.y / SIZE) * 100}%`,
            borderColor: color,
          }}
          className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-card shadow-md"
        >
          <Moon className="h-4 w-4" style={{ color }} />
        </button>
        <button
          type="button"
          aria-label={`Hora de despertar: ${wakeTime}. Usa las flechas para ajustarla.`}
          onKeyDown={(event) => handleKey("wake", event)}
          style={{
            left: `${(wakePos.x / SIZE) * 100}%`,
            top: `${(wakePos.y / SIZE) * 100}%`,
            borderColor: color,
          }}
          className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-card shadow-md"
        >
          <Sunrise className="h-4 w-4 text-amber-500" />
        </button>
      </div>

      <p className="mt-1 text-center text-[11px] text-muted-foreground">
        Arrastra la luna o el sol para ajustar los extremos, o el arco para mover
        la noche entera (pasos de 5 min).
      </p>
    </div>
  );
}
