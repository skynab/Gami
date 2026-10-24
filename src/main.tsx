import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import './app/app.css';
import './app/theme';
import './i18n';
import { useAuth } from './auth/store';
import { Gallery } from './routes/Gallery';
import { CommunityModel } from './routes/CommunityModel';
import { Learn } from './routes/Learn';
import { NotFound } from './routes/NotFound';

// Only creators need the Studio, so everyone else never downloads it.
const Studio = lazy(() => import('./routes/Studio'));
const Admin = lazy(() => import('./routes/Admin'));
// The Studio editor without signing in, for writing the built-in models. Left out of production builds.
const StudioDev = import.meta.env.DEV ? lazy(() => import('./routes/StudioEditor')) : null;

// Picks up a saved session, or the sign-in link someone just clicked. Does nothing on sites without accounts.
useAuth.getState().start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/learn/:modelId" element={<Learn />} />
        <Route path="/m/:id" element={<CommunityModel />} />
        <Route path="/s/:token" element={<CommunityModel shared />} />
        <Route
          path="/studio/:draftId?"
          element={
            <Suspense fallback={null}>
              <Studio />
            </Suspense>
          }
        />
        <Route
          path="/admin"
          element={
            <Suspense fallback={null}>
              <Admin />
            </Suspense>
          }
        />
        {StudioDev && (
          <Route
            path="/studio/dev"
            element={
              <Suspense fallback={null}>
                <StudioDev />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
