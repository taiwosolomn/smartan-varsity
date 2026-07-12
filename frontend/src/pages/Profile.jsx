import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { renderTrackIcon } from '../api';
import { useAuth, useCustomDialog } from '../App';
import { IconEdit, IconAlertCircle, IconCheck, IconAward, IconUpload, IconLogout, IconSettings } from '@tabler/icons-react';

const CIRCLE_SIZE = 280;  // px – crop circle display diameter
const OUTPUT_SIZE = 400;  // px – canvas export size

/** Format decimal hours as "X hr Y min" */
function formatHours(h) {
  const n = parseFloat(h) || 0;
  const hrs = Math.floor(n);
  const mins = Math.round((n - hrs) * 60);
  if (hrs === 0 && mins === 0) return '0 hr';
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

export default function Profile() {
  const { fetchUser, logout } = useAuth();
  const { showConfirm } = useCustomDialog();
  const navigate = useNavigate();

  // ── Data state ────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [totalHours, setTotalHours] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('mission');

  // ── Edit form state ───────────────────────────────────────────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editMission, setEditMission] = useState('');
  const [editProjectSummary, setEditProjectSummary] = useState('');
  const [editGoals, setEditGoals] = useState([]);
  const [newGoalText, setNewGoalText] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

  // ── Avatar crop state ─────────────────────────────────────────────────────
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [avatarUploading, setAvatarUploading] = useState(false);

  const fileInputRef = useRef(null);
  const imgRef = useRef(null);
  const naturalDims = useRef({ w: 0, h: 0 });

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchProfileData = async () => {
    try {
      const [userRes, tracksRes, summaryRes, logsRes, milestonesRes, streakRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/tracks/detailed'),
        api.get('/analytics/summary'),
        api.get('/logs'),
        api.get('/milestones'),
        api.get('/analytics/streak'),
      ]);
      setUser(userRes.data);
      setTracks(tracksRes.data);
      setTotalHours(summaryRes.data.totalHours || 0);
      setLogs(logsRes.data);
      setMilestones(milestonesRes.data);
      setBestStreak(streakRes.data.bestStreak || 0);
      setEditFullName(userRes.data.fullName || '');
      setEditLocation(userRes.data.location || '');
      setEditMission(userRes.data.mission || '');
      setEditProjectSummary(userRes.data.projectSummary || '');
      setEditGoals(userRes.data.goals ? [...userRes.data.goals] : []);
      setLoading(false);
      setError(false);
      setErrorMsg('');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || String(err));
      setError(true);
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfileData(); }, []);

  // ── Profile save ──────────────────────────────────────────────────────────
  const handleEditProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/auth/profile', {
        fullName: editFullName,
        location: editLocation,
        mission: editMission,
        projectSummary: editProjectSummary,
        goals: editGoals,
      });
      await fetchProfileData();
      await fetchUser();
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Goals ─────────────────────────────────────────────────────────────────
  const handleToggleGoal = async (goalIndex) => {
    if (!user) return;
    const updatedGoals = user.goals.map((g, idx) =>
      idx === goalIndex ? { ...g, completed: !g.completed } : g
    );
    try {
      setUser(prev => ({ ...prev, goals: updatedGoals }));
      await api.put('/auth/profile', { goals: updatedGoals });
      await fetchProfileData();
    } catch (err) {
      console.error('Error toggling goal', err);
    }
  };

  const handleAddGoal = () => {
    if (!newGoalText.trim()) return;
    setEditGoals(prev => [...prev, { text: newGoalText.trim(), target: newGoalTarget.trim(), completed: false }]);
    setNewGoalText('');
    setNewGoalTarget('');
  };

  const handleRemoveGoal = (index) => {
    setEditGoals(prev => prev.filter((_, idx) => idx !== index));
  };

  // ── Avatar – file selection ───────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const url = URL.createObjectURL(file);
    setPendingAvatarUrl(url);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    setShowCropModal(true);
  };

  // ── Avatar – crop & upload ────────────────────────────────────────────────
  const handleCropSave = async () => {
    if (!imgRef.current || !naturalDims.current.w) return;
    setAvatarUploading(true);
    try {
      const { w: nw, h: nh } = naturalDims.current;
      // baseScale fills the circle from the shorter edge
      const baseScale = CIRCLE_SIZE / Math.min(nw, nh);
      const totalScale = baseScale * cropZoom;

      // Source rectangle in natural-image pixels
      const sw = CIRCLE_SIZE / totalScale;
      const sh = CIRCLE_SIZE / totalScale;
      const sx = nw / 2 - cropOffset.x / totalScale - sw / 2;
      const sy = nh / 2 - cropOffset.y / totalScale - sh / 2;

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      canvas.getContext('2d').drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      const formData = new FormData();
      formData.append('file', blob, 'avatar.jpg');

      await api.post('/auth/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

      URL.revokeObjectURL(pendingAvatarUrl);
      setPendingAvatarUrl(null);
      setShowCropModal(false);
      await fetchProfileData();
      await fetchUser();
    } catch (err) {
      console.error('Avatar upload failed', err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleCropCancel = () => {
    if (pendingAvatarUrl) URL.revokeObjectURL(pendingAvatarUrl);
    setPendingAvatarUrl(null);
    setShowCropModal(false);
  };

  const handleRemoveAvatar = async () => {
    if (isRemovingAvatar) return;
    setIsRemovingAvatar(true);
    try {
      await api.delete('/auth/avatar');
      await fetchProfileData();
      await fetchUser();
    } catch (err) {
      console.error('Remove avatar failed', err);
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  // ── Drag helpers (with edge clamping) ────────────────────────────────────
  const clampedOffset = useCallback((rawX, rawY, zoom) => {
    const { w: nw, h: nh } = naturalDims.current;
    if (!nw) return { x: rawX, y: rawY };
    const baseScale = CIRCLE_SIZE / Math.min(nw, nh);
    const totalScale = baseScale * zoom;
    const maxX = Math.max(0, (nw * totalScale - CIRCLE_SIZE) / 2);
    const maxY = Math.max(0, (nh * totalScale - CIRCLE_SIZE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, rawX)),
      y: Math.max(-maxY, Math.min(maxY, rawY)),
    };
  }, []);

  const handleDragMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y });
  };

  const handleDragTouchStart = (e) => {
    const t = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: t.clientX - cropOffset.x, y: t.clientY - cropOffset.y });
  };

  const handleDragMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setCropOffset(clampedOffset(e.clientX - dragStart.x, e.clientY - dragStart.y, cropZoom));
  }, [isDragging, dragStart, cropZoom, clampedOffset]);

  const handleDragTouchMove = useCallback((e) => {
    if (!isDragging) return;
    const t = e.touches[0];
    setCropOffset(clampedOffset(t.clientX - dragStart.x, t.clientY - dragStart.y, cropZoom));
  }, [isDragging, dragStart, cropZoom, clampedOffset]);

  const handleDragEnd = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (!showCropModal) return;
    window.addEventListener('mousemove', handleDragMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragTouchMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleDragMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [showCropModal, handleDragMouseMove, handleDragTouchMove, handleDragEnd]);

  // Re-clamp offset whenever zoom changes
  useEffect(() => {
    if (naturalDims.current.w) {
      setCropOffset(prev => clampedOffset(prev.x, prev.y, cropZoom));
    }
  }, [cropZoom, clampedOffset]);

  // ── Track progress ────────────────────────────────────────────────────────
  const calculateTrackProgress = (t) => {
    let total = 0, done = 0;
    (t.courses || []).forEach(c => {
      (c.modules || []).forEach(m => {
        total++;
        if (m.status === 'completed' || m.status === 'done') done++;
      });
    });
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  // ── Computed image transform for crop preview ────────────────────────────
  const getCropImgStyle = () => {
    if (!naturalDims.current.w) return { visibility: 'hidden' };
    const { w: nw, h: nh } = naturalDims.current;
    const baseScale = CIRCLE_SIZE / Math.min(nw, nh);
    return {
      position: 'absolute',
      width: `${nw * baseScale}px`,
      height: `${nh * baseScale}px`,
      left: '50%',
      top: '50%',
      transform: `translate(calc(-50% + ${cropOffset.x}px), calc(-50% + ${cropOffset.y}px)) scale(${cropZoom})`,
      transformOrigin: 'center center',
      userSelect: 'none',
      pointerEvents: 'none',
      draggable: 'false',
    };
  };

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Urbanist, sans-serif' }}>
      <div className="card shimmer-bg" style={{ height: '192px', borderRadius: '20px' }} />
      <div style={{ display: 'flex', gap: '8px' }}>
        {[80, 60, 90].map((w, i) => (
          <div key={i} className="shimmer-bg" style={{ height: '36px', width: `${w}px`, borderRadius: '8px' }} />
        ))}
      </div>
      <div className="card shimmer-bg" style={{ height: '320px', borderRadius: '20px' }} />
    </div>
  );

  if (error || !user) return (
    <div className="card" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center' }}>
      <IconAlertCircle size={32} style={{ color: '#ef4444' }} />
      <span style={{ font: '600 14px Urbanist', color: 'var(--text-muted)' }}>Failed to load profile.</span>
      {errorMsg && <span style={{ font: '600 12px Urbanist', color: '#ef4444', textAlign: 'center', maxWidth: '300px' }}>{errorMsg}</span>}
      <button className="pillbtn" onClick={() => { setLoading(true); fetchProfileData(); }}>Retry</button>
    </div>
  );

  const avatarSrc = user.avatarUrl
    ? (user.avatarUrl.startsWith('http') ? user.avatarUrl : `${api.defaults.baseURL || ''}${user.avatarUrl.startsWith('/') ? '' : '/'}${user.avatarUrl}`)
    : null;

  // First two chars of name as initials fallback
  const initials = (user.fullName || '??').slice(0, 2).toUpperCase();

  const STATS = [
    { value: formatHours(totalHours), label: 'LOGGED' },
    { value: logs.length,             label: 'SESSIONS' },
    { value: milestones.length,        label: 'MILESTONES' },
    { value: `${bestStreak} days`,     label: 'BEST STREAK' },
  ];

  const TABS = [
    { id: 'mission',    label: 'Mission' },
    { id: 'tracks',     label: 'Tracks' },
    { id: 'milestones', label: 'Milestones', badge: milestones.length },
  ];

  // ── Shared avatar circle style ────────────────────────────────────────────
  const avatarCircle = (size, fontSize) => ({
    width: `${size}px`, height: `${size}px`, borderRadius: '50%',
    background: 'var(--phbar-bg)', overflow: 'hidden', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: `${fontSize}px`, fontWeight: 900, color: 'var(--text-muted)',
    border: '2px solid var(--card-border)',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Urbanist, sans-serif' }}>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />

      {/* ── MAIN HEADER CARD ─────────────────────────────────── */}
      <div className="card" style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        <div className="profile-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {/* Avatar + details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '22px', minWidth: 0, width: '100%' }}>
            {/* Clickable avatar */}
            <div
              onClick={() => fileInputRef.current?.click()}
              title="Click to change avatar"
              style={{ ...avatarCircle(76, 22), cursor: 'pointer', position: 'relative', flexShrink: 0 }}
            >
              {avatarSrc
                ? <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
              {/* Hover overlay hint */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}
              >
                <IconUpload size={18} style={{ color: '#fff' }} />
              </div>
            </div>

            {/* Name / tagline / mission badge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
              <h2 style={{ font: '900 25px/1.15 Urbanist', color: 'var(--text)', margin: 0, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{user.fullName}</h2>
              <p style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', margin: 0, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {user.location || 'No tagline set.'}
              </p>
              {user.mission && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  marginTop: '5px', padding: '5px 13px', borderRadius: '99px',
                  background: 'rgba(229,168,60,0.10)', color: '#b07d18',
                  font: '700 12px Urbanist', width: 'fit-content',
                  border: '1px solid rgba(229,168,60,0.18)',
                }}>
                  ⚡ {user.mission}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="profile-action-buttons" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              id="profile-edit-btn"
              onClick={() => setShowEditModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '10px 20px', borderRadius: '99px',
                background: 'var(--text)', color: 'var(--card-bg)',
                font: '800 13px Urbanist', border: 'none', cursor: 'pointer',
                minHeight: '40px'
              }}
            >
              <IconEdit size={14} strokeWidth={2.5} />
              Edit details
            </button>
            <button
              id="profile-settings-btn"
              onClick={() => navigate('/settings')}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '10px 20px', borderRadius: '99px',
                background: 'transparent', color: 'var(--text)',
                font: '800 13px Urbanist',
                border: '1.5px solid var(--input-border)', cursor: 'pointer',
                minHeight: '40px'
              }}
            >
              <IconSettings size={14} strokeWidth={2.5} />
              Settings
            </button>
            <button
              id="profile-logout-btn"
              onClick={async () => {
                const confirmLogout = await showConfirm("Log out of Smartan Varsity?", "Log Out");
                if (confirmLogout) {
                  logout();
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '10px 20px', borderRadius: '99px',
                background: 'transparent', color: '#ef4444',
                font: '800 13px Urbanist',
                border: '1.5px solid rgba(239, 68, 68, 0.4)', cursor: 'pointer',
                minHeight: '40px'
              }}
            >
              <IconLogout size={14} strokeWidth={2.5} />
              Logout
            </button>
          </div>
        </div>

        {/* Stats row – inline */}
        <div className="profile-stats-row" style={{ display: 'flex', gap: '44px' }}>
          {STATS.map((stat, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ font: '900 21px/1.1 Urbanist', color: 'var(--text)' }}>{stat.value}</span>
              <span style={{ font: '600 10px Urbanist', color: 'var(--text-muted)', letterSpacing: '0.7px', textTransform: 'uppercase' }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS BAR ──────────────────────────────────────────── */}
      <div className="profile-tabs-bar" style={{ display: 'flex', borderBottom: '1.5px solid var(--input-border)', paddingLeft: '2px' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`profile-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'transparent', border: 'none',
              borderBottom: activeTab === tab.id ? '2.5px solid var(--text)' : '2.5px solid transparent',
              marginBottom: '-1.5px',
              color: activeTab === tab.id ? 'var(--text)' : 'var(--text-muted)',
              padding: '10px 18px',
              font: `${activeTab === tab.id ? '800' : '600'} 14px Urbanist`,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '18px', height: '18px', borderRadius: '99px', padding: '0 4px',
                background: 'var(--phbar-bg)', color: 'var(--text-muted)', font: '700 11px Urbanist',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ───────────────────────────────────────── */}
      <div>

        {/* MISSION TAB */}
        {activeTab === 'mission' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div className="card" style={{ padding: '28px 32px 28px 24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: '10px', left: '16px',
                font: '900 72px Georgia, serif', color: 'var(--input-border)',
                lineHeight: 1, userSelect: 'none', pointerEvents: 'none', opacity: 0.7,
              }}>"</div>
              <div style={{ paddingLeft: '32px' }}>
                <p style={{ font: '700 10px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.9px', margin: '0 0 10px 0' }}>
                  MISSION STATEMENT
                </p>
                <p style={{ font: '800 22px/1.35 Urbanist', color: 'var(--text)', margin: 0 }}>
                  "{user.mission || 'No mission set yet.'}"
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '16px' }}>
              {/* Goals card */}
              <div className="card" style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ font: '700 10px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.9px', margin: 0 }}>
                  ACTIVE GOALS
                </p>
                {(!user.goals || user.goals.length === 0) ? (
                  <span style={{ font: '600 13px Urbanist', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No goals set. Add them via Edit details.
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                    {user.goals.map((g, idx) => (
                      <div key={idx} onClick={() => handleToggleGoal(idx)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                          <div style={{
                            width: '15px', height: '15px', flexShrink: 0, borderRadius: '3px',
                            border: `1.5px solid ${g.completed ? '#10b981' : 'var(--text-muted)'}`,
                            background: g.completed ? '#10b981' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {g.completed && <IconCheck size={9} strokeWidth={3.5} style={{ color: '#fff' }} />}
                          </div>
                          <span style={{
                            font: '700 13.5px Urbanist',
                            color: g.completed ? 'var(--text-muted)' : 'var(--text)',
                            textDecoration: g.completed ? 'line-through' : 'none',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {g.text}
                          </span>
                        </div>
                        {g.target && (
                          <span style={{ font: '600 11.5px Urbanist', color: 'var(--text-muted)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                            {g.target}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Project card */}
              <div className="card" style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ font: '700 10px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.9px', margin: 0 }}>
                  PROJECT
                </p>
                {user.projectSummary ? (
                  <p style={{ font: '600 13.5px/1.55 Urbanist', color: 'var(--text-muted)', margin: 0 }}>{user.projectSummary}</p>
                ) : (
                  <span style={{ font: '600 13px Urbanist', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No project summary set. Add one via Edit details.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TRACKS TAB */}
        {activeTab === 'tracks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tracks.length > 0 ? (
              [...tracks].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(t => {
                const p = calculateTrackProgress(t);
                return (
                  <div key={t.id} onClick={() => navigate(`/tracks/${t.id}`)} style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px',
                    background: 'var(--card-bg)', borderRadius: '16px',
                    border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)',
                    borderLeft: `4px solid ${t.color}`, cursor: 'pointer',
                    transition: 'opacity 0.15s, box-shadow 0.15s',
                  }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      background: `${t.color}18`, color: t.color,
                      display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
                      overflow: 'hidden'
                    }}>
                      {renderTrackIcon(t, 22, { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' })}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '800 15px Urbanist', color: 'var(--text)' }}>{t.name}</div>
                      <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {t.phase} · {t.courses?.length || 0} courses · {p.done}/{p.total} modules done
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end', minWidth: '110px' }}>
                      <span style={{ font: '800 13px Urbanist', color: 'var(--text)' }}>{p.pct}%</span>
                      <div style={{ width: '96px', background: 'var(--phbar-bg)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${p.pct}%`, height: '100%', background: t.color, borderRadius: '3px' }} />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', font: '700 14px Urbanist' }}>
                No tracks registered yet. Go to the Tracks page to create one.
              </div>
            )}
          </div>
        )}

        {/* MILESTONES TAB */}
        {activeTab === 'milestones' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {milestones.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', font: '700 14px Urbanist' }}>
                No milestones recorded yet.
              </div>
            ) : (
              milestones.map((m, idx) => (
                <div key={m.id || idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)', borderRadius: '14px', boxShadow: 'var(--card-shadow)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%',
                      background: '#f59e0b18', color: '#f59e0b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <IconAward size={17} />
                    </div>
                    <div>
                      <div style={{ font: '800 13.5px Urbanist', color: 'var(--text)' }}>{m.name}</div>
                      {m.trackName && <div style={{ font: '600 11px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>{m.trackName}</div>}
                    </div>
                  </div>
                  <span style={{ font: '600 11.5px Urbanist', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {m.date ? (() => {
                      try {
                        const d = new Date(m.date);
                        return isNaN(d.getTime()) ? m.date : d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
                      } catch (e) {
                        return m.date || '—';
                      }
                    })() : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── EDIT PROFILE MODAL ────────────────────────────────── */}
      {showEditModal && (
        <div className="scrim" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '480px', maxWidth: '92%' }}>
            <div className="modal-header">
              <span className="modal-title">Edit Profile Details</span>
              <span className="modal-close" onClick={() => setShowEditModal(false)}>×</span>
            </div>
            <form onSubmit={handleEditProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* ── Avatar section ── */}
              <div>
                <label className="flabel">AVATAR</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '8px' }}>
                  {/* Preview circle */}
                  <div style={avatarCircle(80, 22)}>
                    {avatarSrc
                      ? <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initials
                    }
                  </div>
                  {/* Change / Remove buttons */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '9px 18px', borderRadius: '99px',
                        background: 'var(--card-bg)', color: 'var(--text)',
                        font: '700 13px Urbanist',
                        border: '1.5px solid var(--input-border)', cursor: 'pointer',
                      }}
                    >
                      <IconUpload size={14} strokeWidth={2} />
                      Change
                    </button>
                    {user.avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={isRemovingAvatar}
                        style={{
                          padding: '9px 18px', borderRadius: '99px',
                          background: 'transparent', color: '#ef4444',
                          font: '700 13px Urbanist',
                          border: '1.5px solid rgba(239,68,68,0.25)',
                          cursor: isRemovingAvatar ? 'not-allowed' : 'pointer',
                          opacity: isRemovingAvatar ? 0.6 : 1,
                        }}
                      >
                        {isRemovingAvatar ? 'Removing…' : 'Remove'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="flabel">FULL NAME</label>
                <input type="text" className="field" value={editFullName} onChange={e => setEditFullName(e.target.value)} required />
              </div>
              <div>
                <label className="flabel">TAGLINE / LOCATION</label>
                <input type="text" className="field" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="e.g. Lagos, Nigeria" />
              </div>
              <div>
                <label className="flabel">MISSION STATEMENT</label>
                <input type="text" className="field" value={editMission} onChange={e => setEditMission(e.target.value)} placeholder="e.g. Dangerous at 23." />
              </div>
              <div>
                <label className="flabel">PROJECT SUMMARY</label>
                <textarea className="field" style={{ height: '80px', resize: 'vertical' }} value={editProjectSummary} onChange={e => setEditProjectSummary(e.target.value)} placeholder="Summary of what you are building..." />
              </div>

              {/* Goals editor */}
              <div>
                <label className="flabel">MILESTONE GOALS</label>
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '6px',
                  maxHeight: '140px', overflowY: 'auto', marginBottom: '8px',
                  padding: '6px', background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)', borderRadius: '8px',
                }}>
                  {editGoals.length === 0
                    ? <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '2px 4px' }}>No goals defined.</span>
                    : editGoals.map((g, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--page)', padding: '5px 10px', borderRadius: '6px' }}>
                        <span style={{ font: '700 12px Urbanist', color: 'var(--text)' }}>
                          {g.text}{g.target ? ` — ${g.target}` : ''}
                        </span>
                        <button type="button" onClick={() => handleRemoveGoal(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', fontWeight: 900, lineHeight: 1 }}>×</button>
                      </div>
                    ))
                  }
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" className="field" placeholder="Goal text..." value={newGoalText} onChange={e => setNewGoalText(e.target.value)} style={{ flex: 2 }} />
                  <input type="text" className="field" placeholder="Target (e.g. Dec 2026)" value={newGoalTarget} onChange={e => setNewGoalTarget(e.target.value)} style={{ flex: 1 }} />
                  <button type="button" className="pillbtn" onClick={handleAddGoal} style={{ height: '40px', flexShrink: 0 }}>Add</button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '6px' }}>
                <button type="button" className="ghostpill" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="pillbtn" disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CROP / ADJUST MODAL ───────────────────────────────── */}
      {showCropModal && pendingAvatarUrl && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.82)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            background: '#1a1a22', borderRadius: '22px', padding: '36px 36px 32px',
            width: '440px', maxWidth: '94vw',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h3 style={{ font: '800 20px Urbanist', color: '#fff', margin: 0 }}>Adjust Profile Picture</h3>
              <button onClick={handleCropCancel} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
            <p style={{ font: '400 13px/1.55 Urbanist', color: '#777', margin: '0 0 26px' }}>
              Drag the image to position, and use the zoom slider to crop.
            </p>

            {/* Circle crop preview */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
              <div
                onMouseDown={handleDragMouseDown}
                onTouchStart={handleDragTouchStart}
                style={{
                  width: `${CIRCLE_SIZE}px`, height: `${CIRCLE_SIZE}px`,
                  borderRadius: '50%', overflow: 'hidden', position: 'relative',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  border: '3px solid #e6a820',
                  boxShadow: '0 0 0 1px rgba(230,168,32,0.25), 0 10px 40px rgba(0,0,0,0.5)',
                  userSelect: 'none', background: '#111',
                }}
              >
                <img
                  ref={imgRef}
                  src={pendingAvatarUrl}
                  alt="crop"
                  onLoad={() => {
                    if (imgRef.current) {
                      naturalDims.current = { w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight };
                      // Trigger re-render so getCropImgStyle picks up dims
                      setCropZoom(z => z);
                    }
                  }}
                  style={getCropImgStyle()}
                  draggable={false}
                />
              </div>
            </div>

            {/* Zoom slider */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ font: '700 10px Urbanist', color: '#777', textTransform: 'uppercase', letterSpacing: '0.8px' }}>ZOOM SCALE</span>
                <span style={{ font: '700 12px Urbanist', color: '#e6a820' }}>{Math.round(cropZoom * 100)}%</span>
              </div>
              <input
                type="range" min="1" max="3" step="0.01"
                value={cropZoom}
                onChange={e => setCropZoom(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#e6a820', cursor: 'pointer', height: '4px' }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCropCancel}
                style={{
                  padding: '12px 24px', borderRadius: '99px',
                  background: 'transparent', color: '#bbb',
                  font: '700 14px Urbanist', border: '1.5px solid #444', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCropSave}
                disabled={avatarUploading}
                style={{
                  padding: '12px 28px', borderRadius: '99px',
                  background: '#e6a820', color: '#000',
                  font: '800 14px Urbanist', border: 'none', cursor: 'pointer',
                  opacity: avatarUploading ? 0.7 : 1, transition: 'opacity 0.15s',
                }}
              >
                {avatarUploading ? 'Uploading…' : 'Crop & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}