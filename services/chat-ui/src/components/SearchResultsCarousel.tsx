import { useMemo, useState } from "react";

import type { SearchResultItem, SearchResultsResponse } from "../types";

type SearchResultsCarouselProps = {
  results: SearchResultsResponse;
};

const currencyFormatter = new Intl.NumberFormat("nl-BE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/**
 * Format an attribute value for display.
 */
function formatValue(value: unknown): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "";
  }
  if (typeof value === "boolean") {
    return value ? "Ja" : "Nee";
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

/**
 * Display a single search result item.
 */
function ResultCard({ item }: { item: SearchResultItem }) {
  return (
    <article className="results-card">
      <header>
        <div className="card-title">
          <span className="brand">{item.brand ?? "Onbekend merk"}</span>
          {typeof item.price === "number" ? <span className="price">{currencyFormatter.format(item.price)}</span> : null}
        </div>
        {typeof item.availability === "boolean" ? (
          <span className={`availability ${item.availability ? "available" : "unavailable"}`}>
            {item.availability ? "Op voorraad" : "Niet beschikbaar"}
          </span>
        ) : null}
      </header>
      <dl>
        {(item.attributes ?? []).map((attribute, index) => {
          const label = attribute.label || attribute.name || `Attribuut ${index + 1}`;
          const value = formatValue(attribute.value);
          const content = value || "—";
          
          return (
            <div key={`${attribute.name}-${index}`} className="attribute-row">
              <dt>{label}</dt>
              <dd className={value ? undefined : "placeholder"}>{content}</dd>
            </div>
          );
        })}
      </dl>
    </article>
  );
}

/**
 * Display a carousel of search results with navigation controls.
 */
export function SearchResultsCarousel({ results }: SearchResultsCarouselProps) {
  const items = useMemo(() => results.items?.filter(Boolean) ?? [], [results.items]);
  const [index, setIndex] = useState(0);

  const humanSorting = useMemo(() => {
    const sortedBy = results.sorted_by;
    if (!sortedBy || typeof sortedBy !== "object") {
      return null;
    }

    const sortInfo = sortedBy as { field?: unknown; order?: unknown };
    const field = typeof sortInfo.field === "string" ? sortInfo.field : undefined;
    const order = typeof sortInfo.order === "string" ? sortInfo.order : undefined;

    if (!field && !order) {
      return null;
    }

    const fieldLabel = field ? field : "onbekend veld";
    let orderLabel: string;
    switch (order) {
      case "asc":
        orderLabel = "laag naar hoog";
        break;
      case "desc":
        orderLabel = "hoog naar laag";
        break;
      default:
        orderLabel = order ? order : "onbekende volgorde";
    }

    return `Gesorteerd op ${fieldLabel}, ${orderLabel}`;
  }, [results.sorted_by]);

  if (items.length === 0) {
    return null;
  }

  const count = typeof results.count === "number" ? results.count : undefined;
  const displayedCount = count ?? items.length;

  const goPrev = () => setIndex((prev) => Math.max(prev - 1, 0));
  const goNext = () => setIndex((prev) => Math.min(prev + 1, items.length - 1));

  return (
    <div className="results-carousel">
      <header className="results-carousel__topline">Ik heb volgende resultaten voor je gevonden.</header>
      <div className="results-carousel__meta">
        <span>Resultaat {index + 1} van {displayedCount}</span>
        {humanSorting ? <span className="sorted-by">{humanSorting}</span> : null}
      </div>

      <div className="results-carousel__viewport">
        <ResultCard item={items[index]} />
      </div>

      {items.length > 1 ? (
        <div className="results-carousel__controls">
          <button type="button" onClick={goPrev} disabled={index === 0}>
            Vorig
          </button>
          <div className="indicators">
            {items.map((_, dotIndex) => (
              <span key={dotIndex} className={`indicator ${dotIndex === index ? "active" : ""}`} />
            ))}
          </div>
          <button type="button" onClick={goNext} disabled={index === items.length - 1}>
            Volgend
          </button>
        </div>
      ) : null}
    </div>
  );
}
