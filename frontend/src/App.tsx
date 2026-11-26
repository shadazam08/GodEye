import { useEffect } from 'react'
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from 'react-router'

import './App.css'
import './brand.css'
import './brand-theme.css'
import Header from './components/Header'
import Footer from './components/Footer'
import HazardMap from './components/HazardMap'
import ReportForm from './components/ReportForm'
import MyReports from './components/MyReports'
import ReviewerPanel from './components/ReviewerPanel'

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

function AboutPage() {
  return (
    <section className="section-container content-section">
      <span className="eyebrow">ABOUT GODEYE</span>

      <h1 className="section-title">
        Better information about damaged roads.
      </h1>

      <div className="info-card">
        <h2>How it works</h2>

        <p>
          Community members report road damage with its location
          and photo evidence. Reviewers assess reports before
          verified hazards appear on the public map.
        </p>

        <h2>Current features</h2>

        <p>
          Explore verified hazards, view your device location,
          submit reports and check your own report status.
        </p>

        <h2>Under development</h2>

        <p>
          Destination search, route navigation and voice warnings
          are not available yet.
        </p>

        <h2>Our focus</h2>

        <p>
          GodEye is an independent project initially focused on
          Darbhanga. Reports may be incomplete or out of date.
        </p>
      </div>
    </section>
  )
}

function NotFoundPage() {
  return (
    <section className="section-container content-section">
      <h1 className="section-title">Page not found</h1>

      <Link className="button button-primary" to="/">
        Open road map
      </Link>
    </section>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />

      <div className="website app-layout">
        <Header />

        <main className="app-main" id="main-content">
          <Routes>
            <Route path="/" element={<HazardMap />} />
            <Route path="/report" element={<ReportForm />} />
            <Route path="/my-reports" element={<MyReports />} />
            <Route path="/admin" element={<ReviewerPanel />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App