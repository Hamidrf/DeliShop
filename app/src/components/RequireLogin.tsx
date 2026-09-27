import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isLoggedIn } from '../lib/auth';

/** Wraps the studio routes: sends visitors to the login page, then back to where they were going. */
export function RequireLogin() {
  const { pathname } = useLocation();
  return isLoggedIn() ? <Outlet /> : <Navigate to="/studio/login" replace state={{ from: pathname }} />;
}
