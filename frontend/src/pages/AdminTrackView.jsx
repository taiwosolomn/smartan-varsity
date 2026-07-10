import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { renderTrackIcon, formatDuration } from '../api';
import TrackIconRenderer from '../components/TrackIconRenderer.jsx';
import { 
  IconArrowLeft, IconChevronDown, IconBook, IconPlayerPlay, IconBolt, IconTools, IconCheckbox, IconFile, IconCalendar, IconLoader, IconAlertCircle
} from '@tabler/icons-react';

export default function AdminTrackView() {
  const { id: studentId, trackId } = useParams();
  const navigate = useNavigate();
  
  const [track, setTrack] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Collapsed sections (courseId -> boolean)
  const [collapsedCourses, setCollapsedCourses] = useState({});
  const [expandedModules, setExpandedModules] = useState({});

  const fetchTrackData = async (retryCount = 0) => {
    try {
      const [trackRes, sessionsRes] = await Promise.all([
        api.get(`/admin/smartans/${studentId}/tracks/${trackId}`, { timeout: 10000 }),
        api.get(`/admin/smartans/${studentId}/sessions`, { timeout: 10000 })
      ]);
      
      setTrack(trackRes.data);
      
      // Filter logs by this track
      const allLogs = sessionsRes.data?.logs || [];
      const trackLogs = allLogs.filter(l => l.trackId === trackId);
      setLogs(trackLogs);
      
      // Initialize all courses as expanded
      const collapses = {};
      (trackRes.data?.courses || []).forEach(c => { collapses[c.id] = false; });
      setCollapsedCourses(collapses);

      setLoading(false);
      setError(false);
    } catch (err) {
      console.error(err);
      if (retryCount < 2) {
        setTimeout(() => fetchTrackData(retryCount + 1), (retryCount + 1) * 1000);
      } else {
        setError(true);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchTrackData();
  }, [studentId, trackId]);

  const calculateTrackProgress = () => {
    if (!track) return { total: 0, done: 0, pct: 0 };
    let total = 0;
    let done = 0;
    (track.courses || []).forEach(c => {
      total += (c.modules || []).length;
      done += (c.modules || []).filter(m => m.status === 'done' || m.status === 'completed').length;
    });
    return {
      total,
      done,
      pct: total ? Math.round((done / total) * 100) : 0
    };
  };

  const getCourseProgress = (course) => {
    const total = (course.modules || []).length;
    const done = (course.modules || []).filter(m => m.status === 'done' || m.status === 'completed').length;
    return {
      total,
      done,
      pct: total ? Math.round((done / total) * 100) : 0
    };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        <IconLoader size={36} className="spin" />
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="card" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center', fontFamily: 'Urbanist, sans-serif' }}>
        <IconAlertCircle size={32} style={{ color: '#ef4444' }} />
        <span style={{ font: '600 14px Urbanist', color: 'var(--text-muted)' }}>Failed to load track details.</span>
        <button className="pillbtn" onClick={() => { setLoading(true); fetchTrackData(); }} style={{ padding: '8px 16px', fontSize: '13px' }}>Retry</button>
      </div>
    );
  }

  const p = calculateTrackProgress();
  const totalHours = (logs.reduce((acc, l) => acc + l.duration, 0) / 60).toFixed(1);
  const ratings = logs.map(l => l.rating);
  const avgRating = ratings.length ? (ratings.reduce((x, y) => x + y, 0) / ratings.length).toFixed(1) : '0';

  // SVG Line Chart points calculation for Progress tab
  let chartPath = '';
  let chartPoints = [];
  const chartHeight = 100;
  const chartWidth = 400;
  
  if (logs.length > 1) {
    // Sort logs chronologically for chart plotting
    const sortedLogs = [...logs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const maxLogs = sortedLogs.slice(-10); // plot last 10 logs
    const xStep = chartWidth / (maxLogs.length - 1);
    
    chartPoints = maxLogs.map((l, index) => {
      const x = index * xStep;
      const y = chartHeight - ((l.rating - 1) / 9) * (chartHeight - 20) - 10;
      return { x, y, rating: l.rating, date: l.date };
    });
    
    chartPath = chartPoints.reduce((path, pt, index) => {
      return path + (index === 0 ? 'M' : 'L') + ' ' + pt.x + ' ' + pt.y;
    }, '');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'Urbanist, sans-serif' }}>
      
      {/* HEADER HERO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          onClick={() => navigate(`/admin/smartans/${studentId}`)}
          style={{ 
            background: 'var(--input-bg)', 
            border: '1px solid var(--input-border)', 
            color: 'var(--text-muted)', 
            width: '36px', 
            height: '36px', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer' 
          }}
        >
          <IconArrowLeft size={16} />
        </button>
        <span style={{ font: '900 12px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Back to student details
        </span>
      </div>

      <div className="track-hero" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '50%', 
              background: `${track.color}18`, 
              color: track.color, 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              overflow: 'hidden'
            }}>
              <TrackIconRenderer track={track} size={36} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ font: '900 24px Urbanist', color: 'var(--text)', margin: 0 }}>{track.name}</h2>
                <span style={{ 
                  background: `${track.color}15`, 
                  color: track.color || 'var(--accent)', 
                  border: `1px solid ${track.color}30`, 
                  borderRadius: '99px', 
                  padding: '2px 10px', 
                  fontSize: '11px',
                  fontWeight: 900
                }}>
                  {track.phase || 'Phase I'}
                </span>
              </div>
              <p style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', margin: 0 }}>
                Read-only observation of student's track syllabus and progress.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <span style={{ font: '900 13px Urbanist', color: 'var(--text-muted)' }}>Progress: {p.pct}%</span>
            <div style={{ width: '200px', height: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ width: `${p.pct}%`, height: '100%', background: track.color || 'var(--accent)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--rail-border)', marginBottom: '4px' }}>
        <button 
          className={`tabx ${activeTab === 'overview' ? 'on' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Modules
        </button>
        <button 
          className={`tabx ${activeTab === 'progress' ? 'on' : ''}`}
          onClick={() => setActiveTab('progress')}
        >
          Progress
        </button>
        <button 
          className={`tabx ${activeTab === 'log' ? 'on' : ''}`}
          onClick={() => setActiveTab('log')}
        >
          Log
        </button>
      </div>

      {/* MODULES TAB PANEL */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {(track.courses || []).length === 0 ? (
            <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No courses found in this track.
            </div>
          ) : (
            (track.courses || []).map((course) => {
              const isCollapsed = !!collapsedCourses[course.id];
              const cp = getCourseProgress(course);
              const courseModules = course.modules || [];
              
              return (
                <div key={course.id} className="course-card-block">
                  {/* Course Header Bar */}
                  <div 
                    onClick={() => setCollapsedCourses(prev => ({ ...prev, [course.id]: !isCollapsed }))}
                    className="course-card-header"
                    style={{ 
                      borderBottom: !isCollapsed ? '1px solid var(--rail-border)' : 'none'
                    }}
                  >
                    <div>
                      <h3 className="course-card-title" style={{ margin: 0 }}>{course.name}</h3>
                      <div className="course-card-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '3px' }}>
                        <span>{cp.done} of {cp.total} modules complete</span>
                        {course.deadline && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent, #E5A83C)', fontWeight: 700 }}>
                            <IconCalendar size={12} />
                            Due: {new Date(course.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                          </span>
                        )}
                      </div>
                      <div className="phbar" style={{ width: '140px', marginTop: '6px' }}>
                        <div className="progress-fill" style={{ width: `${cp.pct}%`, background: track.color }}></div>
                      </div>
                    </div>
                    
                    <div className="course-card-controls">
                      <button className="iconbtn" style={{ width: '32px', height: '32px' }}>
                        <IconChevronDown 
                          size={16} 
                          style={{ 
                            transform: !isCollapsed ? 'rotate(180deg)' : 'none', 
                            transition: 'transform 0.2s' 
                          }} 
                        />
                      </button>
                    </div>
                  </div>

                  {/* Modules list content */}
                  {!isCollapsed && (
                    <div className="course-card-body" style={{ display: 'flex', flexDirection: 'column' }}>
                      {courseModules.length === 0 ? (
                        <div style={{ padding: '20px 24px', color: 'var(--text-muted)', fontStyle: 'italic', font: '600 13px Urbanist' }}>
                          No modules in this course.
                        </div>
                      ) : (
                        courseModules.map((m) => {
                          const isExpanded = expandedModules[m.id] === true;
                          return (
                            <div key={m.id} style={{ borderBottom: '1px solid var(--rail-border)' }}>
                              <div 
                                className="module-row-item"
                                onClick={() => setExpandedModules(prev => ({ ...prev, [m.id]: !isExpanded }))}
                                style={{ cursor: 'pointer', borderBottom: 'none' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, marginRight: '16px' }}>
                                  <div className="module-row-icon-wrap" style={{ flexShrink: 0 }}>
                                    {m.type === 'reading' && <IconBook size={16} />}
                                    {m.type === 'video' && <IconPlayerPlay size={16} />}
                                    {m.type === 'drill' && <IconBolt size={16} />}
                                    {m.type === 'project' && <IconTools size={16} />}
                                    {m.type === 'assessment' && <IconCheckbox size={16} />}
                                    {m.type === 'note' && <IconFile size={16} />}
                                  </div>
                                  
                                  <div className="module-row-info" style={{ flex: 1, minWidth: 0, marginLeft: '12px' }}>
                                    <div className="module-row-title" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', font: '700 14px Urbanist', color: 'var(--text)' }}>
                                      {m.deadline && (
                                        <span 
                                          style={{
                                            font: '800 11px Urbanist',
                                            color: 'var(--accent, #E5A83C)',
                                            background: 'rgba(229, 168, 60, 0.08)',
                                            border: '1px solid rgba(229, 168, 60, 0.18)',
                                            borderRadius: '4px',
                                            padding: '2px 6px',
                                            marginRight: '4px',
                                            textTransform: 'uppercase',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            flexShrink: 0
                                          }}
                                        >
                                          <IconCalendar size={10} />
                                          {m.day ? `${m.day.slice(0, 3)}, ` : ''}
                                          {new Date(m.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                                        </span>
                                      )}
                                      <span>
                                        {m.deadline
                                          ? m.title.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*[-•|:—]?\s*/i, '')
                                          : m.title}
                                      </span>
                                    </div>
                                    <div className="module-row-type" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>
                                      <span>{m.type}</span>
                                      <span style={{ fontSize: '9px', opacity: 0.5, fontStyle: 'italic', textTransform: 'none' }}>
                                        · {isExpanded ? 'Click to collapse' : 'Click to expand'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                  {m.day && (
                                    <span 
                                      style={{ 
                                        font: '800 11px Urbanist', 
                                        color: 'var(--text-muted)', 
                                        textTransform: 'uppercase', 
                                        letterSpacing: '0.5px',
                                        marginRight: '4px'
                                      }}
                                    >
                                      {m.day}
                                    </span>
                                  )}
                                  {m.status === 'done' || m.status === 'completed' ? (
                                    <span className="module-row-status done">✓ Done</span>
                                  ) : m.status === 'inprogress' ? (
                                    <span className="module-row-status inprogress">In progress</span>
                                  ) : (
                                    <span className="module-row-status todo">To do</span>
                                  )}
                                </div>
                              </div>

                              {isExpanded && (
                                <div style={{ padding: '0 24px 16px 72px', font: '600 13px/1.6 Urbanist', color: 'var(--text-muted)' }}>
                                  <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '6px' }}>Full Task Description:</div>
                                  <div style={{ background: 'var(--input-bg)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--input-border)', color: 'var(--text)' }}>
                                    {m.task || m.description || "No description provided."}
                                  </div>
                                  {m.notes && (
                                    <div style={{ marginTop: '12px' }}>
                                      <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '4px' }}>Study Notes:</div>
                                      <div style={{ fontStyle: 'italic' }}>{m.notes}</div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* PROGRESS TAB PANEL */}
      {activeTab === 'progress' && (
        <div>
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            <div className="stat-box">
              <span className="stat-box-val">{p.pct}%</span>
              <span className="stat-box-lbl">COMPLETE</span>
            </div>
            <div className="stat-box">
              <span className="stat-box-val">{totalHours}h</span>
              <span className="stat-box-lbl">INVESTED</span>
            </div>
            <div className="stat-box">
              <span className="stat-box-val">{avgRating}<span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/10</span></span>
              <span className="stat-box-lbl">AVG MASTERY</span>
            </div>
            <div className="stat-box">
              <span className="stat-box-val">{logs.length}</span>
              <span className="stat-box-lbl">SESSIONS</span>
            </div>
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <span className="lbl" style={{ marginBottom: '16px' }}>Mastery trend</span>
              <div style={{ width: '100%', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {logs.length > 1 ? (
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <line x1="0" y1="10" x2={chartWidth} y2="10" stroke="var(--phbar-bg)" strokeWidth="1" strokeDasharray="3" />
                    <line x1="0" y1="50" x2={chartWidth} y2="50" stroke="var(--phbar-bg)" strokeWidth="1" strokeDasharray="3" />
                    <line x1="0" y1="90" x2={chartWidth} y2="90" stroke="var(--phbar-bg)" strokeWidth="1" strokeDasharray="3" />
                    
                    <path d={chartPath} fill="none" stroke={track.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    
                    {chartPoints.map((pt, i) => (
                      <g key={i}>
                        <circle cx={pt.x} cy={pt.y} r="5" fill={track.color} stroke="var(--card-bg)" strokeWidth="1.5" />
                        <text x={pt.x} y={pt.y - 10} textAnchor="middle" fill="var(--text)" fontSize="9" fontWeight="800" fontFamily="Urbanist">
                          {pt.rating}
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
                    Log more sessions to generate trend line.
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center', font: '600 11px Urbanist', color: 'var(--text-muted)', marginTop: '10px' }}>
                Last 10 sessions — going up and to the right.
              </div>
            </div>

            <div className="card">
              <span className="lbl" style={{ marginBottom: '16px' }}>By course</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(track.courses || []).map(c => {
                  const cp = getCourseProgress(c);
                  return (
                    <div key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
                        <span>{c.name}</span>
                        <span>{cp.pct}%</span>
                      </div>
                      <div className="phbar">
                        <div className="progress-fill" style={{ width: `${cp.pct}%`, background: track.color }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOG TAB PANEL */}
      {activeTab === 'log' && (
        <div>
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--rail-border)', marginTop: '16px' }}>
            {logs.length > 0 ? (
              logs.map(l => (
                <div key={l.id} className="activity-row" style={{ cursor: 'default' }}>
                  <div className="activity-row-icon" style={{ background: `${track.color}15`, color: track.color, overflow: 'hidden' }}>
                    {renderTrackIcon(track, 16, { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' })}
                  </div>
                  
                  <div className="activity-row-details">
                    <div className="activity-row-title">{l.topic}</div>
                    <div className="activity-row-subtitle">
                      {new Date(l.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {l.notes && ' · ' + l.notes}
                    </div>
                  </div>

                  <div className="activity-row-side">
                    <div className="activity-row-rating">⭐ {l.rating}/10</div>
                    <div className="activity-row-dur">{formatDuration(l.duration)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0', fontSize: '14px', fontWeight: 600 }}>
                No study sessions logged for this track.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
