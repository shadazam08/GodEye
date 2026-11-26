import { Link } from 'react-router'

function Footer() {
  return (
    <footer className="site-footer">
      <Link className="brand" to="/" aria-label="GodEye home">
        <img
          className="brand-logo"
          src="/brand/logo-transparent-512.webp"
          alt=""
          width={40}
          height={40}
        />

        <span>
          God<span className="brand-highlight">Eye</span>
        </span>
      </Link>

      <Link to="/about">About GodEye</Link>

      <Link to="/admin">Admin dashboard</Link>
    </footer>
  )
}

export default Footer