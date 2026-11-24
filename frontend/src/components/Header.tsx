import AuthControls from './AuthControls'

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label="GodEye home">
        <span className="brand-icon" aria-hidden="true">
          ◉
        </span>

        God<span className="brand-highlight">Eye</span>
      </a>

      <nav className="navigation" aria-label="Main navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#features">Features</a>
        <a href="#hazard-map">Hazard map</a>
        <a href="#project">Our mission</a>
      </nav>

      <a className="button button-small" href="#report-pothole">
        Report a pothole <span aria-hidden="true">↗</span>
      </a>
      <AuthControls />
    </header>
  )
}

export default Header