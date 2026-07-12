import React, { useState, useEffect } from 'react';
import api from '../api';
import { IconLoader, IconAlertCircle } from '@tabler/icons-react';

export default function AdminLeaderboard() {
  // Scoped loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);
  const [metric, setMetric] = useState('hours'); // hours, sessions, streak
  const [scope, setScope] = useState('all_time'); // week, month, semester, year, all_time

  // Cache key based on filters
  const cacheKey = `sv_admin_leaderboard_cache_${metric}_${scope}`;

  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setLeaderboard(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
    }
  }, [metric, scope]);

  const fetchLeaderboard = async (retryCount = 0) => {
    try {
      const res = await api.get('/admin/leaderboard', { 
        params: { metric, scope }, 
        timeout: 10000 
      });
      setLeaderboard(res.data);
      setLoading(false);
      setError(false);
      
      // Save cache
      localStorage.setItem(cacheKey, JSON.stringify(res.data));
    } catch (err) {
      console.error('Failed to fetch leaderboard', err);
      if (retryCount < 2) {
        setTimeout(() => fetchLeaderboard(retryCount + 1), (retryCount + 1) * 1000);
      } else {
        if (leaderboard.length === 0) setError(true);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [metric, scope]);

  const renderTableSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="shimmer-bg" style={{ height: '62px', borderRadius: '12px' }} />
      ))}
    </div>
  );

  const metrics = [
    { key: 'hours', label: 'Most hours' },
    { key: 'sessions', label: 'Most sessions' },
    { key: 'streak', label: 'Longest streak' }
  ];

  const scopes = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'semester', label: 'Semester' },
    { key: 'year', label: 'Year' },
    { key: 'all_time', label: 'All-time' }
  ];

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '36px', fontFamily: 'Urbanist, sans-serif' }}>
      
      {/* PAGE TITLE */}
      <div style={{ marginBottom: '8px' }}>
        <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
        <h1 className="dashboard-title">Leaderboard</h1>
        <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
          Top Smartans ranked by hours, sessions &amp; engagement
        </div>
      </div>

      {/* 1. FILTER CONTROLS BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Metric pills */}
        <div style={{ display: 'flex', background: 'var(--input-bg)', padding: '4px', borderRadius: '99px', border: '1px solid var(--input-border)' }}>
          {metrics.map(m => (
            <button
              key={m.key}
              onClick={() => {
                setLoading(true);
                setMetric(m.key);
              }}
              style={{
                background: metric === m.key ? 'var(--text)' : 'transparent',
                color: metric === m.key ? 'var(--page)' : 'var(--text-muted)',
                border: 'none',
                padding: '6px 18px',
                borderRadius: '99px',
                font: '800 12.5px Urbanist',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Time scopes */}
        <div style={{ display: 'flex', background: 'var(--input-bg)', padding: '4px', borderRadius: '99px', border: '1px solid var(--input-border)' }}>
          {scopes.map(s => (
            <button
              key={s.key}
              onClick={() => {
                setLoading(true);
                setScope(s.key);
              }}
              style={{
                background: scope === s.key ? 'var(--text)' : 'transparent',
                color: scope === s.key ? 'var(--page)' : 'var(--text-muted)',
                border: 'none',
                padding: '6px 18px',
                borderRadius: '99px',
                font: '800 12.5px Urbanist',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

      </div>

      {/* 2. LEADERBOARD LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
        
        {/* Header line */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: '80px 2fr 1fr 1fr 1fr', 
            padding: '16px 20px', 
            borderBottom: '2px solid var(--input-border)',
            color: 'var(--text-muted)',
            font: '800 11px Urbanist',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}
        >
          <span>#</span>
          <span>Smartan</span>
          <span>Hours</span>
          <span>Sessions</span>
          <span>Streak</span>
        </div>

        {loading ? renderTableSkeleton() : error ? (
          <div style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
            <IconAlertCircle size={32} style={{ color: '#ef4444' }} />
            <span style={{ font: '600 13px Urbanist', color: 'var(--text-muted)' }}>Failed to load leaderboard rankings.</span>
            <button className="pillbtn" onClick={() => { setLoading(true); fetchLeaderboard(); }} style={{ padding: '6px 14px', fontSize: '12px' }}>Retry</button>
          </div>
        ) : leaderboard.length === 0 ? (
          <div style={{ font: '700 13px Urbanist', color: 'var(--text-muted)', padding: '36px', textAlign: 'center' }}>
            No records found for this period.
          </div>
        ) : (
          leaderboard.map((user, index) => {
            const isTop3 = index < 3;
            let rowBg = 'transparent';
            let borderStyle = '1px solid transparent';
            
            if (index === 0) {
              rowBg = 'rgba(245, 158, 11, 0.05)';
              borderStyle = '1px solid rgba(245, 158, 11, 0.15)';
            } else if (index === 1) {
              rowBg = 'rgba(107, 114, 128, 0.05)';
              borderStyle = '1px solid rgba(107, 114, 128, 0.15)';
            } else if (index === 2) {
              rowBg = 'rgba(180, 83, 9, 0.05)';
              borderStyle = '1px solid rgba(180, 83, 9, 0.15)';
            }

            return (
              <div 
                key={user.id} 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '80px 2fr 1fr 1fr 1fr', 
                  alignItems: 'center',
                  padding: '16px 20px', 
                  background: rowBg, 
                  border: borderStyle,
                  borderBottom: isTop3 ? borderStyle : '1px solid var(--input-border)',
                  borderRadius: isTop3 ? '16px' : '0px',
                  marginTop: isTop3 ? '8px' : '0px',
                  marginBottom: isTop3 ? '4px' : '0px'
                }}
              >
                <span style={{ font: '900 15px Urbanist', color: isTop3 ? 'var(--text)' : 'var(--text-muted)' }}>
                  {index === 0 && '🥇'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                  {index > 2 && `${index + 1}`}
                </span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--accent, #cc3333)',
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '14px',
                    fontWeight: 900
                  }}>
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `${api.defaults.baseURL || ''}${user.avatarUrl}`} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      (user.fullName || '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ font: '800 13.5px Urbanist', color: 'var(--text)' }}>{user.fullName}</span>
                    <span style={{ font: '600 10.5px Urbanist', color: 'var(--text-muted)' }}>{user.email}</span>
                  </div>
                </div>

                <span style={{ font: '700 14px Urbanist', color: metric === 'hours' ? 'var(--text)' : 'var(--text-muted)', fontWeight: metric === 'hours' ? 900 : 700 }}>
                  {user.hours}h
                </span>
                <span style={{ font: '700 14px Urbanist', color: metric === 'sessions' ? 'var(--text)' : 'var(--text-muted)', fontWeight: metric === 'sessions' ? 900 : 700 }}>
                  {user.sessions}
                </span>
                <span style={{ font: '700 14px Urbanist', color: metric === 'streak' ? 'var(--text)' : 'var(--text-muted)', fontWeight: metric === 'streak' ? 900 : 700 }}>
                  {user.streak}d
                </span>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
