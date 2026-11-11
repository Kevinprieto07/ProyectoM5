import { listIssuesSchema } from "../schemas/index.js";
import { listIssues } from "../github/operations.js";
import { toAppError } from "../errors/index.js";
import { logger } from "../utils/logging.js";
import type { ToolResult } from "../types.js";

export const listIssuesTool = {
  name: "list_issues",

  description:
    "Lista los issues ABIERTOS de un repositorio específico de GitHub (no incluye pull requests). " +
    "Úsalo cuando el usuario quiera ver, revisar o consultar los issues o tareas pendientes de un repositorio. " +
    "Es solo de consulta: para crear un issue usa create_issue. " +
    "Si no se indica el dueño, se usa la cuenta del usuario autenticado. " +
    "Devuelve el número, el título, el autor y la URL de cada issue abierto.",

  inputSchema: listIssuesSchema,

  async handler(args: unknown): Promise<ToolResult> {
    try {
      const input = listIssuesSchema.parse(args);
      const issues = await listIssues(input);
      const repoName = input.owner ? `${input.owner}/${input.repo}` : input.repo;

      if (issues.length === 0) {
        return { content: [{ type: "text", text: `El repositorio ${repoName} no tiene issues abiertos.` }] };
      }

      const lines = issues.map(
        (issue) => `- #${issue.number} ${issue.title} (por ${issue.author ?? "desconocido"}) — ${issue.url}`,
      );
      const text = [`Issues abiertos en ${repoName} (${issues.length}):`, ...lines].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (error) {
      const appError = toAppError(error);
      logger.error(`list_issues falló: ${appError.message}`);
      return { content: [{ type: "text", text: appError.message }], isError: true };
    }
  },
};
