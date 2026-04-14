# Vendor

Pacotes vendorizados para eliminar dependência do registry npm da codrstudio.

| Pacote                        | Repositório                                   |
|-------------------------------|-----------------------------------------------|
| `@codrstudio/openclaude-sdk`  | https://github.com/codrstudio/openclaude-sdk  |
| `@codrstudio/openclaude-chat` | https://github.com/codrstudio/openclaude-chat |

## Atualização

1. Baixe o novo `.tgz` (`npm pack @codrstudio/<pacote>@<versão>`)
2. Substitua o arquivo antigo nesta pasta
3. Atualize o nome do arquivo nos `package.json` (root e `apps/backbone`)
4. Rode `npm install`
