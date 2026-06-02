; Kulala injection queries (overlay on tree-sitter-kulala-http).
; TypeScript uses tree-sitter-typescript for parsing plus javascript highlights (see engine.ts).

; Comments
((comment) @injection.content
  (#set! injection.language "comment"))

; Body
((json_body) @injection.content
  (#set! injection.language "json"))

((xml_body) @injection.content
  (#set! injection.language "xml"))

((graphql_data) @injection.content
  (#set! injection.language "graphql"))

; Inline script: `{% lang=lua`
((script
  (script_body) @injection.content) @_script
  (#match? @_script "lang=lua($|[^a-zA-Z])")
  (#set! injection.include-children)
  (#set! injection.language "lua"))

; Inline script: `{% lang=ts` (word boundary - avoid matching inside `lang=typescript`)
((script
  (script_body) @injection.content) @_script
  (#match? @_script "lang=ts($|[^a-zA-Z])")
  (#set! injection.include-children)
  (#set! injection.language "typescript"))

; Alias some users try (not parsed by kulala-core for execution)
((script
  (script_body) @injection.content) @_script
  (#match? @_script "lang=typescript")
  (#set! injection.include-children)
  (#set! injection.language "typescript"))

; Inline script: `{% lang=js`
((script
  (script_body) @injection.content) @_script
  (#match? @_script "lang=js($|[^a-zA-Z])")
  (#set! injection.include-children)
  (#set! injection.language "javascript"))

; Inline script (default: JavaScript)
((script
  (script_body) @injection.content) @_script
  (#not-match? @_script "lang=lua($|[^a-zA-Z])")
  (#not-match? @_script "lang=ts($|[^a-zA-Z])")
  (#not-match? @_script "lang=typescript")
  (#not-match? @_script "lang=js($|[^a-zA-Z])")
  (#set! injection.include-children)
  (#set! injection.language "javascript"))
