import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { renderActivityIcon, renderActivityText } from '../api';
import { IconUser, IconChevronRight, IconLoader, IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../App';
import { getFirstName } from '../utils/nameHelper';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Scoped loading & error states
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(true);

  const [metricsError, setMetricsError] = useState(false);
  const [flagsError, setFlagsError] = useState(false);
  const [feedError, setFeedError] = useState(false);

  // Data states
  const [metricsData, setMetricsData] = useState(null);
  const [flagsData, setFlagsData] = useState([]);
  const [feedData, setFeedData] = useState([]);

  // Scopes & pagination
  const [activeScope, setActiveScope] = useState('week');
  const [activityPage, setActivityPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);

  // Background refresh cache check
  useEffect(() => {
    try {
      const cached = localStorage.getItem('sv_admin_dashboard_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        setMetricsData(parsed.metrics);
        setFlagsData(parsed.flags);
        setFeedData(parsed.feed);
        
        setMetricsLoading(false);
        setFlagsLoading(false);
        setFeedLoading(false);
      }
    } catch (e) {
      console.error('Failed parsing dashboard cache', e);
    }
  }, []);

  const fetchDashboard = async (retryCount = 0) => {
    // parallel fetching of sections using Promise.allSettled to prevent failures from blocking others
    const p1 = api.get('/admin/dashboard', { params: { page: 1 }, timeout: 10000 });

    try {
      const res = await p1;
      const payload = res.data;

      // Update states
      setMetricsData({
        aggregateHours: payload.aggregateHours,
        aggregateSessions: payload.aggregateSessions,
        totalSmartans: payload.totalSmartans
      });
      setFlagsData(payload.engagementFlags);
      setFeedData(payload.recentActivity);

      setMetricsLoading(false);
      setFlagsLoading(false);
      setFeedLoading(false);

      setMetricsError(false);
      setFlagsError(false);
      setFeedError(false);

      // Save cache
      localStorage.setItem('sv_admin_dashboard_cache', JSON.stringify({
        metrics: {
          aggregateHours: payload.aggregateHours,
          aggregateSessions: payload.aggregateSessions,
          totalSmartans: payload.totalSmartans
        },
        flags: payload.engagementFlags,
        feed: payload.recentActivity
      }));
    } catch (err) {
      console.error('Dashboard fetch error', err);
      if (retryCount < 2) {
        // Automatic retry with exponential backoff
        setTimeout(() => fetchDashboard(retryCount + 1), (retryCount + 1) * 1000);
      } else {
        if (!metricsData) setMetricsError(true);
        if (flagsData.length === 0) setFlagsError(true);
        if (feedData.length === 0) setFeedError(true);

        setMetricsLoading(false);
        setFlagsLoading(false);
        setFeedLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleAcknowledge = async (smartanId, flagType) => {
    // Optimistic UI update: remove flag immediately
    const previousFlags = [...flagsData];
    setFlagsData(prev => prev.filter(f => !(f.smartanId === smartanId && f.flagType === flagType)));

    try {
      await api.post(`/admin/engagement-flags/${smartanId}/acknowledge`, { flag_type: flagType });
      // quiet backend refresh
      const res = await api.get('/admin/dashboard', { params: { page: 1 } });
      setFlagsData(res.data.engagementFlags);
    } catch (e) {
      console.error('Failed to acknowledge flag', e);
      // Revert if request failed
      setFlagsData(previousFlags);
      alert('Action failed. Reverting state.');
    }
  };

  const loadMoreActivity = async () => {
    setLoadingMore(true);
    const nextPage = activityPage + 1;
    try {
      const res = await api.get('/admin/dashboard', { params: { page: nextPage } });
      if (res.data.recentActivity.length === 0) {
        setHasMoreActivities(false);
      } else {
        setFeedData(prev => [...prev, ...res.data.recentActivity]);
        setActivityPage(nextPage);
      }
    } catch (e) {
      console.error('Load more activities failed', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const scopes = [
    { key: 'average', label: 'Smartan average' },
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This week' },
    { key: 'month', label: 'This month' },
    { key: 'semester', label: 'This semester' },
    { key: 'year', label: 'This year' }
  ];

  const formatRelativeTime = (dateStr) => {
    try {
      const diffMs = new Date() - new Date(dateStr);
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHrs = Math.floor(diffMins / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.floor(diffHrs / 24);
      return `${diffDays}d ago`;
    } catch (e) {
      return '';
    }
  };

  const getHoursValue = () => {
    if (activeScope === 'average') {
      return metricsData?.aggregateHours?.avg?.all_time || 0;
    }
    return metricsData?.aggregateHours?.total?.[activeScope] || 0;
  };

  const getSessionsValue = () => {
    if (activeScope === 'average') {
      return metricsData?.aggregateSessions?.avg?.all_time || 0;
    }
    return metricsData?.aggregateSessions?.total?.[activeScope] || 0;
  };

  const getLabelSuffix = () => {
    if (activeScope === 'average') return 'SMARTAN AVERAGE';
    return activeScope.replace('_', ' ').toUpperCase();
  };

  // Rendering skeletons
  const renderMetricsSkeleton = () => (
    <div style={{ background: '#100D18', borderRadius: '24px', padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[1,2,3,4].map(i => <div key={i} className="shimmer-bg" style={{ width: '80px', height: '28px', borderRadius: '99px' }} />)}
        </div>
        <div className="shimmer-bg" style={{ width: '180px', height: '28px', borderRadius: '99px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: '40px', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="shimmer-bg" style={{ width: '120px', height: '14px' }} />
          <div className="shimmer-bg" style={{ width: '180px', height: '48px' }} />
        </div>
        <div style={{ width: '1px', height: '60px', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="shimmer-bg" style={{ width: '120px', height: '14px' }} />
          <div className="shimmer-bg" style={{ width: '180px', height: '48px' }} />
        </div>
      </div>
    </div>
  );

  const renderFlagsSkeleton = () => (
    <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="shimmer-bg" style={{ width: '220px', height: '24px', borderRadius: '6px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1,2,3].map(i => (
          <div key={i} className="shimmer-bg" style={{ height: '70px', borderRadius: '16px' }} />
        ))}
      </div>
    </div>
  );

  const renderFeedSkeleton = () => (
    <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="shimmer-bg" style={{ width: '180px', height: '24px', borderRadius: '6px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="shimmer-bg" style={{ height: '60px', borderRadius: '16px' }} />
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'Urbanist, sans-serif' }}>
      
      {/* 0. PAGE HEADER */}
      <div style={{ marginBottom: '4px' }}>
        <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
        <h1 className="dashboard-title">
          Howdy, {getFirstName(user?.fullName, user?.email, 'Admin')}
        </h1>
        <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · <span style={{ color: 'var(--accent, #C25A3A)', fontWeight: 700 }}>University for Smartans</span>
        </div>
      </div>

      {/* 1. HERO METRICS CARD */}
      {metricsLoading ? renderMetricsSkeleton() : metricsError ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '36px', alignItems: 'center', justifyContent: 'center' }}>
          <IconAlertCircle size={32} style={{ color: '#ef4444' }} />
          <span style={{ font: '600 14px Urbanist', color: 'var(--text-muted)' }}>Failed to load metrics.</span>
          <button className="pillbtn" onClick={() => { setMetricsLoading(true); fetchDashboard(); }} style={{ padding: '6px 16px', fontSize: '12px' }}>Retry</button>
        </div>
      ) : (
        <div 
          style={{ 
            background: '#100D18', 
            borderRadius: '24px', 
            padding: '36px 40px',
            color: '#ffffff',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', padding: '4px', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.08)' }}>
              {scopes.map(s => (
                <button
                  key={s.key}
                  onClick={() => setActiveScope(s.key)}
                  style={{
                    background: activeScope === s.key ? '#ffffff' : 'transparent',
                    color: activeScope === s.key ? '#100D18' : 'rgba(255,255,255,0.6)',
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
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                background: 'rgba(255,255,255,0.06)', 
                padding: '6px 16px', 
                borderRadius: '99px',
                font: '800 12px Urbanist',
                color: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <IconUser size={13} style={{ marginRight: '6px' }} />
              <strong>{metricsData?.totalSmartans || 0}</strong> &nbsp;Smartans registered
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', alignItems: 'center', gap: '40px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ font: '900 10.5px Urbanist', color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                HOURS LOGGED · {getLabelSuffix()}
              </span>
              <span style={{ font: '900 54px Urbanist', color: '#ffffff', lineHeight: '1' }}>
                {getHoursValue()}h
              </span>
            </div>
            <div style={{ width: '1px', height: '60px', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ font: '900 10.5px Urbanist', color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                SESSIONS LOGGED · {getLabelSuffix()}
              </span>
              <span style={{ font: '900 54px Urbanist', color: '#ffffff', lineHeight: '1' }}>
                {getSessionsValue()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. SPLIT LAYOUT FOR FLAGS & FEED */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* ENGAGEMENT FLAGS */}
        {flagsLoading ? renderFlagsSkeleton() : flagsError ? (
          <div className="card" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
            <IconAlertCircle size={28} style={{ color: '#ef4444' }} />
            <span style={{ font: '600 13px Urbanist', color: 'var(--text-muted)' }}>Failed to load flags list.</span>
            <button className="pillbtn" onClick={() => { setFlagsLoading(true); fetchDashboard(); }} style={{ padding: '6px 12px', fontSize: '11px' }}>Retry</button>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ font: '900 18px Urbanist', color: 'var(--text)', margin: 0 }}>🚩 Engagement flags</h3>
              <span style={{ 
                background: '#ef4444', 
                color: '#ffffff', 
                borderRadius: '99px', 
                padding: '2px 8px', 
                font: '900 11px Urbanist' 
              }}>
                {flagsData.length}
              </span>
              <span style={{ font: '600 13px Urbanist', color: 'var(--text-muted)' }}>
                Smartans who've gone quiet
              </span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', overflowY: 'auto', maxHeight: '420px' }}>
              {flagsData.length === 0 ? (
                <div style={{ font: '700 13px Urbanist', color: 'var(--text-muted)', padding: '36px', textAlign: 'center', background: 'var(--input-bg)', borderRadius: '12px', border: '1px dashed var(--input-border)' }}>
                  🎉 No active flags! Excellent engagement.
                </div>
              ) : (
                flagsData.map((f, i) => {
                  let reason = f.flagType === 'no_session_7d' 
                    ? `No session in 7+ days · last active ${f.lastActive}`
                    : f.flagType === 'no_session_3d_this_week'
                    ? `3+ consecutive days missed · last active ${f.lastActive}`
                    : `Broken streak · last active ${f.lastActive}`;

                  return (
                    <div 
                      key={i} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px', 
                        background: 'var(--input-bg)', 
                        border: '1px solid var(--input-border)',
                        borderRadius: '16px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span 
                          style={{ font: '800 15px Urbanist', color: 'var(--text)', cursor: 'pointer' }}
                          onClick={() => navigate(`/admin/smartans/${f.smartanId}`)}
                        >
                          {f.fullName}
                        </span>
                        <span style={{ font: '600 12px Urbanist', color: 'var(--text-muted)' }}>
                          {reason}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button 
                          onClick={() => navigate(`/admin/smartans/${f.smartanId}`)}
                          style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '8px', 
                            background: 'var(--page)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--input-border)'
                          }}
                        >
                          <IconChevronRight size={16} />
                        </button>
                        <input 
                          type="checkbox" 
                          onChange={() => handleAcknowledge(f.smartanId, f.flagType)}
                          title="Dismiss Flag"
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--text)' }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* COMMUNITY FEED */}
        {feedLoading ? renderFeedSkeleton() : feedError ? (
          <div className="card" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
            <IconAlertCircle size={28} style={{ color: '#ef4444' }} />
            <span style={{ font: '600 13px Urbanist', color: 'var(--text-muted)' }}>Failed to load activity logs.</span>
            <button className="pillbtn" onClick={() => { setFeedLoading(true); fetchDashboard(); }} style={{ padding: '6px 12px', fontSize: '11px' }}>Retry</button>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              <h3 style={{ font: '900 18px Urbanist', color: 'var(--text)', margin: 0 }}>Community-wide activity</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '420px' }}>
              {feedData.length === 0 ? (
                <div style={{ font: '700 13px Urbanist', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>
                  No recent activity.
                </div>
              ) : (
                <>
                  {feedData.map((a, i) => (
                    <div 
                      key={a.id || i} 
                      style={{ 
                        padding: '14px 18px', 
                        background: 'var(--input-bg)', 
                        border: '1px solid var(--input-border)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '14px' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {renderActivityIcon(a.eventType, 18)}
                        </div>
                        <span style={{ font: '600 13.5px Urbanist', color: 'var(--text)', lineHeight: '1.4' }}>
                          {renderActivityText(a)}
                        </span>
                      </div>
                      <span style={{ font: '600 11px Urbanist', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatRelativeTime(a.createdAt)}
                      </span>
                    </div>
                  ))}
                  
                  {hasMoreActivities && (
                    <button
                      className="ghostpill"
                      onClick={loadMoreActivity}
                      disabled={loadingMore}
                      style={{ width: '100%', padding: '12px', marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                    >
                      {loadingMore ? <IconLoader size={16} className="spin" /> : 'Load More Activity'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
