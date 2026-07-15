import React, { useState, useEffect, useRef, useCallback } from 'react';
import api, { renderActivityIcon, renderActivityText } from '../api';
import { useAuth } from '../App';
import { IconEdit, IconLoader, IconAlertCircle, IconUpload } from '@tabler/icons-react';

const CIRCLE_SIZE = 280;  // px – crop circle display diameter
const OUTPUT_SIZE = 400;  // px – canvas export size

export default function AdminProfile() {
  const { fetchUser } = useAuth();

  // Scoped loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('mission'); // mission, scope, activity
  const [showEditModal, setShowEditModal] = useState(false);

  // Edit details form state
  const [fullName, setFullName] = useState('');
  const [tagline, setTagline] = useState('');
  const [saving, setSaving] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

  // Avatar crop state — identical flow to the Smartan Profile page
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

  useEffect(() => {
    try {
      const cached = localStorage.getItem('sv_admin_profile_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        setData(parsed);
        setFullName(parsed.profile.fullName);
        setTagline(parsed.profile.mission || '');
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchProfile = async (retryCount = 0) => {
    try {
      const res = await api.get('/admin/profile', { timeout: 10000 });
      setData(res.data);
      setFullName(res.data.profile.fullName);
      setTagline(res.data.profile.mission || '');

      setLoading(false);
      setError(false);

      // Save cache
      localStorage.setItem('sv_admin_profile_cache', JSON.stringify(res.data));
    } catch (err) {
      console.error(err);
      if (retryCount < 2) {
        setTimeout(() => fetchProfile(retryCount + 1), (retryCount + 1) * 1000);
      } else {
        if (!data) setError(true);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleEditProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Optimistic profile state updates
      const updatedProfile = {
        ...data.profile,
        fullName,
        mission: tagline,
      };
      setData(prev => ({ ...prev, profile: updatedProfile }));

      await api.post('/admin/profile/edit', {
        fullName,
        mission: tagline,
      });

      await fetchProfile();
      await fetchUser(); // Reload parent auth context
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to update details.');
    } finally {
      setSaving(false);
    }
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
      const baseScale = CIRCLE_SIZE / Math.min(nw, nh);
      const totalScale = baseScale * cropZoom;

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
      await fetchProfile();
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
      await fetchProfile();
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

  const renderProfileSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="card" style={{ height: '152px', borderRadius: '16px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {[1,2,3].map(i => <div key={i} className="card shimmer-bg" style={{ height: '110px', borderRadius: '16px' }} />)}
      </div>
      <div className="card" style={{ height: '320px', borderRadius: '16px' }} />
    </div>
  );

  if (loading && !data) {
    return renderProfileSkeleton();
  }

  if (error && !data) {
    return (
      <div className="card" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center' }}>
        <IconAlertCircle size={32} style={{ color: '#ef4444' }} />
        <span style={{ font: '600 14px Urbanist', color: 'var(--text-muted)' }}>Failed to load profile.</span>
        <button className="pillbtn" onClick={() => { setLoading(true); fetchProfile(); }} style={{ padding: '8px 16px', fontSize: '13px' }}>Retry</button>
      </div>
    );
  }

  const { profile, stats, activity } = data;

  const avatarSrc = profile.avatarUrl
    ? (profile.avatarUrl.startsWith('http') ? profile.avatarUrl : `${api.defaults.baseURL || ''}${profile.avatarUrl.startsWith('/') ? '' : '/'}${profile.avatarUrl}`)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'Urbanist, sans-serif' }}>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />

      {/* PAGE TITLE */}
      <div>
        <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
        <h1 className="dashboard-title">My Profile</h1>
        <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
          Admin account · <span style={{ color: 'var(--accent, #C25A3A)', fontWeight: 700 }}>Smartan Varsity</span>
        </div>
      </div>

      {/* 1. HEADER HERO */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            title="Click to change avatar"
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'var(--tab-active-border, #C25A3A)',
              color: '#fff',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '32px',
              fontWeight: 900,
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              (profile.fullName || '?').charAt(0).toUpperCase()
            )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ font: '900 24px Urbanist', color: 'var(--text)', margin: 0 }}>{profile.fullName}</h2>
              <span style={{ 
                padding: '3px 12px', 
                borderRadius: '99px', 
                fontSize: '10px',
                fontWeight: 900,
                background: '#ea580c15',
                color: '#ea580c',
                border: '1px solid #ea580c30',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Administrator
              </span>
            </div>
            <p style={{ font: '600 14px Urbanist', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
              "{profile.mission || 'Fostering excellence across the Varsity.'}"
            </p>
          </div>
        </div>

        <button 
          className="ghostpill"
          onClick={() => setShowEditModal(true)}
          style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--input-border)', cursor: 'pointer' }}
        >
          <IconEdit size={16} /> Edit details
        </button>
      </div>

      {/* 2. STAT COUNTERS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '24px', textAlign: 'center' }}>
          <span style={{ font: '900 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Smartans overseen</span>
          <span style={{ font: '900 32px Urbanist', color: 'var(--text)' }}>{stats.smartansOverseen}</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '24px', textAlign: 'center' }}>
          <span style={{ font: '900 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Flags resolved</span>
          <span style={{ font: '900 32px Urbanist', color: 'var(--text)' }}>{stats.flagsResolved}</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '24px', textAlign: 'center' }}>
          <span style={{ font: '900 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Broadcasts sent</span>
          <span style={{ font: '900 32px Urbanist', color: 'var(--text)' }}>{stats.broadcastsSent}</span>
        </div>
      </div>

      {/* 3. TABS NAVIGATION */}
      <div style={{ display: 'flex', borderBottom: '1.5px solid var(--input-border)', gap: '28px', marginTop: '8px' }}>
        <button
          onClick={() => setActiveTab('mission')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'mission' ? '3px solid var(--text)' : '3px solid transparent',
            color: activeTab === 'mission' ? 'var(--text)' : 'var(--text-muted)',
            padding: '12px 6px',
            font: '900 14px Urbanist',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Mission
        </button>
        <button
          onClick={() => setActiveTab('scope')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'scope' ? '3px solid var(--text)' : '3px solid transparent',
            color: activeTab === 'scope' ? 'var(--text)' : 'var(--text-muted)',
            padding: '12px 6px',
            font: '900 14px Urbanist',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Scope
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'activity' ? '3px solid var(--text)' : '3px solid transparent',
            color: activeTab === 'activity' ? 'var(--text)' : 'var(--text-muted)',
            padding: '12px 6px',
            font: '900 14px Urbanist',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Activity
        </button>
      </div>

      {/* 4. TABS CONTENT */}
      <div className="card" style={{ padding: '32px', minHeight: '260px' }}>
        
        {/* MISSION TAB */}
        {activeTab === 'mission' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ font: '900 18px Urbanist', color: 'var(--text)', margin: 0 }}>Varsity Vision & Values</h3>
            <p style={{ font: '600 14px Urbanist', color: 'var(--text-muted)', lineHeight: '1.7', margin: 0 }}>
              The purpose of Smartan Varsity is to foster specialized, state-of-the-art knowledge and build a community of exceptional leaders. 
              As an administrator, your mission is to monitor participation, check in on inactive students, resolve flags, and dispatch announcements to guide the community.
            </p>
            <p style={{ font: '600 14px Urbanist', color: 'var(--text-muted)', lineHeight: '1.7', margin: 0 }}>
              Every interaction is tracked transparently. Maintain integrity, respect student privacy boundaries, and resolve alerts promptly.
            </p>
          </div>
        )}

        {/* SCOPE TAB */}
        {activeTab === 'scope' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ font: '900 16px Urbanist', color: 'var(--text)', margin: '0 0 4px 0' }}>Authorized Actions</h3>
              <p style={{ font: '600 13px Urbanist', color: 'var(--text-muted)', margin: 0 }}>The roles and operations you are permitted to perform:</p>
            </div>
            
            <ul style={{ font: '700 13.5px Urbanist', color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '20px' }}>
              <li>View all registered Smartans directory profiles and learning paths.</li>
              <li>Acknowledge and dismiss student inactivity engagement flags.</li>
              <li>Deactivate or reactivate student account profiles.</li>
              <li>Trigger password resets securely via Supabase Auth links.</li>
              <li>Compose and dispatch Varsity-wide broadcasts or direct notifications.</li>
            </ul>

            <div style={{ borderTop: '1px solid var(--input-border)', paddingTop: '16px' }}>
              <h3 style={{ font: '900 16px Urbanist', color: '#ef4444', margin: '0 0 4px 0' }}>Unauthorized Restrictions</h3>
              <p style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', margin: 0 }}>Actions you are strictly restricted from performing:</p>
            </div>

            <ul style={{ font: '700 13.5px Urbanist', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '20px' }}>
              <li>Cannot edit or delete custom tracks, courses, modules, or session logs.</li>
              <li>Cannot moderate or delete resources added by students.</li>
              <li>Cannot promote other accounts to administrator role or create new admin profiles.</li>
            </ul>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ font: '900 16px Urbanist', color: 'var(--text)', margin: '0 0 4px 0' }}>Admin Action Log</h3>
            {activity.length === 0 ? (
              <div style={{ font: '700 13px Urbanist', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>No actions logged for your account.</div>
            ) : (
              activity.map((a, idx) => (
                <div 
                  key={a.id || idx} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '12px 16px', 
                    background: 'var(--input-bg)', 
                    border: '1px solid var(--input-border)',
                    borderRadius: '12px' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {renderActivityIcon(a.eventType, 14)}
                    </div>
                    <span style={{ font: '600 13px Urbanist', color: 'var(--text)' }}>
                      {renderActivityText(a)}
                    </span>
                  </div>
                  <span style={{ font: '600 11px Urbanist', color: 'var(--text-muted)' }}>
                    {new Date(a.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* EDIT PROFILE MODAL */}
      {showEditModal && (
        <div className="scrim" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ width: '420px', padding: '32px', position: 'relative' }}>
            <div className="kthin" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
            <h3 style={{ font: '900 18px Urbanist', color: 'var(--text)', marginBottom: '18px' }}>Edit Admin Details</h3>
            
            <form onSubmit={handleEditProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ font: '800 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Display Name</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    borderRadius: '8px',
                    font: '600 13.5px Urbanist',
                    color: 'var(--text)',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ font: '800 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Tagline / Mission</label>
                <input 
                  type="text" 
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  placeholder="Fostering excellence..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    borderRadius: '8px',
                    font: '600 13.5px Urbanist',
                    color: 'var(--text)',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ font: '800 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Avatar</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '8px' }}>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                    background: 'var(--tab-active-border, #C25A3A)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', fontWeight: 900,
                  }}>
                    {avatarSrc
                      ? <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (profile.fullName || '?').charAt(0).toUpperCase()
                    }
                  </div>
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
                    {profile.avatarUrl && (
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  className="ghostpill" 
                  onClick={() => setShowEditModal(false)}
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="pillbtn" 
                  disabled={saving}
                  style={{ padding: '8px 16px', fontSize: '13px', background: 'var(--text)', color: 'var(--page)' }}
                >
                  {saving ? 'Saving...' : 'Save details'}
                </button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h3 style={{ font: '800 20px Urbanist', color: '#fff', margin: 0 }}>Adjust Profile Picture</h3>
              <button onClick={handleCropCancel} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
            <p style={{ font: '400 13px/1.55 Urbanist', color: '#777', margin: '0 0 26px' }}>
              Drag the image to position, and use the zoom slider to crop.
            </p>

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
                      setCropZoom(z => z);
                    }
                  }}
                  style={getCropImgStyle()}
                  draggable={false}
                />
              </div>
            </div>

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
