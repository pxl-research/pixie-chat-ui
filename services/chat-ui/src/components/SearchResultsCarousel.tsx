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

function cleanString(value?: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}

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

type AttributeSchemaEntry = {
  key: string;
  label: string;
};

function resolveAttributeKey(attribute: SearchResultAttribute, fallbackIndex: number): string {
  return cleanString(attribute.name) || cleanString(attribute.label) || `attribute-${fallbackIndex}`;
}

function resolveAttributeLabel(attribute: SearchResultAttribute, fallbackIndex: number): string {
  return cleanString(attribute.label) || cleanString(attribute.name) || `attribute-${fallbackIndex}`;
}

function buildAttributeSchema(items: SearchResultItem[]): AttributeSchemaEntry[] {
  const schema = new Map<string, { key: string; label: string; count: number }>();

  items.forEach((item) => {
    (item.attributes ?? []).forEach((attribute, index) => {
      const key = resolveAttributeKey(attribute, index);
      const label = resolveAttributeLabel(attribute, index);
      const existing = schema.get(key);

      if (existing) {
        existing.count += 1;
        if (label.length > existing.label.length) {
          existing.label = label;
        }
      } else {
        schema.set(key, { key, label, count: 1 });
      }
    });
  });

  return Array.from(schema.values())
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label);
    })
    .map(({ key, label }) => ({ key, label }));
}

function ResultCard({ item, schema }: { item: SearchResultItem; schema: AttributeSchemaEntry[] }) {
  const attributeMap: Record<string, SearchResultAttribute> = {};

  (item.attributes ?? []).forEach((attribute, index) => {
    const key = resolveAttributeKey(attribute, index);
    if (!(key in attributeMap)) {
      attributeMap[key] = attribute;
    }
  });

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
        {schema.map((schemaEntry, index) => {
          const attribute = attributeMap[schemaEntry.key];
          const value = attribute ? formatValue(attribute.value) : "";
          const content = value || "—";
          return (
            <div key={`${schemaEntry.key}-${index}`} className="attribute-row">
              <dt>{schemaEntry.label}</dt>
              <dd className={value ? undefined : "placeholder"}>{content}</dd>
            </div>
          );
        })}
      </dl>
    </article>
  );
}

export function SearchResultsCarousel({ results }: SearchResultsCarouselProps) {
  const items = useMemo(() => results.items?.filter(Boolean) ?? [], [results.items]);
  const attributeSchema = useMemo(() => buildAttributeSchema(items), [items]);
  const [index, setIndex] = useState(0);

  if (items.length === 0) {
    return null;
  }

  const count = typeof results.count === "number" ? results.count : undefined;
  const displayedCount = count ?? items.length;

  const humanSorting = useMemo(() => {
    const sortedBy = results.sorted_by;
    if (!sortedBy || typeof sortedBy !== "object") {
      return null;
    }

    const field = typeof (sortedBy as any).field === "string" ? (sortedBy as any).field : undefined;
    const order = typeof (sortedBy as any).order === "string" ? (sortedBy as any).order : undefined;

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
        <ResultCard item={items[index]} schema={attributeSchema} />
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
