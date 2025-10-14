import { useMemo, useState } from "react";

import type { SearchResultAttribute, SearchResultItem, SearchResultsResponse } from "../hooks/useChat";

type SearchResultsCarouselProps = {
  results: SearchResultsResponse;
};

const currencyFormatter = new Intl.NumberFormat("nl-BE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

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

function ResultCard({ item }: { item: SearchResultItem }) {
  const attributes = item.attributes ?? [];

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
        {attributes.map((attribute: SearchResultAttribute, index: number) => {
          const label = attribute.label || attribute.name || `Attribuut ${index + 1}`;
          const value = formatValue(attribute.value);
          if (!value) {
            return null;
          }
          return (
            <div key={`${attribute.name ?? "attr"}-${index}`} className="attribute-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          );
        })}
      </dl>
    </article>
  );
}

export function SearchResultsCarousel({ results }: SearchResultsCarouselProps) {
  const items = useMemo(() => results.items?.filter(Boolean) ?? [], [results.items]);
  const [index, setIndex] = useState(0);

  if (items.length === 0) {
    return null;
  }

  const total = typeof results.total === "number" ? results.total : undefined;
  const count = typeof results.count === "number" ? results.count : undefined;
  const displayedCount = count ?? items.length;

  const goPrev = () => setIndex((prev) => Math.max(prev - 1, 0));
  const goNext = () => setIndex((prev) => Math.min(prev + 1, items.length - 1));

  return (
    <div className="results-carousel">
      <div className="results-carousel__meta">
        <span>
          Resultaat {index + 1} van {displayedCount}
          {total !== undefined && total !== displayedCount ? ` (totaal ${total})` : ""}
        </span>
        {results.sorted_by && typeof results.sorted_by === "object" ? (
          <span className="sorted-by">Gesorteerd op {JSON.stringify(results.sorted_by)}</span>
        ) : null}
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
