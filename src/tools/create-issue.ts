import { createIssueSchema } from "../schemas/index.js";
import { createIssue } from "../github/operations.js";
import { toAppError } from "../errors/index.js";
import { logger } from "../utils/logging.js";
import type { ToolResult } from "../types.js";

export const createIssueTool = {
  name: "create_issue",

  description:
    "Abre (crea) un issue NUEVO en un repositorio existente de GitHub. " +
    "Úsalo cuando el usuario quiera reportar un error, registrar una tarea, una idea o abrir un issue. " +
    "No lo uses para ver o consultar issues existentes (usa list_issues). " +
    "Si no se indica el dueño, se usa la cuenta del usuario autenticado. " +
    "Devuelve el número, el título y la URL del issue creado.",

  inputSchema: createIssueSchema,

  async handler(args: unknown): Promise<ToolResult> {
    try {
      const input = createIssueSchema.parse(args);
      const issue = await createIssue(input);

      const text = [
        `Issue #${issue.number} creado: ${issue.title}`,
        `URL: ${issue.url}`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (error) {
      const appError = toAppError(error);
      logger.error(`create_issue falló: ${appError.message}`);
      return { content: [{ type: "text", text: appError.message }], isError: true };
    }
  },
};
