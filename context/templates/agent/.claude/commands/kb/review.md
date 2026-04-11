Revisa código contra padrões que o knowledge base já conhece.

Passos:
1. Leia `kb/HOME.md` para entender o índice do KB
2. Leia os artigos relevantes em `kb/atlas/concepts/` e `kb/atlas/connections/`
3. Analise o código indicado pelo usuário (argumento = path ou descrição do que revisar)
4. Compare o código contra os padrões, decisões e lições documentados no KB
5. Reporte discrepâncias, violações de padrões, ou oportunidades de alinhamento

Se nenhum argumento for fornecido, peça ao usuário qual código quer revisar.

Formato do output: lista de findings com severidade (error/warning/suggestion), referenciando os artigos do KB com [[wikilinks]].
