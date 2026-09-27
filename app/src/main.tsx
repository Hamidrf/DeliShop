import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireLogin } from './components/RequireLogin';
import './index.css';
import Admin from './pages/Admin';
import Checkout from './pages/Checkout';
import Inventory from './pages/Inventory';
import Login from './pages/Login';
import Shop from './pages/shop/Shop';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Shop />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/studio/login" element={<Login />} />
        <Route element={<RequireLogin />}>
          <Route path="/studio" element={<Admin />} />
          <Route path="/studio/products" element={<Inventory />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
