import { BrowserRouter, Route, Routes, Link } from "react-router-dom";
import { PortfolioSelector } from "./pages/PortfolioSelector";

function Placeholder({ label }: { label: string }) {
  return <div>{label} (coming soon)</div>;
}

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Portfolios</Link>
      </nav>
      <Routes>
        <Route path="/" element={<PortfolioSelector />} />
        <Route path="/portfolios/:id" element={<Placeholder label="Portfolio detail" />} />
        <Route path="/portfolios/compare" element={<Placeholder label="Portfolio comparison" />} />
        <Route path="/companies/:ticker" element={<Placeholder label="Company detail" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
