import { ZodError } from "zod";

// ============================================================
// 1. Clase base de todos los errores del proyecto
// ============================================================

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

// ============================================================
// 2. Los cuatro errores que pide la consigna
// ============================================================

/** Datos de entrada incorrectos (no pasaron la validación). */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Token ausente, inválido o sin los permisos (scopes) necesarios. */
export class AuthenticationError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/** Errores que devuelve GitHub, incluido el rate limit. */
export class GitHubAPIError extends AppError {
  readonly status: number | undefined;
  readonly isRateLimit: boolean;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    message: string,
    options: { status?: number; isRateLimit?: boolean; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "GitHubAPIError";
    this.status = options.status;
    this.isRateLimit = options.isRateLimit ?? false;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/** Problemas de conexión: no se pudo llegar a GitHub. */
export class NetworkError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

// ============================================================
// 3. Funciones auxiliares para reconocer cada tipo de error técnico
// ============================================================

/** Información adicional para armar mensajes más claros. */
export type ErrorContext = {
  repo?: string;
};

/** Forma mínima de un error HTTP como los que lanza Octokit. */
type HttpErrorLike = {
  status: number;
  message?: string;
  response?: { headers?: Record<string, string | number | undefined> };
};

/** Códigos que Node usa cuando falla la conexión de red. */
const NETWORK_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);

function isHttpError(error: unknown): error is HttpErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  );
}

function isNetworkFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const err = error as { code?: unknown; message?: unknown; cause?: unknown };

  if (typeof err.code === "string" && NETWORK_ERROR_CODES.has(err.code)) return true;
  if (err.message === "fetch failed") return true;

  return err.cause !== undefined && isNetworkFailure(err.cause);
}

function getHeader(error: HttpErrorLike, name: string): string | undefined {
  const value = error.response?.headers?.[name];
  return value === undefined ? undefined : String(value);
}

function isRateLimitError(error: HttpErrorLike): boolean {
  if (error.status === 429) return true;
  if (error.status !== 403) return false;

  return (
    getHeader(error, "x-ratelimit-remaining") === "0" ||
    /rate limit/i.test(error.message ?? "")
  );
}

function getRetryAfterSeconds(error: HttpErrorLike): number | undefined {
  const retryAfter = Number(getHeader(error, "retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter;

  const resetAt = Number(getHeader(error, "x-ratelimit-reset"));
  if (Number.isFinite(resetAt) && resetAt > 0) {
    return Math.max(0, Math.ceil(resetAt - Date.now() / 1000));
  }

  return undefined;
}

// ============================================================
// 4. Conversión de errores HTTP de GitHub
// ============================================================

function fromHttpError(error: HttpErrorLike, context: ErrorContext): AppError {
  if (isRateLimitError(error)) {
    return new GitHubAPIError(
      "Se superó el límite de solicitudes de GitHub (rate limit). Espera unos minutos e intenta de nuevo.",
      { status: error.status, isRateLimit: true, retryAfterSeconds: getRetryAfterSeconds(error) },
    );
  }

  switch (error.status) {
    case 401:
      return new AuthenticationError(
        "El token de GitHub es inválido o expiró. Genera uno nuevo y actualiza GITHUB_TOKEN en el archivo .env.",
      );

    case 403:
      return new AuthenticationError(
        "GitHub rechazó la operación por falta de permisos. Verifica que el token tenga los scopes repo, user y admin:org.",
      );

    case 404: {
      const message = context.repo
        ? `El repositorio ${context.repo} no fue encontrado. Verifica el nombre e intenta de nuevo.`
        : "El recurso solicitado no fue encontrado en GitHub. Verifica los datos e intenta de nuevo.";
      return new GitHubAPIError(message, { status: 404 });
    }

    case 422:
      return new GitHubAPIError(
        "GitHub no pudo procesar la solicitud. Es posible que el repositorio ya exista o que algún dato no sea aceptado.",
        { status: 422 },
      );

    default:
      return new GitHubAPIError(
        `GitHub respondió con un error (código ${error.status}). Intenta de nuevo más tarde.`,
        { status: error.status },
      );
  }
}

// ============================================================
// 5. Función principal: cualquier error -> uno de nuestros errores
// ============================================================

export function toAppError(error: unknown, context: ErrorContext = {}): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => issue.message).join(" ");
    return new ValidationError(`Datos inválidos: ${details}`);
  }

  if (isNetworkFailure(error)) {
    return new NetworkError(
      "No se pudo conectar con GitHub. Revisa tu conexión a internet e intenta de nuevo.",
    );
  }

  if (isHttpError(error)) return fromHttpError(error, context);

  return new GitHubAPIError(
    "Ocurrió un error inesperado al comunicarse con GitHub. Intenta de nuevo.",
  );
}
