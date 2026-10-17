import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** The 52px bar at the top of every page. Pages fill the start, middle and end slots. */
export function TopBar({ start, center, end }: { start?: ReactNode; center?: ReactNode; end?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-start">{start ?? <Brand />}</div>
      {center && <div className="topbar-center">{center}</div>}
      <div className="topbar-end">{end}</div>
    </header>
  );
}

export function Brand() {
  return (
    <Link to="/" className="brand">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="26" height="26" />
      <span>Gami</span>
    </Link>
  );
}
