import { createCommitSchema } from "../schemas/index.js";
import { createCommit } from "../github/operations.js";
import { toAppError } from "../errors/index.js";
import { logger } from "../utils/logging.js";
import type { ToolResult } from "../types.js";

export const createCommitTool = {
  name: "create_commit",

  description:
    "Hace un commit que crea o modifica UN archivo en un repositorio existente de GitHub (en su rama principal). " +
    "Si el archivo ya existe, reemplaza todo su contenido; si no existe, lo crea. " +
    "Úsalo cuando el usuario quiera agregar, escribir, actualizar o subir un archivo a un repositorio. " +
    "No lo uses para crear repositorios (usa create_repository) ni para crear issues (usa create_issue). " +
    "Si no se indica el dueño, se usa la cuenta del usuario autenticado. " +
    "Devuelve si el archivo se creó o se modificó, el identificador (sha) del commit y su URL.",

  inputSchema: createCommitSchema,

  async handler(args: unknown): Promise<ToolResult> {
    try {
      const input = createCommitSchema.parse(args);
      const commit = await createCommit(input);

      const actionText = commit.action === "created" ? "creado" : "modificado";
      const text = [
        `Archivo ${commit.path} ${actionText} correctamente.`,
        `Commit: ${commit.sha.slice(0, 7)} — "${commit.message}"`,
        `URL: ${commit.url}`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (error) {
      const appError = toAppError(error);
      logger.error(`create_commit falló: ${appError.message}`);
      return { content: [{ type: "text", text: appError.message }], isError: true };
    }
  },
};
