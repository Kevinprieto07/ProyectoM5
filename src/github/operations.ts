import { getGitHubClient } from "./client.js";
import { GitHubAPIError, ValidationError } from "../errors/index.js";
import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logging.js";
import type { CommitSummary, IssueSummary, RepositorySummary } from "../types.js";
import type {
  CreateCommitInput,
  CreateIssueInput,
  CreateRepositoryInput,
  ListIssuesInput,
  ListRepositoriesInput,
} from "../schemas/index.js";

// ============================================================
// 1. Conversión de respuestas de GitHub a nuestros tipos
// ============================================================

/** Campos de un repositorio de GitHub que nos interesan. */
type GitHubRepository = {
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
};

/** Campos de un issue de GitHub que nos interesan. */
type GitHubIssue = {
  number: number;
  title: string;
  html_url: string;
  user: { login: string } | null;
};

function toRepositorySummary(repo: GitHubRepository): RepositorySummary {
  return {
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    isPrivate: repo.private,
    url: repo.html_url,
  };
}

function toIssueSummary(issue: GitHubIssue): IssueSummary {
  return {
    number: issue.number,
    title: issue.title,
    author: issue.user?.login ?? null,
    url: issue.html_url,
  };
}

// ============================================================
// 2. Dueño por defecto: el usuario autenticado
// ============================================================

/** Si no se indicó dueño, usa la cuenta del token. */
async function resolveOwner(owner: string | undefined): Promise<string> {
  if (owner) return owner;

  const octokit = getGitHubClient();
  const { data } = await withRetry(() => octokit.users.getAuthenticated());
  return data.login;
}

// ============================================================
// 3. Operaciones con repositorios
// ============================================================

export async function createRepository(input: CreateRepositoryInput): Promise<RepositorySummary> {
  const octokit = getGitHubClient();
  logger.info(`Creando repositorio ${input.name}`);

  const { data } = await withRetry(
    () =>
      octokit.repos.createForAuthenticatedUser({
        name: input.name,
        description: input.description,
        private: input.private,
      }),
    { context: { repo: input.name } },
  );

  return toRepositorySummary(data);
}

export async function listRepositories(input: ListRepositoriesInput): Promise<RepositorySummary[]> {
  const octokit = getGitHubClient();

  const { data } = await withRetry(() =>
    octokit.repos.listForAuthenticatedUser({
      per_page: input.limit,
      sort: "updated",
    }),
  );

  return data.map(toRepositorySummary);
}

// ============================================================
// 4. Operaciones con issues
// ============================================================

export async function createIssue(input: CreateIssueInput): Promise<IssueSummary> {
  const octokit = getGitHubClient();
  const owner = await resolveOwner(input.owner);
  const fullName = `${owner}/${input.repo}`;
  logger.info(`Creando issue en ${fullName}`);

  const { data } = await withRetry(
    () =>
      octokit.issues.create({
        owner,
        repo: input.repo,
        title: input.title,
        body: input.body,
      }),
    { context: { repo: fullName } },
  );

  return toIssueSummary(data);
}

export async function listIssues(input: ListIssuesInput): Promise<IssueSummary[]> {
  const octokit = getGitHubClient();
  const owner = await resolveOwner(input.owner);
  const fullName = `${owner}/${input.repo}`;

  const { data } = await withRetry(
    () =>
      octokit.issues.listForRepo({
        owner,
        repo: input.repo,
        state: "open",
        per_page: 100,
      }),
    { context: { repo: fullName } },
  );

  // GitHub devuelve también los pull requests en esta lista: se filtran.
  return data.filter((issue) => !issue.pull_request).map(toIssueSummary);
}

// ============================================================
// 5. Commit: crear o modificar un archivo
// ============================================================

/** Devuelve el sha del archivo si ya existe, o undefined si no existe. */
async function getExistingFileSha(
  owner: string,
  repo: string,
  path: string,
  fullName: string,
): Promise<string | undefined> {
  const octokit = getGitHubClient();

  try {
    const { data } = await withRetry(() => octokit.repos.getContent({ owner, repo, path }), {
      context: { repo: fullName },
    });

    if (Array.isArray(data) || data.type !== "file") {
      throw new ValidationError(
        `La ruta ${path} no es un archivo (es una carpeta u otro tipo de elemento). Indica la ruta de un archivo.`,
      );
    }

    return data.sha;
  } catch (error) {
    if (error instanceof GitHubAPIError && error.status === 404) return undefined;
    throw error;
  }
}

export async function createCommit(input: CreateCommitInput): Promise<CommitSummary> {
  const octokit = getGitHubClient();
  const owner = await resolveOwner(input.owner);
  const fullName = `${owner}/${input.repo}`;

  const existingSha = await getExistingFileSha(owner, input.repo, input.path, fullName);
  const action = existingSha ? "updated" : "created";
  logger.info(`${action === "updated" ? "Modificando" : "Creando"} ${input.path} en ${fullName}`);

  const { data } = await withRetry(
    () =>
      octokit.repos.createOrUpdateFileContents({
        owner,
        repo: input.repo,
        path: input.path,
        message: input.message,
        content: Buffer.from(input.content, "utf8").toString("base64"),
        sha: existingSha,
      }),
    { context: { repo: fullName } },
  );

  return {
    sha: data.commit.sha ?? "",
    message: input.message,
    path: input.path,
    action,
    url: data.commit.html_url ?? "",
  };
}
