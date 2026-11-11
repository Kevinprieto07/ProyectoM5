import { describe, expect, it } from "vitest";
import { createIssueSchema, createRepositorySchema } from "../src/schemas/index.js";

describe("Schema de create_repository", () => {
  it("acepta un nombre de repositorio válido", () => {
    const result = createRepositorySchema.safeParse({ name: "prueba-mcp" });
    expect(result.success).toBe(true);
  });

  it("rechaza un nombre de 2 caracteres con el mensaje correcto", () => {
    const result = createRepositorySchema.safeParse({ name: "ab" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "El nombre del repositorio debe tener al menos 3 caracteres.",
    );
  });

  it("rechaza un nombre con espacios con el mensaje correcto", () => {
    const result = createRepositorySchema.safeParse({ name: "mi repo" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("solo puede contener letras, números");
  });

  it("rechaza un nombre de más de 100 caracteres con el mensaje correcto", () => {
    const result = createRepositorySchema.safeParse({ name: "a".repeat(101) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "El nombre del repositorio no puede tener más de 100 caracteres.",
    );
  });

  it("aplica private: false por defecto", () => {
    const input = createRepositorySchema.parse({ name: "prueba-mcp" });
    expect(input.private).toBe(false);
  });
});

describe("Schema de create_issue", () => {
  it("rechaza un issue sin título", () => {
    const result = createIssueSchema.safeParse({ repo: "prueba-mcp" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("El título del issue es obligatorio.");
  });
});
