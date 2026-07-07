import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import api from '../api';
import { useAuth } from '../App';
import { IconEye, IconEyeOff, IconCheck, IconX } from '@tabler/icons-react';

export default function Login() {
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Password Visibility States
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Email validation on blur states
  const [emailError, setEmailError] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);

  // Remember me toggle
  const [rememberMe, setRememberMe] = useState(true);

  // Rate Limiting states
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  const { session } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated and confirmed
  useEffect(() => {
    if (session?.user?.email_confirmed_at) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, navigate]);

  // Lockout Countdown Timer Effect
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => {
        setLockoutTime(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  const validateEmailFormat = (emailVal) => {
    if (!emailVal) return 'Email address is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailVal)) {
      return 'Invalid email address format';
    }
    return '';
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);
    setEmailError(validateEmailFormat(email));
  };

  const handleEmailChange = (val) => {
    setEmail(val);
    if (emailTouched) {
      setEmailError(validateEmailFormat(val));
    }
  };

  // Password strength checklist rules
  const hasMinLength = password.length >= 6;
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // Check lockout
    if (lockoutTime > 0) {
      setError(`Too many attempts — try again in ${lockoutTime} seconds`);
      return;
    }

    // Email validation check
    const formatErr = validateEmailFormat(email);
    if (formatErr) {
      setEmailError(formatErr);
      setEmailTouched(true);
      setError('Please resolve email errors.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      
      // Handle Remember Me session cleanup logic on tab close
      if (!rememberMe) {
        localStorage.setItem('sv_remember_me', 'false');
      } else {
        localStorage.removeItem('sv_remember_me');
      }

      setFailedAttempts(0);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 3) {
        setLockoutTime(60);
        setError('Too many attempts — try again in 60 seconds');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    // Validation checks
    const formatErr = validateEmailFormat(email);
    if (formatErr) {
      setEmailError(formatErr);
      setEmailTouched(true);
      setError('Please resolve email errors.');
      return;
    }

    if (!hasMinLength || !hasNumber || !hasSpecialChar) {
      setError('Password does not meet the complexity requirements.');
      return;
    }

    setLoading(true);
    try {
      // 1 — Create Supabase Auth user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (signUpError) throw signUpError;

      // 2 — Create our profile row (using the new session token)
      if (signUpData.session) {
        // Auto-login (email confirmation disabled) — create profile immediately
        await api.post('/auth/create-profile', { fullName });
        
        // Handle persistence
        if (!rememberMe) {
          localStorage.setItem('sv_remember_me', 'false');
        } else {
          localStorage.removeItem('sv_remember_me');
        }

        navigate('/dashboard', { replace: true });
      } else {
        // Email confirmation required — show holding message
        setInfo(`✅ Account created! Check your inbox for a confirmation email sent to ${email}. Click the link to activate your account.`);
        setTab('login');
      }
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.');
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
    transition: 'border-color 0.2s',
  };

  const labelStyle = {
    display: 'block',
    font: '700 12px Urbanist, sans-serif',
    color: 'var(--text-muted)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
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
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '27px', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.8px' }}>
            Smartan <span style={{ color: '#E5A83C', fontWeight: '400' }}>Varsity</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 600 }}>
            {tab === 'login' ? 'Welcome back.' : 'Create your account'}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--input-bg)', borderRadius: '12px', padding: '4px' }}>
          {['login', 'signup'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); setInfo(''); }}
              style={{
                flex: 1,
                height: '36px',
                borderRadius: '9px',
                border: 'none',
                font: '700 13px Urbanist, sans-serif',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: tab === t ? 'var(--card-bg)' : 'transparent',
                color: tab === t ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              {t === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {error && (
          <div className="card" style={{ background: '#fef2f2', border: '1.5px solid rgba(239, 68, 68, 0.15)', color: '#ef4444', font: '800 12.5px Urbanist', padding: '12px 16px', borderRadius: '10px', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '18px' }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {info && (
          <div className="card" style={{ background: '#f0fdf4', border: '1.5px solid rgba(22, 163, 74, 0.15)', color: '#16a34a', font: '700 13px Urbanist', padding: '12px 16px', borderRadius: '10px', marginBottom: '18px' }}>
            {info}
          </div>
        )}

        {/* LOGIN FORM */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                style={{
                  ...inputStyle,
                  borderColor: emailError ? '#ef4444' : 'var(--rail-border)'
                }}
                placeholder="user@domain.com"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
                required
                autoComplete="email"
              />
              {emailError && (
                <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: 700, marginTop: '4px' }}>
                  {emailError}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showLoginPassword ? "text" : "password"}
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
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
                  {showLoginPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me option */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '-4px' }}>
              <input 
                type="checkbox" 
                id="remember_me" 
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--tab-active-border, #C25A3A)' }}
              />
              <label htmlFor="remember_me" style={{ font: '700 12.5px Urbanist', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                Remember me
              </label>
            </div>

            <button
              type="submit"
              className="pillbtn"
              disabled={loading || lockoutTime > 0}
              style={{ width: '100%', justifyContent: 'center', height: '48px', fontSize: '15px' }}
            >
              {loading ? 'Signing in...' : lockoutTime > 0 ? `Locked (${lockoutTime}s)` : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '4px' }}>
              <Link
                to="/forgot-password"
                style={{ fontSize: '13px', color: '#E5A83C', fontWeight: 700, textDecoration: 'none' }}
              >
                Forgot password?
              </Link>
            </div>
          </form>
        )}

        {/* SIGNUP FORM */}
        {tab === 'signup' && (
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                style={inputStyle}
                placeholder="e.g. Jane Doe"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                style={{
                  ...inputStyle,
                  borderColor: emailError ? '#ef4444' : 'var(--rail-border)'
                }}
                placeholder="user@domain.com"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
                required
                autoComplete="email"
              />
              {emailError && (
                <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: 700, marginTop: '4px' }}>
                  {emailError}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showSignupPassword ? "text" : "password"}
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
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
                  {showSignupPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>

              {/* Password strength real-time widget */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '8px', padding: '10px 12px' }}>
                <span style={{ font: '900 10.5px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Password strength check</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '700 11.5px Urbanist', color: hasMinLength ? '#10b981' : 'var(--text-muted)' }}>
                    {hasMinLength ? <IconCheck size={13} strokeWidth={3} /> : <IconX size={13} strokeWidth={3} />}
                    <span>At least 6 characters</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '700 11.5px Urbanist', color: hasNumber ? '#10b981' : 'var(--text-muted)' }}>
                    {hasNumber ? <IconCheck size={13} strokeWidth={3} /> : <IconX size={13} strokeWidth={3} />}
                    <span>At least 1 digit (0-9)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '700 11.5px Urbanist', color: hasSpecialChar ? '#10b981' : 'var(--text-muted)' }}>
                    {hasSpecialChar ? <IconCheck size={13} strokeWidth={3} /> : <IconX size={13} strokeWidth={3} />}
                    <span>At least 1 special char (!@#$ etc)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Remember me option */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '-4px' }}>
              <input 
                type="checkbox" 
                id="remember_me_signup" 
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--tab-active-border, #C25A3A)' }}
              />
              <label htmlFor="remember_me_signup" style={{ font: '700 12.5px Urbanist', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                Remember me
              </label>
            </div>

            <button
              type="submit"
              className="pillbtn"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', height: '48px', fontSize: '15px' }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600, margin: 0 }}>
              A confirmation email will be sent to activate your account.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}