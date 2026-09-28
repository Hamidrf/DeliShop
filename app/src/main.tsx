import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PageLoader } from './components/PageLoader';
import { RequireLogin } from './components/RequireLogin';
import './index.css';
import { queryClient } from './lib/queryClient';

// Lazily loaded so PageLoader's childlike bounce shows while each page's code loads,
// instead of shipping every page in the first bundle.
const Shop = lazy(() => import('./pages/shop/Shop'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Login = lazy(() => import('./pages/Login'));
const Admin = lazy(() => import('./pages/Admin'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Orders = lazy(() => import('./pages/Orders'));

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
