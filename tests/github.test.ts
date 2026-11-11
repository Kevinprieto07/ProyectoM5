import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGitHubClient } from "../src/github/client.js";
import {
  createCommit,
  createRepository,
  listIssues,
  listRepositories,
} from "../src/github/operations.js";
import { AuthenticationError } from "../src/errors/index.js";

// Reemplaza el cliente real por uno falso: ningún test llama a GitHub de verdad.
vi.mock("../src/github/client.js", () => ({ getGitHubClient: vi.fn() }));

/** Crea un Octokit falso con solo los métodos que usan las operaciones. */
function createFakeOctokit() {
  return {
    users: { getAuthenticated: vi.fn().mockResolvedValue({ data: { login: "kevin" } }) },
    repos: {
      createForAuthenticatedUser: vi.fn(),
      listForAuthenticatedUser: vi.fn(),
      getContent: vi.fn(),
      createOrUpdateFileContents: vi.fn(),
    },
    issues: { create: vi.fn(), listForRepo: vi.fn() },
  };
}

const fakeRepo = {
  name: "prueba-mcp",
  full_name: "kevin/prueba-mcp",
  description: "Demo",
  private: false,
  html_url: "https://github.com/kevin/prueba-mcp",
};

let octokit: ReturnType<typeof createFakeOctokit>;

beforeEach(() => {
  octokit = createFakeOctokit();
  vi.mocked(getGitHubClient).mockReturnValue(
    octokit as unknown as ReturnType<typeof getGitHubClient>,
  );
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Operaciones con repositorios", () => {
  it("createRepository envía los datos correctos a GitHub y resume la respuesta", async () => {
    octokit.repos.createForAuthenticatedUser.mockResolvedValue({ data: fakeRepo });

    const repo = await createRepository({ name: "prueba-mcp", description: "Demo", private: false });

    expect(octokit.repos.createForAuthenticatedUser).toHaveBeenCalledWith({
      name: "prueba-mcp",
      description: "Demo",
      private: false,
    });
    expect(repo).toEqual({
      name: "prueba-mcp",
      fullName: "kevin/prueba-mcp",
      description: "Demo",
      isPrivate: false,
      url: "https://github.com/kevin/prueba-mcp",
    });
  });

  it("un token inválido (401) produce un AuthenticationError", async () => {
    octokit.repos.listForAuthenticatedUser.mockRejectedValue({ status: 401, message: "Bad credentials" });

    await expect(listRepositories({ limit: 30 })).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("ante un rate limit espera y reintenta hasta lograrlo", async () => {
    vi.useFakeTimers();
    octokit.repos.listForAuthenticatedUser
      .mockRejectedValueOnce({ status: 429, message: "rate limit exceeded" })
      .mockResolvedValueOnce({ data: [fakeRepo] });

    const promise = listRepositories({ limit: 30 });
    await vi.runAllTimersAsync();
    const repos = await promise;

    expect(octokit.repos.listForAuthenticatedUser).toHaveBeenCalledTimes(2);
    expect(repos).toHaveLength(1);
  });
});

describe("Operaciones con issues", () => {
  it("listIssues excluye los pull requests y usa la cuenta autenticada como dueño", async () => {
    octokit.issues.listForRepo.mockResolvedValue({
      data: [
        { number: 1, title: "Bug real", html_url: "https://github.com/kevin/prueba-mcp/issues/1", user: { login: "kevin" } },
        {
          number: 2,
          title: "Un pull request",
          html_url: "https://github.com/kevin/prueba-mcp/pull/2",
          user: { login: "kevin" },
          pull_request: { url: "https://api.github.com/repos/kevin/prueba-mcp/pulls/2" },
        },
      ],
    });

    const issues = await listIssues({ repo: "prueba-mcp" });

    expect(octokit.issues.listForRepo).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "kevin", repo: "prueba-mcp", state: "open" }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.number).toBe(1);
  });

  it("un repositorio inexistente produce el mensaje del 404 y no se reintenta", async () => {
    octokit.issues.listForRepo.mockRejectedValue({ status: 404, message: "Not Found" });

    await expect(listIssues({ repo: "no-existe" })).rejects.toThrow(
      "El repositorio kevin/no-existe no fue encontrado. Verifica el nombre e intenta de nuevo.",
    );
    expect(octokit.issues.listForRepo).toHaveBeenCalledTimes(1);
  });
});

describe("Commit (crear o modificar un archivo)", () => {
  const commitResponse = {
    data: { commit: { sha: "abc1234def5678", html_url: "https://github.com/kevin/prueba-mcp/commit/abc1234" } },
  };
  const commitInput = { repo: "prueba-mcp", path: "README.md", content: "# Hola", message: "docs: agrega README" };

  it("crea el archivo cuando no existe (sin sha y con el contenido en Base64)", async () => {
    octokit.repos.getContent.mockRejectedValue({ status: 404, message: "Not Found" });
    octokit.repos.createOrUpdateFileContents.mockResolvedValue(commitResponse);

    const commit = await createCommit(commitInput);

    expect(commit.action).toBe("created");
    expect(octokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "kevin",
        path: "README.md",
        sha: undefined,
        content: Buffer.from("# Hola", "utf8").toString("base64"),
      }),
    );
  });

  it("modifica el archivo cuando ya existe, enviando su sha", async () => {
    octokit.repos.getContent.mockResolvedValue({ data: { type: "file", sha: "sha-anterior" } });
    octokit.repos.createOrUpdateFileContents.mockResolvedValue(commitResponse);

    const commit = await createCommit(commitInput);

    expect(commit.action).toBe("updated");
    expect(octokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ sha: "sha-anterior" }),
    );
  });
});
