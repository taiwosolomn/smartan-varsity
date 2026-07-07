import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { renderTrackIcon, API_URL } from '../api';
import TrackIconPicker from '../components/TrackIconPicker.jsx';
import TrackIconRenderer from '../components/TrackIconRenderer.jsx';
import { IconPlus, IconLayoutGrid, IconList, IconX, IconUpload, IconChevronRight } from '@tabler/icons-react';

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

// Reusable Open Track Button with dynamic colors and borders on hover
function OpenTrackButton({ track, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Open ${track.name} track`}
      style={{
        width: '100%',
        height: '38px',
        borderRadius: '8px',
        background: hovered ? 'var(--card-hover-bg, rgba(255,255,255,0.06))' : 'var(--input-bg)',
        color: 'var(--text)',
        font: '800 13px Urbanist',
        border: `1.5px solid ${track.color}${hovered ? '99' : '22'}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      Open track
    </button>
  );
}

// Reusable hoverable Add A New Track dashed placeholder card
function NewTrackPlaceholderCard({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="track-card"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: '2px dashed var(--input-border)',
        borderRadius: '14px',
        background: hovered ? 'var(--input-bg)' : 'var(--card-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        minHeight: '348px', // matches other track cards exactly
        cursor: 'pointer',
        boxShadow: 'none',
        transition: 'all 0.15s ease',
        textAlign: 'center'
      }}
    >
      <span 
        style={{ 
          fontSize: '32px', 
          color: hovered ? 'var(--text)' : 'var(--text-muted)', 
          display: 'inline-block',
          transition: 'transform 0.2s, color 0.2s',
          transform: hovered ? 'rotate(90deg)' : 'none',
          lineHeight: 1,
          marginBottom: '12px'
        }}
      >
        +
      </span>
      <div 
        style={{ 
          fontSize: '12px', 
          fontWeight: 800, 
          color: hovered ? 'var(--text)' : 'var(--text-muted)', 
          textTransform: 'uppercase', 
          letterSpacing: '0.8px',
          transition: 'color 0.2s'
        }}
      >
        Add a new track
      </div>
    </div>
  );
}

// LocalStorage-backed client-side cache variables for tracks
let tracksCache = null;
let tracksCacheTimestamp = 0;

try {
  const cachedVal = localStorage.getItem('sv_tracks_cache');
  const cachedTime = localStorage.getItem('sv_tracks_cache_timestamp');
  if (cachedVal && cachedTime) {
    tracksCache = JSON.parse(cachedVal);
    tracksCacheTimestamp = parseInt(cachedTime, 10);
  }
} catch (e) {
  console.warn("Failed to load tracks cache from localStorage", e);
}

export default function Tracks() {
  const [tracks, setTracks] = useState(tracksCache || []);
  const [loading, setLoading] = useState(!tracksCache);
  const [filter, setFilter] = useState('all'); // all, active, complete
  const [view, setView] = useState('grid'); // grid, list
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTrackName, setNewTrackName] = useState('');
  // iconState: { type: 'emoji'|'image'|'library', value: string, imageUrl?: string, thumbUrl?: string }
  const [newIconState, setNewIconState] = useState({ type: 'emoji', value: '🧠', imageUrl: null, thumbUrl: null });
  const [newTrackColor, setNewTrackColor] = useState('#C25A3A');
  const [newTrackPhase, setNewTrackPhase] = useState('Phase I');

  // Validation & shake animations
  const [valErrors, setValErrors] = useState({ name: '', color: '', icon: '', combined: '' });
  const [shakeName, setShakeName] = useState(false);
  const [shakeColor, setShakeColor] = useState(false);
  const [shakeIcon, setShakeIcon] = useState(false);

  // Hover/focus tracking for accessibility rings
  const [hoveredTrackId, setHoveredTrackId] = useState(null);
  const [focusedTrackId, setFocusedTrackId] = useState(null);
  
  const navigate = useNavigate();

  const fetchTracks = async (forceRefresh = false) => {
    const now = Date.now();

    // Re-validate in-memory cache against localStorage (cleared on logout)
    if (tracksCache && !localStorage.getItem('sv_tracks_cache')) {
      tracksCache = null;
      tracksCacheTimestamp = 0;
    }

    const hasValidCache = tracksCache && (now - tracksCacheTimestamp < 60000); // 60 seconds
    
    if (tracksCache && !forceRefresh) {
      setTracks(tracksCache);
      setLoading(false);
      
      if (!hasValidCache) {
        api.get('/tracks/detailed')
          .then(res => {
            tracksCache = res.data;
            tracksCacheTimestamp = Date.now();
            try {
              localStorage.setItem('sv_tracks_cache', JSON.stringify(res.data));
              localStorage.setItem('sv_tracks_cache_timestamp', tracksCacheTimestamp.toString());
            } catch (e) {}
            setTracks(res.data);
          })
          .catch(err => console.error("Silent tracks refresh failed", err));
      }
      return;
    }

    if (!tracksCache) {
      setLoading(true);
    }
    
    try {
      const res = await api.get('/tracks/detailed');
      tracksCache = res.data;
      tracksCacheTimestamp = Date.now();
      try {
        localStorage.setItem('sv_tracks_cache', JSON.stringify(res.data));
        localStorage.setItem('sv_tracks_cache_timestamp', tracksCacheTimestamp.toString());
      } catch (e) {}
      setTracks(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  const calculateTrackProgress = (track) => {
    let total = 0;
    let done = 0;
    if (track.courses) {
      track.courses.forEach(c => {
        if (c.modules) {
          total += c.modules.length;
          done += c.modules.filter(m => m.status === 'done').length;
        }
      });
    }
    return {
      total,
      done,
      pct: total ? Math.round((done / total) * 100) : 0
    };
  };

  const getHsl = (hex) => {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let r = parseInt(hex.substring(0, 2), 16) / 255;
    let g = parseInt(hex.substring(2, 4), 16) / 255;
    let b = parseInt(hex.substring(4, 6), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  };

  const isSimilarColor = (col1, col2) => {
    if (!col1 || !col2) return false;
    const hsl1 = getHsl(col1);
    const hsl2 = getHsl(col2);
    let hDiff = Math.abs(hsl1.h - hsl2.h);
    hDiff = Math.min(hDiff, 360 - hDiff);
    return hDiff < 15 && Math.abs(hsl1.s - hsl2.s) < 15 && Math.abs(hsl1.l - hsl2.l) < 10;
  };

  const validateFields = (name, color, emoji, excludeId = null) => {
    let errs = { name: '', color: '', emoji: '', combined: '' };
    
    // 1. Name is empty
    if (!name.trim()) {
      errs.name = 'Track name is required.';
      return errs;
    }
    
    // Clean name: case-insensitive & whitespace trimmed
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, ' ');
    const otherTracks = tracks.filter(t => t.id !== excludeId);
    
    // 2. Name already exists
    const nameExists = otherTracks.some(t => t.name.trim().toLowerCase().replace(/\s+/g, ' ') === cleanName);
    if (nameExists) {
      errs.name = `You already have a track called '${name.trim()}'. Choose a different name.`;
      return errs;
    }

    // 5. Colour AND emoji match (highest precedence check for combined collision)
    const combinedMatch = otherTracks.find(t => (t.color.toLowerCase() === color.toLowerCase() || isSimilarColor(color, t.color)) && t.icon === emoji);
    if (combinedMatch) {
      errs.combined = `This combination is identical to ${combinedMatch.name}. Change at least one.`;
      return errs;
    }

    // 3. Colour too similar
    const colorMatch = otherTracks.find(t => t.color.toLowerCase() === color.toLowerCase() || isSimilarColor(color, t.color));
    if (colorMatch) {
      errs.color = `Colour is too close to your ${colorMatch.name} track (${colorMatch.color}).`;
      return errs;
    }

    // 4. Emoji already in use (only when emoji type)
    if (emoji && !emoji.startsWith('/') && !emoji.startsWith('http')) {
      const emojiMatch = otherTracks.find(t => t.icon === emoji);
      if (emojiMatch) {
        errs.icon = `${emoji} is already used by ${emojiMatch.name}.`;
        return errs;
      }
    }

    return errs;
  };

  const handleCreateTrack = async (e) => {
    e.preventDefault();
    const iconDisplayVal = newIconState.value || '🧠';
    const err = validateFields(newTrackName, newTrackColor, iconDisplayVal);
    setValErrors(err);
    if (err.name || err.color || err.icon || err.combined) {
      if (err.name)  { setShakeName(true);  setTimeout(() => setShakeName(false), 400); }
      if (err.color) { setShakeColor(true); setTimeout(() => setShakeColor(false), 400); }
      if (err.icon)  { setShakeIcon(true);  setTimeout(() => setShakeIcon(false), 400); }
      return;
    }

    try {
      await api.post('/tracks', {
        name:          newTrackName.trim(),
        icon:          iconDisplayVal,
        color:         newTrackColor,
        phase:         newTrackPhase,
        icon_type:     newIconState.type,
        icon_value:    iconDisplayVal,
      });
      window.dispatchEvent(new CustomEvent('show-success', {
        detail: { type: 'track_created' }
      }));
      // If it was an image, also persist image urls via PUT (after getting the id)
      // Reset state
      setNewTrackName('');
      setNewIconState({ type: 'emoji', value: '🧠', imageUrl: null, thumbUrl: null });
      setNewTrackColor('#C25A3A');
      setNewTrackPhase('Phase I');
      setValErrors({ name: '', color: '', icon: '', combined: '' });
      setIsModalOpen(false);
      fetchTracks(true);
    } catch (err) {
      if (err.response && err.response.status === 409) {
        const details = err.response.data.detail || '';
          if (details.toLowerCase().includes('name') || details.toLowerCase().includes('called')) {
            setValErrors(prev => ({ ...prev, name: 'A track with this name already exists.' }));
            setShakeName(true);
            setTimeout(() => setShakeName(false), 400);
          } else if (details.toLowerCase().includes('identical') || details.toLowerCase().includes('combination')) {
            setValErrors(prev => ({ ...prev, combined: details }));
          } else if (details.toLowerCase().includes('color') || details.toLowerCase().includes('colour')) {
            setValErrors(prev => ({ ...prev, color: details }));
            setShakeColor(true);
            setTimeout(() => setShakeColor(false), 400);
          } else if (details.toLowerCase().includes('used by') || details.toLowerCase().includes('icon') || details.toLowerCase().includes('emoji')) {
            setValErrors(prev => ({ ...prev, icon: details }));
            setShakeIcon(true);
            setTimeout(() => setShakeIcon(false), 400);
          } else {
          setValErrors(prev => ({ ...prev, name: details }));
        }
      } else {
        console.error(err);
      }
    }
  };

  // Filter logic: Active is started (>0%) and not completed (<100%)
  const filteredTracks = tracks.filter(t => {
    const p = calculateTrackProgress(t);
    if (filter === 'active') return p.pct > 0 && p.pct < 100;
    if (filter === 'complete') return p.pct === 100;
    return true;
  });

  // Dynamic count badges calculations
  const allCount = tracks.length;
  const activeCount = tracks.filter(t => {
    const p = calculateTrackProgress(t);
    return p.pct > 0 && p.pct < 100;
  }).length;
  const completeCount = tracks.filter(t => {
    const p = calculateTrackProgress(t);
    return p.pct === 100;
  }).length;

  if (loading) {
    return (
      <div className="page active" id="page-tracks">
        <style>{skeletonStyle}</style>
        
        {/* Header skeleton */}
        <div className="dashboard-header-row" style={{ marginBottom: '24px' }}>
          <div>
            <div className="skeleton-box" style={{ width: '140px', height: '28px', marginBottom: '8px' }} />
            <div className="skeleton-box" style={{ width: '220px', height: '16px' }} />
          </div>
          <div className="skeleton-box" style={{ width: '120px', height: '40px', borderRadius: '99px' }} />
        </div>

        {/* Filters skeleton */}
        <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--rail-border)', paddingBottom: '14px', marginBottom: '24px' }}>
          <div className="skeleton-box" style={{ width: '60px', height: '18px' }} />
          <div className="skeleton-box" style={{ width: '60px', height: '18px' }} />
          <div className="skeleton-box" style={{ width: '80px', height: '18px' }} />
        </div>

        {/* Tracks Grid skeleton */}
        <div className="tracks-grid">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="track-card" style={{ minHeight: '348px' }}>
              <div className="skeleton-box" style={{ width: '100%', height: '140px', borderRadius: '14px 14px 0 0' }} />
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="skeleton-box" style={{ width: '160px', height: '18px' }} />
                <div className="skeleton-box" style={{ width: '80px', height: '12px' }} />
                <div className="skeleton-box" style={{ width: '180px', height: '12px' }} />
                <div className="skeleton-box" style={{ width: '100%', height: '6px', borderRadius: '99px', marginTop: '4px' }} />
                <div className="skeleton-box" style={{ width: '120px', height: '38px', borderRadius: '8px', marginTop: '12px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page active" id="page-tracks">
      {/* HEADER SECTION */}
      <div className="dashboard-header-row" style={{ marginBottom: '16px' }}>
        <div>
          <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
          <h1 className="dashboard-title">Tracks</h1>
          <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
            A new lane in your grind. Name it, mark it, run it.
          </div>
        </div>
        <button className="pillbtn" onClick={() => setIsModalOpen(true)}>
          <IconPlus size={16} /> 
          <span className="hide-on-mobile">New track</span>
        </button>
      </div>

      {/* FILTER BAR AND TOGGLES */}
      <div className="filter-row-container">
        <div role="tablist" style={{ display: 'flex', gap: '24px' }}>
          <button 
            role="tab"
            aria-selected={filter === 'all'}
            className={`tabx ${filter === 'all' ? 'on' : ''}`}
            onClick={() => setFilter('all')}
          >
            All <span style={{ color: filter === 'all' ? '#C25A3A' : 'var(--text-muted)', fontSize: '11px', fontWeight: 800 }}>({allCount})</span>
          </button>
          <button 
            role="tab"
            aria-selected={filter === 'active'}
            className={`tabx ${filter === 'active' ? 'on' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active <span style={{ color: filter === 'active' ? '#C25A3A' : 'var(--text-muted)', fontSize: '11px', fontWeight: 800 }}>({activeCount})</span>
          </button>
          <button 
            role="tab"
            aria-selected={filter === 'complete'}
            className={`tabx ${filter === 'complete' ? 'on' : ''}`}
            onClick={() => setFilter('complete')}
          >
            Complete <span style={{ color: filter === 'complete' ? '#C25A3A' : 'var(--text-muted)', fontSize: '11px', fontWeight: 800 }}>({completeCount})</span>
          </button>
        </div>
        
        <div className="view-toggles" style={{ display: 'flex', gap: '8px', paddingBottom: '10px' }}>
          <button 
            className={`iconbtn ${view === 'grid' ? 'active' : ''}`}
            style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '8px', 
              border: 'none',
              background: view === 'grid' ? 'var(--text)' : 'transparent',
              color: view === 'grid' ? 'var(--page)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            onClick={() => setView('grid')}
            title="Grid view"
          >
            <IconLayoutGrid size={16} />
          </button>
          <button 
            className={`iconbtn ${view === 'list' ? 'active' : ''}`}
            style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '8px', 
              border: 'none',
              background: view === 'list' ? 'var(--text)' : 'transparent',
              color: view === 'list' ? 'var(--page)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            onClick={() => setView('list')}
            title="List view"
          >
            <IconList size={16} />
          </button>
        </div>
      </div>

      {/* TRACKS CONTAINER */}
      {filteredTracks.length > 0 ? (
        view === 'grid' ? (
          <div className="tracks-grid">
            {filteredTracks.map(t => {
              const p = calculateTrackProgress(t);
              const isHovered = hoveredTrackId === t.id;
              const isFocused = focusedTrackId === t.id;
              
              return (
                <div 
                  key={t.id} 
                  className="track-card"
                  tabIndex="0"
                  onKeyDown={e => e.key === 'Enter' && navigate(`/tracks/${t.id}`)}
                  onFocus={() => setFocusedTrackId(t.id)}
                  onBlur={() => setFocusedTrackId(null)}
                  onMouseEnter={() => setHoveredTrackId(t.id)}
                  onMouseLeave={() => setHoveredTrackId(null)}
                  style={{
                    boxShadow: isFocused ? `0 0 0 3px ${t.color}` : 'var(--card-shadow)',
                    outline: 'none'
                  }}
                >
                  {/* Colored decorative band */}
                  <div 
                    className="track-card-band" 
                    style={{ 
                      background: t.color, 
                      height: '140px',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '14px 14px 0 0'
                    }}
                    aria-hidden="true"
                  >
                    {(() => {
                      const isImage = t.icon_type === 'image' || (t.icon && (t.icon.startsWith('/') || t.icon.startsWith('http')));
                      if (isImage && t.icon) {
                        const imgUrl = t.icon.startsWith('http') ? t.icon : `${API_URL}${t.icon.startsWith('/') ? '' : '/'}${t.icon}`;
                        return (
                          <img 
                            src={imgUrl} 
                            alt={t.name} 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'cover',
                              position: 'absolute',
                              inset: 0
                            }}
                          />
                        );
                      }
                      return (
                        <TrackIconRenderer
                          track={t}
                          size={52}
                          style={{ zIndex: 1 }}
                        />
                      );
                    })()}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.3) 100%)',
                      pointerEvents: 'none',
                      zIndex: 1
                    }} />
                  </div>

                  <div className="track-card-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div className="track-card-name" style={{ font: '900 16px Urbanist', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {t.name}
                      <IconChevronRight 
                        size={16} 
                        style={{ 
                          color: 'var(--text-muted)', 
                          opacity: isHovered ? 1 : 0, 
                          transform: isHovered ? 'translateX(0)' : 'translateX(-4px)',
                          transition: 'opacity 0.2s, transform 0.2s' 
                        }} 
                      />
                    </div>
                    
                    {/* Phase label with track accent dot */}
                    <div 
                      className="track-card-phase" 
                      style={{ 
                        color: 'var(--text-muted)', 
                        opacity: 0.85, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        fontSize: '12px', 
                        fontWeight: 600, 
                        marginTop: '4px' 
                      }}
                    >
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: t.color }}></span>
                      {t.phase}
                    </div>

                    <div className="track-card-meta" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      {t.courses?.length || 0} courses · {p.done} of {p.total} modules complete
                    </div>

                    <div className="phbar" style={{ height: '6px', background: 'var(--input-bg)', marginTop: '12px', borderRadius: '999px', overflow: 'hidden' }}>
                      <div className="progress-fill" style={{ width: p.pct > 0 ? `${p.pct}%` : '4px', height: '100%', background: t.color }}></div>
                    </div>

                    <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', marginTop: '10px' }}>
                      <span style={{ color: 'var(--text)', fontWeight: 800 }}>{p.pct}%</span> complete
                    </div>

                    <div className="track-card-actions" style={{ marginTop: 'auto', paddingTop: '16px' }}>
                      <OpenTrackButton 
                        track={t} 
                        onClick={() => navigate(`/tracks/${t.id}`)} 
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* ADD A NEW TRACK PLACEHOLDER CARD */}
            <NewTrackPlaceholderCard onClick={() => setIsModalOpen(true)} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredTracks.map(t => {
              const p = calculateTrackProgress(t);
              return (
                <div 
                  key={t.id} 
                  className="track-list-item" 
                  onClick={() => navigate(`/tracks/${t.id}`)}
                  style={{ cursor: 'pointer', padding: '16px', borderRadius: '12px', transition: 'background 0.2s', border: '1px solid var(--rail-border)' }}
                >
                  <div className="track-list-band" style={{ background: `${t.color}15`, color: t.color, width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    <TrackIconRenderer track={t} size={22} />
                  </div>
                  <div className="track-list-info" style={{ marginLeft: '16px', flex: 1 }}>
                    <div className="track-list-name" style={{ font: '800 14px Urbanist', color: 'var(--text)' }}>{t.name}</div>
                    <div className="track-list-meta" style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {t.phase} · {t.courses?.length || 0} courses · {p.done} of {p.total} modules complete
                    </div>
                    <div className="phbar" style={{ width: '100%', maxWidth: '300px', height: '5px', background: 'var(--input-bg)', marginTop: '8px' }}>
                      <div className="progress-fill" style={{ width: `${p.pct}%`, background: t.color }}></div>
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)' }}>{p.pct}%</span>
                    <button 
                      className="ghostpill"
                      style={{ padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/tracks/${t.id}`);
                      }}
                      aria-label={`Open ${t.name} track`}
                    >
                      Open track
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0', fontSize: '15px', fontWeight: 600 }}>
          No tracks found in this category.
        </div>
      )}

      {/* NEW TRACK MODAL */}
      {isModalOpen && (
        <div className="scrim" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '440px' }}>
            <div className="modal-header">
              <span className="modal-title">New Track</span>
              <span className="modal-close" onClick={() => setIsModalOpen(false)}>×</span>
            </div>
            
            <form onSubmit={handleCreateTrack} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* LIVE PREVIEW CARD */}
              <div>
                <label className="flabel" style={{ marginBottom: '8px' }}>Live Preview</label>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                  <div 
                    className="track-card"
                    style={{ 
                      width: '200px', 
                      minHeight: '260px', 
                      pointerEvents: 'none', 
                      margin: 0,
                      boxShadow: 'none',
                      border: '1.5px solid var(--card-border)'
                    }}
                  >
                    <div 
                      style={{ 
                        background: newTrackColor, 
                        height: '90px', 
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '14px 14px 0 0',
                        overflow: 'hidden',
                      }}
                    >
                      {newIconState.type === 'image' && newIconState.value ? (
                        <img 
                          src={newIconState.value.startsWith('http') ? newIconState.value : `${API_URL}${newIconState.value.startsWith('/') ? '' : '/'}${newIconState.value}`}
                          alt="preview"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            position: 'absolute',
                            inset: 0
                          }}
                        />
                      ) : (
                        <TrackIconRenderer
                          track={{
                            icon: newIconState.value,
                            icon_type: newIconState.type,
                            icon_value: newIconState.value,
                            icon_image_url: newIconState.imageUrl,
                            icon_thumb_url: newIconState.thumbUrl,
                            name: newTrackName || 'Track',
                            color: newTrackColor,
                          }}
                          size={36}
                        />
                      )}
                    </div>
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ font: '800 13px Urbanist', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {newTrackName || 'Track Name'}
                      </div>
                      <div style={{ font: '600 11px Urbanist', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: newTrackColor }}></span>
                        {newTrackPhase}
                      </div>
                      <div style={{ font: '600 10.5px Urbanist', color: 'var(--text-muted)' }}>
                        0 courses · 0 of 0 complete
                      </div>
                      <div className="phbar" style={{ height: '4px', background: 'var(--input-bg)' }}>
                        <div style={{ width: '4px', height: '100%', background: newTrackColor }} />
                      </div>
                      <div style={{ font: '800 11px Urbanist', color: 'var(--text)', marginTop: '4px' }}>
                        0% complete
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TRACK NAME */}
              <div className={shakeName ? 'shake' : ''}>
                <label className="flabel">Track name</label>
                <input 
                  className="field" 
                  placeholder="e.g. Quantum Computing"
                  value={newTrackName}
                  onChange={(e) => {
                    setNewTrackName(e.target.value);
                    setValErrors(prev => ({ ...prev, name: '' }));
                  }}
                  onBlur={() => {
                    const err = validateFields(newTrackName, newTrackColor, newIconState.value);
                    setValErrors(prev => ({ ...prev, name: err.name }));
                    if (err.name) {
                      setShakeName(true);
                      setTimeout(() => setShakeName(false), 400);
                    }
                  }}
                  required
                  autoFocus
                />
                {valErrors.name && (
                  <div style={{ color: '#FF5E5E', fontSize: '12px', fontWeight: 600, marginTop: '6px' }}>
                    {valErrors.name}
                  </div>
                )}
              </div>

              {/* ICON PICKER */}
              <div className={shakeIcon ? 'shake' : ''}>
                <label className="flabel" style={{ marginBottom: '8px' }}>Choose Icon</label>
                <TrackIconPicker
                  value={newIconState}
                  onChange={setNewIconState}
                  usedIcons={tracks.map(t => ({ type: t.icon_type || 'emoji', value: t.icon_value || t.icon }))}
                  trackColor={newTrackColor}
                />
                {valErrors.icon && (
                  <div style={{ color: '#FF5E5E', fontSize: '12px', fontWeight: 600, marginTop: '6px' }}>
                    {valErrors.icon}
                  </div>
                )}
              </div>

              {/* PRESET COLORS */}
              <div className={shakeColor ? 'shake' : ''}>
                <label className="flabel">Choose Colour</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {['#C25A3A', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#f43f5e', '#14b8a6', '#06b6d4'].map(color => {
                    const isPresetInUse = tracks.some(t => t.color.toLowerCase() === color.toLowerCase() || isSimilarColor(color, t.color));
                    return (
                      <button
                        key={color}
                        type="button"
                        disabled={isPresetInUse}
                        onClick={() => {
                          if (isPresetInUse) return;
                          setNewTrackColor(color);
                          const err = validateFields(newTrackName, color, newIconState.value);
                          setValErrors(err);
                          if (err.color || err.combined) {
                            setShakeColor(true);
                            setTimeout(() => setShakeColor(false), 400);
                          }
                        }}
                        style={{
                          background: color,
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          border: newTrackColor === color ? '2.5px solid var(--text)' : 'none',
                          cursor: isPresetInUse ? 'not-allowed' : 'pointer',
                          opacity: isPresetInUse ? 0.4 : 1,
                          position: 'relative',
                          overflow: 'hidden',
                          transition: 'border 0.15s, opacity 0.15s'
                        }}
                        title={isPresetInUse ? `Colour already in use or too similar` : `Select preset`}
                      >
                        {isPresetInUse && (
                          <div style={{
                            position: 'absolute',
                            width: '100%',
                            height: '2px',
                            background: 'rgba(255,255,255,0.8)',
                            transform: 'rotate(-45deg)',
                            top: 'calc(50% - 1px)',
                            left: 0
                          }} />
                        )}
                      </button>
                    );
                  })}
                  <input 
                    type="color" 
                    value={newTrackColor}
                    onChange={(e) => {
                      setNewTrackColor(e.target.value);
                      const err = validateFields(newTrackName, e.target.value, newIconState.value);
                      setValErrors(err);
                      if (err.color || err.combined) {
                        setShakeColor(true);
                        setTimeout(() => setShakeColor(false), 400);
                      }
                    }}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer'
                    }}
                    title="Custom color"
                  />
                </div>
                {valErrors.color && (
                  <div style={{ color: '#FF5E5E', fontSize: '12px', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {(() => {
                      // Find which track conflicts to output conflicting name and small color swatch preview!
                      const conflictingTrack = tracks.find(t => t.color.toLowerCase() === newTrackColor.toLowerCase() || isSimilarColor(newTrackColor, t.color));
                      if (conflictingTrack) {
                        return (
                          <>
                            <span>This colour is too close to your <strong>{conflictingTrack.name}</strong> track</span>
                            <span style={{ 
                              display: 'inline-block', 
                              width: '12px', 
                              height: '12px', 
                              borderRadius: '50%', 
                              background: conflictingTrack.color,
                              border: '1px solid rgba(255,255,255,0.2)' 
                            }}></span>
                          </>
                        );
                      }
                      return valErrors.color;
                    })()}
                  </div>
                )}
              </div>

              {/* PHASE */}
              <div>
                <label className="flabel">Phase</label>
                <input 
                  className="field" 
                  placeholder="Phase I"
                  value={newTrackPhase}
                  onChange={(e) => setNewTrackPhase(e.target.value)}
                />
              </div>

              {/* COMBINED/GENERAL ERROR */}
              {valErrors.combined && (
                <div style={{ color: '#FF5E5E', fontSize: '12px', fontWeight: 600, marginTop: '4px', textAlign: 'center' }}>
                  {valErrors.combined}
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="ghostpill" onClick={() => {
                  setValErrors({ name: '', color: '', emoji: '', combined: '' });
                  setIsModalOpen(false);
                }}>
                  Cancel
                </button>
                <button type="submit" className="pillbtn">
                  Create track
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
