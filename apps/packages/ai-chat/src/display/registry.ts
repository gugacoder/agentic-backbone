import type { ComponentType } from "react";
import type { DisplayToolName } from "@agentic-backbone/ai-sdk";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DisplayRendererMap = Partial<Record<DisplayToolName, ComponentType<any>>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const defaultDisplayRenderers: Record<DisplayToolName, ComponentType<any>> = {
  display_alert: AlertRenderer,
  display_metric: MetricCardRenderer,
  display_price: PriceHighlightRenderer,
  display_file: FileCardRenderer,
  display_code: CodeBlockRenderer,
  display_sources: SourcesListRenderer,
  display_steps: StepTimelineRenderer,
  display_progress: ProgressStepsRenderer,
  display_chart: ChartRenderer,
  display_carousel: CarouselRenderer,
  display_product: ProductCardRenderer,
  display_comparison: ComparisonTableRenderer,
  display_table: DataTableRenderer,
  display_spreadsheet: SpreadsheetRenderer,
  display_gallery: GalleryRenderer,
  display_image: ImageViewerRenderer,
  display_link: LinkPreviewRenderer,
  display_map: MapViewRenderer,
  display_choices: ChoiceButtonsRenderer,
};

export function resolveDisplayRenderer(
  toolName: string,
  overrides?: DisplayRendererMap,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ComponentType<any> | undefined {
  return (
    overrides?.[toolName as DisplayToolName] ??
    defaultDisplayRenderers[toolName as DisplayToolName]
  );
}
