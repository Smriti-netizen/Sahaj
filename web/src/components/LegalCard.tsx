import type { LegalRight } from "../types";

export function LegalCard({ legal }: { legal: LegalRight }) {
  return (
    <article className="card">
      <h3>{legal.title_hindi}</h3>
      <p className="card-desc">Laws: {legal.laws.join(", ")}</p>
      <ol>
        {legal.steps_hindi.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {legal.portal_url && (
        <a className="card-link" href={legal.portal_url} target="_blank" rel="noreferrer">
          Portal →
        </a>
      )}
    </article>
  );
}
