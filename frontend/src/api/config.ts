/**
 * Centralized API base URL.
 *
 * - Local dev: defaults to '/api' so requests go through the Vite proxy
 *   (see vite.config.ts) to the local backend on port 8001.
 * - Production build: set via VITE_API_URL env var (see .env.production),
 *   e.g. the Railway backend URL.
 *
 * Always import from here — never hardcode the backend URL in components.
 */
export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) || '/api';
