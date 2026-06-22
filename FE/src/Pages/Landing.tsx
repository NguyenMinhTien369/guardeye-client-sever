import { useNavigate } from "react-router-dom";
import { FiShield, FiActivity, FiBell, FiPauseCircle, FiCheckCircle, FiGlobe } from "react-icons/fi";

export function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-logo">
          <img src="/favicon.svg" alt="GuardEye Logo" style={{ width: '28px', height: '28px' }} />
          <span className="logo-text">GuardEye</span>
        </div>
        <nav className="landing-nav">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it Works</a>
          <a href="#testimonials">Testimonials</a>
        </nav>
        <div className="landing-actions">
          <button className="btn btn-primary btn-get-started" onClick={() => navigate('/register')}>Get Started</button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="trusted-badge">
            <FiShield className="badge-icon" /> Trusted by 10,000+ Guardians
          </div>
          <h1 className="hero-headline">
            Uncompromising safety<br/>for what matters most.
          </h1>
          <p className="hero-subtext">
            GuardEye provides vigilant clarity for your digital household. 
            Advanced monitoring, intelligent alerts, and total control—simplified.
          </p>
          <div className="hero-buttons">
            <button className="btn btn-primary hero-btn" onClick={() => navigate('/login')}>Login</button>
            <button className="btn btn-outline hero-btn-demo" onClick={() => navigate('/register')}>
              Register
            </button>
          </div>
        </div>
        <div className="hero-graphic">
          <div className="graphic-placeholder" style={{ padding: 0, overflow: 'hidden' }}>
            <img src="/hero-graphic.png" alt="GuardEye System Illustration" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="landing-social-proof">
        <div className="social-text">Trusted by over 10,000+ parents worldwide.</div>
        <div className="social-logos">
          <span className="partner-logo">SafeNet</span>
          <span className="partner-logo">ChildTrust</span>
          <span className="partner-logo">GuardianAlliance</span>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="landing-features">
        <div className="section-header">
          <h2>Proactive Digital Protection</h2>
          <p>Designed for precision and ease. GuardEye transforms complex data into actionable safety insights.</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: '#3b82f6', backgroundColor: '#eff6ff' }}>
              <FiActivity />
            </div>
            <h3>Real-time Monitoring</h3>
            <p>Live updates on digital activity across all connected devices. Witness activity as it happens with zero latency.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: '#ef4444', backgroundColor: '#fef2f2' }}>
              <FiBell />
            </div>
            <h3>Intelligent Alerts</h3>
            <p>Our AI identifies risky behavior before it becomes a problem, sending instant notifications to your primary device.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: '#10b981', backgroundColor: '#ecfdf5' }}>
              <FiPauseCircle />
            </div>
            <h3>Remote Control</h3>
            <p>Need a digital timeout? Instantly pause all monitoring or internet access with a single tap from your dashboard.</p>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section id="how-it-works" className="landing-steps">
        <div className="steps-content">
          <h2>Peace of mind in 3 simple steps</h2>
          
          <div className="step-item">
            <div className="step-number">1</div>
            <div className="step-text">
              <h3>Install Agent</h3>
              <p>Download our lightweight agent on the devices you wish to protect. It runs silently in the background.</p>
            </div>
          </div>

          <div className="step-item">
            <div className="step-number">2</div>
            <div className="step-text">
              <h3>Configure Rules</h3>
              <p>Set boundaries and monitoring rules using our intuitive dashboard tailored to your family's needs.</p>
            </div>
          </div>

          <div className="step-item">
            <div className="step-number">3</div>
            <div className="step-text">
              <h3>Stay Informed</h3>
              <p>Receive clear reports and urgent alerts only when necessary, maintaining a calm digital environment.</p>
            </div>
          </div>
        </div>
        
        <div className="steps-graphic">
          <div className="laptop-mockup">
            <div className="laptop-screen">
              <div className="dashboard-mockup">
                <div className="mockup-header"></div>
                <div className="mockup-sidebar"></div>
                <div className="mockup-main">
                  <div className="mockup-card"></div>
                  <div className="mockup-card"></div>
                </div>
              </div>
            </div>
            <div className="laptop-base"></div>
            
            <div className="floating-badge">
              <div className="badge-header">
                <FiCheckCircle className="badge-icon-success" /> Active
              </div>
              <p>All devices currently<br/>under protection.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="landing-cta">
        <div className="cta-container">
          <h2>Ready to protect your digital home?</h2>
          <p>Join over 10,000 parents who have chosen vigilant clarity over digital chaos.<br/>Get started today with a 14-day premium trial.</p>
          <div className="cta-buttons">
            <button className="btn btn-white" onClick={() => navigate('/register')}>Join GuardEye Today</button>
            <button className="btn btn-outline-white" onClick={() => navigate('/login')}>Sign In</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-columns">
          <div className="footer-brand">
            <h3 className="footer-logo">GuardEye</h3>
            <p>Providing professional-grade digital safety tools for the modern guardian. Focused on clarity, security, and unwavering reliability.</p>
          </div>
          <div className="footer-links">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#security">Security</a>
          </div>
          <div className="footer-links">
            <h4>Support</h4>
            <a href="#help">Help Center</a>
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="copyright">© 2024 GuardEye. All rights reserved.</div>
          <div className="lang-selector">
            <FiGlobe /> English (US)
          </div>
        </div>
      </footer>
    </div>
  );
}
