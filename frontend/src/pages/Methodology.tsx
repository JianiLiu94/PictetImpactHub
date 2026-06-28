export function Methodology() {
  return (
    <div>
      <h1 className="page-title">Methodology</h1>
      <p className="page-sub">How the two impact models behind this dashboard are built.</p>

      <div className="card-grid">
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
    </div>
  );
}
