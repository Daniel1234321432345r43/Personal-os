"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  hasApiKey,
  type AiSettings,
} from "@/lib/ai/settings";

interface SettingsContextValue {
  settings: AiSettings;
  setSettings: (settings: AiSettings) => void;
  /** true si la IA está lista: clave escrita en Ajustes o clave en el servidor (.env). */
  configured: boolean;
  /** true si el servidor tiene una clave de IA en .env (fallback sin escribir clave). */
  envConfigured: boolean;
  /** true si la configuración ya se cargó de localStorage tras montar en el cliente. */
  hydrated: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<AiSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [envConfigured, setEnvConfigured] = useState(false);

  // Cargar desde localStorage una sola vez al montar (evita mismatch de hidratación).
  useEffect(() => {
    setSettingsState(loadSettings());
    setHydrated(true);
  }, []);

  // Consultar si el servidor tiene claves configuradas en .env (fallback).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { configured?: boolean } | null) => {
        if (!cancelled && data?.configured) setEnvConfigured(true);
      })
      .catch(() => {
        // Sin conexión con el endpoint: asumir que no hay clave de entorno.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSettings = useCallback((next: AiSettings) => {
    setSettingsState(next);
    saveSettings(next);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      setSettings,
      configured: hasApiKey(settings) || envConfigured,
      envConfigured,
      hydrated,
    }),
    [settings, setSettings, envConfigured, hydrated],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings debe usarse dentro de <SettingsProvider>.");
  }
  return ctx;
}
