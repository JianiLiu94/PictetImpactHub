import { useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { PortfolioSelector } from "./pages/PortfolioSelector";
import { PortfolioDetail } from "./pages/PortfolioDetail";
import { Compare } from "./pages/Compare";
import { CompanyDetail } from "./pages/CompanyDetail";
import { CompaniesList } from "./pages/CompaniesList";
import { BuildPortfolio } from "./pages/BuildPortfolio";
import { Methodology } from "./pages/Methodology";
import { DevPortal } from "./pages/DevPortal";
import { Contact } from "./pages/Contact";
import { BookIcon, BuildingIcon, ChevronLeftIcon, ChevronRightIcon, CodeIcon, GridIcon, MailIcon, ShuffleIcon, UploadIcon } from "./components/Icon";
import { ThemeToggle } from "./components/ThemeToggle";
import logo from "./assets/banque-pictet-cie.png";

function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item${isActive ? " is-active" : ""}`}>
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className={`sidebar${sidebarOpen ? "" : " sidebar--collapsed"}`}>
          <div className="sidebar__logo">
            <img src={logo} alt="Banque Pictet & Cie" />
          </div>
          <nav className="sidebar__nav">
            <NavItem to="/" end icon={<GridIcon />} label="Portfolios" />
            <NavItem to="/companies" icon={<BuildingIcon />} label="Companies" />
            <NavItem to="/compare" icon={<ShuffleIcon />} label="Compare" />
            <NavItem to="/build" icon={<UploadIcon />} label="Custom Portfolio" />
            <NavItem to="/methodology" icon={<BookIcon />} label="Methodology" />
            <NavItem to="/dev-portal" icon={<CodeIcon />} label="Dev Portal" />
            <NavItem to="/contact" icon={<MailIcon />} label="Contact" />
          </nav>
          <div className="sidebar__spacer" />
          <ThemeToggle />
          <button
            className="sidebar__toggle"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <ChevronLeftIcon size={14} /> : <ChevronRightIcon size={14} />}
            {sidebarOpen && <span>Collapse</span>}
          </button>
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<PortfolioSelector />} />
            <Route path="/portfolios/:id" element={<PortfolioDetail />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/build" element={<BuildPortfolio />} />
            <Route path="/companies" element={<CompaniesList />} />
            <Route path="/companies/:ticker" element={<CompanyDetail />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/dev-portal" element={<DevPortal />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
