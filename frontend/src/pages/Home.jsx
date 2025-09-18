export default function Home() {
  return (
    <div className="row g-3">
      <div className="col-md-6">
        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="card-title">Welcome 👋</h5>
            <p className="mb-0">
              Use the navigation to manage Tournaments, Teams, Players, and Matches.
              OBS overlay is served by your backend at <code>/overlay</code>.
            </p>
          </div>
        </div>
      </div>
      <div className="col-md-6">
        <div className="alert alert-info mb-0">
          Tip: After creating teams & tournaments, create a match by selecting IDs or names.
          The API stores only IDs but the UI will show names.
        </div>
      </div>
    </div>
  );
}
