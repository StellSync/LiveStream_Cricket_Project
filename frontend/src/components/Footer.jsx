import "./Footer.css";

export default function Footer() {
  return (
    <footer className="app-footer text-light py-3">
      <div className="container d-flex flex-column flex-md-row justify-content-between align-items-center text-center text-md-start">
        <span className="fw-bold">Made with ❤️ by Stellsync</span>
        <span>
          Contact us:&nbsp;
          <a
            href="https://stellsync.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-decoration-none footer-link"
          >
            🌐 stellsync.com
          </a>
        </span>
      </div>
    </footer>
  );
}
