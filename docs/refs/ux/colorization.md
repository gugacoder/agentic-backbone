# Esquema de Cores para Apps

## Cores Temáticas

Variam conforme o brand. Cada produto define seus próprios valores.

Tradicionalmente são:

- primary — Cor principal da marca
- secondary — Cor de apoio da marca
- accent — Cor de destaque / chamada

---

## Cores Semânticas

Fixas entre brands. Representam **estados e níveis de intensidade** da interface.

| Token            | Referência   | Uso                                          |
|------------------|--------------|----------------------------------------------|
| `--cs-faint`     | super pálido | Ruído absoluto · quase invisível             |
| `--cs-muted`     | pálido       | Debug profundo · ruído                       |
| `--cs-normal`    | preto/branco | Estado neutro — varia com o tema dark/light  |
| `--cs-info`      | ciano        | Informação passiva                           |
| `--cs-notice`    | azul         | Estado relevante, mas não problemático       |
| `--cs-highlight` | violeta      | Ênfase · foco                                |
| `--cs-success`   | verde        | Ação bem-sucedida                            |
| `--cs-warning`   | amarelo      | Atenção                                      |
| `--cs-alert`     | laranja      | Ação imediata                                |
| `--cs-error`     | vermelho     | Falha                                        |
| `--cs-critical`  | pink         | Falha sistêmica                              |

* Faint e muted são variações de palidez da cor normal.
