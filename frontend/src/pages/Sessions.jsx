import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api, { formatDuration } from '../api';
import { useCustomDialog } from '../App';
import { 
  IconPlus, 
  IconCalendar, 
  IconClock, 
  IconTrash, 
  IconX, 
  IconSearch
} from '@tabler/icons-react';

// Star SVG icon in amber (#f59e0b)
const StarIcon = () => (
  <svg 
    width="13" 
    height="13" 
    viewBox="0 0 24 24" 
    fill="#f59e0b" 
    stroke="#f59e0b" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

// Reusable filter pill component with dynamic hover tints
function TrackFilterPill({ name, color, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);
  
  let bg = 'var(--input-bg)';
  let textColor = 'var(--text)';
  let borderColor = 'var(--input-border)';
  
  if (isActive) {
    bg = name === 'All' ? 'var(--text)' : color;
    textColor = name === 'All' ? 'var(--page)' : '#ffffff';
    borderColor = name === 'All' ? 'var(--text)' : color;
  } else if (hovered) {
    bg = name === 'All' ? 'var(--card-hover-bg, rgba(255,255,255,0.06))' : `${color}0D`; // 5% opacity tint
    borderColor = name === 'All' ? 'var(--text)' : color; // border brightens
  }

  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: '99px',
        font: '800 12px Urbanist',
        background: bg,
        color: textColor,
        border: `1.5px solid ${borderColor}`,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.15s ease',
        flexShrink: 0
      }}
    >
      {name !== 'All' && (
        <span style={{ 
          display: 'inline-block', 
          width: '6px', 
          height: '6px', 
          borderRadius: '50%', 
          background: isActive ? '#ffffff' : color 
        }} />
      )}
      {name}
    </button>
  );
}

// LocalStorage-backed SWR cache for Sessions page
let sessionsTracksCache = null;
let sessionsTracksCacheTs = 0;

try {
  const cv = localStorage.getItem('sv_sessions_tracks_cache');
  const ct = localStorage.getItem('sv_sessions_tracks_cache_ts');
  if (cv && ct) {
    sessionsTracksCache = JSON.parse(cv);
    sessionsTracksCacheTs = parseInt(ct, 10);
  }
} catch (e) {}

export default function Sessions() {
  const { showConfirm, showAlert } = useCustomDialog();
  const [logs, setLogs] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Filters state
  const [selectedTrackId, setSelectedTrackId] = useState('all');
  const [milestonesOnly, setMilestonesOnly] = useState(location.state?.milestoneOnly || false);
  const [sortOrder, setSortOrder] = useState('newest'); 
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);

  // Statistics Summary state
  const [stats, setStats] = useState({ count: 0, totalMinutes: 0, avgRating: 0.0, milestoneCount: 0 });

  // Modal detail state
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeletingLog, setIsDeletingLog] = useState(false);

  // Search input expandable state (mobile)
  const [searchExpanded, setSearchExpanded] = useState(false);

  // Mobile layout detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch track metadata — with localStorage SWR cache for instant display
  useEffect(() => {
    // Invalidate stale in-memory cache if localStorage was cleared (e.g. logout)
    if (sessionsTracksCache && !localStorage.getItem('sv_sessions_tracks_cache')) {
      sessionsTracksCache = null;
      sessionsTracksCacheTs = 0;
    }
    if (sessionsTracksCache) {
      setTracks(sessionsTracksCache);
      // Background refresh if > 5 min old
      if (Date.now() - sessionsTracksCacheTs > 300000) {
        api.get('/tracks').then(res => {
          sessionsTracksCache = res.data;
          sessionsTracksCacheTs = Date.now();
          try {
            localStorage.setItem('sv_sessions_tracks_cache', JSON.stringify(res.data));
            localStorage.setItem('sv_sessions_tracks_cache_ts', sessionsTracksCacheTs.toString());
          } catch (e) {}
          setTracks(res.data);
        }).catch(err => console.error('Silent tracks refresh failed', err));
      }
      return;
    }
    api.get('/tracks')
      .then(res => {
        sessionsTracksCache = res.data;
        sessionsTracksCacheTs = Date.now();
        try {
          localStorage.setItem('sv_sessions_tracks_cache', JSON.stringify(res.data));
          localStorage.setItem('sv_sessions_tracks_cache_ts', sessionsTracksCacheTs.toString());
        } catch (e) {}
        setTracks(res.data);
      })
      .catch(err => console.error('Error loading tracks list', err));
  }, []);

  // Fetch paginated log list
  const fetchLogs = async (pageNum = 1, isReplace = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setFetchingMore(true);
    }
    try {
      const res = await api.get('/logs', {
        params: {
          page: pageNum,
          limit: 20,
          trackId: selectedTrackId,
          sort: sortOrder
        }
      });
      const newLogs = res.data.logs || [];
      const total = res.data.total || 0;
      
      if (isReplace || pageNum === 1) {
        setLogs(newLogs);
        setHasMore(newLogs.length < total);
      } else {
        setLogs(prev => {
          const merged = [...prev, ...newLogs];
          setHasMore(merged.length < total);
          return merged;
        });
      }
    } catch (err) {
      console.error("Error fetching logs list", err);
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  };

  // Fetch summary aggregated statistics
  const fetchStats = async () => {
    try {
      const res = await api.get('/logs/stats', {
        params: {
          trackId: selectedTrackId,
          milestoneOnly: milestonesOnly
        }
      });
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching logs summary statistics", err);
    }
  };

  // Reload logs and stats concurrently on criteria change
  useEffect(() => {
    setPage(1);
    // Parallel fetch: logs + stats simultaneously instead of sequentially
    setLoading(true);
    Promise.all([
      api.get('/logs', { params: { page: 1, limit: 20, trackId: selectedTrackId, sort: sortOrder } }),
      api.get('/logs/stats', { params: { trackId: selectedTrackId, milestoneOnly: milestonesOnly } })
    ]).then(([logsRes, statsRes]) => {
      const newLogs = logsRes.data.logs || [];
      const total = logsRes.data.total || 0;
      setLogs(newLogs);
      setHasMore(newLogs.length < total);
      setStats(statsRes.data);
    }).catch(err => {
      console.error('Error loading sessions data', err);
    }).finally(() => {
      setLoading(false);
    });
  }, [selectedTrackId, sortOrder, milestonesOnly]);

  useEffect(() => {
    if (location.state && location.state.hasOwnProperty('milestoneOnly')) {
      setMilestonesOnly(location.state.milestoneOnly);
    }
  }, [location.state]);

  useEffect(() => {
    const highlightId = location.state?.highlightLogId;
    if (highlightId && logs.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`log-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.transition = 'all 0.5s ease';
          el.style.borderColor = 'var(--accent, #cc3333)';
          el.style.boxShadow = '0 0 15px var(--accent, #cc3333)';
          setTimeout(() => {
            el.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            el.style.boxShadow = 'var(--card-shadow)';
          }, 2000);
        }
      }, 500);
    }
  }, [location.state, logs]);

  // Infinite scroll trigger scroll listener
  useEffect(() => {
    const handleScroll = () => {
      if (loading || fetchingMore || !hasMore) return;
      const threshold = 200;
      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      if (documentHeight - scrollPosition < threshold) {
        setPage(prev => {
          const next = prev + 1;
          fetchLogs(next, false);
          return next;
        });
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, fetchingMore, hasMore, selectedTrackId, sortOrder]);

  const handleDeleteLog = async (logId) => {
    const isConfirmed = await showConfirm("Are you sure you want to delete this session log?", "Delete Session Log");
    if (!isConfirmed || isDeletingLog) return;
    setIsDeletingLog(true);
    try {
      await api.delete(`/logs/${logId}`);
      setIsModalOpen(false);
      setSelectedLog(null);
      setPage(1);
      fetchLogs(1, true);
      fetchStats();
    } catch (err) {
      console.error(err);
      showAlert("Failed to delete session log.", "Error");
    } finally {
      setIsDeletingLog(false);
    }
  };

  // Format date helper: e.g. "30 Jun 2026"
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

  // Date Sticky Header groupings builder
  const getGroupHeaderLabel = (dateStr) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (dateStr === today) return 'TODAY';
      if (dateStr === yesterday) return 'YESTERDAY';
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
    } catch (e) {
      return dateStr.toUpperCase();
    }
  };

  // client-side search and milestone-only filter mapping
  let displayedLogs = [...logs];
  
  if (milestonesOnly) {
    displayedLogs = displayedLogs.filter(l => l.milestoneReached);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    displayedLogs = displayedLogs.filter(l => 
      (l.topic && l.topic.toLowerCase().includes(q)) || 
      (l.notes && l.notes.toLowerCase().includes(q))
    );
  }

  // Render customized empty states
  const renderEmptyState = () => {
    if (searchQuery.trim() && displayedLogs.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', font: '600 14px Urbanist' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
          <div>No sessions matching '{searchQuery}'. Try a different search.</div>
        </div>
      );
    }
    if (milestonesOnly && displayedLogs.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', font: '600 14px Urbanist' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏆</div>
          <div>No milestones yet. Keep building, mark your next breakthrough when you log a session.</div>
        </div>
      );
    }
    if (selectedTrackId !== 'all' && displayedLogs.length === 0) {
      const activeTrack = tracks.find(t => t.id === selectedTrackId);
      const emoji = activeTrack?.icon || '🧠';
      const name = activeTrack?.name || 'Track';
      return (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', font: '600 14px Urbanist' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>{emoji}</div>
          <div>
            No {name} sessions logged yet. <Link to="/log" style={{ color: '#C25A3A', fontWeight: 800, textDecoration: 'none' }}>Log a session →</Link>
          </div>
        </div>
      );
    }
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', font: '600 14px Urbanist' }}>
        No sessions logged. <Link to="/log" style={{ color: '#C25A3A', fontWeight: 800, textDecoration: 'none' }}>Log a session →</Link>
      </div>
    );
  };

  // Reusable card hover state and layout
  const renderSessionCard = (l) => {
    const t = tracks.find(x => x.id === l.trackId);
    
    return (
      <div 
        id={`log-${l.id}`}
        key={l.id}
        onClick={() => {
          setSelectedLog(l);
          setIsModalOpen(true);
        }}
        className="card session-entry-card"
        style={{
          borderLeft: `4px solid ${t?.color || 'var(--text)'}`,
          boxShadow: l.milestoneReached 
            ? `inset 3px 0 8px ${t?.color || '#ccc'}66, var(--card-shadow)`
            : 'var(--card-shadow)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '16px 20px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          transition: 'background 0.2s',
          position: 'relative'
        }}
      >
        {/* Top row: badge, title, rating, duration */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
            
            {/* Track Badge */}
            {t && (
              <span 
                style={{
                  background: `${t.color}15`,
                  color: t.color,
                  padding: '2px 8px',
                  borderRadius: '24px',
                  font: '800 10px Urbanist',
                  textTransform: 'uppercase',
                  border: `1.5px solid ${t.color}25`
                }}
              >
                {t.name}
              </span>
            )}

            {/* Title with optional milestone trophy icon */}
            <span style={{ font: '700 15px Urbanist', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {l.milestoneReached && <span style={{ color: '#f59e0b', fontSize: '14px' }}>🏆</span>}
              {l.topic}
            </span>
          </div>

          {/* Rating display and duration */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', font: '800 12.5px Urbanist' }}>
            <span style={{ color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <StarIcon /> {l.rating || '0'}/10
            </span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--text-muted)' }}>
              {formatDuration(l.duration)}
            </span>
          </div>
        </div>

        {/* Middle row: notes details */}
        {l.notes && (
          <div style={{ font: '600 13px Urbanist', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            {l.notes}
          </div>
        )}

        {/* Bottom row: date */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', font: '800 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <IconCalendar size={12} /> {formatDateString(l.date)}
          </span>
          {(l.startTime || l.endTime) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', font: '800 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              <IconClock size={12} /> {l.startTime || '—'} – {l.endTime || '—'}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Grouped chronologically or flat renderer based on sort criteria
  const renderSessionsList = () => {
    if (displayedLogs.length === 0) {
      return renderEmptyState();
    }

    if (sortOrder !== 'newest') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayedLogs.map(l => renderSessionCard(l))}
        </div>
      );
    }

    // Group logs by date
    const groups = {};
    displayedLogs.forEach(l => {
      if (!groups[l.date]) groups[l.date] = [];
      groups[l.date].push(l);
    });

    const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sortedDates.map(dateVal => (
          <div key={dateVal} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Sticky Date Group Header */}
            <div style={{
              position: 'sticky',
              top: '64px',
              zIndex: 10,
              background: 'var(--page)',
              padding: '6px 0',
              font: '800 11px Urbanist',
              letterSpacing: '0.8px',
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--rail-border)',
              marginBottom: '4px'
            }}>
              {getGroupHeaderLabel(dateVal)}
            </div>
            {groups[dateVal].map(l => renderSessionCard(l))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="page active" id="page-sessions" style={{ paddingBottom: '48px' }}>
      
      {/* HEADER SECTION */}
      <div className="dashboard-header-row" style={{ marginBottom: '24px' }}>
        <div>
          <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
          <h1 className="dashboard-title">Sessions & Milestones.</h1>
          <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
            Every rep you logged, and the breakthroughs among them.
          </div>
        </div>
        
        <button 
          className="pillbtn" 
          style={{ 
            background: '#e5a83c', 
            color: '#100D18', 
            border: 'none', 
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }} 
          onClick={() => navigate('/log')}
        >
          <IconPlus size={16} strokeWidth={2.5} /> Log a session
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* FILTERS TOOLBAR ROW CARD */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Scrollable track pills row with right-side fade indicator */}
          <div style={{ position: 'relative', width: '100%' }}>
            <div 
              style={{ 
                display: 'flex', 
                overflowX: 'auto', 
                whiteSpace: 'nowrap', 
                gap: '8px', 
                paddingBottom: '8px',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none'
              }}
            >
              <TrackFilterPill 
                name="All"
                color="var(--text)"
                isActive={selectedTrackId === 'all'}
                onClick={() => setSelectedTrackId('all')}
              />
              {tracks.map(t => (
                <TrackFilterPill 
                  key={t.id}
                  name={t.name}
                  color={t.color}
                  isActive={selectedTrackId === t.id}
                  onClick={() => setSelectedTrackId(t.id)}
                />
              ))}
            </div>
            
            {/* Fade right indicator */}
            <div style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '40px',
              background: 'linear-gradient(to right, transparent, var(--page))',
              pointerEvents: 'none',
              zIndex: 2
            }} />
          </div>

          {/* Toggle Filters Row with search and dropdowns (Added 4px vertical space) */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            borderTop: '1px solid var(--rail-border)', 
            paddingTop: '18px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            
            {/* Milestones Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ font: '600 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Milestones only
              </span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={milestonesOnly}
                  onChange={e => setMilestonesOnly(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Search + Sorting Dropdowns */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              
              {/* Expandable Search Input */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {isMobile && !searchExpanded ? (
                  <button 
                    onClick={() => setSearchExpanded(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', padding: '8px', cursor: 'pointer' }}
                    title="Search"
                  >
                    <IconSearch size={18} />
                  </button>
                ) : (
                  <div style={{ position: 'relative', width: isMobile ? '120px' : '170px', display: 'flex', alignItems: 'center' }}>
                    <IconSearch 
                      size={14} 
                      style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} 
                    />
                    <input 
                      type="text"
                      className="field"
                      style={{ 
                        height: '36px', 
                        paddingLeft: '30px', 
                        paddingRight: '26px', 
                        fontSize: '12px',
                        font: '700 12.5px Urbanist'
                      }}
                      placeholder="Search sessions…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Escape' && setSearchQuery('')}
                      onBlur={() => {
                        if (isMobile && !searchQuery) setSearchExpanded(false);
                      }}
                      autoFocus={isMobile}
                    />
                    {searchQuery && (
                      <span 
                        onClick={() => setSearchQuery('')}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                      >
                        <IconX size={14} />
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Sort dropdown */}
              <select
                className="field"
                style={{ width: '130px', padding: '6px 10px', height: '36px', font: '800 12px Urbanist' }}
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="highest_rated">Highest rated</option>
                <option value="lowest_rated">Lowest rated</option>
                <option value="longest">Longest session</option>
                <option value="shortest">Shortest session</option>
              </select>
            </div>

          </div>
        </div>

        {/* SUMMARY STATS BAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <div style={{ font: '600 11.5px Urbanist', color: 'var(--text-muted)', letterSpacing: '0.02em', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span>
              {stats.count} sessions · {(stats.totalMinutes / 60).toFixed(1)} hours total · ⭐ {stats.avgRating} avg rating · {stats.milestoneCount} milestones
            </span>
          </div>
          <div style={{ height: '1px', background: 'var(--rail-border)', opacity: 0.3 }} />
        </div>

        {/* SESSIONS CARDS LIST */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-muted)', font: '700 14px Urbanist' }}>
            Loading sessions list...
          </div>
        ) : (
          <div>
            {renderSessionsList()}
            
            {/* Scroll bottom loading indicator */}
            {fetchingMore && (
              <div style={{ textAlign: 'center', padding: '20px 0', font: '800 12px Urbanist', color: 'var(--text-muted)' }}>
                Loading more logs...
              </div>
            )}
          </div>
        )}

      </div>

      {/* SESSION DETAIL MODAL */}
      {isModalOpen && selectedLog && (() => {
        const t = tracks.find(x => x.id === selectedLog.trackId);
        
        // Stars array helper
        const stars = [];
        for (let i = 1; i <= 10; i++) {
          stars.push(
            <svg 
              key={i} 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill={i <= (selectedLog.rating || 0) ? "#E5A83C" : "none"} 
              stroke={i <= (selectedLog.rating || 0) ? "#E5A83C" : "var(--text-muted)"}
              style={{ opacity: i <= (selectedLog.rating || 0) ? 1 : 0.4 }}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          );
        }

        return (
          <div className="scrim" onClick={() => { setIsModalOpen(false); setSelectedLog(null); }}>
            <div 
              className="modal" 
              onClick={e => e.stopPropagation()}
              style={{ padding: '0', overflow: 'hidden', position: 'relative', width: '520px', maxWidth: '92%' }}
            >
              <div className="kthin" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
              
              <div style={{ padding: '30px', paddingTop: '34px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Header line: Track & Close */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {t && (
                    <span 
                      style={{
                        background: `${t.color}15`,
                        color: t.color,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        font: '800 11px Urbanist',
                        textTransform: 'uppercase',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: t.color }}></span>
                      {t.name}
                    </span>
                  )}
                  
                  <button 
                    onClick={() => { setIsModalOpen(false); setSelectedLog(null); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <IconX size={18} />
                  </button>
                </div>

                {/* Session title */}
                <h2 style={{ font: '900 22px Urbanist', color: 'var(--text)', lineHeight: '1.3', marginTop: '4px' }}>
                  {selectedLog.topic}
                </h2>

                {/* Details Boxes Row */}
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

                {/* Session quality ratings */}
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

                {/* Notes box */}
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

                {/* Bottom row actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: '1px solid var(--rail-border)', paddingTop: '20px' }}>
                  
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteLog(selectedLog.id)}
                    disabled={isDeletingLog}
                    style={{ background: 'none', border: 'none', color: '#EF4444', font: '800 13px Urbanist', display: 'flex', alignItems: 'center', gap: '6px', cursor: isDeletingLog ? 'not-allowed' : 'pointer', opacity: isDeletingLog ? 0.6 : 1 }}
                  >
                    <IconTrash size={14} /> {isDeletingLog ? 'Deleting…' : 'Delete'}
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
