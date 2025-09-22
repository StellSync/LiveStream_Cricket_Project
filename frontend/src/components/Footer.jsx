export default function Footer() {
  return (
    <footer
      className="text-light py-3 fixed-bottom"
      style={{ background: "linear-gradient(to right, #000000, #0d1b2a)" }}
    >
      <div className="container d-flex flex-column flex-md-row justify-content-between align-items-center text-center text-md-start">
        <span className="fw-bold">Made with ❤️ by Stellsync</span>
        <span>
          Contact us:{" "}
          <a
            href="https://stellsync.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-decoration-none text-info fw-semibold"
          >
            🌐 stellsync.com
          </a>
        </span>
      </div>
    </footer>
  );
}
