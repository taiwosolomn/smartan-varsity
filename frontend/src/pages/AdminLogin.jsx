import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { supabase } from '../supabaseClient';
import api from '../api';
import { IconEye, IconEyeOff } from '@tabler/icons-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const { fetchUser } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Authenticate profile and check role
      const res = await api.get('/auth/me');
      if (res.data.role !== 'admin') {
        // Sign out if not admin
        await supabase.auth.signOut();
        throw new Error('Access denied. Admin account required.');
      }

      await fetchUser();
      navigate('/admin/dashboard');
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 403 && err.response.data?.detail === "Account deactivated") {
        setErrorMsg('This admin account has been deactivated. Please contact support.');
      } else if (err.message && err.message.includes('Access denied')) {
        setErrorMsg('Access denied. Admin account required.');
      } else {
        setErrorMsg(err.response?.data?.detail || err.message || 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      width: '100vw',
      flex: 1,
      background: '#16131a', 
      fontFamily: 'Urbanist, sans-serif' 
    }}>
      <div className="card" style={{ 
        width: '460px', 
        background: '#100D18', 
        padding: '48px 40px', 
        borderRadius: '24px',
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: '28px', 
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.03)',
        overflow: 'hidden'
      }}>
        {/* Top Multi-Color Stripe */}
        <div style={{
          height: '4px',
          background: 'linear-gradient(90deg, #c25a3a 0%, #eab308 16%, #22c55e 33%, #06b6d4 50%, #3b82f6 66%, #a855f7 83%, #ec4899 100%)',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          width: '100%',
          position: 'absolute',
          top: 0,
          left: 0
        }} />

        {/* Logo and Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: '#c25a3a',
            color: '#fff',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: '900',
            boxShadow: '0 4px 12px rgba(194, 90, 58, 0.3)'
          }}>
            SV
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            <h2 style={{ font: '900 20px Urbanist', color: '#ffffff', margin: 0, letterSpacing: '0.5px' }}>Smartan Varsity</h2>
            <p style={{ font: '800 10px Urbanist', color: 'rgba(255,255,255,0.4)', margin: 0, letterSpacing: '2px', textTransform: 'uppercase' }}>ADMIN ACCESS</p>
          </div>
        </div>

        {errorMsg && (
          <div style={{ 
            background: '#ef444415', 
            color: '#ef4444', 
            font: '700 13px Urbanist', 
            padding: '12px 16px', 
            borderRadius: '8px', 
            border: '1px solid #ef444430', 
            width: '100%', 
            textAlign: 'center',
            boxSizing: 'border-box'
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ font: '800 10px Urbanist', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>EMAIL</label>
            <input 
              type="email" 
              placeholder="you@smartanvarsity.org"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ 
                width: '100%', 
                background: '#1b1824', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '8px', 
                padding: '14px 16px',
                color: '#ffffff',
                font: '600 14px Urbanist',
                outline: 'none',
                boxShadow: '0 0 0px 1000px #1b1824 inset',
                WebkitTextFillColor: '#ffffff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ font: '800 10px Urbanist', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>PASSWORD</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ 
                  width: '100%', 
                  background: '#1b1824', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '8px', 
                  padding: '14px 44px 14px 16px',
                  color: '#ffffff',
                  font: '600 14px Urbanist',
                  outline: 'none',
                  boxShadow: '0 0 0px 1000px #1b1824 inset',
                  WebkitTextFillColor: '#ffffff',
                  boxSizing: 'border-box'
                }}
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
                  color: 'rgba(255,255,255,0.4)',
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

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', 
              background: '#ffffff', 
              color: '#100D18', 
              borderRadius: '99px',
              border: 'none',
              padding: '14px',
              marginTop: '8px',
              font: '900 14px Urbanist',
              cursor: 'pointer',
              boxSizing: 'border-box',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '4px', 
          textAlign: 'center', 
          opacity: 0.3, 
          color: '#ffffff', 
          font: '600 11px Urbanist',
          marginTop: '8px'
        }}>
          <span>This console is invite-only.</span>
          <span>Access is provisioned by an existing administrator.</span>
        </div>
      </div>
    </div>
  );
}
