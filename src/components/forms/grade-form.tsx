"use client";

import { useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, inputClass, labelClass, selectClass } from "./ui";
import { todayKey } from "@/lib/format";
import type { Grade } from "@/lib/types";

interface GradeFormProps {
  defaultSubjectId?: string;
  gradeToEdit?: Grade;
  onDone: () => void;
}

export function GradeForm({ defaultSubjectId, gradeToEdit, onDone }: GradeFormProps) {
  const { data, actions } = useData();

  const [subjectId, setSubjectId] = useState(
    gradeToEdit?.subject_id || defaultSubjectId || data.subjects[0]?.id || "",
  );
  const [title, setTitle] = useState(gradeToEdit?.title || "");
  const [score, setScore] = useState(
    gradeToEdit ? String(gradeToEdit.score) : "",
  );
  const [maxScore, setMaxScore] = useState(
    gradeToEdit ? String(gradeToEdit.max_score) : "10",
  );
  const [weight, setWeight] = useState(
    gradeToEdit?.weight_percentage != null ? String(gradeToEdit.weight_percentage) : "",
  );
  const [date, setDate] = useState(gradeToEdit?.date || todayKey());
  const [notes, setNotes] = useState(gradeToEdit?.notes || "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || score === "") return;

    const numScore = parseFloat(score);
    if (isNaN(numScore)) return;

    const numMax = parseFloat(maxScore) || 10;
    const numWeight = weight.trim() !== "" ? parseFloat(weight) : null;

    if (gradeToEdit) {
      actions.updateGrade(gradeToEdit.id, {
        subject_id: subjectId,
        title: title.trim(),
        score: numScore,
        max_score: numMax,
        weight_percentage: numWeight,
        date: date || null,
        notes: notes.trim() || null,
      });
    } else {
      actions.addGrade({
        subject_id: subjectId || null,
        title: title.trim(),
        score: numScore,
        max_score: numMax,
        weight_percentage: numWeight,
        date: date || null,
        notes: notes.trim() || null,
      });
    }

    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="grade-subject">
            Asignatura
          </label>
          <select
            id="grade-subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={selectClass}
            required
          >
            {data.subjects.length === 0 && (
              <option value="">Sin asignaturas (se creará una)</option>
            )}
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="grade-title">
            Nombre de la prueba / examen
          </label>
          <input
            id="grade-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ej. Examen Parcial 1, Práctica Redes"
            className={inputClass}
            required
            autoFocus
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="grade-score">
            Nota obtenida
          </label>
          <input
            id="grade-score"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="ej. 8.5"
            className={inputClass}
            required
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="grade-max">
            Sobre (máximo)
          </label>
          <input
            id="grade-max"
            type="number"
            step="1"
            min="1"
            max="100"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            className={inputClass}
            required
          />
        </div>

        <div className={`${fieldClass} col-span-2 sm:col-span-1`}>
          <label className={labelClass} htmlFor="grade-weight">
            ¿Cuánto cuenta? (%)
          </label>
          <input
            id="grade-weight"
            type="number"
            step="0.5"
            min="0"
            max="100"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="ej. 20"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="grade-date">
            Fecha
          </label>
          <input
            id="grade-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="grade-notes">
            Observaciones (opcional)
          </label>
          <input
            id="grade-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ej. Muy bien la parte práctica, repasar teoría"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" size="sm">
          {gradeToEdit ? "Guardar cambios" : "Añadir calificación"}
        </Button>
      </div>
    </form>
  );
}
