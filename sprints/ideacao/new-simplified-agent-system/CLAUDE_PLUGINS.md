Sim, dá. Tem **duas formas nativas** que resolvem exatamente seu caso sem symlink. A recomendada para o que você quer (sets de skills por "perfil") é plugin-dir.

## Opção 1 — `--plugin-dir` (recomendada pro seu caso)

Empacota cada set como um plugin local. Estrutura:

```
/my/standards/coder/
├── .claude-plugin/
│   └── plugin.json        ← manifest obrigatório
└── skills/
    ├── skill-a/SKILL.md
    └── skill-b/SKILL.md
```

Onde `plugin.json` é mínimo:

```json
{
  "name": "coder-standards",
  "description": "Coder skill set",
  "author": { "name": "Guga" }
}
```

Aí você lança o Claude Code apontando para um ou mais:

```bash
claude --plugin-dir /my/standards/coder
claude --plugin-dir /my/standards/coder --plugin-dir /my/standards/cto
```

Nada é instalado globalmente — vale só pra sessão. E as skills ficam **namespaced** (`coder-standards:skill-a`), então não colidem com as do projeto nem entre sets.

Dá pra criar aliases no `.zshrc` / `.bashrc` pra ficar ergonômico:

```bash
claude-coder()    { claude --plugin-dir /my/standards/coder "$@" }
claude-producer() { claude --plugin-dir /my/standards/producer "$@" }
claude-cto()      { claude --plugin-dir /my/standards/cto "$@" }
```

Se quiser persistir em vez de ficar passando flag, dá pra instalar local e ligar/desligar:

```bash
claude plugins install /my/standards/coder
claude plugins disable coder-standards   # quando não quiser
claude plugins enable  coder-standards
```

## Opção 2 — `--add-dir` (mais rápido, menos controle)

A doc diz explicitamente que `.claude/skills/` **dentro** de um diretório passado por `--add-dir` é carregado automaticamente (é a exceção da regra — outras configs como subagents/commands não são). Então se sua estrutura já é:

```
/my/standards/coder/.claude/skills/*
```

você só faz:

```bash
claude --add-dir /my/standards/coder
```

Contras vs. Opção 1: não tem namespace (skills com mesmo nome colidem com precedência enterprise > personal > project), não tem manifest, e você também está dando acesso de leitura/escrita de arquivos àquele diretório — `--add-dir` foi pensado pra grant de file access, o carregamento de skills é um efeito colateral documentado.

---

**Resumo prático**: como você quer sets compostos e intercambiáveis (`coder`, `producer`, `cto`), vai de plugin-dir. É literalmente o caso de uso pensado para isso, e te dá namespace, manifest e a opção futura de empacotar/distribuir pro time via marketplace se quiser.