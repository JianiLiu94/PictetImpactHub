export function Methodology() {
  return (
    <div>
      <h1 className="page-title">Methodology</h1>
      <p className="page-sub">How the two impact models behind this dashboard are built.</p>

      <div className="card-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h2 className="tone-social" style={{ marginBottom: 6 }}>
            Social impact model
          </h2>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
            Measures a company's contribution to human wellbeing in WELLBYs (Wellbeing-Adjusted
            Life Years). Values can be positive (e.g. employment creation) or negative (e.g.
            health damage).
          </p>

          <div className="pill-row" style={{ marginBottom: 8 }}>
            <span className="pill">3 scopes</span>
            <span className="pill">5 stakeholder groups</span>
            <span className="pill">12 categories</span>
          </div>

          <div style={{ fontSize: 12, marginBottom: 10 }}>
            <strong>Scopes:</strong> upstream supply chain, own operations, downstream
            products/services
          </div>
          <div style={{ fontSize: 12, marginBottom: 10 }}>
            <strong>Stakeholder groups:</strong> customers, employees, government/communities,
            shareholders, suppliers
          </div>
          <div style={{ fontSize: 12, marginBottom: 10 }}>
            <strong>Categories:</strong> Health, Employment, Energy, Connectivity, and 8 more
          </div>

          <p className="muted" style={{ fontSize: 11.5 }}>
            Data is currently sparse — companies only have scores in categories relevant to their
            business. This is expected to improve over time as the model matures.
          </p>
        </div>

        <div className="card">
          <h2 className="tone-bio" style={{ marginBottom: 6 }}>
            Biodiversity impact model
          </h2>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
            Measures a company's biodiversity footprint in PDF&middot;yr (Potentially
            Disappeared Fraction of species &times; years). All values are negative, representing
            biodiversity loss.
          </p>

          <div className="pill-row" style={{ marginBottom: 8 }}>
            <span className="pill">3 scopes</span>
            <span className="pill">5 environmental categories</span>
            <span className="pill">15 scope &times; category combinations</span>
          </div>

          <div style={{ fontSize: 12, marginBottom: 10 }}>
            <strong>Scopes:</strong> direct, upstream, downstream
          </div>
          <div style={{ fontSize: 12, marginBottom: 10 }}>
            <strong>Categories:</strong> Climate change, Water stress, Land use, Eutrophication,
            Acidification
          </div>

          <p className="muted" style={{ fontSize: 11.5 }}>
            Unlike the social model, biodiversity data is dense — every company has all 15
            scope&times;category combinations populated.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 style={{ marginBottom: 6 }}>How scores are calculated</h2>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
          The 0&ndash;100 scores shown throughout the app (e.g. on the Companies and Portfolios
          pages) are <strong>percentile ranks</strong>, not raw model output and not a blend of
          social and biodiversity. Social and biodiversity are measured in different units
          (WELLBY vs PDF&middot;yr) and are always shown side by side, never averaged into a
          single &ldquo;composite&rdquo; figure.
        </p>

        <div style={{ fontSize: 12, marginBottom: 10 }}>
          <strong>1. Raw company total:</strong> for each company, sum every WELLBY value
          (social) or PDF&middot;yr value (biodiversity) across all scopes, categories, and
          stakeholders. This gives one raw social total and one raw biodiversity total per
          company. Companies with no rows for a model are treated as a raw total of 0.
        </div>
        <div style={{ fontSize: 12, marginBottom: 10 }}>
          <strong>2. Percentile rank:</strong> within each model, rank every company in the
          dataset by its raw total and convert that rank to a 0&ndash;100 percentile &mdash;
          the company with the highest raw total scores 100, the lowest scores 0, and ties share
          the same score. A score is therefore <em>relative to the current dataset</em>: it
          answers &ldquo;how does this company compare to its peers here&rdquo;, not an
          absolute measure of impact, and will shift if companies are added, removed, or their
          underlying data changes.
        </div>
        <div style={{ fontSize: 12, marginBottom: 10 }}>
          <strong>3. Portfolio scores:</strong> a portfolio's score is the holdings-weighted
          average of its constituent companies' percentile scores, using each holding's
          <code>% of fund</code> as the weight. A portfolio score in the 60s, for example,
          usually means it mixes some very high-percentile holdings with some much lower-scoring
          ones &mdash; not that every holding scores around 60.
        </div>

        <p className="muted" style={{ fontSize: 11.5 }}>
          Because this is percentile-based, a single-company dataset always scores 100 (nothing
          to rank against), and scores cluster wherever raw totals cluster &mdash; a tiny gap in
          raw value near the median can move a company several percentile points.
        </p>
      </div>
    </div>
  );
}
