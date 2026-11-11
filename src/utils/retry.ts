import { AppError, GitHubAPIError, NetworkError, toAppError, type ErrorContext } from "../errors/index.js";
import { logger } from "./logging.js";

// ============================================================
// 1. Opciones de los reintentos
// ============================================================

export type RetryOptions = {
  /** Cuántas veces reintentar como máximo (sin contar el primer intento). */
  maxRetries?: number;
  /** Espera inicial en milisegundos; se duplica en cada reintento. */
  baseDelayMs?: number;
  /** Espera máxima aceptada; si GitHub pide más, no se reintenta. */
  maxDelayMs?: number;
  /** Datos para armar mensajes de error claros (ej. nombre del repo). */
  context?: ErrorContext;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1_000;
const DEFAULT_MAX_DELAY_MS = 60_000;

// ============================================================
// 2. ¿Vale la pena reintentar?
// ============================================================

/** Solo se reintentan el rate limit y los fallos de red: son temporales. */
function isRetryable(error: AppError): boolean {
  if (error instanceof NetworkError) return true;
  if (error instanceof GitHubAPIError && error.isRateLimit) return true;
  return false;
}

// ============================================================
// 3. ¿Cuánto esperar?
// ============================================================

/** Si GitHub dijo cuánto esperar, se respeta; si no, exponential backoff. */
function getDelayMs(error: AppError, attempt: number, baseDelayMs: number): number {
  if (error instanceof GitHubAPIError && error.retryAfterSeconds !== undefined) {
    return error.retryAfterSeconds * 1_000;
  }
  return baseDelayMs * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// 4. Ejecutar una operación con reintentos
// ============================================================

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    context = {},
  } = options;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (rawError) {
      const error = toAppError(rawError, context);

      if (!isRetryable(error) || attempt >= maxRetries) throw error;

      const delayMs = getDelayMs(error, attempt, baseDelayMs);
      if (delayMs > maxDelayMs) throw error;

      logger.warn(
        `Error temporal (${error.name}). Reintento ${attempt + 1} de ${maxRetries} en ${Math.round(delayMs / 1_000)} s.`,
      );

      await sleep(delayMs);
      attempt++;
    }
  }
}
