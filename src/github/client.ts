import { Octokit } from "@octokit/rest";
import { AuthenticationError } from "../errors/index.js";

/** Cliente ya creado (se reutiliza en todas las operaciones). */
let client: Octokit | undefined;

/** Devuelve el cliente de GitHub configurado con el token del entorno. */
export function getGitHubClient(): Octokit {
  if (client) return client;

  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    throw new AuthenticationError(
      "No se encontró el token de GitHub. Define GITHUB_TOKEN en el archivo .env (o en la configuración de Antigravity) y reinicia el servidor.",
    );
  }

  client = new Octokit({ auth: token });
  return client;
}
