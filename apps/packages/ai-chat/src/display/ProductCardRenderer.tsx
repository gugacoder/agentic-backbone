import { useState } from "react";
import type { DisplayProduct } from "@agentic-backbone/ai-sdk";
import { Star, ShoppingCart, ExternalLink } from "lucide-react";

const BADGE_VARIANT_CLASS: Record<string, string> = {
  default: "ai-chat-display-product-badge--default",
  success: "ai-chat-display-product-badge--success",
  warning: "ai-chat-display-product-badge--warning",
  error: "ai-chat-display-product-badge--error",
  info: "ai-chat-display-product-badge--info",
};

function StarRating({ score, count }: { score: number; count: number }) {
  const fullStars = Math.floor(score);
  const hasHalf = score - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="ai-chat-display-product-rating" aria-label={`${score} de 5 estrelas (${count} avaliações)`}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`f${i}`} size={14} className="ai-chat-display-product-star--full" fill="currentColor" />
      ))}
      {hasHalf && (
        <span className="ai-chat-display-product-star--half">
          <Star size={14} fill="none" />
        </span>
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`e${i}`} size={14} className="ai-chat-display-product-star--empty" fill="none" />
      ))}
      <span className="ai-chat-display-product-rating-count">({count})</span>
    </div>
  );
}

function formatMoney(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function ProductCardRenderer({
  title,
  image,
  price,
  originalPrice,
  rating,
  badges,
  url,
  description,
}: DisplayProduct) {
  const [imgError, setImgError] = useState(false);

  const discount =
    price && originalPrice && originalPrice.value > price.value
      ? Math.round(((originalPrice.value - price.value) / originalPrice.value) * 100)
      : null;

  return (
    <div className="ai-chat-display ai-chat-display-product">
      {image && !imgError && (
        <div className="ai-chat-display-product-image-wrap">
          <img
            src={image}
            alt={title}
            className="ai-chat-display-product-image"
            onError={() => setImgError(true)}
          />
          {discount !== null && (
            <span className="ai-chat-display-product-discount">-{discount}%</span>
          )}
        </div>
      )}

      <div className="ai-chat-display-product-body">
        {badges && badges.length > 0 && (
          <div className="ai-chat-display-product-badges">
            {badges.map((b, i) => (
              <span
                key={i}
                className={`ai-chat-display-product-badge ${BADGE_VARIANT_CLASS[b.variant] ?? BADGE_VARIANT_CLASS["default"]}`}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}

        <h3 className="ai-chat-display-product-title">{title}</h3>

        {description && (
          <p className="ai-chat-display-product-description">{description}</p>
        )}

        {rating && <StarRating score={rating.score} count={rating.count} />}

        {price && (
          <div className="ai-chat-display-product-price-row">
            <span className="ai-chat-display-product-price">
              {formatMoney(price.value, price.currency)}
            </span>
            {originalPrice && (
              <span className="ai-chat-display-product-original-price">
                {formatMoney(originalPrice.value, originalPrice.currency)}
              </span>
            )}
          </div>
        )}

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="ai-chat-display-product-btn"
          >
            <ShoppingCart size={14} />
            Ver produto
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
