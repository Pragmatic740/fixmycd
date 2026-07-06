import Link from 'next/link';

export default function LandingPage() {
  return (
    <>
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <img src="/logo.svg" alt="FixMyDistrict Logo" />
          <span>FixMyDistrict</span>
        </div>
        <div className="landing-nav-links">
          <Link href="#features">Features</Link>
          <Link href="#how-it-works">How it works</Link>
          <Link href="/dashboard" className="btn-primary">
            Launch App
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <h1>Your district deserves <span>better infrastructure.</span></h1>
        <p>
          Report potholes, broken streetlights, and infrastructure failures. 
          Hold local authorities accountable and track repairs in real-time.
        </p>
        <div className="landing-hero-actions">
          <Link href="/dashboard" className="btn-primary">
            Start Reporting
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            View the Map
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="landing-features">
        <h2>Why FixMyDistrict?</h2>
        <p>A modern platform designed to bridge the gap between citizens and local government for better public infrastructure.</p>
        
        <div className="features-grid">
          <div className="feature-card">
            <img src="/hero-asset-1.svg" alt="Report easily" className="feature-card-icon" />
            <h3>Report Instantly</h3>
            <p>Snap a photo, tag the location on the map, and submit your report in less than 30 seconds.</p>
          </div>
          <div className="feature-card">
            <img src="/hero-asset-2.svg" alt="Community upvotes" className="feature-card-icon" />
            <h3>Community Driven</h3>
            <p>Upvote critical issues in your neighborhood to bring them to the immediate attention of authorities.</p>
          </div>
          <div className="feature-card">
            <img src="/hero-asset-3.svg" alt="Track progress" className="feature-card-icon" />
            <h3>Track Progress</h3>
            <p>Receive updates when your report is acknowledged, assigned, and finally resolved.</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="landing-steps">
        <h2>How it works</h2>
        <div className="steps-row">
          <div className="step-item">
            <div className="step-number">1</div>
            <h3>Spot an Issue</h3>
            <p>See a pothole or broken light? Open the app.</p>
          </div>
          <div className="step-item">
            <div className="step-number">2</div>
            <h3>Pin & Report</h3>
            <p>Pin the exact location and add a quick description.</p>
          </div>
          <div className="step-item">
            <div className="step-number">3</div>
            <h3>Get it Fixed</h3>
            <p>Authorities are notified. Track the repair progress.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} FixMyDistrict. Built for the community.</p>
      </footer>
    </>
  );
}
