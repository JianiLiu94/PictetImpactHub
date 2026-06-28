import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { PortfolioSelector } from "./pages/PortfolioSelector";
import { PortfolioDetail } from "./pages/PortfolioDetail";
import { Compare } from "./pages/Compare";
import { CompanyDetail } from "./pages/CompanyDetail";
import { CompaniesList } from "./pages/CompaniesList";
import { Methodology } from "./pages/Methodology";
import { BookIcon, BuildingIcon, GridIcon, ShuffleIcon } from "./components/Icon";
import { ThemeToggle } from "./components/ThemeToggle";
import logo from "./assets/banque-pictet-cie.png";

function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item${isActive ? " is-active" : ""}`}>
      {icon}
      {label}
    </NavLink>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar__logo">
            <img src={logo} alt="Banque Pictet & Cie" />
          </div>
          <nav className="sidebar__nav">
            <NavItem to="/" end icon={<GridIcon />} label="Portfolios" />
            <NavItem to="/companies" icon={<BuildingIcon />} label="Companies" />
            <NavItem to="/compare" icon={<ShuffleIcon />} label="Compare" />
            <NavItem to="/methodology" icon={<BookIcon />} label="Methodology" />
          </nav>
          <div className="sidebar__spacer" />
          <ThemeToggle />
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<PortfolioSelector />} />
            <Route path="/portfolios/:id" element={<PortfolioDetail />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/companies" element={<CompaniesList />} />
            <Route path="/companies/:ticker" element={<CompanyDetail />} />
            <Route path="/methodology" element={<Methodology />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
