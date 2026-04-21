Arquiva um Q&A deliberado em `kb/effort/qa/`.

O argumento pode ser:
- Uma pergunta — gera a resposta consultando o KB e salva como artigo Q&A
- Sem argumento — revisa a conversa atual e pergunta ao usuário o que vale arquivar

Executa `uv run --directory .systems python memory/scripts/kb/query.py "$ARGUMENTS" --file-back` a partir da raiz do projeto.

Ao finalizar, confirme o path do artigo criado e mostre quantos Q&A existem no total.
