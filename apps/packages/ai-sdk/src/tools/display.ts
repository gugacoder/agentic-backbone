import { tool } from "ai";
import {
  DisplayMetricSchema,
  DisplayChartSchema,
  DisplayTableSchema,
  DisplayProgressSchema,
  DisplayProductSchema,
  DisplayComparisonSchema,
  DisplayPriceSchema,
  DisplayImageSchema,
  DisplayGallerySchema,
  DisplayCarouselSchema,
  DisplaySourcesSchema,
  DisplayLinkSchema,
  DisplayMapSchema,
  DisplayFileSchema,
  DisplayCodeSchema,
  DisplaySpreadsheetSchema,
  DisplayStepsSchema,
  DisplayAlertSchema,
  DisplayChoicesSchema,
} from "../display-schemas.js";

export function createDisplayTools() {
  return {
    display_metric: tool({
      description: "Exibe um KPI/metrica em destaque com valor grande, label e tendencia opcional (seta para cima/baixo). Use para destacar um numero importante.",
      parameters: DisplayMetricSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_chart: tool({
      description: "Exibe um grafico (barras, linhas, pizza, area, donut). Use para visualizar dados numericos comparativos ou series temporais.",
      parameters: DisplayChartSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_table: tool({
      description: "Exibe uma tabela rica com colunas tipadas (texto, numero, dinheiro, imagem, link, badge). Use quando uma tabela markdown seria insuficiente — por exemplo, com imagens em celulas ou formatacao monetaria.",
      parameters: DisplayTableSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_progress: tool({
      description: "Exibe uma barra de progresso com etapas nomeadas e status (completo, atual, pendente). Use para mostrar fluxos de trabalho ou checklists visuais.",
      parameters: DisplayProgressSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_product: tool({
      description: "Exibe um card de produto com imagem, titulo, preco, rating, fonte e badges. Use para apresentar um produto especifico encontrado em pesquisa.",
      parameters: DisplayProductSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_comparison: tool({
      description: "Exibe uma tabela comparativa de produtos lado a lado, cada um com imagem, preco e atributos. Use para comparar 2-5 opcoes.",
      parameters: DisplayComparisonSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_price: tool({
      description: "Exibe um preco em destaque grande com label, contexto e fonte. Use para destacar o preco principal encontrado em uma pesquisa.",
      parameters: DisplayPriceSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_image: tool({
      description: "Exibe uma imagem unica com caption e suporte a zoom. Use para mostrar uma foto relevante ao contexto.",
      parameters: DisplayImageSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_gallery: tool({
      description: "Exibe um grid de imagens expansivel. Use para mostrar multiplas imagens relacionadas (fotos de produtos, screenshots, etc.).",
      parameters: DisplayGallerySchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_carousel: tool({
      description: "Exibe um carrossel horizontal de cards com imagem, titulo, subtitulo e preco opcional. Use para apresentar uma lista de opcoes navegavel.",
      parameters: DisplayCarouselSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_sources: tool({
      description: "Exibe uma lista de fontes consultadas com favicon, titulo e URL. Use ao final de uma resposta baseada em pesquisa para dar transparencia sobre as fontes.",
      parameters: DisplaySourcesSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_link: tool({
      description: "Exibe um preview de link com OG image, titulo e descricao. Use para destacar um link importante com visual rico.",
      parameters: DisplayLinkSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_map: tool({
      description: "Exibe um mapa com pins geolocalizados. Use para mostrar localizacoes de lojas, enderecos ou pontos de interesse.",
      parameters: DisplayMapSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_file: tool({
      description: "Exibe um card de arquivo para download com icone, nome, tipo e tamanho. Use para entregar documentos gerados (PDF, DOCX, XLSX).",
      parameters: DisplayFileSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_code: tool({
      description: "Exibe um bloco de codigo com syntax highlighting, numeros de linha, e botao de copiar. Use para trechos de codigo maiores que um inline code.",
      parameters: DisplayCodeSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_spreadsheet: tool({
      description: "Exibe uma planilha com headers e linhas de dados, com formatacao monetaria/percentual opcional. Use para dados tabulares que o usuario pode querer exportar.",
      parameters: DisplaySpreadsheetSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_steps: tool({
      description: "Exibe uma timeline/checklist de etapas com status visual. Use para passo-a-passo, fluxos de trabalho ou progresso de tarefas.",
      parameters: DisplayStepsSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_alert: tool({
      description: "Exibe um banner de alerta (info, warning, error, success). Use para chamar atencao para informacoes criticas, avisos ou confirmacoes.",
      parameters: DisplayAlertSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    display_choices: tool({
      description: "Exibe opcoes clicaveis para o usuario (botoes, cards ou lista). Use quando precisar que o usuario escolha entre alternativas.",
      parameters: DisplayChoicesSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
  };
}
