import { Outlet, Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

export function AuthLayout() {
  return (
    <div className="auth-layout">
      {/* Left branding panel — visible on desktop */}
      <aside className="auth-brand-panel">
        <div className="brand-bg-circles">
          <div className="circle circle-1"></div>
          <div className="circle circle-2"></div>
          <div className="circle circle-3"></div>
        </div>
        <div className="brand-content-left">
          <div className="brand-logo-row">
            <div className="brand-logo-icon">
              <img src="/favicon.svg" alt="GuardEye Logo" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
            </div>
            <span className="brand-name">GuardEye</span>
          </div>
          
          <h1 className="brand-headline">
            Uncompromising<br/>
            safety for what<br/>
            matters most.
          </h1>
          
          <p className="brand-desc">
            Advanced digital monitoring and protection designed<br/>
            to keep your family and assets secure in an ever-<br/>
            evolving world.
          </p>

          <div className="trusted-section">
            <div className="avatar-group">
              <div className="avatar-item" style={{backgroundImage: 'url(https://i.pravatar.cc/100?img=11)'}}></div>
              <div className="avatar-item" style={{backgroundImage: 'url(https://i.pravatar.cc/100?img=47)'}}></div>
              <div className="avatar-item" style={{backgroundImage: 'url(https://i.pravatar.cc/100?img=12)'}}></div>
            </div>
            <span className="trusted-text">Trusted by over 10,000+ users worldwide</span>
          </div>
        </div>
      </aside>

      {/* Right form panel */}
      <main className="auth-form-panel" style={{ position: 'relative' }}>
        <Link to="/" style={{ position: 'absolute', top: '2rem', left: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-primary)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
          <FiArrowLeft /> Back
        </Link>
        <div className="auth-form-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
