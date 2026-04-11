# Sistema de memória do agente

Este é o sistema de memória do agente. Ele faz com que o agente lembre das conversas que teve, aprenda com o que foi discutido e com os materiais que você fornecer, e consiga consultar esse conhecimento depois.

A ideia central é simples: cada conversa que o agente tem é matéria-prima. Cada arquivo que você entrega a ele é matéria-prima. O sistema transforma essa matéria-prima em conhecimento organizado, que cresce com o tempo e fica disponível para ser consultado, revisado ou usado como base para novas decisões.

Abaixo estão as partes do sistema. Cada parte tem um nome, um propósito e, quando faz sentido, parâmetros que ajustam o comportamento. Como usar cada parte — se é automaticamente, sob demanda, numa conversa, ou de outro jeito — fica a critério de quem opera o agente.

---

## As partes

### capture — capturar a conversa

**O que faz:** lê uma conversa que acabou de acontecer entre o agente e alguém, extrai o que vale a pena lembrar, e registra no diário do dia.

**Para que serve:** garantir que nada substancial do que foi discutido se perca quando a conversa termina. Cada dia de conversas vira uma entrada de diário, e esse diário é a fonte primária do conhecimento do agente.

**Parâmetros:** nenhum. Pode ser chamado depois de qualquer conversa relevante.

### add — adicionar material externo

**O que faz:** processa arquivos que você colocou na caixa de entrada do agente — PDFs, imagens, áudios, textos, planilhas, o que for — e absorve o conteúdo deles no conhecimento.

**Para que serve:** trazer para o agente informação que veio de fora da conversa. Um prontuário, uma apostila, uma foto de um exame, a gravação de uma reunião, um documento de referência.

**Parâmetros:**

- (sem parâmetros) — processa tudo que está novo na caixa de entrada
- `--file <nome>` — processa apenas um arquivo específico
- `--all` — reprocessa tudo, mesmo o que já foi absorvido antes
- `--dry-run` — mostra o que seria processado, sem fazer

Arquivos com forma própria (PDFs, imagens, áudios) são preservados na base. Arquivos que são só texto são absorvidos diretamente na forma de notas.

### digest — organizar o aprendizado

**O que faz:** pega o diário de conversas e transforma em conhecimento organizado: conceitos (ideias atômicas), conexões (relações entre ideias) e atualizações no índice geral.

**Para que serve:** transformar conversa bruta em conhecimento navegável. Se `capture` é "escrever o diário", `digest` é "ler o diário depois e tirar as lições". Normalmente é rodado uma vez por dia, no fim do dia, mas pode ser acionado a qualquer momento.

**Parâmetros:**

- (sem parâmetros) — processa apenas o que mudou desde a última organização
- `--all` — reprocessa tudo
- `--file <data>` — organiza apenas o diário de um dia específico
- `--dry-run` — mostra o que seria feito, sem fazer

### ask — perguntar

**O que faz:** responde uma pergunta consultando tudo que o agente já aprendeu. Lê o índice do conhecimento, escolhe os artigos relevantes e compõe uma resposta citando as fontes.

**Para que serve:** é o principal jeito de extrair valor do conhecimento acumulado. Você pergunta em linguagem natural, o agente responde com base no que já foi registrado, e sempre diz de onde tirou cada parte da resposta.

**Parâmetros:**

- `"pergunta"` — o que você quer saber, em linguagem natural
- `--file-back` — depois de responder, arquiva a resposta como conhecimento permanente (útil para perguntas que vão ser feitas de novo no futuro)

A resposta é temporária por padrão — você lê e descarta. Com `--file-back`, vira parte do conhecimento.

### file — arquivar uma resposta

**O que faz:** toma uma pergunta, obtém a resposta do sistema, e arquiva formalmente como conhecimento permanente.

**Para que serve:** algumas perguntas são suficientemente importantes que a resposta deve ficar guardada para sempre. Em vez de refazer a pesquisa toda vez que a pergunta aparece, o agente consulta diretamente a resposta arquivada.

**Parâmetros:**

- `"pergunta"` — a pergunta a arquivar

É equivalente a `ask --file-back`, mas com a intenção explícita de "isso vale guardar".

### note — anotar à mão

**O que faz:** adiciona uma nota manual ao diário do dia atual.

**Para que serve:** registrar algo que você quer que o agente lembre, mas que não veio de uma conversa nem de um arquivo externo. Um recado, uma observação, um lembrete, uma reflexão que apareceu de repente.

**Parâmetros:**

- `"texto da nota"` — o conteúdo a registrar

É a forma mais direta de colocar informação no sistema sem passar por conversa ou por arquivo.

### audit — conferir a saúde do conhecimento

**O que faz:** varre o conhecimento do agente procurando problemas: links quebrados, artigos sem conexão, informações que se contradizem entre si, artigos muito curtos, material bruto que ainda não foi organizado.

**Para que serve:** manter a qualidade do conhecimento ao longo do tempo. É o equivalente a conferir sua estante para ver se há livros com páginas faltando ou guardados no lugar errado. Gera um relatório do que foi encontrado para você decidir o que corrigir.

**Parâmetros:**

- (sem parâmetros) — roda todas as checagens (inclui uma que usa IA para detectar contradições entre artigos, e portanto tem custo)
- `--structural-only` — pula a checagem de contradições, roda só as checagens automáticas. Mais rápida e gratuita.

### check — validar uma abordagem

**O que faz:** compara uma ideia ou decisão que você está prestes a tomar contra o que o agente já sabe sobre aquele assunto, e reporta se há consistência, conflito, ou se o conhecimento não é suficiente para opinar.

**Para que serve:** evitar contradizer o próprio histórico. Se o agente já registrou antes que "tal protocolo não funcionou com pacientes com perfil X" e você está prestes a aplicar exatamente isso de novo, o sistema avisa antes.

**Parâmetros:**

- `"descrição da abordagem"` — o que você quer validar, em linguagem natural

### review — revisar contra o conhecimento

**O que faz:** analisa um conteúdo (um documento, uma receita, um texto, um plano) contra os padrões e decisões que o agente já conhece, e aponta divergências ou oportunidades de alinhamento.

**Para que serve:** garantir que algo novo siga o que já foi estabelecido. Se o agente sabe que "toda prescrição precisa incluir X", e você está revisando uma nova prescrição que não tem X, o sistema sinaliza.

**Parâmetros:**

- `"caminho ou descrição"` — o que revisar

---

## Onde o conhecimento vive

Tudo que o sistema produz fica dentro de uma pasta chamada `kb/` (de *knowledge base*) na raiz do workspace do agente. É lá que os diários, os conceitos, as conexões, as respostas arquivadas e os arquivos preservados moram. O formato é markdown puro com links entre notas, então você pode abrir em qualquer editor de texto ou no Obsidian e navegar manualmente se quiser.

A estrutura dessa pasta — o que vai em cada lugar, como os artigos são formatados, como os links funcionam — é descrita no arquivo `KNOWLEDGE_BASE.md` na raiz do workspace.

---

## Para quem quer os detalhes técnicos

O funcionamento interno de cada parte está documentado em [`memory/SYSTEM.md`](memory/SYSTEM.md). Esse documento é voltado a quem vai manter ou estender o sistema. Como usuário, você não precisa lê-lo.
