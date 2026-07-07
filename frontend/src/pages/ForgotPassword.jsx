import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1.5px solid var(--rail-border)',
    background: 'var(--input-bg)',
    color: 'var(--text)',
    font: '600 14px Urbanist, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100%',
      background: 'var(--page)',
      padding: '20px',
    }}>
      <div className="card" style={{ width: '440px', padding: '36px 38px', border: '1px solid var(--rail-border)' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '27px', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.8px' }}>
            Smartan <span style={{ color: '#E5A83C', fontWeight: '400' }}>Varsity</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 600 }}>
            Reset your password
          </div>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <div style={{ fontSize: '40px' }}>📬</div>
            <h3 style={{ font: '800 18px Urbanist', color: 'var(--text)', margin: 0 }}>Check your inbox</h3>
            <p style={{ font: '600 13px/1.6 Urbanist', color: 'var(--text-muted)', margin: 0 }}>
              We sent a password reset link to <strong>{email}</strong>. Click it to set a new password.
            </p>
            <Link
              to="/login"
              style={{ font: '700 13px Urbanist', color: '#E5A83C', textDecoration: 'none', marginTop: '8px' }}
            >
              ← Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.09)',
                border: '1.5px solid #ef4444',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '13px',
                color: '#ef4444',
                marginBottom: '20px',
                fontWeight: 600,
              }}>
                {error}
              </div>
            )}

            <p style={{ font: '600 13px/1.6 Urbanist', color: 'var(--text-muted)', marginBottom: '22px' }}>
              Enter the email address for your account and we'll send you a password reset link.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', font: '700 12px Urbanist', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  style={inputStyle}
                  placeholder="user@domain.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="pillbtn"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', height: '48px', fontSize: '15px' }}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link
                to="/login"
                style={{ font: '700 13px Urbanist', color: '#E5A83C', textDecoration: 'none' }}
              >
                ← Back to Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
