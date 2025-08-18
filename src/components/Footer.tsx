function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-top">
          <div className="footer-brand">
            <img src="/logo.png" alt="Open IAP" className="footer-logo" />
            <div>
              <h3>Open IAP</h3>
              <p>Unified specification for in-app purchases</p>
            </div>
          </div>
          <div className="footer-links">
            <div className="footer-section">
              <h4>Documentation</h4>
              <ul>
                <li><a href="/docs/lifecycle">Life Cycle</a></li>
                <li><a href="/docs/apis">APIs</a></li>
                <li><a href="/docs/events">Events</a></li>
                <li><a href="/docs/types">Types</a></li>
              </ul>
            </div>
            
            <div className="footer-section">
              <h4>Resources</h4>
              <ul>
                <li><a href="/introduction">Introduction</a></li>
                <li><a href="/tutorials">Tutorials</a></li>
                <li><a href="/languages">Languages</a></li>
                <li><a href="/sponsors">Sponsors</a></li>
              </ul>
            </div>
            
            <div className="footer-section">
              <h4>Community</h4>
              <ul>
                <li><a href="https://github.com/hyochan/openiap.dev" target="_blank" rel="noopener noreferrer">GitHub</a></li>
                <li><a href="http://hyo.dev/joinSlack" target="_blank" rel="noopener noreferrer">Slack</a></li>
                <li><a href="https://x.com/hyodotdev" target="_blank" rel="noopener noreferrer">X (Twitter)</a></li>
                <li><a href="mailto:hyo@hyo.dev">Contact</a></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="footer-divider"></div>
        
        <div className="footer-bottom">
          <p>&copy; 2025 <a href="https://hyo.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', fontWeight: '500' }}>Hyo Dev</a>. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer