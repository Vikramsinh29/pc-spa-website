import Image from "next/image";

export default function Home() {
  return (
    <main>
      <section className="hero" id="overview">
        <div className="hero-art" aria-label="PC-SPA golden phoenix artwork">
          <Image src="/pc-spa-hero.png" alt="PC-SPA golden phoenix emblem" fill priority sizes="(max-width: 900px) 100vw, 42vw" style={{ objectFit: "cover" }} />
        </div>
        <div className="hero-copy">
          <header className="nav">
            <a className="mobile-brand" href="#overview">PC-SPA</a>
            <nav aria-label="Main navigation">
              <a href="#features">Features</a>
              <a href="#safety">Safety</a>
              <a href="#faq">FAQ</a>
            </nav>
            <a className="nav-cta" href="/beta-access">Sign in</a>
          </header>
          <div className="hero-content">
            <p className="eyebrow">PC-SPA &middot; CONTROLLED BETA</p>
            <h1>A cleaner, clearer Windows PC.<br /><span>No guesswork.</span></h1>
            <p className="intro">Understand system health, safely review temporary files, and improve everyday performance with a calm, guided experience.</p>
            <form className="signup" id="join">
              <label className="sr-only" htmlFor="email">Email address</label>
              <input id="email" type="email" placeholder="Your email address" required />
              <button type="submit">Request beta access <span>&rarr;</span></button>
            </form>
            <div className="trust-row">
              <span>&#10003; Windows 10 &amp; 11</span>
              <span>&#9671; Review before cleaning</span>
              <span>&#9676; Feedback welcome</span>
            </div>
            <p className="beta-note">Controlled beta only. The current installer is unsigned and is not offered as an unrestricted public download.</p>
          </div>
        </div>
      </section>

      <section className="section features" id="features">
        <div className="section-head">
          <p className="eyebrow">WHAT&rsquo;S INCLUDED</p>
          <h2>Every essential tool.<br />One clear experience.</h2>
        </div>
        <div className="feature-grid">
          <article><span>01</span><h3>Cleaner</h3><p>Scan temporary files, review every result, and clean only the items you select.</p></article>
          <article><span>02</span><h3>Health Check</h3><p>See essential system checks and overall PC health in clear, simple language.</p></article>
          <article><span>03</span><h3>Custom Clean</h3><p>Choose specific cleanup areas and preview exactly what PC-SPA finds before taking action.</p></article>
          <article><span>04</span><h3>Auto Clean Schedule</h3><p>Plan regular cleanup reminders while keeping every cleanup under your control.</p></article>
          <article><span>05</span><h3>Large File Finder</h3><p>Locate space-hungry files quickly, review them safely, and decide what deserves attention.</p></article>
        </div>
      </section>

      <section className="safety" id="safety">
        <div><p className="eyebrow">BUILT FOR CONTROL</p><h2>PC care should feel safe, not mysterious.</h2></div>
        <div className="safety-card">
          <span className="shield">&#10003;</span>
          <p><strong>Preview first.</strong> Scan results are shown before action. Destructive changes are never the default.</p>
          <p><strong>Your choice.</strong> Select only what you understand and want to remove.</p>
          <p><strong>Beta transparency.</strong> Version and build details remain visible inside the app.</p>
        </div>
      </section>

      <section className="section faq" id="faq">
        <div className="section-head"><p className="eyebrow">COMMON QUESTIONS</p><h2>Good to know.</h2></div>
        <div className="faq-list">
          <details><summary>Is PC-SPA free?<span>+</span></summary><p>The current beta is free for approved testers. Commercial plans will be announced later.</p></details>
          <details><summary>Will it delete files automatically?<span>+</span></summary><p>No. PC-SPA shows you what it finds and asks for confirmation before cleanup.</p></details>
          <details><summary>Which Windows versions are supported?<span>+</span></summary><p>This beta is designed for 64-bit Windows 10 and Windows 11.</p></details>
          <details><summary>Why is Windows showing an unknown publisher warning?<span>+</span></summary><p>The controlled beta is currently unsigned. Only install a build received through the official PC-SPA beta programme.</p></details>
          <details><summary>How can I contact PC-SPA?<span>+</span></summary><p>For beta access, installation help, or feedback, email support@getpcspa.com.</p></details>
        </div>
      </section>

      <footer>
        <a href="#overview" className="footer-brand">PC-SPA</a>
        <p>System Performance Accelerator</p>
        <p>Get in touch: <a className="support-link" href="mailto:support@getpcspa.com">support@getpcspa.com</a></p>
        <p>&copy; 2026 PC-SPA &middot; Beta software</p>
      </footer>
    </main>
  );
}
