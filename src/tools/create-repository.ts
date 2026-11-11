import { createRepositorySchema } from "../schemas/index.js";
import { createRepository } from "../github/operations.js";
import { toAppError } from "../errors/index.js";
import { logger } from "../utils/logging.js";
import type { ToolResult } from "../types.js";

export const createRepositoryTool = {
  name: "create_repository",

  description:
    "Crea un repositorio NUEVO en la cuenta de GitHub del usuario autenticado. " +
    "Úsalo cuando el usuario pida crear, iniciar o abrir un repositorio nuevo. " +
    "No lo uses para ver repositorios existentes (usa list_repositories) " +
    "ni para agregar archivos a un repositorio (usa create_commit). " +
    "Devuelve el nombre completo, la visibilidad, la descripción y la URL del repositorio creado.",

  inputSchema: createRepositorySchema,

  async handler(args: unknown): Promise<ToolResult> {
    try {
      const input = createRepositorySchema.parse(args);
      const repo = await createRepository(input);

      const text = [
        `Repositorio creado: ${repo.fullName}`,
        `Visibilidad: ${repo.isPrivate ? "privado" : "público"}`,
        `Descripción: ${repo.description ?? "(sin descripción)"}`,
        `URL: ${repo.url}`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (error) {
      const appError = toAppError(error);
      logger.error(`create_repository falló: ${appError.message}`);
      return { content: [{ type: "text", text: appError.message }], isError: true };
    }
  },
};
