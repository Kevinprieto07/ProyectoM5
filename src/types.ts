// ============================================================
// Tipos del dominio: cómo se ven los datos que devuelve el servidor
// ============================================================

/** Resumen de un repositorio de GitHub. */
export type RepositorySummary = {
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  url: string;
};

/** Resumen de un issue de GitHub. */
export type IssueSummary = {
  number: number;
  title: string;
  author: string | null;
  url: string;
};

/** Resultado de un commit que crea o modifica un archivo. */
export type CommitSummary = {
  sha: string;
  message: string;
  path: string;
  action: "created" | "updated";
  url: string;
};

// ============================================================
// Estructura que devuelve cada tool al LLM (formato MCP)
// ============================================================

/** Lo que devuelve un tool: uno o más bloques de texto y, si falló, isError. */
export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};
