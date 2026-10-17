import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import './app/app.css';
import { Gallery } from './routes/Gallery';
import { Learn } from './routes/Learn';
import { NotFound } from './routes/NotFound';

// Only creators need the Studio, so everyone else never downloads it.
const Studio = lazy(() => import('./routes/Studio'));

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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
