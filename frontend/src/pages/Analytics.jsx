import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { formatDuration, renderTrackIcon } from '../api';
import { 
  IconChevronRight, 
  IconTrendingUp, 
  IconActivity
} from '@tabler/icons-react';

// Count-up Animated Number Component
const AnimatedNumber = ({ value, duration = 600, formatter = (val) => val }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = null;
    const target = parseFloat(value) || 0;
    
    // Ease out quad: f(t) = t * (2 - t)
    const easeOutQuad = (t) => t * (2 - t);

    let animationFrameId;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const easedProgress = easeOutQuad(progress);
      
      setDisplayValue(easedProgress * target);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setDisplayValue(target);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  const isFloat = String(value).includes('.');
  if (isFloat) {
    return <>{formatter(displayValue.toFixed(1))}</>;
  }
  return <>{formatter(Math.round(displayValue))}</>;
};

// LocalStorage-backed SWR cache — persists across navigations AND page refreshes
const ANALYTICS_CACHE_KEY = 'sv_analytics_cache';
const ANALYTICS_CACHE_TS_KEY = 'sv_analytics_cache_ts';
const ANALYTICS_CACHE_TTL = 60000; // 60 seconds

let _analyticsMemCache = null;
let _analyticsMemCacheTs = 0;

try {
  const cv = localStorage.getItem(ANALYTICS_CACHE_KEY);
  const ct = localStorage.getItem(ANALYTICS_CACHE_TS_KEY);
  if (cv && ct) {
    _analyticsMemCache = JSON.parse(cv);
    _analyticsMemCacheTs = parseInt(ct, 10);
  }
} catch (e) {}

const fetchWithCache = async (url, params) => {
  const res = await api.get(url, { params });
  return res.data;
};

// Helper to map date range option to start/end ISO strings
const getDateRangeParams = (range) => {
  if (range === 'all') return { from: '', to: '' };
  const today = new Date();
  let days = 7;
  if (range === '30') days = 30;
  if (range === '90') days = 90;
  
  const fromDate = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const toStr = today.toISOString().split('T')[0];
  const fromStr = fromDate.toISOString().split('T')[0];
  return { from: fromStr, to: toStr };
};

export default function Analytics() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [byTrack, setByTrack] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [masteryData, setMasteryData] = useState([]);
  const [streakData, setStreakData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [dateRange, setDateRange] = useState('all');
  const [selectedTrackId, setSelectedTrackId] = useState('all');

  // Hover states for overlays
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [donutTooltip, setDonutTooltip] = useState(null);
  const [hoveredCellIdx, setHoveredCellIdx] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  
  // Staggered bars animation trigger
  const [animateProgress, setAnimateProgress] = useState(false);

  const fetchAnalyticsData = async () => {
    // Invalidate stale in-memory cache if localStorage was cleared (e.g. logout)
    if (_analyticsMemCache && !localStorage.getItem(ANALYTICS_CACHE_KEY)) {
      _analyticsMemCache = null;
      _analyticsMemCacheTs = 0;
    }

    const now = Date.now();
    const cacheIsValid = _analyticsMemCache && (now - _analyticsMemCacheTs < ANALYTICS_CACHE_TTL);
    const cacheMatchesFilters = _analyticsMemCache &&
      _analyticsMemCache._dateRange === dateRange &&
      _analyticsMemCache._trackId === selectedTrackId;

    if (cacheIsValid && cacheMatchesFilters) {
      // Instant render from cache — no loading state needed
      const d = _analyticsMemCache;
      setSummary(d.summary); setByTrack(d.byTrack); setHeatmap(d.heatmap);
      setMilestones(d.milestones); setMasteryData(d.masteryData);
      setStreakData(d.streakData); setLogs(d.logs); setTracks(d.tracks);
      setLoading(false);
      setTimeout(() => setAnimateProgress(true), 50);
      return;
    }

    try {
      setLoading(true);
      setAnimateProgress(false);
      const { from, to } = getDateRangeParams(dateRange);
      const filterParams = { trackId: selectedTrackId, from, to };

      // Concurrent fetch requests
      const [
        summaryData, byTrackData, heatmapData, milestonesData,
        masteryData, streakData, logsData, tracksData
      ] = await Promise.all([
        fetchWithCache('/analytics/summary', filterParams),
        fetchWithCache('/analytics/by-track', filterParams),
        fetchWithCache('/analytics/heatmap', filterParams),
        fetchWithCache('/milestones', { trackId: selectedTrackId }),
        fetchWithCache('/analytics/mastery', filterParams),
        fetchWithCache('/analytics/streak', filterParams),
        fetchWithCache('/logs', { trackId: selectedTrackId, limit: 1000, from, to }),
        fetchWithCache('/tracks', {})
      ]);

      const newCacheData = {
        summary: summaryData, byTrack: byTrackData, heatmap: heatmapData,
        milestones: milestonesData.slice(0, 5), masteryData, streakData,
        logs: logsData.logs || logsData, tracks: tracksData,
        _dateRange: dateRange, _trackId: selectedTrackId
      };
      _analyticsMemCache = newCacheData;
      _analyticsMemCacheTs = Date.now();
      try {
        localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(newCacheData));
        localStorage.setItem(ANALYTICS_CACHE_TS_KEY, _analyticsMemCacheTs.toString());
      } catch (e) {}

      setSummary(summaryData); setByTrack(byTrackData); setHeatmap(heatmapData);
      setMilestones(milestonesData.slice(0, 5)); setMasteryData(masteryData);
      setStreakData(streakData); setLogs(logsData.logs || logsData); setTracks(tracksData);
    } catch (err) {
      console.error('Error loading analytics data', err);
    } finally {
      setLoading(false);
      setTimeout(() => setAnimateProgress(true), 50);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange, selectedTrackId]);

  const formatTotalHours = (hrs) => {
    const val = parseFloat(hrs) || 0;
    if (val % 1 === 0) {
      return `${Math.round(val)}h`;
    }
    return `${val.toFixed(1)}h`;
  };

  const formatBarValue = (hours) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getDayOfWeekStats = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const minsPerDay = Array(7).fill(0);
    
    logs.forEach(l => {
      const d = new Date(l.date + 'T12:00:00');
      let dayIdx = d.getDay() - 1; 
      if (dayIdx === -1) dayIdx = 6;
      minsPerDay[dayIdx] += l.duration;
    });
    
    return days.map((name, idx) => ({
      name,
      hours: minsPerDay[idx] / 60
    }));
  };

  const getTimeOfDayStats = () => {
    const hourCounts = Array(24).fill(0);
    logs.forEach(l => {
      if (l.startTime) {
        const parts = l.startTime.split(':');
        if (parts.length > 0) {
          const hour = parseInt(parts[0], 10);
          if (!isNaN(hour) && hour >= 0 && hour < 24) {
            hourCounts[hour] += 1;
          }
        }
      }
    });
    
    return hourCounts.map((count, hour) => ({
      name: `${String(hour).padStart(2, '0')}:00`,
      count
    }));
  };

  const renderDonutChart = () => {
    const totalHrs = byTrack.reduce((sum, item) => sum + item.hours, 0);
    const tracksWithData = byTrack.filter(t => t.hours > 0);
    
    const cx = 60, cy = 60, r = 40, strokeW = 12;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px', width: '100%', justifyContent: 'center', position: 'relative' }}>
        <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--phbar-bg)" strokeWidth={strokeW} />
            {tracksWithData.map((t, idx) => {
              const pct = t.hours / (totalHrs || 1);
              const dash = pct * circ;
              const currentOffset = offset;
              offset += dash;
              
              const isHovered = hoveredSegment === idx;
              
              return (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={t.color}
                  strokeWidth={isHovered ? strokeW + 2 : strokeW}
                  strokeDasharray={`${animateProgress ? dash : 0} ${circ}`}
                  strokeDashoffset={-currentOffset}
                  style={{ 
                    transition: 'stroke-width 0.15s, stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)', 
                    cursor: 'pointer',
                    filter: isHovered ? `drop-shadow(0 0 4px ${t.color})` : 'none'
                  }}
                  onMouseEnter={() => setHoveredSegment(idx)}
                  onMouseLeave={() => {
                    setHoveredSegment(null);
                    setDonutTooltip(null);
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                    setDonutTooltip({
                      text: `${t.name}: ${formatBarValue(t.hours)} · ${Math.round(pct * 100)}%`,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top
                    });
                  }}
                />
              );
            })}
          </svg>
          
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1px' }}>
              <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text)' }}>
                {totalHrs.toFixed(1)}
              </span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
                h
              </span>
            </div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'lowercase' }}>
              total
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tracksWithData.map((t, idx) => (
            <div 
              key={idx} 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', font: '700 12px Urbanist', color: 'var(--text)', cursor: 'pointer' }}
              onMouseEnter={() => setHoveredSegment(idx)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: t.color, flexShrink: 0 }}></div>
              <span style={{ whiteSpace: 'nowrap' }}>
                {t.name} · <span style={{ color: 'var(--text-muted)' }}>{formatBarValue(t.hours)}</span>
              </span>
            </div>
          ))}
        </div>

        {donutTooltip && (
          <div style={{
            position: 'absolute',
            top: donutTooltip.y - 35,
            left: donutTooltip.x + 10,
            background: 'var(--card-bg, #1e1b26)',
            border: '1px solid var(--rail-border)',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            color: 'var(--text)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 100
          }}>
            {donutTooltip.text}
          </div>
        )}
      </div>
    );
  };

  const renderHeatmap = () => {
    if (heatmap.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>No history logged.</div>;
    
    const logs90 = heatmap.slice(-90);
    const numCols = Math.ceil(logs90.length / 6);

    const monthLabels = [];
    let lastMonth = null;
    for (let colIdx = 0; colIdx < numCols; colIdx++) {
      const firstCellIdx = colIdx * 6;
      const cell = logs90[firstCellIdx];
      if (cell && cell.date) {
        const dateObj = new Date(cell.date + 'T12:00:00');
        const mName = dateObj.toLocaleDateString('en-US', { month: 'short' });
        if (mName !== lastMonth) {
          monthLabels.push({ colIdx, name: mName });
          lastMonth = mName;
        }
      }
    }

    const columns = [];
    for (let colIdx = 0; colIdx < numCols; colIdx++) {
      const columnCells = [];
      for (let rowIdx = 0; rowIdx < 6; rowIdx++) {
        const cellIdx = colIdx * 6 + rowIdx;
        const item = logs90[cellIdx];

        if (!item) {
          columnCells.push(<div key={rowIdx} style={{ width: '46px', height: '46px' }}></div>);
          continue;
        }

        let heatClass = 'heat-cell';
        if (item.level === 1) heatClass = 'heat-cell heat-2';
        else if (item.level === 2) heatClass = 'heat-cell heat-2';
        else if (item.level === 3) heatClass = 'heat-cell heat-3';
        else if (item.level === 4) heatClass = 'heat-cell heat-4';

        const tooltipText = item.minutes > 0
          ? `${formatDateLabel(item.date)}: ${formatDuration(item.minutes)} logged · ${item.sessionCount || 0} sessions`
          : `${formatDateLabel(item.date)}: No sessions logged`;

        columnCells.push(
          <div 
            key={rowIdx}
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoveredCellIdx(cellIdx)}
            onMouseLeave={() => setHoveredCellIdx(null)}
          >
            <div 
              className={heatClass}
              style={{ 
                width: '46px', 
                height: '46px', 
                borderRadius: '5px',
                transition: 'background 0.15s'
              }}
            />
            {hoveredCellIdx === cellIdx && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%) translateY(-6px)',
                background: 'var(--card-bg, #1e1b26)',
                border: '1px solid var(--rail-border)',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                color: 'var(--text)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                whiteSpace: 'nowrap',
                zIndex: 100,
                pointerEvents: 'none'
              }}>
                {tooltipText}
              </div>
            )}
          </div>
        );
      }

      columns.push(
        <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {columnCells}
        </div>
      );
    }

    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', position: 'relative', height: '18px', marginBottom: '6px', width: '100%' }}>
          {monthLabels.map((lbl, idx) => (
            <div 
              key={idx} 
              style={{ 
                position: 'absolute', 
                left: `${lbl.colIdx * (46 + 3)}px`, 
                fontSize: '10px', 
                fontWeight: '700', 
                color: 'var(--text-muted)',
                fontFamily: 'Urbanist'
              }}
            >
              {lbl.name}
            </div>
          ))}
        </div>

        <div 
          style={{ 
            display: 'flex', 
            gap: '3px', 
            justifyContent: numCols === 15 ? 'space-between' : 'flex-start', 
            overflowX: 'auto', 
            paddingBottom: '8px',
            width: '100%',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {columns}
        </div>
      </div>
    );
  };

  const renderLineChart = () => {
    if (masteryData.length === 0) {
      return <div style={{ color: 'var(--text-muted)', fontSize: '13.5px', padding: '40px 0', textAlign: 'center', fontWeight: 600 }}>No mastery logs for this range.</div>;
    }

    const width = 500;
    const height = 150;
    const paddingX = 40;
    const paddingY = 20;

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
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="var(--rail-border, rgba(0,0,0,0.1))" strokeWidth="1" />
                <text x={paddingX - 10} y={y + 4} fill="var(--text-muted)" fontSize="9" fontWeight="700" textAnchor="end">{r}</text>
              </g>
            );
          })}

          <line x1={paddingX} y1={avgY} x2={width - paddingX} y2={avgY} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={width - paddingX + 5} y={avgY + 3} fill="var(--text-muted)" fontSize="9" fontWeight="700">AVG ({avgRating.toFixed(1)})</text>

          {points.length > 1 && (
            <path 
              d={pathD} 
              fill="none" 
              stroke="var(--accent, #e5a83c)" 
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
              r="4.5"
              fill="var(--accent, #e5a83c)"
              stroke="var(--card-bg, #100d18)"
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
            background: 'var(--card-bg, #1e1b26)',
            border: '1px solid var(--rail-border)',
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
              {hoveredPoint.log.date} · Rating: {hoveredPoint.log.rating}/10
            </div>
          </div>
        )}
      </div>
    );
  };

  const StatCardSkeleton = () => (
    <div className="stat-box skeleton-shimmer" style={{ height: '116px', border: 'none' }} />
  );

  const BarChartSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="skeleton-shimmer" style={{ width: '100px', height: '16px' }} />
          <div className="skeleton-shimmer" style={{ flex: 1, height: '8px' }} />
          <div className="skeleton-shimmer" style={{ width: '40px', height: '16px' }} />
        </div>
      ))}
    </div>
  );

  const DonutSkeleton = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '32px', width: '100%', justifyContent: 'center' }}>
      <div className="skeleton-shimmer" style={{ width: '120px', height: '120px', borderRadius: '50%' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="skeleton-shimmer" style={{ width: '10px', height: '10px', borderRadius: '3px' }} />
            <div className="skeleton-shimmer" style={{ width: '120px', height: '14px' }} />
          </div>
        ))}
      </div>
    </div>
  );

  const HeatmapSkeleton = () => (
    <div style={{ display: 'flex', gap: '3px', justifyContent: 'space-between', width: '100%' }}>
      {Array.from({ length: 15 }).map((_, colIdx) => (
        <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {Array.from({ length: 6 }).map((_, rowIdx) => (
            <div 
              key={rowIdx} 
              className="skeleton-shimmer" 
              style={{ width: '46px', height: '46px', borderRadius: '5px' }} 
            />
          ))}
        </div>
      ))}
    </div>
  );

  const ListSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="skeleton-shimmer" style={{ width: '10px', height: '10px', borderRadius: '50%' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className="skeleton-shimmer" style={{ width: '70%', height: '14px' }} />
            <div className="skeleton-shimmer" style={{ width: '40%', height: '10px' }} />
          </div>
          <div className="skeleton-shimmer" style={{ width: '50px', height: '12px' }} />
        </div>
      ))}
    </div>
  );

  const bestTrack = byTrack.length > 0 ? [...byTrack].sort((a,b) => b.hours - a.hours)[0] : null;
  const maxHours = Math.max(...byTrack.map(t => t.hours), 1);
  const dayOfWeekData = getDayOfWeekStats();
  const maxDayHours = Math.max(...dayOfWeekData.map(d => d.hours), 1);
  const timeOfDayData = getTimeOfDayStats();
  const maxTimeCount = Math.max(...timeOfDayData.map(h => h.count), 1);

  return (
    <div className="page active" id="page-analytics" style={{ paddingBottom: '48px' }}>
      
      <div className="dashboard-header-row" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
          <h1 className="dashboard-title">Analytics.</h1>
          <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
            Everything you've put in — measured.
          </div>
          {selectedTrackId !== 'all' && bestTrack && (
            <div style={{ font: '700 12.5px Urbanist', color: bestTrack.color || 'var(--text)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {renderTrackIcon(bestTrack, 14, { borderRadius: '50%' })}
              <span>Showing: {bestTrack.name}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', marginBottom: '14px', width: '100%', overflowX: 'auto', paddingBottom: '4px' }} className="segmented-control-container">
        <div style={{ display: 'flex', background: 'var(--card-bg, #1a1a24)', padding: '4px', borderRadius: '24px', border: '1px solid var(--rail-border)' }} className="segmented-control">
          {[
            { id: '7', label: 'Last 7 days' },
            { id: '30', label: 'Last 30 days' },
            { id: '90', label: 'Last 90 days' },
            { id: 'all', label: 'All time' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setDateRange(opt.id)}
              style={{
                background: dateRange === opt.id ? 'var(--phbar-bg, #EDEBF3)' : 'transparent',
                color: dateRange === opt.id ? 'var(--card-bg, #100d18)' : 'var(--text-muted)',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '20px',
                font: '800 12px Urbanist',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div 
        className="track-pills-container" 
        style={{ 
          display: 'flex', 
          gap: '8px', 
          overflowX: 'auto', 
          whiteSpace: 'nowrap', 
          marginBottom: '28px',
          paddingBottom: '4px',
          width: '100%'
        }}
      >
        <button
          onClick={() => setSelectedTrackId('all')}
          style={{
            padding: '6px 16px',
            borderRadius: '24px',
            font: '700 12px Urbanist',
            border: '1px solid var(--rail-border)',
            cursor: 'pointer',
            background: selectedTrackId === 'all' ? 'var(--text)' : 'transparent',
            color: selectedTrackId === 'all' ? 'var(--card-bg)' : 'var(--text)',
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
        >
          All
        </button>
        {tracks.map(t => {
          const isActive = selectedTrackId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSelectedTrackId(t.id)}
              style={{
                padding: '6px 16px',
                borderRadius: '24px',
                font: '700 12px Urbanist',
                border: `1px solid ${isActive ? t.color : 'var(--rail-border)'}`,
                cursor: 'pointer',
                background: isActive ? t.color : 'transparent',
                color: isActive ? 'var(--card-bg)' : 'var(--text)',
                transition: 'all 0.15s ease',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {renderTrackIcon(t, 14, { borderRadius: '50%' })}
              {t.name}
            </button>
          );
        })}
      </div>

      {loading ? (
        <>
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
          </div>
          <div className="grid-2" style={{ marginBottom: '24px', alignItems: 'start' }}>
            <div className="card" style={{ padding: '28px', height: '240px' }}><div style={{ width: '120px', height: '20px', marginBottom: '20px' }} className="skeleton-shimmer" /><BarChartSkeleton /></div>
            <div className="card" style={{ padding: '28px', height: '240px' }}><div style={{ width: '120px', height: '20px', marginBottom: '20px' }} className="skeleton-shimmer" /><DonutSkeleton /></div>
          </div>
          <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}><div style={{ width: '150px', height: '20px' }} className="skeleton-shimmer" /><div style={{ width: '80px', height: '16px' }} className="skeleton-shimmer" /></div>
            <HeatmapSkeleton />
          </div>
        </>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            <div 
              className="stat-box stat-card-clickable" 
              onClick={() => document.getElementById('analytics-heatmap')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '24px', gap: '4px' }}
            >
              <span className="stat-box-lbl" style={{ fontSize: '10px' }}>TOTAL HOURS</span>
              <span className="stat-box-val" style={{ fontSize: '32px', fontWeight: '900' }}>
                <AnimatedNumber value={summary?.totalHours || 0} formatter={formatTotalHours} />
              </span>
              <span style={{ font: '700 11.5px Urbanist', color: 'var(--text-muted)', textTransform: 'lowercase' }}>
                all time
              </span>
            </div>

            <div 
              className="stat-box stat-card-clickable" 
              onClick={() => document.getElementById('analytics-hours-by-track')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '24px', gap: '4px' }}
            >
              <span className="stat-box-lbl" style={{ fontSize: '10px' }}>AVG SESSION</span>
              <span className="stat-box-val" style={{ fontSize: '32px', fontWeight: '900' }}>
                <AnimatedNumber value={summary?.avgSession || 0} formatter={formatDuration} />
              </span>
              <span style={{ font: '700 11.5px Urbanist', color: 'var(--text-muted)', textTransform: 'lowercase' }}>
                per sitting
              </span>
            </div>

            <div 
              className="stat-box stat-card-clickable" 
              onClick={() => {
                if (bestTrack) navigate(`/tracks/${bestTrack.trackId || bestTrack.id}`);
              }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '24px', gap: '4px', overflow: 'hidden' }}
            >
              <span className="stat-box-lbl" style={{ fontSize: '10px' }}>MOST ACTIVE TRACK</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0', maxWidth: '100%' }}>
                {bestTrack && bestTrack.hours > 0 ? (
                  <>
                    <span style={{ fontSize: '18px' }}>{bestTrack.icon}</span>
                    <span className="stat-box-val" style={{ fontSize: '15.5px', fontWeight: '900', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                      {bestTrack.name}
                    </span>
                  </>
                ) : (
                  <span className="stat-box-val" style={{ fontSize: '20px', fontWeight: '900' }}>—</span>
                )}
              </div>
              <span style={{ font: '700 11.5px Urbanist', color: 'var(--text-muted)', textTransform: 'lowercase' }}>
                {bestTrack ? `${bestTrack.hours.toFixed(1)}h logged` : '0h logged'}
              </span>
            </div>

            <div 
              className="stat-box stat-card-clickable" 
              onClick={() => document.getElementById('analytics-this-month')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '24px', gap: '4px' }}
            >
              <span className="stat-box-lbl" style={{ fontSize: '10px' }}>AVG MASTERY</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                <span className="stat-box-val" style={{ fontSize: '32px', fontWeight: '900' }}>
                  <AnimatedNumber value={summary?.avgMastery || 0} />
                </span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)' }}>/10</span>
              </div>
              <span style={{ font: '700 11.5px Urbanist', color: 'var(--text-muted)', textTransform: 'lowercase' }}>
                this month
              </span>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: '24px', alignItems: 'start' }}>
            <div className="card" id="analytics-hours-by-track" style={{ padding: '28px' }}>
              <span className="lbl" style={{ marginBottom: '20px' }}>Hours by track</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {byTrack.length > 0 ? (
                  byTrack.map((t, idx) => {
                    const w = Math.round((t.hours / maxHours) * 100);
                    const hasData = t.hours > 0;
                    return (
                      <div 
                        key={idx} 
                        style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}
                        onMouseEnter={() => setHoveredBarIndex(idx)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                      >
                        <span style={{ font: '700 13px Urbanist', color: 'var(--text-muted)', width: '110px', flexShrink: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {t.name}
                        </span>
                        <div className="phbar" style={{ flex: 1, height: '8px', cursor: 'pointer' }}>
                          <div 
                            className="progress-fill" 
                            style={{ 
                              width: animateProgress ? (hasData ? `${w}%` : '4px') : '0%', 
                              background: t.color,
                              opacity: hasData ? 1 : 0.3,
                              transition: 'width 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
                              transitionDelay: `${idx * 80}ms`
                            }}
                          />
                        </div>
                        <span style={{ font: '800 13px Urbanist', color: 'var(--text)', width: '55px', textAlign: 'right', flexShrink: 0 }}>
                          {t.hours > 0 ? formatBarValue(t.hours) : '0h'}
                        </span>

                        {hoveredBarIndex === idx && (
                          <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%) translateY(-6px)',
                            background: 'var(--card-bg, #1e1b26)',
                            border: '1px solid var(--rail-border)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: 'var(--text)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                            pointerEvents: 'none'
                          }}>
                            {t.name}: {formatBarValue(t.hours)} across {t.sessionCount || 0} sessions
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>Log sessions to see data</div>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column' }}>
              <span className="lbl" style={{ marginBottom: '20px' }}>Time split</span>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '160px' }}>
                {renderDonutChart()}
              </div>
            </div>
          </div>

          <div className="card" id="analytics-heatmap" style={{ padding: '28px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ font: '900 16px Urbanist', color: 'var(--text)' }}>
                {dateRange === '7' ? 'Activity — last 7 days' : dateRange === '30' ? 'Activity — last 30 days' : 'Activity — last 90 days'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', font: '700 11px Urbanist', color: 'var(--text-muted)' }}>
                <span>Less</span>
                <div className="heat-cell" style={{ width: '12px', height: '12px', borderRadius: '3px' }}></div>
                <div className="heat-cell heat-2" style={{ width: '12px', height: '12px', borderRadius: '3px' }}></div>
                <div className="heat-cell heat-3" style={{ width: '12px', height: '12px', borderRadius: '3px' }}></div>
                <div className="heat-cell heat-4" style={{ width: '12px', height: '12px', borderRadius: '3px' }}></div>
                <span>More</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto', paddingBottom: '6px' }}>
              {renderHeatmap()}
            </div>
          </div>
        </>
      )}

      <div className="grid-2" style={{ alignItems: 'start', marginBottom: '24px' }}>
        <div className="card" id="analytics-this-month" style={{ padding: '28px' }}>
          <span className="lbl" style={{ marginBottom: '16px' }}>THIS MONTH</span>
          {loading ? (
            <ListSkeleton />
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                <span style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text)' }}>
                  {formatDuration(logs.reduce((sum, l) => sum + l.duration, 0))}
                </span>
                <span style={{ font: '700 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  logged this period
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', font: '700 13px Urbanist', color: 'var(--text)' }}>
                  <span style={{ fontSize: '15px' }}>🔥</span>
                  <span>
                    {streakData?.currentStreak || 0} day streak
                  </span>
                </div>
                <div style={{ font: '700 12px Urbanist', color: 'var(--text-muted)', paddingLeft: '24px' }}>
                  Best streak: {streakData?.bestStreak || 0} days
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--rail-border)', margin: '16px 0' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: '700 12.5px Urbanist', color: 'var(--text)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sessions logged:</span>
                  <span>{streakData?.sessionsCount || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: '700 12.5px Urbanist', color: 'var(--text)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Avg session quality:</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '1px' }}>
                    <span>{streakData?.avgMastery ? streakData.avgMastery.toFixed(1) : '0.0'}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/10</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="card" style={{ padding: '28px' }}>
          <span className="lbl" style={{ marginBottom: '20px' }}>Milestones</span>
          {loading ? (
            <ListSkeleton />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {milestones.length > 0 ? (
                <>
                  {milestones.map((m, idx) => {
                    const t = tracks.find(x => x.id === m.trackId);
                    const formattedDate = new Date(m.date + 'T12:00:00').toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    });
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
                        <div style={{ 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%', 
                          background: t?.color || 'var(--text)',
                          flexShrink: 0 
                        }}></div>
                        
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div 
                            style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                            title={m.name}
                          >
                            {m.name}
                          </div>
                          <div style={{ font: '600 11.5px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {t?.name || 'Track'}
                          </div>
                        </div>
                        
                        <div style={{ font: '700 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', flexShrink: 0 }}>
                          {formattedDate}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: '8px', borderTop: '1px solid var(--rail-border)', paddingTop: '14px' }}>
                    <Link 
                      to="/sessions?milestones=true" 
                      style={{ 
                        font: '800 12.5px Urbanist', 
                        color: 'var(--accent, #e5a83c)', 
                        textDecoration: 'none', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px' 
                      }}
                    >
                      View all milestones
                      <IconChevronRight size={14} />
                    </Link>
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '20px 0', textAlign: 'center', fontWeight: 600 }}>
                  🏆 No milestones yet. Mark your first breakthrough when logging a session.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <IconTrendingUp size={20} style={{ color: 'var(--accent, #e5a83c)' }} />
            <span className="lbl" style={{ margin: 0 }}>Session Quality Over Time</span>
          </div>
          {loading ? <BarChartSkeleton /> : renderLineChart()}
        </div>

        <div className="card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <IconActivity size={20} style={{ color: 'var(--accent, #e5a83c)' }} />
            <span className="lbl" style={{ margin: 0 }}>Best Day of Week</span>
          </div>
          {loading ? (
            <BarChartSkeleton />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dayOfWeekData.map((d, idx) => {
                const w = Math.round((d.hours / maxDayHours) * 100);
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', width: '35px', flexShrink: 0 }}>
                      {d.name}
                    </span>
                    <div className="phbar" style={{ flex: 1, height: '7px' }}>
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: animateProgress ? `${w}%` : '0%', 
                          background: 'var(--accent, #e5a83c)', 
                          transition: 'width 0.4s ease-out',
                          transitionDelay: `${idx * 50}ms`
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text)', width: '55px', textAlign: 'right', flexShrink: 0 }}>
                      {d.hours > 0 ? `${d.hours.toFixed(1)}h` : '0h'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <IconActivity size={20} style={{ color: 'var(--accent, #e5a83c)' }} />
          <span className="lbl" style={{ margin: 0 }}>Best Time of Day</span>
        </div>
        {loading ? (
          <BarChartSkeleton />
        ) : (
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px', 
              maxHeight: '340px', 
              overflowY: 'auto', 
              paddingRight: '6px' 
            }}
          >
            {timeOfDayData.map((h, idx) => {
              const w = Math.round((h.count / maxTimeCount) * 100);
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', width: '45px', flexShrink: 0 }}>
                    {h.name}
                  </span>
                  <div className="phbar" style={{ flex: 1, height: '6px' }}>
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: animateProgress ? `${w}%` : '0%', 
                        background: 'var(--accent, #e5a83c)', 
                        transition: 'width 0.4s ease-out',
                        transitionDelay: `${idx * 20}ms`
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text)', width: '85px', textAlign: 'right', flexShrink: 0 }}>
                    {h.count} {h.count === 1 ? 'session' : 'sessions'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}