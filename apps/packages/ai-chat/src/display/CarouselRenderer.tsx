import type { DisplayCarousel } from "@agentic-backbone/ai-sdk";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

function formatPrice(value: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function CarouselRenderer({ title, items }: DisplayCarousel) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, dragFree: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <div className="ai-chat-display ai-chat-display-carousel">
      {title && <p className="ai-chat-display-carousel-title">{title}</p>}

      <div className="ai-chat-display-carousel-stage">
        <button
          className="ai-chat-display-carousel-arrow ai-chat-display-carousel-arrow--prev"
          onClick={scrollPrev}
          disabled={!canScrollPrev}
          aria-label="Anterior"
          type="button"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="ai-chat-display-carousel-viewport" ref={emblaRef}>
          <div className="ai-chat-display-carousel-track">
            {items.map((item, index) => (
              <div key={index} className="ai-chat-display-carousel-slide">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="ai-chat-display-carousel-card">
                    <CarouselCard item={item} />
                  </a>
                ) : (
                  <div className="ai-chat-display-carousel-card">
                    <CarouselCard item={item} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          className="ai-chat-display-carousel-arrow ai-chat-display-carousel-arrow--next"
          onClick={scrollNext}
          disabled={!canScrollNext}
          aria-label="Próximo"
          type="button"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {items.length > 1 && (
        <div className="ai-chat-display-carousel-dots" role="tablist" aria-label="Slides">
          {items.map((_, index) => (
            <button
              key={index}
              className={`ai-chat-display-carousel-dot${index === selectedIndex ? " ai-chat-display-carousel-dot--active" : ""}`}
              onClick={() => emblaApi?.scrollTo(index)}
              role="tab"
              aria-selected={index === selectedIndex}
              aria-label={`Slide ${index + 1}`}
              type="button"
            />
          ))}
        </div>
      )}
    </div>
  );
}

type CarouselItem = DisplayCarousel["items"][number];

function CarouselCard({ item }: { item: CarouselItem }) {
  return (
    <>
      {item.image && (
        <div className="ai-chat-display-carousel-card-image">
          <img src={item.image} alt={item.title} loading="lazy" />
        </div>
      )}
      <div className="ai-chat-display-carousel-card-body">
        <p className="ai-chat-display-carousel-card-title">{item.title}</p>
        {item.subtitle && (
          <p className="ai-chat-display-carousel-card-subtitle">{item.subtitle}</p>
        )}
        {item.price && (
          <p className="ai-chat-display-carousel-card-price">
            {formatPrice(item.price.value, item.price.currency)}
          </p>
        )}
        {item.badges && item.badges.length > 0 && (
          <div className="ai-chat-display-carousel-card-badges">
            {item.badges.map((badge, i) => (
              <span key={i} className={`ai-chat-display-carousel-badge ai-chat-display-carousel-badge--${badge.variant}`}>
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
