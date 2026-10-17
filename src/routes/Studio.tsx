import { Link } from 'react-router';
import { StudioIcon } from '../app/icons';
import { TopBar } from '../app/TopBar';

/**
 * Advanced mode. Loaded as its own chunk. Sign-in and the creator role arrive in milestone 6;
 * the database's row-level security is what actually protects creator data, not this route.
 */
export default function Studio() {
  return (
    <div className="app">
      <TopBar center="Studio" />
      <main className="stage">
        <div className="stage-empty">
          <StudioIcon className="stage-icon" />
          <h1>Design your own models</h1>
          <p className="muted">
            The Studio is for approved creators. Sign in to fold, save and share your own models.
          </p>
          <button type="button" className="primary" disabled title="Coming soon">
            Sign in
          </button>
          <Link to="/" className="muted small">
            Back to the gallery
          </Link>
        </div>
      </main>
    </div>
  );
}
