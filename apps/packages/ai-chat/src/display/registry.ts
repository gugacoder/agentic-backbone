import type { ComponentType } from "react";

import { AlertRenderer } from "./AlertRenderer.js";
import { MetricCardRenderer } from "./MetricCardRenderer.js";
import { PriceHighlightRenderer } from "./PriceHighlightRenderer.js";
import { FileCardRenderer } from "./FileCardRenderer.js";
import { CodeBlockRenderer } from "./CodeBlockRenderer.js";
import { SourcesListRenderer } from "./SourcesListRenderer.js";
import { StepTimelineRenderer } from "./StepTimelineRenderer.js";
import { ProgressStepsRenderer } from "./ProgressStepsRenderer.js";
import { ChartRenderer } from "./ChartRenderer.js";
import { CarouselRenderer } from "./CarouselRenderer.js";
import { ProductCardRenderer } from "./ProductCardRenderer.js";
import { ComparisonTableRenderer } from "./ComparisonTableRenderer.js";
import { DataTableRenderer } from "./DataTableRenderer.js";
import { SpreadsheetRenderer } from "./SpreadsheetRenderer.js";
import { GalleryRenderer } from "./GalleryRenderer.js";
import { ImageViewerRenderer } from "./ImageViewerRenderer.js";
import { LinkPreviewRenderer } from "./LinkPreviewRenderer.js";
import { MapViewRenderer } from "./MapViewRenderer.js";
import { ChoiceButtonsRenderer } from "./ChoiceButtonsRenderer.js";

export type DisplayActionName =
  | "metric"
  | "price"
  | "alert"
  | "choices"
  | "table"
  | "spreadsheet"
  | "comparison"
  | "carousel"
  | "gallery"
  | "sources"
  | "product"
  | "link"
  | "file"
  | "image"
  | "chart"
  | "map"
  | "code"
  | "progress"
  | "steps";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DisplayRendererMap = Partial<Record<string, ComponentType<any>>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const defaultDisplayRenderers: Record<DisplayActionName, ComponentType<any>> = {
  // highlight
  metric: MetricCardRenderer,
  price: PriceHighlightRenderer,
  alert: AlertRenderer,
  choices: ChoiceButtonsRenderer,
  // collection
  table: DataTableRenderer,
  spreadsheet: SpreadsheetRenderer,
  comparison: ComparisonTableRenderer,
  carousel: CarouselRenderer,
  gallery: GalleryRenderer,
  sources: SourcesListRenderer,
  // card
  product: ProductCardRenderer,
  link: LinkPreviewRenderer,
  file: FileCardRenderer,
  image: ImageViewerRenderer,
  // visual
  chart: ChartRenderer,
  map: MapViewRenderer,
  code: CodeBlockRenderer,
  progress: ProgressStepsRenderer,
  steps: StepTimelineRenderer,
};

export function resolveDisplayRenderer(
  action: string,
  overrides?: DisplayRendererMap,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ComponentType<any> | null {
  if (overrides?.[action]) return overrides[action]!;
  return (defaultDisplayRenderers as Record<string, ComponentType<any>>)[action] ?? null;
}
