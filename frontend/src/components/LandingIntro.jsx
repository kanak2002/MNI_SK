import { ArrowRight, Lock, ShieldCheck, Sparkles } from "lucide-react";

function LandingIntro({ onLaunch }) {
  return (
    <main className="landing-shell">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <div className="landing-eyebrow">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Privacy-first agent control</span>
          </div>

          <div className="landing-title-group">
            <h1 id="landing-title">PersonaGuard</h1>
            <p className="landing-subtitle">Privacy-aware AI Governor</p>
          </div>

          <p className="landing-description">
            Set your privacy comfort level once. PersonaGuard protects what gets
            shared, blocked, substituted, or confirmed before an AI agent acts.
          </p>

          <button className="landing-launch" type="button" onClick={onLaunch}>
            <span>Launch PersonaGuard</span>
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="landing-preview" aria-hidden="true">
          <div className="preview-card preview-card-primary">
            <div className="preview-card-header">
              <div className="preview-icon">
                <Lock size={20} />
              </div>
              <div>
                <span>Comfort level</span>
                <strong>Balanced privacy</strong>
              </div>
            </div>
            <div className="preview-meter">
              <span />
            </div>
          </div>

          <div className="preview-rule-grid">
            <div className="preview-rule">
              <span>BLOCK</span>
              <strong>SSN, full address</strong>
            </div>
            <div className="preview-rule">
              <span>CONFIRM</span>
              <strong>Payments, bookings</strong>
            </div>
            <div className="preview-rule">
              <span>SUBSTITUTE</span>
              <strong>Email, phone</strong>
            </div>
            <div className="preview-rule">
              <span>SHARE</span>
              <strong>Low-risk context</strong>
            </div>
          </div>

          <div className="preview-card preview-card-footer">
            <Sparkles size={18} />
            <span>AI action checked before release</span>
          </div>
        </div>
      </section>
    </main>
  );
}

export default LandingIntro;
