import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRepositoryTool } from "./tools/create-repository.js";
import { createIssueTool } from "./tools/create-issue.js";
import { listRepositoriesTool } from "./tools/list-repositories.js";
import { createCommitTool } from "./tools/create-commit.js";
import { listIssuesTool } from "./tools/list-issues.js";
import { logger } from "./utils/logging.js";

// ============================================================
// 1. Cargar las variables de entorno (ruta absoluta)
// ============================================================

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(currentDir, "..", ".env");
dotenv.config({ path: envPath, quiet: true });

if (!process.env.GITHUB_TOKEN) {
  logger.warn(
    "No se encontró GITHUB_TOKEN. El servidor arrancará, pero los tools fallarán hasta que lo configures en el archivo .env.",
  );
}

// ============================================================
// 2. Crear el servidor MCP
// ============================================================

const server = new McpServer({
  name: "github-ai-agent",
  version: "1.0.0",
});

// ============================================================
// 3. Registrar los cinco tools
// ============================================================

server.registerTool(
  createRepositoryTool.name,
  { description: createRepositoryTool.description, inputSchema: createRepositoryTool.inputSchema },
  (args) => createRepositoryTool.handler(args),
);

server.registerTool(
  createIssueTool.name,
  { description: createIssueTool.description, inputSchema: createIssueTool.inputSchema },
  (args) => createIssueTool.handler(args),
);

server.registerTool(
  listRepositoriesTool.name,
  { description: listRepositoriesTool.description, inputSchema: listRepositoriesTool.inputSchema },
  (args) => listRepositoriesTool.handler(args),
);

server.registerTool(
  createCommitTool.name,
  { description: createCommitTool.description, inputSchema: createCommitTool.inputSchema },
  (args) => createCommitTool.handler(args),
);

server.registerTool(
  listIssuesTool.name,
  { description: listIssuesTool.description, inputSchema: listIssuesTool.inputSchema },
  (args) => listIssuesTool.handler(args),
);

// ============================================================
// 4. Abrir la comunicación por stdio
// ============================================================

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Servidor MCP github-ai-agent iniciado. Esperando solicitudes por stdio...");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`No se pudo iniciar el servidor: ${message}`);
  process.exit(1);
});
