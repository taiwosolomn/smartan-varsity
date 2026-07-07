import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { IconEye, IconEyeOff } from '@tabler/icons-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false); // true once Supabase has processed the recovery token

  const navigate = useNavigate();

  useEffect(() => {
    // Supabase handles the #access_token in the URL automatically.
    // The PASSWORD_RECOVERY event fires when the recovery link is opened.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      } else if (event === 'SIGNED_IN' && session) {
        // Also set ready if we are already signed in via the link
        setReady(true);
      }
    });

    // Check if we already have a session (user arrived with a recovery token)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err.message || 'Failed to update password. Try again.');
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
            Set a new password
          </div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
            <div style={{ fontSize: '40px' }}>✅</div>
            <h3 style={{ font: '800 18px Urbanist', color: 'var(--text)', margin: 0 }}>Password updated!</h3>
            <p style={{ font: '600 13px Urbanist', color: 'var(--text-muted)', margin: 0 }}>
              Redirecting you to sign in…
            </p>
          </div>
        ) : !ready ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
            <div style={{ fontSize: '32px' }}>🔗</div>
            <p style={{ font: '600 13px/1.6 Urbanist', color: 'var(--text-muted)', margin: 0 }}>
              Verifying your reset link… If this page stays blank, try clicking the link in your email again.
            </p>
            <Link to="/forgot-password" style={{ font: '700 13px Urbanist', color: '#E5A83C', textDecoration: 'none' }}>
              Request a new link
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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', font: '700 12px Urbanist', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    style={{ ...inputStyle, paddingRight: '44px' }}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', font: '700 12px Urbanist', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    style={{ ...inputStyle, paddingRight: '44px' }}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    {showConfirmPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="pillbtn"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', height: '48px', fontSize: '15px' }}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
