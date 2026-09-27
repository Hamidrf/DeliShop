import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { isLoggedIn, logIn } from '../lib/auth';
import './Login.css';

/** Where a login lands when it wasn't sent here from another studio page. */
const STUDIO_HOME = '/studio/products';

export default function Login() {
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const next = from?.startsWith('/studio') && from !== '/studio/login' ? from : STUDIO_HOME;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  if (isLoggedIn()) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Enter your username and password.'); return; }
    setChecking(true);
    const result = await logIn(username, password);
    if (result === 'ok') { navigate(next, { replace: true }); return; }
    setChecking(false);
    setError(result === 'insecure'
      ? 'Log in only works on https or localhost. Open the studio from one of those.'
      : 'That username or password is wrong.');
  };

  return (
    <div className="page">
      <div className="page-inner login">
        <header className="page-header">
          <Logo to="/" />
          <Link to="/" className="pill">← Back to the shop</Link>
        </header>

        <form className="form-card login-card" onSubmit={submit} noValidate>
          <div className="login-head">
            <span className="studio-badge">Studio</span>
            <h1 className="login-title">Log in</h1>
            <span className="hand login-sub">Manage the drawings, prices and stories in the shop.</span>
          </div>

          <div className="login-field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              className="field login-input"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <div className="login-password">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-show"
                aria-controls="login-password"
                aria-pressed={showPassword}
                onClick={() => setShowPassword(s => !s)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
            <button type="submit" className="btn-dark login-submit press press-pink" disabled={checking}>
              {checking ? 'Checking…' : 'Log in'}
            </button>
            <span className="hand login-error" role="alert">{error}</span>
          </div>
        </form>
      </div>
    </div>
  );
}
