import { afterEach, describe, expect, it, vi } from "vitest";
import { NetworkError, toAppError } from "../src/errors/index.js";
import { logger } from "../src/utils/logging.js";

describe("toAppError", () => {
  it("convierte un fallo de conexión en NetworkError", () => {
    const error = toAppError({ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND api.github.com" });
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toContain("No se pudo conectar con GitHub");
  });

  it("nunca filtra el mensaje técnico ni el stack trace de un error desconocido", () => {
    const original = new Error("detalle interno del sistema");
    const error = toAppError(original);
    expect(error.message).not.toContain("detalle interno del sistema");
    expect(error.message).not.toMatch(/\n\s+at /);
  });
});

describe("Logger", () => {
  // El token falso se arma al ejecutar el test: nunca aparece completo en el código.
  const FAKE_TOKEN = "ghp_" + "a1B2c3D4e5".repeat(4);

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("oculta el token configurado antes de escribir", () => {
    vi.stubEnv("GITHUB_TOKEN", FAKE_TOKEN);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    logger.error(`Fallo usando el token ${FAKE_TOKEN}`);

    const written = stderrSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(written).not.toContain(FAKE_TOKEN);
    expect(written).toContain("***");
  });
});
