// ============================================================
// 1. Niveles de log
// ============================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Ordenados de menor a mayor gravedad: la posición en la lista es su prioridad. */
const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

const DEFAULT_LEVEL: LogLevel = "info";

function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as string[]).includes(value);
}

/** Lee LOG_LEVEL en cada llamada; si no existe o es inválido, usa "info". */
function getCurrentLevel(): LogLevel {
  const value = process.env.LOG_LEVEL?.trim().toLowerCase();
  return value !== undefined && isLogLevel(value) ? value : DEFAULT_LEVEL;
}

// ============================================================
// 2. Ocultar tokens
// ============================================================

/** Formatos de token de GitHub: ghp_, gho_, ghu_, ghs_, ghr_ y github_pat_. */
const GITHUB_TOKEN_PATTERN = /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g;

const MASK = "***";

/** Reemplaza cualquier token por *** antes de escribirlo. */
export function maskSecrets(text: string): string {
  let masked = text;

  const token = process.env.GITHUB_TOKEN;
  if (token && token.length >= 8) {
    masked = masked.split(token).join(MASK);
  }

  return masked.replace(GITHUB_TOKEN_PATTERN, MASK);
}

// ============================================================
// 3. Escribir el log (siempre en stderr)
// ============================================================

function log(level: LogLevel, message: string): void {
  const minimum = LOG_LEVELS.indexOf(getCurrentLevel());
  if (LOG_LEVELS.indexOf(level) < minimum) return;

  process.stderr.write(`[${level.toUpperCase()}] ${maskSecrets(message)}\n`);
}

// ============================================================
// 4. El logger que usa el resto del proyecto
// ============================================================

export const logger = {
  debug: (message: string) => log("debug", message),
  info: (message: string) => log("info", message),
  warn: (message: string) => log("warn", message),
  error: (message: string) => log("error", message),
};
