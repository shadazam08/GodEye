import { Link, NavLink } from 'react-router'
import AuthControls from './AuthControls'

function Header() {
  return (
    <header className="site-header app-header">
      <Link className="brand" to="/" aria-label="GodEye home">
        <img
          className="brand-logo"
          src="/brand/logo-transparent-512.webp"
          alt=""
          width={52}
          height={52}
        />

        <span>
          God<span className="brand-highlight">Eye</span>
        </span>
      </Link>

      <nav
        className="app-navigation"
        aria-label="Main navigation"
      >
        <NavLink to="/" end>
          Map
        </NavLink>

        <NavLink to="/report">
          Report damage
        </NavLink>

        <NavLink to="/my-reports">
          My Reports
        </NavLink>
      </nav>

      <AuthControls />
    </header>
  )
}

export default Header