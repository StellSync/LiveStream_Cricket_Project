export default function Footer() {
  return (
    <footer
      className="text-light py-4 mt-auto"
      style={{ background: "linear-gradient(to right, #000000, #0d1b2a)" }}
    >
      <div className="container d-flex flex-column flex-md-row justify-content-between align-items-center text-center text-md-start">
        {/* Left side */}
        <div className="mb-2 mb-md-0">
          <span className="fw-bold">Made with ❤️ by Stellsync</span>
        </div>

        {/* Right side */}
        <div>
          <a
            href="https://stellsync.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-decoration-none text-info fw-semibold"
          >
            Visit Us 🌐 stellsync.com
          </a>
        </div>
      </div>
    </footer>
  );
}
