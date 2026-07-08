import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { renderTrackIcon, formatDuration } from '../api';
import { useAuth, useCustomDialog } from '../App';
import { getFirstName } from '../utils/nameHelper';
import { IconPlus, IconChevronRight, IconStar, IconX, IconTrash, IconCheck, IconAlertCircle, IconCalendar } from '@tabler/icons-react';

// LocalStorage-backed client-side cache variables (persist across navigations and page refreshes)
let dashboardCache = null;
let dashboardCacheTimestamp = 0;

try {
  const cachedVal = localStorage.getItem('sv_dashboard_cache');
  const cachedTime = localStorage.getItem('sv_dashboard_cache_timestamp');
  if (cachedVal && cachedTime) {
    dashboardCache = JSON.parse(cachedVal);
    dashboardCacheTimestamp = parseInt(cachedTime, 10);
  }
} catch (e) {
  console.warn("Failed to load dashboard cache from localStorage", e);
}

// Shimmer CSS skeleton style definition
const skeletonStyle = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .skeleton-box {
    background: linear-gradient(90deg, var(--input-bg) 25%, var(--card-border) 50%, var(--input-bg) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
  }
`;

// Easing count-up animation component
function AnimatedNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const start = 0;
    const end = parseFloat(value) || 0;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }
    const duration = 600; // 600ms count-up
    const startTime = performance.now();
    
    let animationFrameId;
    const updateNumber = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * (2 - progress); // easeOutQuad curve
      const current = start + easeProgress * (end - start);
      
      if (Number.isInteger(end)) {
        setDisplayValue(Math.round(current));
      } else {
        setDisplayValue(parseFloat(current.toFixed(1)));
      }
      
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateNumber);
      } else {
        setDisplayValue(end);
      }
    };
    
    animationFrameId = requestAnimationFrame(updateNumber);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value]);
  
  return <>{displayValue}</>;
}

// Custom reusable hoverable stat cards
function StatBox({ value, label, subLabel, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div 
      className="stat-box" 
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ 
        cursor: 'pointer', 
        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        borderColor: hovered ? 'var(--text)' : 'var(--card-border, var(--rail-border))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '16px 20px'
      }}
    >
      <span className="stat-box-val" style={{ display: 'block', font: '900 24px Urbanist', color: 'var(--text)', lineHeight: 1 }}>
        <AnimatedNumber value={value} />
      </span>
      <span className="stat-box-lbl" style={{ display: 'block', font: '800 9.5px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '6px' }}>
        {label}
      </span>
      <span style={{ display: 'block', font: '600 10px Urbanist', color: 'var(--text-muted)', opacity: 0.65, marginTop: '2.5px' }}>
        {subLabel}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { showConfirm, showAlert } = useCustomDialog();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredTrack, setHoveredTrack] = useState(null);
  
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dueData, setDueData] = useState({ due_today: [], this_week: [] });
  const [loadingDue, setLoadingDue] = useState(true);
  const navigate = useNavigate();

  const getTodayDateString = () => {
    return new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isOverdue = (eventTime) => {
    try {
      const parts = eventTime.split(':');
      if (parts.length < 2) return false;
      const evH = parseInt(parts[0]);
      const evM = parseInt(parts[1]);
      const evDate = new Date();
      evDate.setHours(evH, evM, 0, 0);
      return new Date() > evDate;
    } catch (e) {
      return false;
    }
  };

  const fetchData = async (forceRefresh = false) => {
    const now = Date.now();

    // Re-validate in-memory cache against localStorage.
    // If localStorage was cleared (e.g. on logout), reset the module var so the
    // new user always gets a fresh fetch instead of the previous user's data.
    if (dashboardCache && !localStorage.getItem('sv_dashboard_cache')) {
      dashboardCache = null;
      dashboardCacheTimestamp = 0;
    }

    const hasValidCache = dashboardCache && (now - dashboardCacheTimestamp < 60000); // 60 seconds validation
    
    if (dashboardCache && !forceRefresh) {
      // Load cached data instantly (even if older than 60s, to show something immediately)
      setDashboardData(dashboardCache);
      setLoading(false);
      
      // Perform background refresh silently if expired
      if (!hasValidCache) {
        api.get('/api/dashboard/summary')
          .then(res => {
            dashboardCache = res.data;
            dashboardCacheTimestamp = Date.now();
            try {
              localStorage.setItem('sv_dashboard_cache', JSON.stringify(res.data));
              localStorage.setItem('sv_dashboard_cache_timestamp', dashboardCacheTimestamp.toString());
            } catch (e) {}
            setDashboardData(res.data);
          })
          .catch(err => console.error("Silent background refresh failed", err));
      }
      return;
    }

    if (!dashboardCache) {
      setLoading(true);
    }
    
    try {
      const res = await api.get('/api/dashboard/summary');
      dashboardCache = res.data;
      dashboardCacheTimestamp = Date.now();
      try {
        localStorage.setItem('sv_dashboard_cache', JSON.stringify(res.data));
        localStorage.setItem('sv_dashboard_cache_timestamp', dashboardCacheTimestamp.toString());
      } catch (e) {}
      setDashboardData(res.data);
    } catch (err) {
      console.error("Dashboard endpoint fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDueData = async () => {
    try {
      const res = await api.get('/dashboard/due-today');
      setDueData(res.data);
    } catch (err) {
      console.error("Failed to fetch due today/this week modules", err);
    } finally {
      setLoadingDue(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchDueData();
  }, []);

  const handleCompleteModule = async (moduleId) => {
    setDueData(prev => ({
      due_today: prev.due_today.filter(m => m.id !== moduleId),
      this_week: prev.this_week.filter(m => m.id !== moduleId)
    }));

    try {
      await api.put(`/modules/${moduleId}`, { status: 'done' });
      fetchDueData();
      fetchData(true);
    } catch (err) {
      console.error("Failed to complete module", err);
      fetchDueData();
    }
  };

  const handleDeleteLog = async (logId) => {
    const isConfirmed = await showConfirm("Are you sure you want to delete this session log?", "Delete Session Log");
    if (!isConfirmed) return;
    try {
      await api.delete(`/logs/${logId}`);
      setIsModalOpen(false);
      setSelectedLog(null);
      // Force refresh data to sync deletion with database summary and clear cache
      fetchData(true);
    } catch (err) {
      console.error(err);
      showAlert("Failed to delete session log.", "Error");
    }
  };

  // Tick marks drawing loading state hooks
  const [animRatio, setAnimRatio] = useState(0);
  useEffect(() => {
    if (!loading) {
      let start = null;
      const duration = 800; // Ticks progressive draw in 800ms
      let frameId;
      const animateTicks = (timestamp) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        setAnimRatio(easeProgress);
        if (progress < 1) {
          frameId = requestAnimationFrame(animateTicks);
        }
      };
      frameId = requestAnimationFrame(animateTicks);
      return () => cancelAnimationFrame(frameId);
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="page active" id="page-dashboard" style={{ paddingBottom: '48px' }}>
        <style>{skeletonStyle}</style>
        
        {/* Header Skeleton */}
        <div className="dashboard-header-row" style={{ marginBottom: '24px' }}>
          <div>
            <div className="skeleton-box" style={{ width: '180px', height: '28px', marginBottom: '8px' }} />
            <div className="skeleton-box" style={{ width: '120px', height: '16px' }} />
          </div>
          <div className="skeleton-box" style={{ width: '140px', height: '40px', borderRadius: '99px' }} />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid-4" style={{ marginBottom: '24px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="stat-box" style={{ height: '90px', padding: '16px 20px' }}>
              <div className="skeleton-box" style={{ width: '50px', height: '22px', marginBottom: '8px' }} />
              <div className="skeleton-box" style={{ width: '90px', height: '10px', marginBottom: '4px' }} />
              <div className="skeleton-box" style={{ width: '40px', height: '8px' }} />
            </div>
          ))}
        </div>

        {/* Card columns Skeleton */}
        <div className="grid-2" style={{ marginBottom: '24px', alignItems: 'stretch' }}>
          <div className="card">
            <div className="skeleton-box" style={{ width: '120px', height: '18px', marginBottom: '20px' }} />
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div className="skeleton-box" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
                <div className="skeleton-box" style={{ width: '100px', height: '14px' }} />
                <div className="skeleton-box" style={{ width: '140px', height: '8px', marginLeft: 'auto' }} />
                <div className="skeleton-box" style={{ width: '30px', height: '14px' }} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', padding: '30px' }}>
              <div className="skeleton-box" style={{ width: '100px', height: '14px', alignSelf: 'start', marginBottom: '16px' }} />
              <div className="skeleton-box" style={{ width: '120px', height: '120px', borderRadius: '50%' }} />
            </div>
            <div className="card" style={{ flex: 1 }}>
              <div className="skeleton-box" style={{ width: '120px', height: '18px', marginBottom: '16px' }} />
              <div className="skeleton-box" style={{ width: '100%', height: '36px', marginBottom: '12px' }} />
              <div className="skeleton-box" style={{ width: '100%', height: '36px' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate circular Mastery Ticks
  const totalTicks = 36;
  const rawMastery = dashboardData?.averageMastery?.value || 0;
  const activeTicks = Math.round((rawMastery / 10) * totalTicks);
  const animatedActiveTicks = Math.round(activeTicks * animRatio);
  const gaugeTicks = [];

  for (let i = 0; i < totalTicks; i++) {
    const angle = (i * 360) / totalTicks - 90;
    const angleRad = (angle * Math.PI) / 180;
    const rInner = 36;
    const rOuter = 44;
    const x1 = 50 + rInner * Math.cos(angleRad);
    const y1 = 50 + rInner * Math.sin(angleRad);
    const x2 = 50 + rOuter * Math.cos(angleRad);
    const y2 = 50 + rOuter * Math.sin(angleRad);
    
    let tickColor = 'var(--phbar-bg)';
    if (i < animatedActiveTicks) {
      const ratio = i / totalTicks;
      if (ratio < 0.25) tickColor = '#fb7185';
      else if (ratio < 0.5) tickColor = '#fbbf24';
      else if (ratio < 0.75) tickColor = '#34d399';
      else tickColor = '#38bdf8';
    }
    
    gaugeTicks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={tickColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    );
  }

  return (
    <div className="page active" id="page-dashboard" style={{ paddingBottom: '48px' }}>
      
      {/* HEADER SECTION */}
      <div className="dashboard-header-row">
        <div>
          <h1 className="dashboard-title">
            Howdy, {getFirstName(user?.fullName, user?.email)}
          </h1>
          <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
            {getTodayDateString()} · <span style={{ color: 'var(--accent, #C25A3A)', fontWeight: 700 }}>University for Smartans</span>
          </div>
        </div>
        <button className="pillbtn" onClick={() => navigate('/log')}>
          <IconPlus size={16} /> Log a session
        </button>
      </div>

      {/* STAT BOXES GRID */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <StatBox 
          value={dashboardData?.stats?.totalHours || 0}
          label="HRS TOTAL"
          subLabel="all time"
          onClick={() => navigate('/analytics')}
        />
        <StatBox 
          value={dashboardData?.stats?.loggedThisWeek || 0}
          label="LOGGED THIS WEEK"
          subLabel="this week"
          onClick={() => navigate('/analytics')}
        />
        <StatBox 
          value={dashboardData?.stats?.tracksCount || 0}
          label="TRACKS"
          subLabel="in progress"
          onClick={() => navigate('/tracks')}
        />
        <StatBox 
          value={dashboardData?.stats?.streakCount || 0}
          label="DAY STREAK"
          subLabel="days"
          onClick={() => navigate('/analytics')}
        />
      </div>

      <style>{`
        ${skeletonStyle}
        .due-checkbox:hover svg {
          opacity: 1 !important;
        }
      `}</style>

      {/* DUE TODAY & THIS WEEK SECTION */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* DUE TODAY */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span className="lbl" style={{ margin: 0 }}>Due Today</span>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#C25A3A', background: 'rgba(194,90,58,0.1)', padding: '2px 8px', borderRadius: '99px' }}>
              {dueData.due_today.length} tasks
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {loadingDue ? (
              [1, 2].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
                  <div className="skeleton-box" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-box" style={{ width: '140px', height: '14px', marginBottom: '4px' }} />
                    <div className="skeleton-box" style={{ width: '85px', height: '10px' }} />
                  </div>
                </div>
              ))
            ) : dueData.due_today.length > 0 ? (
              dueData.due_today.map(mod => {
                const deadlineDate = mod.deadline ? new Date(mod.deadline) : null;
                const isOverdueTask = deadlineDate && new Date(new Date().toDateString()) > deadlineDate;
                return (
                  <div
                    key={mod.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'var(--input-bg)',
                      border: '1.5px solid var(--input-border)',
                      transition: 'border-color 0.15s'
                    }}
                  >
                    <button
                      className="due-checkbox"
                      onClick={() => handleCompleteModule(mod.id)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '5px',
                        border: '2px solid var(--text-muted)',
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent, #C25A3A)',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent, #C25A3A)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                    >
                      <IconCheck size={12} style={{ opacity: 0, transition: 'opacity 0.15s' }} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '800 13px Urbanist', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {mod.title}
                      </div>
                      <div style={{ font: '600 11px Urbanist', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: mod.track_color }}></span>
                        {mod.track_name} · {mod.course_name}
                      </div>
                    </div>
                    {isOverdueTask && (
                      <span style={{ font: '800 9px Urbanist', color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                        Overdue
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '8px', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '24px' }}>🎉</span>
                <span style={{ font: '800 12.5px Urbanist' }}>All caught up for today!</span>
              </div>
            )}
          </div>
        </div>

        {/* DUE THIS WEEK */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span className="lbl" style={{ margin: 0 }}>This Week</span>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '99px' }}>
              {dueData.this_week.length} tasks
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {loadingDue ? (
              [1, 2].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
                  <div className="skeleton-box" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-box" style={{ width: '140px', height: '14px', marginBottom: '4px' }} />
                    <div className="skeleton-box" style={{ width: '85px', height: '10px' }} />
                  </div>
                </div>
              ))
            ) : dueData.this_week.length > 0 ? (
              dueData.this_week.slice(0, 4).map(mod => {
                const deadlineDate = mod.deadline ? new Date(mod.deadline) : null;
                const isOverdueTask = deadlineDate && new Date(new Date().toDateString()) > deadlineDate;
                const dayName = deadlineDate ? deadlineDate.toLocaleDateString('en-GB', { weekday: 'short' }) : '';
                return (
                  <div
                    key={mod.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'var(--input-bg)',
                      border: '1.5px solid var(--input-border)',
                      transition: 'border-color 0.15s'
                    }}
                  >
                    <button
                      className="due-checkbox"
                      onClick={() => handleCompleteModule(mod.id)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '5px',
                        border: '2px solid var(--text-muted)',
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent, #C25A3A)',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent, #C25A3A)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                    >
                      <IconCheck size={12} style={{ opacity: 0, transition: 'opacity 0.15s' }} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '800 13px Urbanist', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {mod.title}
                      </div>
                      <div style={{ font: '600 11px Urbanist', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: mod.track_color }}></span>
                        {mod.track_name} · {mod.course_name}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                      {dayName && (
                        <span style={{ font: '800 10.5px Urbanist', color: 'var(--text)', textTransform: 'uppercase' }}>
                          {dayName}
                        </span>
                      )}
                      {isOverdueTask && (
                        <span style={{ font: '800 9px Urbanist', color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '1px 4px', borderRadius: '3px', textTransform: 'uppercase' }}>
                          Overdue
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '8px', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '24px' }}>📅</span>
                <span style={{ font: '800 12.5px Urbanist' }}>No tasks due this week</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TWO COLUMN CONTENT */}
      <div className="grid-2" style={{ marginBottom: '24px', alignItems: 'stretch' }}>
        
        {/* LEFT COLUMN: TRACK PROGRESS */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="lbl" style={{ marginBottom: '16px' }}>Track progress</span>
          <div style={{ flex: 1 }}>
            {dashboardData?.trackProgress?.length > 0 ? (
              dashboardData.trackProgress.slice(0, 4).map(t => (
                <div 
                  key={t.id} 
                  className="track-card-item" 
                  onClick={() => navigate(`/tracks/${t.id}`)}
                  style={{ cursor: 'pointer', position: 'relative' }}
                  onMouseEnter={() => setHoveredTrack(t.id)}
                  onMouseLeave={() => setHoveredTrack(null)}
                >
                  <div className="track-card-indicator" style={{ background: t.color, width: '4px' }}></div>
                  <div className="track-card-icon-wrap" style={{ background: `${t.color}18`, color: t.color }}>
                    {renderTrackIcon(t.icon, 18)}
                  </div>
                  <div className="track-card-name">{t.name}</div>
                  <div className="track-card-bar-wrap">
                    <div className="phbar">
                      <div className="progress-fill" style={{ width: t.progress > 0 ? `${t.progress}%` : '4px', background: t.color }}></div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="track-card-pct">{t.progress}%</div>
                    <IconChevronRight 
                      size={16} 
                      style={{ 
                        color: 'var(--text-muted)', 
                        opacity: hoveredTrack === t.id ? 1 : 0, 
                        transform: hoveredTrack === t.id ? 'translateX(0)' : 'translateX(-4px)',
                        transition: 'opacity 0.2s, transform 0.2s' 
                      }} 
                    />
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontSize: '14px', fontWeight: 600 }}>
                No tracks setup yet. Add a track to begin.
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Link to="/tracks" style={{ font: '800 13px Urbanist', color: '#C25A3A', textDecoration: 'none' }}>
              View all tracks →
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN: GAUGE + TODAY */}
        <div className="dashboard-right-col">
          
          {/* AVERAGE MASTERY GAUGE */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '30px 24px' }}>
            <span className="lbl" style={{ alignSelf: 'start', marginBottom: '10px' }}>AVERAGE MASTERY</span>
            <div style={{ position: 'relative', width: '160px', height: '160px' }}>
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                {gaugeTicks}
              </svg>
              <div style={{ 
                position: 'absolute', 
                inset: 0, 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center',
                lineHeight: 1.2
              }}>
                <div style={{ fontSize: '38px', fontWeight: 900, color: 'var(--text)' }}>
                  {rawMastery}<span style={{ fontSize: '18px', color: 'var(--text-muted)', fontWeight: 600 }}>/10</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: '4px', letterSpacing: '0.5px' }}>
                  avg mastery
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.8, fontWeight: 600, marginTop: '2px' }}>
                  from {dashboardData?.averageMastery?.ratedLogsCount || 0} sessions
                </div>
              </div>
            </div>
          </div>

          {/* TODAY'S PLAN & LOGS */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className="lbl" style={{ margin: 0 }}>Today</span>
              <button className="ghostpill" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => navigate('/log')}>
                + Log
              </button>
            </div>
            
            <div className="flabel" style={{ fontSize: '10px', marginBottom: '6px' }}>PLANNED</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dashboardData?.today?.planned?.length > 0 ? (
                <>
                  {dashboardData.today.planned.slice(0, 3).map(e => {
                    const overdue = isOverdue(e.time);
                    const dotColor = overdue ? '#D97706' : e.trackColor;
                    return (
                      <div key={e.id} className="today-plan-item" style={{ padding: '4px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div className="today-plan-dot" style={{ background: dotColor }}></div>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{e.topic}</span>
                          {overdue && (
                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#D97706', background: '#D9770615', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', textTransform: 'uppercase' }}>
                              overdue
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{formatDuration(e.duration)}</span>
                      </div>
                    );
                  })}
                  {dashboardData.today.planned.length > 3 && (
                    <div style={{ font: '800 12px Urbanist', color: '#C25A3A', marginTop: '6px', cursor: 'pointer' }} onClick={() => navigate('/calendar')}>
                      + {dashboardData.today.planned.length - 3} more planned
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', padding: '6px 0', fontWeight: 600 }}>
                  Nothing planned · <Link to="/calendar" style={{ color: '#C25A3A', fontWeight: '800', textDecoration: 'none' }}>Plan a session →</Link>
                </div>
              )}
            </div>

            <div style={{ height: '1px', background: 'var(--rail-border)', opacity: 0.2, margin: '14px 0' }}></div>

            <div className="flabel" style={{ fontSize: '10px', marginBottom: '6px' }}>LOGGED</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dashboardData?.today?.logged?.length > 0 ? (
                <>
                  {dashboardData.today.logged.slice(0, 3).map(l => (
                    <div key={l.id} className="today-plan-item" style={{ padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className="today-plan-dot" style={{ background: l.trackColor }}></div>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{l.topic}</span>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{formatDuration(l.duration)}</span>
                    </div>
                  ))}
                  {dashboardData.today.logged.length > 3 && (
                    <div style={{ font: '800 12px Urbanist', color: '#C25A3A', marginTop: '6px', cursor: 'pointer' }} onClick={() => navigate('/sessions')}>
                      + {dashboardData.today.logged.length - 3} more logged
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', padding: '6px 0', fontWeight: 600 }}>
                  Not logged yet
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* RECENT ACTIVITY LOG FEED */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span className="lbl" style={{ margin: 0 }}>Recent Activity</span>
          <button className="ghostpill" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => navigate('/sessions')}>
            View all →
          </button>
        </div>
        
        <div className="recent-activity-scroll" style={{ borderRadius: '16px', overflowX: 'auto', border: '1px solid var(--rail-border)' }}>
          {dashboardData?.recentActivity?.length > 0 ? (
            dashboardData.recentActivity.map(l => {
              const formattedDate = new Date(l.date + 'T12:00:00').toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });
              return (
                <div 
                  key={l.id} 
                  className="activity-row"
                  style={{ cursor: 'pointer', minWidth: '500px' }}
                  onClick={() => {
                    setSelectedLog(l);
                    setIsModalOpen(true);
                  }}
                >
                  <div className="activity-row-icon" style={{ background: `${l.trackColor || '#ccc'}15`, color: l.trackColor || '#ccc' }}>
                    {renderTrackIcon(l.trackIcon || '📚', 16)}
                  </div>
                  <div className="activity-row-details">
                    <div className="activity-row-title">{l.topic}</div>
                    <div className="activity-row-subtitle">
                      {l.trackName || 'Track'} · {formattedDate}
                    </div>
                  </div>
                  <div className="activity-row-side">
                    <div className="activity-row-rating">⭐ {l.rating}/10</div>
                    <div className="activity-row-dur">{formatDuration(l.duration)}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '34px', fontSize: '14px', fontWeight: 600 }}>
              No study logs recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* SESSION DETAIL MODAL */}
      {isModalOpen && selectedLog && (() => {
        // Star score elements
        const stars = [];
        for (let i = 1; i <= 10; i++) {
          stars.push(
            <IconStar 
              key={i} 
              size={18} 
              fill={i <= (selectedLog.rating || 0) ? "#E5A83C" : "none"} 
              stroke={i <= (selectedLog.rating || 0) ? "#E5A83C" : "var(--text-muted)"}
              style={{ opacity: i <= (selectedLog.rating || 0) ? 1 : 0.4 }}
            />
          );
        }

        const formatDateString = (dateStr) => {
          if (!dateStr) return '';
          try {
            return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });
          } catch (e) {
            return dateStr;
          }
        };

        return (
          <div className="scrim" onClick={() => { setIsModalOpen(false); setSelectedLog(null); }}>
            <div 
              className="modal" 
              onClick={e => e.stopPropagation()}
              style={{ padding: '0', overflow: 'hidden', position: 'relative', width: '520px', maxWidth: '92%' }}
            >
              <div className="kthin" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
              
              <div style={{ padding: '30px', paddingTop: '34px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Header info & close */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span 
                    style={{
                      background: `${selectedLog.trackColor}15`,
                      color: selectedLog.trackColor,
                      padding: '4px 10px',
                      borderRadius: '20px',
                      font: '800 11px Urbanist',
                      textTransform: 'uppercase',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: selectedLog.trackColor }}></span>
                    {selectedLog.trackName}
                  </span>
                  
                  <button 
                    onClick={() => { setIsModalOpen(false); setSelectedLog(null); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <IconX size={18} />
                  </button>
                </div>

                {/* Session topic */}
                <h2 style={{ font: '900 22px Urbanist', color: 'var(--text)', lineHeight: '1.3', marginTop: '4px' }}>
                  {selectedLog.topic}
                </h2>

                {/* Details list block */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ border: '1.5px solid var(--input-border)', borderRadius: '12px', padding: '10px 14px', background: 'var(--input-bg)' }}>
                    <div style={{ font: '800 9px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Date</div>
                    <div style={{ font: '800 12.5px Urbanist', color: 'var(--text)' }}>{formatDateString(selectedLog.date)}</div>
                  </div>
                  <div style={{ border: '1.5px solid var(--input-border)', borderRadius: '12px', padding: '10px 14px', background: 'var(--input-bg)' }}>
                    <div style={{ font: '800 9px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Duration</div>
                    <div style={{ font: '800 12.5px Urbanist', color: 'var(--text)' }}>{formatDuration(selectedLog.duration)}</div>
                  </div>
                  <div style={{ border: '1.5px solid var(--input-border)', borderRadius: '12px', padding: '10px 14px', background: 'var(--input-bg)' }}>
                    <div style={{ font: '800 9px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Time Gap</div>
                    <div style={{ font: '800 12.5px Urbanist', color: 'var(--text)', whiteSpace: 'nowrap' }}>{selectedLog.startTime || '—'} – {selectedLog.endTime || '—'}</div>
                  </div>
                </div>

                {/* Quality ratings */}
                <div>
                  <div style={{ font: '800 10.5px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Session Quality</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                      {stars}
                    </div>
                    <span style={{ font: '900 13px Urbanist', color: '#E5A83C', marginLeft: '4px' }}>
                      {selectedLog.rating || 0}/10
                    </span>
                  </div>
                </div>

                {/* Notes details */}
                {selectedLog.notes && (
                  <div>
                    <div style={{ font: '800 10.5px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Notes</div>
                    <div style={{ 
                      border: '1.5px solid var(--input-border)', 
                      borderRadius: '12px', 
                      padding: '16px', 
                      background: 'var(--input-bg)',
                      font: '600 13.5px/1.5 Urbanist',
                      color: 'var(--text)',
                      minHeight: '80px'
                    }}>
                      {selectedLog.notes}
                    </div>
                  </div>
                )}

                {/* Actions bottom */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: '1px solid var(--rail-border)', paddingTop: '20px' }}>
                  
                  <button 
                    type="button" 
                    onClick={() => handleDeleteLog(selectedLog.id)}
                    style={{ background: 'none', border: 'none', color: '#EF4444', font: '800 13px Urbanist', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <IconTrash size={14} /> Delete
                  </button>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      type="button" 
                      className="ghostpill" 
                      onClick={() => { setIsModalOpen(false); setSelectedLog(null); }}
                      style={{ padding: '8px 16px', font: '800 13px Urbanist', cursor: 'pointer' }}
                    >
                      Close
                    </button>
                  </div>

                </div>

              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
