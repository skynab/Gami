import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import './app/app.css';
import { Gallery } from './routes/Gallery';
import { Learn } from './routes/Learn';
import { NotFound } from './routes/NotFound';

// Only creators need the Studio, so everyone else never downloads it.
const Studio = lazy(() => import('./routes/Studio'));
// The internal Studio for writing the built-in models. Left out of production builds entirely.
const StudioDev = import.meta.env.DEV ? lazy(() => import('./routes/StudioDev')) : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/learn/:modelId" element={<Learn />} />
        <Route
          path="/studio/:draftId?"
          element={
            <Suspense fallback={null}>
              <Studio />
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
