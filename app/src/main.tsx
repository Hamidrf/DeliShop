import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PageLoader } from './components/PageLoader';
import { RequireLogin } from './components/RequireLogin';
import './index.css';
import { queryClient } from './lib/queryClient';

const LOADER_MIN_MS = 4000;

/**
 * Wraps a page import so PageLoader is guaranteed to show for at least
 * `LOADER_MIN_MS`, even once the page's code (a few KB) loads almost
 * instantly. Only bites the first time a given page is visited in a
 * session -- the browser caches the imported module, so later visits to
 * the same page resolve immediately and skip the loader entirely.
 */
function lazyWithMinDelay<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    Promise.all([factory(), new Promise(resolve => setTimeout(resolve, LOADER_MIN_MS))])
      .then(([mod]) => mod),
  );
}

// Lazily loaded so PageLoader's childlike bounce shows while each page's code loads,
// instead of shipping every page in the first bundle.
const Shop = lazyWithMinDelay(() => import('./pages/shop/Shop'));
const Checkout = lazyWithMinDelay(() => import('./pages/Checkout'));
const Login = lazyWithMinDelay(() => import('./pages/Login'));
const Admin = lazyWithMinDelay(() => import('./pages/Admin'));
const Inventory = lazyWithMinDelay(() => import('./pages/Inventory'));
const Orders = lazyWithMinDelay(() => import('./pages/Orders'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Shop />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/studio/login" element={<Login />} />
            <Route path="/studio" element={<RequireLogin><Admin /></RequireLogin>} />
            <Route path="/studio/products" element={<RequireLogin><Inventory /></RequireLogin>} />
            <Route path="/studio/orders" element={<RequireLogin><Orders /></RequireLogin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
