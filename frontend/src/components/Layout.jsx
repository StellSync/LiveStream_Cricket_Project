import { Link, NavLink } from "react-router-dom";

export default function Layout({ children }) {
  return (
    <>
      {/* Full-width navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-fluid">
          <Link className="navbar-brand" to="/">Scoreboard Admin</Link>
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
            <ul className="navbar-nav me-auto">
              <li className="nav-item"><NavLink className="nav-link" to="/tournaments">Tournaments</NavLink></li>
              <li className="nav-item"><NavLink className="nav-link" to="/teams">Teams</NavLink></li>
              <li className="nav-item"><NavLink className="nav-link" to="/players">Players</NavLink></li>
              <li className="nav-item"><NavLink className="nav-link" to="/matches">Matches</NavLink></li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Full-width page container; remove px with px-0 if you want truly edge-to-edge */}
      <main className="container-fluid my-4 px-3 px-md-4">
        {children}
      </main>
    </>
  );
}
