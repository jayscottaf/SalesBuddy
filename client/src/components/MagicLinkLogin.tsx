import { useState } from 'react';
import './MagicLinkLogin.css';

export default function MagicLinkLogin() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    try {
      const res = await fetch('/api/auth/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to send sign-in link.');
      }
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to send sign-in link.');
    }
  };

  return (
    <div className="magic-login">
      <div className="magic-login__card">
        <div className="magic-login__brand">
          <div className="magic-login__logo">S</div>
          <div className="magic-login__title">Salesbuddy</div>
        </div>
        <h2>Sign in</h2>
        <p className="magic-login__sub">Enter your work email and we'll send you a sign-in link.</p>
        {status !== 'sent' && (
          <form onSubmit={submit}>
            <label className="magic-login__label">
              Email
              <input
                type="email"
                required
                autoFocus
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={status === 'sending'}
              />
            </label>
            <button type="submit" className="magic-login__submit" disabled={status === 'sending' || !email}>
              {status === 'sending' ? 'Sending...' : 'Send sign-in link'}
            </button>
            {error && <div className="magic-login__error">{error}</div>}
          </form>
        )}
        {status === 'sent' && (
          <div className="magic-login__sent">
            <div className="magic-login__check">✓</div>
            <h3>Check your email</h3>
            <p>We sent a sign-in link to <strong>{email}</strong>. It expires in 15 minutes.</p>
            <button type="button" className="magic-login__link" onClick={() => setStatus('idle')}>Use a different email</button>
          </div>
        )}
      </div>
    </div>
  );
}
