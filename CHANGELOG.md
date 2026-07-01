## <small>0.4.3 (2026-07-01)</small>

* feat(env): add support for ws (withsecrets.com) ([dfa10ae](https://github.com/mistweaverco/kulala/commit/dfa10ae))
* fix(curl): omit content-type header if not set by user ([ff23ddf](https://github.com/mistweaverco/kulala/commit/ff23ddf))

## <small>0.4.2 (2026-06-30)</small>

* fix(lsp): completion too greedy ([eb5423c](https://github.com/mistweaverco/kulala/commit/eb5423c))

## <small>0.4.1 (2026-06-29)</small>

* fix(grpc, lsp, stdout): grpc tls+verbose, lsp filter by name, await stdout ([3023c30](https://github.com/mistweaverco/kulala/commit/3023c30))

## 0.4.0 (2026-06-27)

* feat(runner, lsp): auto-encode url + add lsp inlay_hints ([9cfef38](https://github.com/mistweaverco/kulala/commit/9cfef38))

## <small>0.3.1 (2026-06-27)</small>

* fix(ignore): add .env to .vscodeignore ([50318ce](https://github.com/mistweaverco/kulala/commit/50318ce))
* fix(oauth): browser-flow on windows ([91f8a5b](https://github.com/mistweaverco/kulala/commit/91f8a5b))
* feat(scripting): add $kulala.runRequest similar to bruno scripting works ([171a886](https://github.com/mistweaverco/kulala/commit/171a886))

## <small>0.2.2 (2026-06-25)</small>

* chore(version): bump ([de93b00](https://github.com/mistweaverco/kulala/commit/de93b00))
* fix(lint): sync svelte first ([23f65b4](https://github.com/mistweaverco/kulala/commit/23f65b4))
* fix(lsp, oauth): fix lsp triggering oauth flow ([b2e4dba](https://github.com/mistweaverco/kulala/commit/b2e4dba))

## <small>0.2.1 (2026-06-24)</small>

* fix(backend): bump backend to fix crlf parser bug ([cca1389](https://github.com/mistweaverco/kulala/commit/cca1389))
* fix(dx): direnv ([b3b0c53](https://github.com/mistweaverco/kulala/commit/b3b0c53))
* fix(lint): fix cast uri to string ([b798bc8](https://github.com/mistweaverco/kulala/commit/b798bc8))
* fix(oauth2): read client secret from private file ([c25f8ef](https://github.com/mistweaverco/kulala/commit/c25f8ef))
* fix(ui): always show the last run request as active view ([dd28348](https://github.com/mistweaverco/kulala/commit/dd28348))
* fix(webview): css not loading in webview ([a9c7620](https://github.com/mistweaverco/kulala/commit/a9c7620))
* chore(deps): bump deps ([63c637f](https://github.com/mistweaverco/kulala/commit/63c637f))
* chore(deps): update dependencies ([dc38a81](https://github.com/mistweaverco/kulala/commit/dc38a81))
* chore(deps): update deps because of security vulnerabilities ([4ec03b8](https://github.com/mistweaverco/kulala/commit/4ec03b8))
* feat(ui): move to svelte and melt ([7748fc1](https://github.com/mistweaverco/kulala/commit/7748fc1))

## <small>0.1.6 (2026-06-19)</small>

* fix(backend): backend parser stripped compat mode when importing files ([f124fb5](https://github.com/mistweaverco/kulala/commit/f124fb5))
* chore(packages): update deps ([4b8b9e6](https://github.com/mistweaverco/kulala/commit/4b8b9e6))
* feat(dx): add direnv ([e2ab8cf](https://github.com/mistweaverco/kulala/commit/e2ab8cf))

## <small>0.1.5 (2026-06-19)</small>

* feat(ci): add ci ([498c310](https://github.com/mistweaverco/kulala/commit/498c310))
* fix(build): fix build for ms ([93c7bf0](https://github.com/mistweaverco/kulala/commit/93c7bf0))
* fix(envManager): envManager was completely borked due to type mismatch ([0fb50fe](https://github.com/mistweaverco/kulala/commit/0fb50fe))
* fix(operator): prompt not always triggered when running all requests ([faaa71f](https://github.com/mistweaverco/kulala/commit/faaa71f))
* fix(package): update dependencies, add openvxs, and cursor support ([496713f](https://github.com/mistweaverco/kulala/commit/496713f))
* chore(docs): add links to vs code marketplace and open vsx registry ([7751a72](https://github.com/mistweaverco/kulala/commit/7751a72))
* Initial commit ([7cb87b8](https://github.com/mistweaverco/kulala/commit/7cb87b8))
* Initial import ([5c16f0a](https://github.com/mistweaverco/kulala/commit/5c16f0a))
