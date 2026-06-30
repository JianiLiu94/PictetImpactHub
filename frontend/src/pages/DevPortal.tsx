import { API_BASE_URL } from "../api/client";

export function DevPortal() {
  return (
    <div>
      <h1 className="page-title">Dev portal</h1>
      <p className="page-sub">
        Interactive API reference, generated directly from the backend (FastAPI/OpenAPI).
      </p>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <iframe
          src={`${API_BASE_URL}/docs`}
          title="API documentation"
          style={{ width: "100%", height: "75vh", border: "none", display: "block" }}
        />
      </div>
    </div>
  );
}
