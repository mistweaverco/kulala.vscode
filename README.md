<div align="center">

![Kulala Logo](images/logo.svg)

# kulala.vscode

[![Made with love][badge-made-with-love]][contributors]
[![Discord][badge-discord]][discord]
[![Development status][badge-development-status]][development-status]
[![Our manifesto][badge-our-manifesto]][our-manifesto]
[![AI Policty][badge-ai-policy]][ai-policy]
[![Kulala on the Visual Code Marketplace][badge-vscode-market]][vscode-market]
[![Kulala on the Open VSX Registry][badge-openvsx]][openvsx]

A fully-featured 🤏 HTTP/GraphQL/gRPC/Websocket-client 🐼
interface 🖥️ for (Visual Studio) Code ❤️,
that supports the Jetbrains .http spec (with full scripting support).

Kulala is swahili for "rest" or "relax."

<p></p>

# Other tools 🔧 from the Kulala 🐼 family 🌈

[Kulala CLI][kulala-cli] •
[Kulala Formatter (and converter)][kulala-fmt] •
[Kulala Desktop][kulala-desktop] •
[Kulala for Neovim][kulala.nvim] •
[Kulala Core][kulala-core]
[Kulala Github Action][kulala-github-action]

---

</div>

## Features

- **Send request** at cursor (`Ctrl+Alt+R` / `Cmd+Alt+R`) or via CodeLens / editor title
- **Send all** requests in the file (`Ctrl+Alt+A` / `Cmd+Alt+A`)
- **Response panel** with Body, Headers, timings, and script console output
- **Environments** from kulala-core (`http-client.env.json`, kuba, etc.)
- **Completion & hover** via kulala-core LSP helpers
- **Diagnostics** in `.http` files
- **Syntax highlighting** via the
  [`kulala_http` tree-sitter grammar][kulala-tree-sitter]
- **Copy as cURL** / **paste from cURL**
- **Inspect request** (resolved request preview)
- OAuth / custom prompts via kulala-core `continue` flow

## Requirements

- VS Code **1.105** or newer
- Network access on first run
  (downloads `kulala-core` from GitHub releases unless `kulala.corePath` is set)

## Install

### Marketplace

Install **Kulala** (`mistweaverco.kulala`) from the VS Code Marketplace.

### From source

```bash
cd kulala.vscode
pnpm install
pnpm run build
```

Press **F5** in VS Code to launch an Extension Development Host.

## LSP (kulala-core)

Kulala for Visual Studio Code uses
**kulala-core** for editor intelligence
(not a separate language-server binary):

| Feature          | `.http` / `.rest`              | `*.http.js` / `*.http.ts` / `*.http.lua` | Inside `{% %}` scripts     |
| ---------------- | ------------------------------ | ---------------------------------------- | -------------------------- |
| Completion       | ✓                              | ✓ (script API)                           | ✓ (script API + variables) |
| Hover            | ✓ (resolved request / GraphQL) | ✓ (script API)                           | ✓ (script API)             |
| Diagnostics      | ✓ (parse errors)               | -                                        | -                          |
| Document symbols | ✓ (request names)              | -                                        | -                          |

External script files must be named `something.http.ts` (etc.) when `kulala.enforceExternalScriptNamingConvention` is true (default), matching Neovim.

## Configuration

| Setting                                        | Default              | Description                                                |
| ---------------------------------------------- | -------------------- | ---------------------------------------------------------- |
| `kulala.corePath`                              | _(empty)_            | Path to `kulala-core` binary; skips auto-download when set |
| `kulala.coreVersion`                           | `[current version]`  | Release version to download                                |
| `kulala.dataDir`                               | _(platform default)_ | `KULALA_CORE_DATA_DIR` for cookies, OAuth, globals         |
| `kulala.defaultEnv`                            | `default`            | Default environment name                                   |
| `kulala.timeout`                               | `60000`              | Subprocess timeout (ms)                                    |
| `kulala.responseView`                          | `beside`             | Response panel: `beside`, `below`, or `active`             |
| `kulala.enableLsp`                             | `true`               | kulala-core completion, hover, diagnostics, symbols        |
| `kulala.enableDiagnostics`                     | `true`               | Parse diagnostics in `.http` / `.rest`                     |
| `kulala.enableCompletion`                      | `true`               | Completion in HTTP files and `{% %}` scripts               |
| `kulala.enforceExternalScriptNamingConvention` | `true`               | LSP on `*.http.js` / `*.http.ts` / `*.http.lua` only       |
| `kulala.syntaxHighlighting`                    | `true`               | Tree-sitter semantic highlighting for `.http` / `.rest`    |

### Syntax highlighting

Kulala bundles the **kulala_http** grammar from [mistweaverco/tree-sitter-kulala-http](https://github.com/mistweaverco/tree-sitter-kulala-http) (`syntaxes/kulala_http.wasm` + query files). **Language injections** (from upstream `queries/kulala_http/injections.scm`) re-highlight embedded content using additional grammars under `syntaxes/grammars/` (json, javascript, typescript, lua, graphql, xml).

Inline `{% %}` scripts use short language tags on
the opening line (same as kulala-core):
`lang=lua`, `lang=js`, or `lang=ts` for TypeScript.

Omit the tag for JavaScript.
Use `lang=ts` (not `lang=typescript`)
so kulala-core runs the TypeScript transpiler.

It uses VS Code **semantic highlighting**
(enable with a theme that supports it, e.g., Dark+).

Requires `editor.semanticHighlighting.enabled`
(on by default for `http` / `rest` via this extension).

`pnpm run build` runs `pnpm install`,
fetches grammars with **git** / **curl**,
and builds WASM with the [tree-sitter CLI](https://tree-sitter.github.io/):

```bash
pnpm run build:syntax
```

Optional environment variables:

| Variable                      | Default                                                       | Purpose                                          |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| `KULALA_HTTP_GRAMMAR_REPO`    | `https://github.com/mistweaverco/tree-sitter-kulala-http.git` | Host grammar clone URL                           |
| `KULALA_HTTP_GRAMMAR_REF`     | `main`                                                        | Host grammar branch or tag                       |
| `KULALA_HTTP_GRAMMAR_DIR`     | `.cache/tree-sitter-kulala-http`                              | Host grammar cache                               |
| `KULALA_GRAPHQL_GRAMMAR_REPO` | `https://github.com/joowani/tree-sitter-graphql.git`          | GraphQL grammar (npm package does not ship wasm) |
| `KULALA_LUA_GRAMMAR_REPO`     | `https://github.com/tree-sitter-grammars/tree-sitter-lua.git` | Lua wasm + highlights (must match)               |
| `KULALA_XML_GRAMMAR_REPO`     | `https://github.com/tree-sitter-grammars/tree-sitter-xml.git` | XML grammar (build in `xml/` subdir)             |

## Example

Create `api.http`:

```http
### Get user
GET https://httpbin.org/get
Accept: application/json
```

Use **Kulala: Send Request** or click the CodeLens above the request.

## How it works

The extension talks to **kulala-core** over a JSON stdin protocol
(`action: run`, `parse`, `lsp_completion`, ...)

On first use it installs the
matching release binary into extension global storage,
or you can point `kulala.corePath` at your own build.

## License

MIT

[badge-discord]: https://mistweaverco.com/assets/badges/discord.svg
[discord]: https://mistweaverco.com/discord
[badge-made-with-love]: https://mistweaverco.com/assets/badges/made-with-love.svg
[contributors]: https://github.com/mistweaverco/kulala.vscode/graphs/contributors
[kulala-cli]: https://github.com/mistweaverco/kulala-cli
[kulala-fmt]: https://github.com/mistweaverco/kulala-fmt
[kulala-desktop]: https://github.com/mistweaverco/kulala-desktop
[kulala.nvim]: https://github.com/mistweaverco/kulala.nvim
[kulala-core]: https://github.com/mistweaverco/kulala-core
[kulala-github-action]: https://github.com/mistweaverco/kulala-github-action
[badge-development-status]: https://mistweaverco.com/assets/badges/development-status.svg
[development-status]: https://mistweaverco.com/roadmap?filter=kulala.vscode
[badge-ai-policy]: https://mistweaverco.com/assets/badges/ai-policy.svg
[ai-policy]: https://mistweaverco.com/ai-policy
[badge-our-manifesto]: https://mistweaverco.com/assets/badges/our-manifesto.svg
[our-manifesto]: https://mistweaverco.com/manifesto
[kulala-tree-sitter]: https://github.com/mistweaverco/tree-sitter-kulala-http
[badge-vscode-market]: https://mistweaverco.com/assets/badges/vscode-market.svg
[vscode-market]: https://marketplace.visualstudio.com/items?itemName=mistweaverco.kulala
[badge-openvsx]: https://mistweaverco.com/assets/badges/openvsx.svg
[openvsx]: https://open-vsx.org/extension/mistweaverco/kulala
