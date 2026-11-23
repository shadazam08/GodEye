import './App.css'
import Header from './components/Header'
import Footer from './components/Footer'
import HazardMap from './components/HazardMap'
import BackendStatus from './components/BackendStatus'
import ReportForm from './components/ReportForm'
import ReviewerPanel from './components/ReviewerPanel'

function App() {
  return (
    <div className="website">
      {/* Website navigation */}
      <Header />

      <main>
        <BackendStatus />
        {/* Main introduction */}
        <section className="hero section-container" id="home">
          <div className="hero-content">
            <span className="eyebrow">
              ROAD AWARENESS. COMMUNITY POWERED.
            </span>

            <h1>
              Know the road.
              <br />
              <span>Before the bump.</span>
            </h1>

            <p className="hero-description">
              A pothole should never be a surprise. GodEye is being
              built to turn community reports into mapped road hazards,
              advance warnings, and visible repair progress.
            </p>

            <div className="hero-actions">
              <a className="button button-primary" href="#how-it-works">
                See how it works <span aria-hidden="true">↗</span>
              </a>

              <a className="button button-secondary" href="#project">
                Why GodEye?
              </a>
            </div>

            <p className="hero-note">
              Built for the web. Designed for better road awareness.
            </p>
          </div>

          <aside className="concept-card" aria-labelledby="concept-title">
            <div className="card-topline">
              <span className="status-label">THE GODEYE APPROACH</span>
              <span className="concept-badge">Concept preview</span>
            </div>

            <div className="road-illustration" aria-hidden="true">
              <div className="road-line" />
              <span className="road-hazard">!</span>
              <span className="road-vehicle">↑</span>
            </div>

            <div className="warning-preview">
              <span className="warning-icon" aria-hidden="true">⚠</span>

              <div>
                <h2 id="concept-title">Pothole ahead</h2>
                <p>Advance awareness. More time to respond.</p>
              </div>
            </div>

            <p className="card-disclaimer">
              Illustration only. Live location and alerts are not
              connected yet.
            </p>
          </aside>
        </section>

        {/* Product principles */}
        <section className="principles" aria-label="Product principles">
          <span>Community reports</span>
          <span>Verified hazard records</span>
          <span>Location-based awareness</span>
          <span>Repair visibility</span>
        </section>

        {/* Explain the workflow */}
        <section
          className="section-container content-section"
          id="how-it-works"
        >
          <span className="eyebrow">FROM REPORT TO ROAD AWARENESS</span>
          <h2 className="section-title">One report. A better-informed journey.</h2>

          <div className="steps-grid">
            <article className="info-card">
              <span className="step-number">01</span>
              <h3>Report a pothole</h3>
              <p>
                A stationary user or passenger submits the location
                and a description of road damage.
              </p>
            </article>

            <article className="info-card">
              <span className="step-number">02</span>
              <h3>Review the evidence</h3>
              <p>
                Reports are checked before being published as
                verified hazards on the shared map.
              </p>
            </article>

            <article className="info-card">
              <span className="step-number">03</span>
              <h3>Improve awareness</h3>
              <p>
                Drivers can view mapped hazards, while repair updates
                help keep road information current.
              </p>
            </article>
          </div>
        </section>

        {/* Planned capabilities */}
        <section
          className="section-container content-section"
          id="features"
        >
          <span className="eyebrow">WHAT WE ARE BUILDING</span>
          <h2 className="section-title">A clearer picture of the road ahead.</h2>

          <div className="features-grid">
            <article className="info-card">
              <span className="feature-tag">MAP</span>
              <h3>Road hazard map</h3>
              <p>
                Explore reported potholes with their location,
                verification status, and latest update.
              </p>
            </article>

            <article className="info-card">
              <span className="feature-tag">REPORT</span>
              <h3>Community reporting</h3>
              <p>
                Share useful road damage information and follow
                your report through the review process.
              </p>
            </article>

            <article className="info-card">
              <span className="feature-tag">ALERT</span>
              <h3>Active-session warnings</h3>
              <p>
                Planned location-based warnings while the website
                remains active and location access is available.
              </p>
            </article>

            <article className="info-card">
              <span className="feature-tag">REVIEW</span>
              <h3>Repair tracking</h3>
              <p>
                Help authorized reviewers verify reports and track
                hazards through to confirmed repair.
              </p>
            </article>
          </div>

          <p className="section-note">
            These capabilities are under development. AI photo
            screening is a future addition and is not active.
          </p>
        </section>

        {/* Project mission */}
        <section
          className="section-container content-section"
          id="project"
        >
          <div className="mission-panel">
            <span className="eyebrow">OUR MISSION</span>
            <h2 className="section-title">
              Better road information starts with all of us.
            </h2>
            <p>
              Rain, fog, and darkness can make road damage harder to
              notice. GodEye aims to make previously mapped hazards
              easier to anticipate through shared, current information.
            </p>
            <p>
              GodEye is an independent project. Hazard information may
              be incomplete and does not guarantee a safe road.
            </p>
          </div>
        </section>
        <ReportForm />
        <HazardMap />
        <ReviewerPanel />
      </main>

      <Footer />
    </div>
  )
}

export default App