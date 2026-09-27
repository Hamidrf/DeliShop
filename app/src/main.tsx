import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireLogin } from './components/RequireLogin';
import './index.css';
import { queryClient } from './lib/queryClient';
import Admin from './pages/Admin';
import Checkout from './pages/Checkout';
import Inventory from './pages/Inventory';
import Login from './pages/Login';
import Orders from './pages/Orders';
import Shop from './pages/shop/Shop';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Shop />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/studio/login" element={<Login />} />
          <Route path="/studio" element={<RequireLogin><Admin /></RequireLogin>} />
          <Route path="/studio/products" element={<RequireLogin><Inventory /></RequireLogin>} />
          <Route path="/studio/orders" element={<RequireLogin><Orders /></RequireLogin>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
