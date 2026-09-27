import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { ApiError } from '../lib/api';
import { useLogin, useMe } from '../lib/auth';

export default function Login() {
  const { data: me, isPending } = useMe();
  const navigate = useNavigate();
  const login = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isPending && me) return <Navigate to="/studio" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    login.mutate({ username, password }, {
      onSuccess: () => navigate('/studio'),
      onError: err => setError(err instanceof ApiError ? err.message : 'Something went wrong.'),
    });
  };

  return (
    <div className="page">
      <div className="page-inner" style={{ maxWidth: 420, width: '100%', margin: '0 auto', padding: '48px 20px', gap: 28 }}>
        <header className="page-header" style={{ justifyContent: 'center' }}>
          <Logo size="lg" />
        </header>

        <form className="form-card" onSubmit={submit} noValidate style={{ gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>Studio login</h1>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Username</span>
            <input
              className="field"
              style={{ height: 48, borderRadius: 14, padding: '0 14px', fontSize: 18 }}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Password</span>
            <input
              className="field"
              type="password"
              style={{ height: 48, borderRadius: 14, padding: '0 14px', fontSize: 18 }}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          <button type="submit" className="btn-dark press press-pink" style={{ height: 50, fontSize: 19 }} disabled={login.isPending}>
            {login.isPending ? 'Logging in…' : 'Log in'}
          </button>
          {error && <span className="hand" role="alert" style={{ fontSize: 20, color: '#C8283F', textAlign: 'center' }}>{error}</span>}
        </form>
      </div>
    </div>
  );
}
