# GitHub AI Agent (AutomateHub)

Servidor **MCP (Model Context Protocol)** en **Node.js + TypeScript** que permite a un agente de IA (Gemini, Claude u otro LLM dentro de **Antigravity**) automatizar tareas de GitHub a partir de instrucciones en lenguaje natural: crear repositorios, hacer commits, abrir issues y consultarlos.

## Descripción

Este proyecto expone **cinco tools** a través del protocolo MCP. Antigravity inicia el servidor y se comunica con él por **stdio**. El LLM lee la descripción de cada tool, decide cuál usar según lo que pide el usuario y con qué parámetros, y el servidor ejecuta la acción en GitHub mediante **Octokit**.

Características principales:

- **Validación con Zod**: cada parámetro se valida antes de llamar a GitHub, con mensajes de error claros en español.
- **Errores en lenguaje natural**: cualquier fallo (token inválido, repositorio inexistente, rate limit, sin conexión) se traduce a un mensaje que el LLM puede transmitirle al usuario. Nunca se expone un stack trace.
- **Reintentos con exponential backoff**: ante un rate limit o un fallo temporal de red, el servidor espera y reintenta automáticamente (1 s → 2 s → 4 s), respetando el tiempo de espera que indique GitHub.
- **Logs seguros**: todos los logs van a `stderr` (para no interferir con el protocolo) y el token se oculta siempre.

## ¿Por qué es útil?

Permite trabajar con GitHub sin salir del editor ni cambiar de contexto, simplemente pidiéndolo en el chat del agente.

| Caso de uso | Ejemplo de pedido |
|---|---|
| Iniciar un proyecto nuevo | "Crea un repositorio privado llamado api-pagos" |
| Documentar rápidamente | "Agrega un README.md a api-pagos explicando cómo instalarlo" |
| Registrar tareas mientras programas | "Anota en api-pagos que falta validar el login" |
| Revisar pendientes | "¿Qué issues abiertos tiene api-pagos?" |
| Recordar en qué estabas trabajando | "Muéstrame mis repositorios más recientes" |

## Requisitos

- **Node.js 18 o superior** (verifícalo con `node -v`).
- **npm** (se instala junto con Node.js).
- **Git**, para clonar el repositorio.
- Una **cuenta de GitHub** y un **Personal Access Token (classic)** con los scopes `repo`, `user` y `admin:org`.
- **Antigravity IDE**, que actúa como host MCP.

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Kevinprieto07/ProyectoM5.git
cd ProyectoM5

# 2. Instalar las dependencias
npm install

# 3. Compilar TypeScript a JavaScript (genera la carpeta dist/)
npm run build
```

## Configuración

### 1. Obtener el Personal Access Token

1. En GitHub, haz clic en tu foto (arriba a la derecha) → **Settings**.
2. En el menú izquierdo, al final: **Developer settings**.
3. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**.
4. Escribe una nota (por ejemplo, `github-ai-agent`) y elige una fecha de expiración.
5. Marca los scopes `repo`, `user` y `admin:org`.
6. Haz clic en **Generate token** y **copia el token** (empieza con `ghp_`). GitHub no lo vuelve a mostrar.

### 2. Scopes necesarios

| Scope | Para qué lo usa este servidor |
|---|---|
| `repo` | Crear repositorios, hacer commits, crear y listar issues (incluidos los de repositorios privados) |
| `user` | Consultar la cuenta autenticada, que se usa como dueño por defecto cuando no se indica otro |
| `admin:org` | Trabajar con repositorios de organizaciones |

### 3. Configurar el archivo `.env`

Copia la plantilla y completa los valores:

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

```env
GITHUB_TOKEN=ghp_tu_token_aqui
LOG_LEVEL=info
```

| Variable | Obligatoria | Descripción |
|---|---|---|
| `GITHUB_TOKEN` | Sí | Tu Personal Access Token |
| `LOG_LEVEL` | No | Nivel de detalle de los logs: `debug`, `info` (por defecto), `warn` o `error` |

> ⚠️ El archivo `.env` está en `.gitignore` y **nunca debe subirse** al repositorio. Si tu token se publica por error, revócalo de inmediato en GitHub.

### 4. Configurar el servidor en Antigravity

1. Abre **Antigravity IDE** y el panel del agente.
2. En el menú **"…"** del panel → **MCP Servers** → **Manage MCP Servers** → **View raw config**.
3. Agrega el servidor en `mcp_config.json`, usando la **ruta absoluta** al archivo compilado:

```json
{
  "mcpServers": {
    "github-ai-agent": {
      "command": "node",
      "args": ["C:\\ruta\\absoluta\\a\\ProyectoM5\\dist\\server.js"]
    }
  }
}
```

4. Guarda el archivo y actualiza la lista de servidores. `github-ai-agent` debe aparecer con sus 5 tools.

Notas:

- En Windows, cada `\` de la ruta se escribe como `\\` dentro del JSON.
- El servidor lee el token del `.env` del proyecto aunque Antigravity lo inicie desde otra carpeta. Opcionalmente, puedes definirlo en la configuración con `"env": { "GITHUB_TOKEN": "ghp_..." }`. Ese archivo está fuera del repositorio y no se comparte.
- Si modificas el código, ejecuta `npm run build` de nuevo: Antigravity usa la versión compilada de `dist/`.

## Tools disponibles

> En todos los tools que trabajan sobre un repositorio existente, `owner` es opcional: si no se indica, se usa la cuenta del usuario autenticado.

### `create_repository`

Crea un repositorio **nuevo** en la cuenta del usuario autenticado. Devuelve el nombre completo, la visibilidad, la descripción y la URL.

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `name` | string | Sí | De 3 a 100 caracteres. Solo letras, números, guiones (`-`), guiones bajos (`_`) y puntos (`.`) |
| `description` | string | No | Descripción corta, máximo 350 caracteres |
| `private` | boolean | No | `true` para privado; por defecto `false` (público) |

**Ejemplo de prompt:** `Crea un repositorio público llamado prueba-mcp con la descripción "Demo del servidor MCP"`

### `create_issue`

Abre un issue **nuevo** en un repositorio existente. Devuelve el número, el título y la URL del issue.

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `owner` | string | No | Usuario u organización dueña del repositorio |
| `repo` | string | Sí | Nombre del repositorio |
| `title` | string | Sí | Título del issue, máximo 256 caracteres |
| `body` | string | No | Contenido del issue (admite Markdown) |

**Ejemplo de prompt:** `Abre un issue en prueba-mcp titulado "Agregar tests" que diga "Faltan tests para el módulo de pagos"`

### `list_repositories`

Lista los repositorios del usuario autenticado, los actualizados más recientemente primero. Es solo de consulta. Devuelve el nombre completo, la visibilidad, la descripción y la URL de cada uno.

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `limit` | number | No | Cantidad máxima de resultados, de 1 a 100; por defecto 30 |

**Ejemplo de prompt:** `Muéstrame mis repositorios de GitHub`

### `create_commit`

Hace un commit que **crea o modifica un archivo** en un repositorio existente (en su rama principal). Si el archivo existe, reemplaza todo su contenido; si no existe, lo crea. Devuelve si se creó o se modificó, el sha del commit y su URL.

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `owner` | string | No | Usuario u organización dueña del repositorio |
| `repo` | string | Sí | Nombre del repositorio |
| `path` | string | Sí | Ruta del archivo, por ejemplo `README.md` o `docs/notas.md` (sin `/` al inicio ni al final) |
| `content` | string | Sí | Contenido completo del archivo |
| `message` | string | Sí | Mensaje del commit |

**Ejemplo de prompt:** `Agrega un archivo README.md a prueba-mcp con el texto "# Prueba MCP" y el mensaje de commit "docs: agrega README"`

### `list_issues`

Lista los issues **abiertos** de un repositorio (excluye los pull requests). Es solo de consulta. Devuelve el número, el título, el autor y la URL de cada issue.

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `owner` | string | No | Usuario u organización dueña del repositorio |
| `repo` | string | Sí | Nombre del repositorio |

**Ejemplo de prompt:** `¿Qué issues abiertos tiene prueba-mcp?`

## Ejemplo de uso completo

Un flujo que pasa por los cinco tools, escrito en el chat del agente de Antigravity:

| # | Lo que escribe el usuario | Tool que elige el LLM | Respuesta del servidor (resumida) |
|---|---|---|---|
| 1 | `Crea un repositorio llamado demo-agente` | `create_repository` | `Repositorio creado: TU_USUARIO/demo-agente` |
| 2 | `Agrega un README.md a demo-agente con el texto "# Demo" y el mensaje "docs: agrega README"` | `create_commit` | `Archivo README.md creado correctamente.` |
| 3 | `Abre un issue en demo-agente titulado "Agregar tests"` | `create_issue` | `Issue #1 creado: Agregar tests` |
| 4 | `¿Qué issues abiertos tiene demo-agente?` | `list_issues` | `Issues abiertos en demo-agente (1): - #1 Agregar tests` |
| 5 | `Muéstrame mis repositorios` | `list_repositories` | `Se encontraron N repositorios: - TU_USUARIO/demo-agente ...` |

Si algo falla, el agente recibe un mensaje claro. Por ejemplo, para un repositorio que no existe:

```
El repositorio TU_USUARIO/repo-inexistente no fue encontrado. Verifica el nombre e intenta de nuevo.
```

## Arquitectura

```
 Usuario
    │ 1. "Crea un repositorio llamado demo-agente"
    ▼
 Antigravity (Host)
    │    Al iniciar, lanza `node dist/server.js` y le pide la lista de tools (tools/list)
    │ 2. Envía el prompt al LLM junto con los tools (nombre, descripción y schema)
    ▼
 LLM: Gemini, Claude u otro (Client)
    │ 3. Decide: create_repository { name: "demo-agente" }
    ▼
 Antigravity ── 4. Mensaje JSON-RPC por stdin ──▶ MCP Server (este proyecto)
                                                    │ 5. El SDK valida los parámetros con el schema de Zod
                                                    │ 6. tool → operación → withRetry (reintentos)
                                                    ▼
                                                 Octokit ── 7. HTTPS + token ──▶ GitHub API
                                                         ◀── 8. Respuesta o error ──
                                                    │ 9. Resumen legible, o toAppError → mensaje claro
 Antigravity ◀── 10. ToolResult por stdout ─────────┘
    │ 11. Entrega el resultado al LLM
    ▼
 LLM ── 12. Responde al usuario en lenguaje natural
```

Responsabilidades dentro del servidor:

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Entrada | `src/server.ts` | Carga el `.env`, crea el servidor MCP, registra los tools y abre stdio |
| Tools | `src/tools/*.ts` | Nombre, descripción, schema y función de cada tool |
| Validación | `src/schemas/index.ts` | Schemas de Zod y tipos inferidos |
| Operaciones | `src/github/operations.ts` | Llamadas a la API de GitHub |
| Cliente | `src/github/client.ts` | Configura Octokit con el token |
| Errores | `src/errors/index.ts` | Errores personalizados y traducción a lenguaje natural |
| Utilidades | `src/utils/logging.ts`, `src/utils/retry.ts` | Logger seguro en stderr y reintentos con backoff |

## Tests

```bash
npm test
```

Los tests usan **Vitest** y **nunca llaman a GitHub de verdad**: el cliente de Octokit se reemplaza por uno simulado con `vi.mock()`, que devuelve respuestas exitosas y errores controlados. Así los tests son rápidos y siempre dan el mismo resultado.

| Archivo | Qué verifica |
|---|---|
| `tests/tools.test.ts` | Schemas: nombre válido, nombres inválidos (2 caracteres, espacios, más de 100), issue sin título y valores por defecto |
| `tests/github.test.ts` | Operaciones con Octokit simulado: datos enviados al crear un repo, exclusión de pull requests, commit que crea o modifica, 404, token inválido y reintento ante rate limit |
| `tests/errors.test.ts` | Conversión de errores de red, ausencia de stack traces y ocultamiento del token en los logs |

## Scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila TypeScript (`src/`) a JavaScript (`dist/`) |
| `npm run dev` | Ejecuta el servidor directamente desde TypeScript, sin compilar |
| `npm test` | Ejecuta los tests |
| `npm run lint` | Revisa los tipos con TypeScript, sin generar archivos |
| `npm run inspector` | Compila y abre el MCP Inspector para probar los tools en el navegador |

## Solución de problemas

**"El token de GitHub es inválido o expiró"** (401)
El token está mal copiado, fue revocado o venció. Genera uno nuevo, actualiza `GITHUB_TOKEN` en el `.env` y reinicia el servidor (o actualiza la lista de MCP Servers en Antigravity).

**"GitHub rechazó la operación por falta de permisos"** (403, scopes faltantes)
El token no tiene los scopes necesarios. En GitHub → Settings → Developer settings → Tokens (classic), edita el token y marca `repo`, `user` y `admin:org`.

**"El repositorio X no fue encontrado"** (404)
Revisa que el nombre y el dueño sean correctos. Si el repositorio es privado o de otra cuenta u organización, el token debe tener acceso a él (scope `repo`).

**"Se superó el límite de solicitudes de GitHub"** (rate limit)
El servidor reintenta automáticamente con esperas crecientes (1 s, 2 s, 4 s) y respeta el tiempo que indique GitHub. Si GitHub pide esperar más de 60 segundos, el servidor responde de inmediato con este mensaje: espera unos minutos y vuelve a intentarlo.

**"No se encontró el token de GitHub"**
No existe `GITHUB_TOKEN`. Verifica que el `.env` esté en la raíz del proyecto, con el formato `GITHUB_TOKEN=ghp_...` (sin espacios ni comillas).

**Antigravity no detecta el servidor o muestra un error**

- Revisa que `mcp_config.json` sea un JSON válido (comas correctas y `\\` en las rutas de Windows).
- Usa la **ruta absoluta** a `dist/server.js` y verifica que el archivo exista (ejecuta `npm run build`).
- Si aparece un error tipo `spawn node ENOENT`, reemplaza `"command": "node"` por la ruta completa, por ejemplo `"C:\\Program Files\\nodejs\\node.exe"`.
- Actualiza la lista de MCP Servers y abre un chat nuevo.
- Si el agente responde `Agent execution terminated due to error` incluso con mensajes simples, verifica si Antigravity tiene una actualización pendiente ("Restart to update") e instálala.

## Licencia

Distribuido bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE).

© 2026 Kevin Andrés Prieto Mora
