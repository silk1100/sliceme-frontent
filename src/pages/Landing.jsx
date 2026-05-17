import { Link } from 'react-router-dom';
import './Landing.css';

export default function Landing() {
  return (
    <div className="landing">
      <div className="logo">slice</div>

      <main>
        <h1 className="headline">Turn email designs into export ready assets</h1>
      </main>

      <footer>
        <div className="cta-row">
          <span className="arrow"></span>
          <Link to="/register" className="cta-link">Sign Up</Link>
          <span className="divider">|</span>
          <Link to="/login" className="cta-link">Login</Link>
        </div>
      </footer>
    </div>
  );
}