import type { Scheme } from "../types";

export function SchemeCards({ schemes }: { schemes: Scheme[] }) {
  return (
    <div className="cards">
      {schemes.map((s) => (
        <article key={s.id} className="card">
          <h3>{s.name_hindi}</h3>
          <p className="card-meta">
            {s.name} · {s.benefit_amount}
          </p>
          <p className="card-desc">{s.description_hindi}</p>
          {s.portal_url && (
            <a className="card-link" href={s.portal_url} target="_blank" rel="noreferrer">
              Official portal →
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
