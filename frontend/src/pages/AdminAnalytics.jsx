import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Analytics from './Analytics.jsx';
import { IconSearch, IconLoader, IconX, IconAlertCircle, IconChevronDown, IconChevronRight, IconTrendingUp, IconAward, IconActivity, IconClock } from '@tabler/icons-react';

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const [smartans, setSmartans] = useState([]);
  
  // Search dropdown states
  const [selectedSmartanId, setSelectedSmartanId] = useState('');
  const [selectedSmartanName, setSelectedSmartanName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Analytics data
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Filters
  const [activeDays, setActiveDays] = useState('all'); // 7, 30, 90, all
  const [timeMetric, setTimeMetric] = useState('day'); // 'day' | 'hour'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Debounced search query for dropdown
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchSmartans = async () => {
    try {
      const res = await api.get('/admin/smartans');
      setSmartans(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSmartans();
  }, []);

  // Offline caching key
  const cacheKey = `sv_admin_analytics_${selectedSmartanId || 'community'}_${activeDays}`;

  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setAnalytics(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedSmartanId, activeDays]);

  const fetchAnalytics = async (retryCount = 0) => {
    try {
      const params = {
        days: activeDays,
        track_category: 'All'
      };

      const res = await api.get('/admin/analytics', { params, timeout: 10000 });
      setAnalytics(res.data);
      setLoading(false);
      setError(false);

      // Save cache
      localStorage.setItem(cacheKey, JSON.stringify(res.data));
    } catch (err) {
      console.error('Failed to fetch analytics', err);
      if (retryCount < 2) {
        setTimeout(() => fetchAnalytics(retryCount + 1), (retryCount + 1) * 1000);
      } else {
        if (!analytics) setError(true);
        setLoading(false);
      }
    }
  };

  // A selected Smartan is rendered via the real <Analytics smartanId .../> component
  // (an exact clone of their own page) instead of this community-wide summary — no
  // need to hit /admin/analytics in that case.
  useEffect(() => {
    if (selectedSmartanId) return;
    fetchAnalytics();
  }, [selectedSmartanId, activeDays]);

  const handleSelectSmartan = (id, name) => {
    setSelectedSmartanId(id);
    setSelectedSmartanName(name);
    setSearchQuery(name);
    setShowDropdown(false);
    setLoading(true);
  };

  const handleResetFocus = () => {
    setSelectedSmartanId('');
    setSelectedSmartanName('');
    setSearchQuery('');
    setLoading(true);
  };

  // Real day-of-week hours, aggregated from analytics.logs (same approach as the
  // Smartan-facing Analytics page's getDayOfWeekStats) — no fabricated weights.
  const getDayOfWeekHours = () => {
    const minsPerDay = Array(7).fill(0);
    (analytics?.logs || []).forEach(log => {
      if (!log.date) return;
      const d = new Date(log.date + 'T12:00:00');
      let dayIdx = d.getDay() - 1;
      if (dayIdx === -1) dayIdx = 6;
      minsPerDay[dayIdx] += log.duration || 0;
    });
    return minsPerDay.map(mins => roundTo1(mins / 60));
  };

  // Real hour-of-day distribution from each log's actual session start time —
  // matches the Smartan-facing Analytics page's getTimeOfDayStats. No fallback
  // to fabricated data: with no real startTime data, every hour is legitimately 0.
  const getHourlyDistribution = () => {
    const hoursData = Array(24).fill(0);
    (analytics?.logs || []).forEach(log => {
      if (!log.startTime) return;
      const hour = parseInt(log.startTime.split(':')[0], 10);
      if (!isNaN(hour) && hour >= 0 && hour < 24) {
        hoursData[hour] += (log.duration || 0) / 60.0;
      }
    });
    return hoursData.map(h => roundTo1(h));
  };

  const formatHourLabel = (h) => {
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  };

  const roundTo1 = (num) => Math.round(num * 10) / 10;

  const daysOptions = [
    { key: '7', label: 'Last 7 days' },
    { key: '30', label: 'Last 30 days' },
    { key: '90', label: 'Last 90 days' },
    { key: 'all', label: 'All time' }
  ];

  // Search filter for dropdown matches
  const filteredSmartansDropdown = smartans.filter(s => 
    s.fullName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
  );

  // Line Chart Renderer (SVG based, fully responsive and styled matching standard Varsity styling)
  const renderLineChart = () => {
    const rawLogs = analytics?.logs || [];
    const masteryData = rawLogs
      .filter(l => l.rating !== null && l.rating !== undefined)
      .slice(0, 15) // last 15 points
      .reverse();

    if (masteryData.length === 0) {
      return (
        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', font: '600 13px Urbanist' }}>
          No rated session logs found in this period to display quality trends.
        </div>
      );
    }

    const width = 500;
    const height = 180;
    const paddingX = 40;
    const paddingY = 25;
    const chartW = width - paddingX * 2;
    const chartH = height - paddingY * 2;

    const points = masteryData.map((log, idx) => {
      const x = paddingX + (masteryData.length > 1 ? (idx / (masteryData.length - 1)) * chartW : chartW / 2);
      const y = height - paddingY - ((log.rating - 1) / 9) * chartH;
      return { x, y, log };
    });

    const pathD = points.length > 1 
      ? `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}` 
      : '';

    const avgRating = masteryData.reduce((sum, l) => sum + l.rating, 0) / masteryData.length;
    const avgY = height - paddingY - ((avgRating - 1) / 9) * chartH;

    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {[1, 5, 10].map(r => {
            const y = height - paddingY - ((r - 1) / 9) * chartH;
            return (
              <g key={r}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="var(--input-border)" strokeWidth="1" />
                <text x={paddingX - 10} y={y + 4} fill="var(--text-muted)" fontSize="9" fontWeight="800" textAnchor="end">{r}</text>
              </g>
            );
          })}

          <line x1={paddingX} y1={avgY} x2={width - paddingX} y2={avgY} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={width - paddingX + 5} y={avgY + 3} fill="var(--text-muted)" fontSize="9" fontWeight="800">AVG ({avgRating.toFixed(1)})</text>

          {points.length > 1 && (
            <path 
              d={pathD} 
              fill="none" 
              stroke="var(--tab-active-border, #C25A3A)" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          )}

          {points.map((p, idx) => (
            <circle 
              key={idx}
              cx={p.x}
              cy={p.y}
              r="5"
              fill="var(--tab-active-border, #C25A3A)"
              stroke="var(--card-bg)"
              strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'r 0.1s' }}
              onMouseEnter={(e) => setHoveredPoint({ ...p, screenX: e.clientX, screenY: e.clientY })}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}
        </svg>

        {hoveredPoint && (
          <div style={{
            position: 'fixed',
            top: hoveredPoint.screenY - 55,
            left: hoveredPoint.screenX - 60,
            background: 'var(--card-bg)',
            border: '1px solid var(--input-border)',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            color: 'var(--text)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100,
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}>
            <div>{hoveredPoint.log.topic}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>
              {new Date(hoveredPoint.log.date).toLocaleDateString([], { day: 'numeric', month: 'short' })} · Rating: {hoveredPoint.log.rating}/10
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStatsSkeleton = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px' }}>
          <div className="shimmer-bg" style={{ width: '100px', height: '12px' }} />
          <div className="shimmer-bg" style={{ width: '60px', height: '24px' }} />
        </div>
      ))}
    </div>
  );

  const renderChartsSkeleton = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {[1,2].map(i => (
        <div key={i} className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="shimmer-bg" style={{ width: '180px', height: '24px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {[1,2,3,4].map(j => <div key={j} className="shimmer-bg" style={{ height: '42px', borderRadius: '8px' }} />)}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'Urbanist, sans-serif' }}>
      
      {/* PAGE TITLE */}
      <div style={{ marginBottom: '8px' }}>
        <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
        <h1 className="dashboard-title">Analytics</h1>
        <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
          Community-wide performance &amp; engagement metrics
        </div>
      </div>

      {/* 1. FILTER CONTROLS BAR */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ font: '900 22px Urbanist', color: 'var(--text)', margin: 0 }}>
                  {selectedSmartanId ? selectedSmartanName : 'Whole Varsity (Community)'}
                </h2>
                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => setShowDropdown(!showDropdown)}
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text)', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                  >
                    Select Smartan <IconChevronDown size={12} />
                  </button>
                  {showDropdown && (
                    <div 
                      style={{ 
                        position: 'absolute', 
                        top: '28px', 
                        left: 0, 
                        width: '220px', 
                        background: 'var(--card-bg)', 
                        border: '1px solid var(--input-border)', 
                        borderRadius: '12px', 
                        maxHeight: '220px', 
                        overflowY: 'auto', 
                        zIndex: 100,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
                      }}
                    >
                      <div
                        onClick={handleResetFocus}
                        style={{ padding: '10px 14px', cursor: 'pointer', font: '900 12.5px Urbanist', color: 'var(--tab-active-border, #C25A3A)', borderBottom: '1px solid var(--input-border)' }}
                      >
                        Whole Varsity (Community)
                      </div>
                      {filteredSmartansDropdown.map(s => (
                        <div
                          key={s.id}
                          onClick={() => handleSelectSmartan(s.id, s.fullName)}
                          style={{ padding: '10px 14px', cursor: 'pointer', font: '700 12.5px Urbanist', color: 'var(--text)', borderBottom: '1px solid var(--input-border)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {s.fullName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p style={{ font: '600 13px Urbanist', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                {selectedSmartanId ? `Individual analytics view for ${selectedSmartanName}` : 'Community-wide analytics scoped across all Smartans'}
              </p>
            </div>
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative', width: '260px' }}>
            <IconSearch size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search Smartan name..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              style={{
                width: '100%',
                padding: '10px 32px 10px 36px',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '99px',
                font: '600 13px Urbanist',
                color: 'var(--text)',
                outline: 'none'
              }}
            />
            {selectedSmartanId && (
              <button
                onClick={handleResetFocus}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <IconX size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filters Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid var(--input-border)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', background: 'var(--input-bg)', padding: '4px', borderRadius: '99px', border: '1px solid var(--input-border)' }}>
            {daysOptions.map(d => (
              <button
                key={d.key}
                onClick={() => {
                  setLoading(true);
                  setActiveDays(d.key);
                }}
                style={{
                  background: activeDays === d.key ? 'var(--text)' : 'transparent',
                  color: activeDays === d.key ? 'var(--page)' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 16px',
                  borderRadius: '99px',
                  font: '800 12px Urbanist',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div style={{ font: '900 11.5px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {selectedSmartanId ? `Inspecting ${selectedSmartanName}` : 'Inspecting Community'}
          </div>
        </div>

      </div>

      {selectedSmartanId ? (
        // Exact clone of the Smartan's own Analytics page, scoped to their data via smartan_id.
        <Analytics key={selectedSmartanId} smartanId={selectedSmartanId} smartanName={selectedSmartanName} />
      ) : loading ? (
        <>
          {renderStatsSkeleton()}
          {renderChartsSkeleton()}
        </>
      ) : error ? (
        <div className="card" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center' }}>
          <IconAlertCircle size={32} style={{ color: '#ef4444' }} />
          <span style={{ font: '600 14px Urbanist', color: 'var(--text-muted)' }}>Failed to load analytics.</span>
          <button className="pillbtn" onClick={() => { setLoading(true); fetchAnalytics(); }} style={{ padding: '8px 16px', fontSize: '13px' }}>Retry</button>
        </div>
      ) : (
        <>
          {/* 2. STATS TILES ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '20px' }}>
              <span style={{ font: '900 10px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                HOURS LOGGED
              </span>
              <span style={{ font: '900 24px Urbanist', color: 'var(--text)' }}>{analytics?.summary?.totalHours || 0}h</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '20px' }}>
              <span style={{ font: '900 10px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>AVG. SESSION LENGTH</span>
              <span style={{ font: '900 24px Urbanist', color: 'var(--text)' }}>{analytics?.summary?.avgSession || 0}min</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '20px' }}>
              <span style={{ font: '900 10px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>SESSIONS</span>
              <span style={{ font: '900 24px Urbanist', color: 'var(--text)' }}>{analytics?.streakData?.sessionsCount || 0}</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '20px' }}>
              <span style={{ font: '900 10px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>BEST STREAK</span>
              <span style={{ font: '900 24px Urbanist', color: 'var(--text)' }}>{analytics?.streakData?.bestStreak || 0}d</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '20px' }}>
              <span style={{ font: '900 10px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>AVG. RATING</span>
              <span style={{ font: '900 24px Urbanist', color: 'var(--text)' }}>
                {analytics?.summary?.avgMastery ? `${analytics.summary.avgMastery}/10` : '—'}
              </span>
            </div>
          </div>

          {/* 3. CHARTS SPLIT */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px' }}>
            
            {/* Session Quality Over Time SVG Line Chart */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ font: '900 16px Urbanist', color: 'var(--text)', margin: 0 }}>Session quality over time</h3>
                <span style={{ font: '900 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rating Trend</span>
              </div>
              <p style={{ font: '600 12.5px Urbanist', color: 'var(--text-muted)', margin: 0 }}>Mastery ratings (1-10) plotted across recent study sessions</p>
              <div style={{ marginTop: '12px' }}>
                {renderLineChart()}
              </div>
            </div>

            {/* Engagement Distribution */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px' }}>
              <h3 style={{ font: '900 16px Urbanist', color: 'var(--text)', margin: 0 }}>Engagement distribution</h3>
              <p style={{ font: '600 12.5px Urbanist', color: 'var(--text-muted)', margin: 0 }}>Smartans grouped by total hours logged</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                {Object.entries(analytics?.masteryData || {}).map(([range, count]) => {
                  const totalCount = Object.values(analytics.masteryData).reduce((a, b) => a + b, 0) || 1;
                  const pct = Math.round((count / totalCount) * 100);
                  return (
                    <div key={range} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', font: '800 12.5px Urbanist', color: 'var(--text)' }}>
                        <span>{range}</span>
                        <span>{count} Smartans</span>
                      </div>
                      <div style={{ width: '100%', height: '10px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--tab-active-border, #C25A3A)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* 4. ACTIVITY PANE & MILESTONES */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
            
            {/* Visual Activity Pane */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ font: '900 16px Urbanist', color: 'var(--text)', margin: 0 }}>Recent session activity</h3>
                <span style={{ font: '800 11px Urbanist', color: 'var(--text-muted)' }}>Latest sessions</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(analytics?.logs || []).length === 0 ? (
                  <div style={{ font: '700 13px Urbanist', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>No recent study logs.</div>
                ) : (
                  (analytics.logs || []).slice(0, 5).map((log, idx) => (
                    <div 
                      key={log.id || idx}
                      onClick={() => navigate(`/admin/smartans/${log.userId}/sessions`)}
                      style={{
                        padding: '14px 18px',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--input-border)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--page)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--input-bg)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--page)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px' }}>
                          ⚡
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ font: '800 13.5px Urbanist', color: 'var(--text)' }}>{log.topic}</span>
                          <span style={{ font: '600 11px Urbanist', color: 'var(--text-muted)' }}>
                            Logged {log.duration} mins · Rating: {log.rating}/10
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ font: '600 11px Urbanist', color: 'var(--text-muted)' }}>
                          {new Date(log.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                        </span>
                        <IconChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Milestones */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px' }}>
              <h3 style={{ font: '900 16px Urbanist', color: 'var(--text)', margin: 0 }}>Recent milestones</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(analytics?.recentMilestones || []).length === 0 ? (
                  <div style={{ font: '700 13px Urbanist', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>No milestones recorded in this period.</div>
                ) : (
                  analytics.recentMilestones.map((m) => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>🏆</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ font: '700 13px Urbanist', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.text}</div>
                          <div style={{ font: '600 11px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>{m.smartanName}</div>
                        </div>
                      </div>
                      <span style={{ font: '600 11px Urbanist', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {new Date(m.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* 5. BEST TIME / DAYS BREAKDOWN CHART */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ font: '900 16px Urbanist', color: 'var(--text)', margin: 0 }}>Time breakdown</h3>
                <p style={{ font: '600 12.5px Urbanist', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Most active hours and days of study sessions</p>
              </div>

              {/* Time Metric Selector Toggle */}
              <div style={{ display: 'flex', background: 'var(--input-bg)', padding: '3px', borderRadius: '8px', border: '1px solid var(--input-border)' }}>
                <button
                  onClick={() => setTimeMetric('day')}
                  style={{
                    background: timeMetric === 'day' ? 'var(--text)' : 'transparent',
                    color: timeMetric === 'day' ? 'var(--page)' : 'var(--text-muted)',
                    border: 'none',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    font: '800 11px Urbanist',
                    cursor: 'pointer'
                  }}
                >
                  Day of Week
                </button>
                <button
                  onClick={() => setTimeMetric('hour')}
                  style={{
                    background: timeMetric === 'hour' ? 'var(--text)' : 'transparent',
                    color: timeMetric === 'hour' ? 'var(--page)' : 'var(--text-muted)',
                    border: 'none',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    font: '800 11px Urbanist',
                    cursor: 'pointer'
                  }}
                >
                  Hour of Day
                </button>
              </div>
            </div>

            <div style={{ marginTop: '10px' }}>
              {timeMetric === 'day' ? (() => {
                const dayOfWeekHours = getDayOfWeekHours();
                const maxDayHours = Math.max(...dayOfWeekHours, 1);
                return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                    const dayHours = dayOfWeekHours[idx];
                    const pct = Math.round((dayHours / maxDayHours) * 100);

                    return (
                      <div key={day} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 60px', alignItems: 'center', gap: '12px' }}>
                        <span style={{ font: '800 12.5px Urbanist', color: 'var(--text)' }}>{day}</span>
                        <div style={{ width: '100%', height: '10px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: 'var(--tab-active-border, #C25A3A)' }} />
                        </div>
                        <span style={{ font: '700 12.5px Urbanist', color: 'var(--text-muted)', textAlign: 'right' }}>{dayHours}h</span>
                      </div>
                    );
                  })}
                </div>
                );
              })() : (() => {
                const hourlyData = getHourlyDistribution();
                const maxHourlyVal = Math.max(...hourlyData) || 1;
                const leftColHours = Array.from({ length: 12 }, (_, i) => i);
                const rightColHours = Array.from({ length: 12 }, (_, i) => i + 12);
                
                const renderHourRow = (h) => {
                  const val = hourlyData[h];
                  const pct = Math.round((val / maxHourlyVal) * 100);
                  return (
                    <div key={h} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 50px', alignItems: 'center', gap: '12px' }}>
                      <span style={{ font: '800 11.5px Urbanist', color: 'var(--text)' }}>{formatHourLabel(h)}</span>
                      <div style={{ width: '100%', height: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--tab-active-border, #C25A3A)' }} />
                      </div>
                      <span style={{ font: '700 11.5px Urbanist', color: 'var(--text-muted)', textAlign: 'right' }}>{val}h</span>
                    </div>
                  );
                };

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {leftColHours.map(renderHourRow)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {rightColHours.map(renderHourRow)}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
