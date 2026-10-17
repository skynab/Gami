import { Link } from 'react-router';
import { PaperIcon } from '../app/icons';
import { TopBar } from '../app/TopBar';

export function NotFound() {
  return (
    <div className="app">
      <TopBar />
      <main className="stage">
        <div className="stage-empty">
          <PaperIcon className="stage-icon" />
          <h1>This page got folded away</h1>
          <p className="muted">We couldn’t find what you were looking for.</p>
          <Link to="/" className="primary">
            See all models
          </Link>
        </div>
      </main>
    </div>
  );
}
