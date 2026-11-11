import { listRepositoriesSchema } from "../schemas/index.js";
import { listRepositories } from "../github/operations.js";
import { toAppError } from "../errors/index.js";
import { logger } from "../utils/logging.js";
import type { ToolResult } from "../types.js";

export const listRepositoriesTool = {
  name: "list_repositories",

  description:
    "Lista los repositorios de la cuenta de GitHub del usuario autenticado, los actualizados más recientemente primero. " +
    "Úsalo cuando el usuario quiera ver, buscar o recordar sus repositorios. " +
    "Es solo de consulta: no crea ni modifica nada (para crear uno usa create_repository). " +
    "No necesita parámetros; opcionalmente acepta la cantidad máxima de resultados. " +
    "Devuelve el nombre completo, la visibilidad, la descripción y la URL de cada repositorio.",

  inputSchema: listRepositoriesSchema,

  async handler(args: unknown): Promise<ToolResult> {
    try {
      const input = listRepositoriesSchema.parse(args ?? {});
      const repos = await listRepositories(input);

      if (repos.length === 0) {
        return { content: [{ type: "text", text: "No se encontraron repositorios en tu cuenta." }] };
      }

      const lines = repos.map(
        (repo) =>
          `- ${repo.fullName} (${repo.isPrivate ? "privado" : "público"})` +
          `${repo.description ? `: ${repo.description}` : ""} — ${repo.url}`,
      );
      const text = [`Se encontraron ${repos.length} repositorios:`, ...lines].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (error) {
      const appError = toAppError(error);
      logger.error(`list_repositories falló: ${appError.message}`);
      return { content: [{ type: "text", text: appError.message }], isError: true };
    }
  },
};
