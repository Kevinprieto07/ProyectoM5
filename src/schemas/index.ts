import { z } from "zod";

// ============================================================
// 1. Piezas reutilizables
// ============================================================

/** Dueño del repositorio (usuario u organización). Opcional. */
const ownerSchema = z
  .string()
  .trim()
  .min(1, "El dueño del repositorio no puede estar vacío.")
  .max(39, "El nombre de usuario u organización de GitHub no puede tener más de 39 caracteres.")
  .regex(/^[A-Za-z0-9-]+$/, "El dueño del repositorio solo puede contener letras, números y guiones.")
  .optional()
  .describe(
    "Usuario u organización dueña del repositorio. Si no se indica, se usa la cuenta del usuario autenticado.",
  );

/** Nombre de un repositorio NUEVO: largo de la consigna + caracteres que permite GitHub. */
const newRepoNameSchema = z
  .string({ error: "El nombre del repositorio es obligatorio." })
  .min(3, "El nombre del repositorio debe tener al menos 3 caracteres.")
  .max(100, "El nombre del repositorio no puede tener más de 100 caracteres.")
  .regex(
    /^[A-Za-z0-9._-]+$/,
    "El nombre del repositorio solo puede contener letras, números, guiones, guiones bajos y puntos (sin espacios ni otros símbolos).",
  )
  .describe(
    "Nombre del nuevo repositorio: de 3 a 100 caracteres, solo letras, números, guiones, guiones bajos y puntos. Ejemplo: prueba-mcp.",
  );

/** Nombre de un repositorio que YA EXISTE: reglas reales de GitHub. */
const repoSchema = z
  .string({ error: "El nombre del repositorio es obligatorio." })
  .min(1, "El nombre del repositorio no puede estar vacío.")
  .max(100, "El nombre del repositorio no puede tener más de 100 caracteres.")
  .regex(
    /^[A-Za-z0-9._-]+$/,
    "El nombre del repositorio solo puede contener letras, números, guiones, guiones bajos y puntos.",
  )
  .describe("Nombre de un repositorio existente, sin el dueño. Ejemplo: prueba-mcp.");

// ============================================================
// 2. Un schema por tool
// ============================================================

/** create_repository */
export const createRepositorySchema = z.object({
  name: newRepoNameSchema,
  description: z
    .string()
    .max(350, "La descripción no puede tener más de 350 caracteres.")
    .optional()
    .describe("Descripción corta del repositorio (opcional)."),
  private: z
    .boolean()
    .default(false)
    .describe("true para crear un repositorio privado; false (por defecto) para uno público."),
});

/** create_issue */
export const createIssueSchema = z.object({
  owner: ownerSchema,
  repo: repoSchema,
  title: z
    .string({ error: "El título del issue es obligatorio." })
    .trim()
    .min(1, "El título del issue no puede estar vacío.")
    .max(256, "El título del issue no puede tener más de 256 caracteres.")
    .describe("Título del issue."),
  body: z
    .string()
    .max(65536, "El contenido del issue no puede tener más de 65536 caracteres.")
    .optional()
    .describe("Contenido del issue (opcional). Admite Markdown."),
});

/** list_repositories */
export const listRepositoriesSchema = z.object({
  limit: z
    .number({ error: "La cantidad de resultados debe ser un número." })
    .int("La cantidad de resultados debe ser un número entero.")
    .min(1, "Debes pedir al menos 1 repositorio.")
    .max(100, "Se pueden listar como máximo 100 repositorios a la vez.")
    .default(30)
    .describe("Cantidad máxima de repositorios a devolver, de 1 a 100. Por defecto 30."),
});

/** create_commit */
export const createCommitSchema = z.object({
  owner: ownerSchema,
  repo: repoSchema,
  path: z
    .string({ error: "La ruta del archivo es obligatoria." })
    .trim()
    .min(1, "La ruta del archivo no puede estar vacía.")
    .refine(
      (path) => !path.startsWith("/") && !path.endsWith("/"),
      "La ruta del archivo no puede empezar ni terminar con '/'. Ejemplo válido: docs/notas.md",
    )
    .describe("Ruta del archivo dentro del repositorio. Ejemplo: README.md o docs/notas.md."),
  content: z
    .string({ error: "El contenido del archivo es obligatorio." })
    .describe("Contenido completo del archivo en texto. Si el archivo ya existe, reemplaza su contenido."),
  message: z
    .string({ error: "El mensaje del commit es obligatorio." })
    .trim()
    .min(1, "El mensaje del commit no puede estar vacío.")
    .describe("Mensaje del commit. Ejemplo: 'docs: agrega notas del proyecto'."),
});

/** list_issues */
export const listIssuesSchema = z.object({
  owner: ownerSchema,
  repo: repoSchema,
});

// ============================================================
// 3. Tipos inferidos desde los schemas
// ============================================================

export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>;
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type ListRepositoriesInput = z.infer<typeof listRepositoriesSchema>;
export type CreateCommitInput = z.infer<typeof createCommitSchema>;
export type ListIssuesInput = z.infer<typeof listIssuesSchema>;
