import { Link, NavLink } from "react-router-dom";
import Footer from "./Footer";
import "./Navbar.css";

export default function Layout({ children }) {
  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Navbar */}
      <nav
        className="navbar navbar-expand-lg navbar-dark shadow-sm"
        style={{ background: "linear-gradient(to right, #000000, #0d1b2a)" }}
      >
        <div className="container">
          <Link className="navbar-brand fw-bold fs-4" to="/">
             Scoreboard Admin
          </Link>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#nav"
            aria-controls="nav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div className="collapse navbar-collapse" id="nav">
            <ul className="navbar-nav ms-auto">
              <li className="nav-item"><NavLink className="nav-link" to="/scoreboard">Scoreboard</NavLink></li>
              <li className="nav-item"><NavLink className="nav-link" to="/tournaments">Tournaments</NavLink></li>
              <li className="nav-item"><NavLink className="nav-link" to="/teams">Teams</NavLink></li>
              <li className="nav-item"><NavLink className="nav-link" to="/players">Players</NavLink></li>
              <li className="nav-item"><NavLink className="nav-link" to="/matches">Matches</NavLink></li>
            </ul>
          </div>
        </div>
      </nav>

      {/* MAIN should grow to push footer to bottom when content is short */}
      <main className="container-fluid my-4 px-3 px-md-4 flex-grow-1">
        {children}
      </main>

      {/* Footer (no fixed-bottom) */}
      <Footer />
    </div>
  );
}
