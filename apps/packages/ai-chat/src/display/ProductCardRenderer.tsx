import { useState } from "react";
import type { DisplayProduct } from "@agentic-backbone/ai-sdk";
import { Star } from "lucide-react";
import { Card, CardContent, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { cn } from "../lib/utils.js";

function StarRating({ score, count }: { score: number; count: number }) {
  const fullStars = Math.floor(score);
  const hasHalf = score - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div
      className="flex items-center gap-0.5 text-primary"
      aria-label={`${score} de 5 estrelas (${count} avaliações)`}
    >
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`f${i}`} size={14} fill="currentColor" />
      ))}
      {hasHalf && <Star size={14} fill="none" />}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`e${i}`} size={14} fill="none" className="text-muted-foreground" />
      ))}
      <span className="text-xs text-muted-foreground ml-1">({count})</span>
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
    <Card className="overflow-hidden">
      {image && !imgError && (
        <div className="relative">
          <img
            src={image}
            alt={title}
            className={cn("w-full aspect-video object-cover")}
            onError={() => setImgError(true)}
          />
          {discount !== null && (
            <Badge variant="destructive" className="absolute top-2 right-2">
              -{discount}%
            </Badge>
          )}
        </div>
      )}

      <CardContent className="p-4 space-y-2">
        {badges && badges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {badges.map((b, i) => (
              <Badge key={i} variant="secondary">
                {b.label}
              </Badge>
            ))}
          </div>
        )}

        <CardTitle className="text-sm">{title}</CardTitle>

        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        )}

        {rating && <StarRating score={rating.score} count={rating.count} />}

        {price && (
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold">{formatMoney(price.value, price.currency)}</span>
            {originalPrice && (
              <span className="text-sm text-muted-foreground line-through">
                {formatMoney(originalPrice.value, originalPrice.currency)}
              </span>
            )}
          </div>
        )}

        {url && (
          <Button className="w-full" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              Ver produto
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
