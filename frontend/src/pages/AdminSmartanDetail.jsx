import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { renderTrackIcon, API_URL } from '../api';
import { useCustomDialog } from '../App';
import TrackIconRenderer from '../components/TrackIconRenderer.jsx';
import {
  IconChevronLeft, IconChevronRight, IconAlertCircle,
  IconLayoutGrid, IconList, IconEye
} from '@tabler/icons-react';

export default function AdminSmartanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useCustomDialog();

  // Loading & error states
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  // States
  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [milestones, setMilestones] = useState([]);
  const [sessionLogs, setSessionLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [statusLoading, setStatusLoading] = useState(false);

  // Section tab — 'tracks' | 'milestones' | 'activity'
  const [activeTab, setActiveTab] = useState('tracks');
  const [tracksView, setTracksView] = useState('list'); // 'list' | 'grid' for Tracks tab

  // Offline cache
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`sv_admin_detail_cache_${id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setProfile(parsed.profile);
        setDashboard(parsed.dashboard);
        setActivityLog(parsed.activityLog || []);
        setTotalLogs(parsed.totalLogs || 0);
        setMilestones(parsed.milestones || []);
        setSessionLogs(parsed.sessionLogs || []);
        setProfileLoading(false);
      }
    } catch (e) {
      console.error(e);
    }
  }, [id]);

  const fetchDetailData = async (retryCount = 0) => {
    try {
      const res = await api.get(`/admin/smartans/${id}`, { params: { page, limit: 10 }, timeout: 15000 });
      setProfile(res.data.profile);
      setDashboard(res.data.dashboard);
      setActivityLog(res.data.activityLog || []);
      setTotalLogs(res.data.totalLogs || 0);
      setMilestones(res.data.milestones || []);
      setSessionLogs(res.data.sessionLogs || []);
      setProfileLoading(false);
      setProfileError(false);

      localStorage.setItem(`sv_admin_detail_cache_${id}`, JSON.stringify({
        profile: res.data.profile,
        dashboard: res.data.dashboard,
        activityLog: res.data.activityLog,
        totalLogs: res.data.totalLogs,
        milestones: res.data.milestones,
        sessionLogs: res.data.sessionLogs
      }));
    } catch (err) {
      console.error(err);
      if (retryCount < 2) {
        setTimeout(() => fetchDetailData(retryCount + 1), (retryCount + 1) * 1500);
      } else {
        if (!profile) setProfileError(true);
        setProfileLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchDetailData();
  }, [id, page]);

  const handleDeactivateToggle = async () => {
    if (!profile) return;
    const isDeactivated = !!profile.deactivated_at;
    const action = isDeactivated ? 'reactivate' : 'deactivate';
    const confirmed = await showConfirm(
      `Are you sure you want to ${action} ${profile.fullName}'s account?`,
      `${isDeactivated ? 'Reactivate' : 'Deactivate'} Account`
    );
    if (!confirmed) return;

    setStatusLoading(true);
    const previousDeactivated = profile.deactivated_at;
    setProfile(prev => ({
      ...prev,
      deactivated_at: isDeactivated ? null : new Date().toISOString()
    }));

    try {
      const endpoint = isDeactivated ? 'reactivate' : 'deactivate';
      await api.post(`/admin/smartans/${id}/${endpoint}`);
      await showAlert(
        `${profile.fullName}'s account has been ${isDeactivated ? 'reactivated' : 'deactivated'} successfully.`,
        'Account Updated'
      );
      // Refresh quietly
      const res = await api.get(`/admin/smartans/${id}`, { params: { page, limit: 10 } });
      setProfile(res.data.profile);
    } catch (e) {
      console.error(e);
      setProfile(prev => ({ ...prev, deactivated_at: previousDeactivated }));
      await showAlert('Action failed. The account status has been reverted.', 'Error');
    } finally {
      setStatusLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!profile) return;
    const confirmed = await showConfirm(
      `Send a password recovery link to ${profile.email}?`,
      'Trigger Password Reset'
    );
    if (!confirmed) return;
    try {
      await api.post(`/admin/smartans/${id}/reset-password`);
      await showAlert(`Password recovery email sent to ${profile.email}.`, 'Email Sent');
    } catch (e) {
      console.error(e);
      await showAlert('Failed to trigger password reset. Please try again.', 'Error');
    }
  };

  const totalPages = Math.ceil(totalLogs / 10) || 1;

  // Calculate track progress from full track data
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

  // Skeletons
  const renderProfileSkeleton = () => (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div className="shimmer-bg" style={{ width: '64px', height: '64px', borderRadius: '50%' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="shimmer-bg" style={{ width: '180px', height: '20px' }} />
          <div className="shimmer-bg" style={{ width: '280px', height: '14px' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div className="shimmer-bg" style={{ width: '160px', height: '36px', borderRadius: '99px' }} />
        <div className="shimmer-bg" style={{ width: '100px', height: '36px', borderRadius: '99px' }} />
      </div>
    </div>
  );

  if (profileLoading && !profile) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'Urbanist, sans-serif' }}>
      {renderProfileSkeleton()}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="card shimmer-bg" style={{ height: '90px', borderRadius: '16px' }} />
        ))}
      </div>
      <div className="card shimmer-bg" style={{ height: '400px', borderRadius: '16px' }} />
    </div>
  );

  if (profileError || !profile) return (
    <div className="card" style={{ padding: '60px 36px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center' }}>
      <IconAlertCircle size={36} style={{ color: '#ef4444' }} />
      <span style={{ font: '700 15px Urbanist', color: 'var(--text-muted)' }}>Failed to load Smartan profile.</span>
      <button className="pillbtn" onClick={() => { setProfileLoading(true); fetchDetailData(); }}>Retry</button>
    </div>
  );

  const trackProgress = dashboard?.trackProgress || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'Urbanist, sans-serif' }}>

      {/* PAGE TITLE */}
      <div>
        <button
          onClick={() => navigate('/admin/smartans')}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', font: '700 13px Urbanist', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, marginBottom: '16px' }}
        >
          <IconChevronLeft size={16} /> Back to Directory
        </button>
        <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
        <h1 className="dashboard-title">{profile.fullName}</h1>
        <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
          Smartan Directory · <span style={{ color: 'var(--accent, #C25A3A)', fontWeight: 700 }}>Observer Mode</span>
        </div>
      </div>

      {/* 1. PROFILE HEADER CARD */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'var(--tab-active-border, #C25A3A)', color: '#fff',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontSize: '24px', fontWeight: 900, flexShrink: 0, overflow: 'hidden'
          }}>
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl.startsWith('http') ? profile.avatarUrl : `${API_URL || ''}${profile.avatarUrl}`}
                alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : profile.fullName.charAt(0).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ font: '900 20px Urbanist', color: 'var(--text)', margin: 0 }}>{profile.fullName}</h2>
              <span style={{
                padding: '2px 10px', borderRadius: '99px', fontSize: '10px', fontWeight: 900,
                background: profile.deactivated_at ? '#ef444415' : '#10b98115',
                color: profile.deactivated_at ? '#ef4444' : '#10b981',
                border: profile.deactivated_at ? '1px solid #ef444430' : '1px solid #10b98130',
                textTransform: 'uppercase'
              }}>
                {profile.deactivated_at ? 'Deactivated' : 'Active'}
              </span>
            </div>
            <span style={{ font: '600 13px Urbanist', color: 'var(--text-muted)' }}>
              {profile.email} · Joined {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="ghostpill"
            onClick={handlePasswordReset}
            style={{ padding: '8px 16px', fontSize: '13px', border: '1px solid var(--input-border)', cursor: 'pointer' }}
          >
            Trigger password reset
          </button>
          <button
            className="pillbtn"
            onClick={handleDeactivateToggle}
            disabled={statusLoading}
            style={{
              padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
              background: profile.deactivated_at ? '#10b981' : '#ef4444', color: '#fff'
            }}
          >
            {statusLoading ? '...' : profile.deactivated_at ? 'Reactivate' : 'Deactivate'}
          </button>
        </div>
      </div>

      {/* 2. OBSERVATION BANNER */}
      <div style={{
        background: '#100D18', borderRadius: '12px', padding: '12px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        color: '#ffffff', font: '800 12.5px Urbanist'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>👁️</span>
          <span>You're viewing {profile.fullName.split(' ')[0]}'s world — a mirror of their Dashboard & Analytics, from the outside.</span>
        </div>
        <span style={{ opacity: 0.5, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Read-only observation</span>
      </div>

      {/* 3. STAT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '20px' }}>
          <span style={{ font: '900 10.5px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>TOTAL HOURS</span>
          <span style={{ font: '900 28px Urbanist', color: 'var(--text)' }}>{dashboard?.stats?.totalHours || 0}h</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '20px' }}>
          <span style={{ font: '900 10.5px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>CURRENT STREAK</span>
          <span style={{ font: '900 28px Urbanist', color: 'var(--text)' }}>{dashboard?.stats?.streakCount || 0} days</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '20px' }}>
          <span style={{ font: '900 10.5px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>AVG. MASTERY</span>
          <span style={{ font: '900 28px Urbanist', color: 'var(--text)' }}>
            {dashboard?.averageMastery?.value ? `${dashboard.averageMastery.value}/10` : '—'}
          </span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '20px' }}>
          <span style={{ font: '900 10.5px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>MILESTONES</span>
          <span style={{ font: '900 28px Urbanist', color: 'var(--text)' }}>{milestones.length}</span>
        </div>
      </div>

      {/* 4. TABS */}
      <div style={{ display: 'flex', borderBottom: '1.5px solid var(--input-border)', gap: '28px' }}>
        {['tracks', 'milestones', 'activity'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'transparent', border: 'none',
              borderBottom: activeTab === tab ? '3px solid var(--text)' : '3px solid transparent',
              color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)',
              padding: '12px 6px', font: '900 14px Urbanist', cursor: 'pointer', transition: 'all 0.2s',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'tracks' ? `Tracks (${trackProgress.length})` : tab === 'milestones' ? `Milestones (${milestones.length})` : 'Full Action Log'}
          </button>
        ))}
      </div>

      {/* 5. TAB CONTENT */}

      {/* TRACKS TAB — same cards as student Tracks page */}
      {activeTab === 'tracks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ font: '700 13px Urbanist', color: 'var(--text-muted)' }}>
              {trackProgress.length} track{trackProgress.length !== 1 ? 's' : ''} registered
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[['grid', IconLayoutGrid], ['list', IconList]].map(([v, Icon]) => (
                <button
                  key={v}
                  onClick={() => setTracksView(v)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                    background: tracksView === v ? 'var(--text)' : 'transparent',
                    color: tracksView === v ? 'var(--page)' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                  }}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>

          {trackProgress.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center', font: '700 14px Urbanist', color: 'var(--text-muted)' }}>
              No tracks registered yet.
            </div>
          ) : tracksView === 'grid' ? (
            <div className="tracks-grid">
              {trackProgress.map(t => (
                <div
                  key={t.id}
                  className="track-card"
                  onClick={() => navigate(`/admin/smartans/${id}/tracks/${t.id}`)}
                  style={{ cursor: 'pointer', position: 'relative' }}
                  title={`Observe ${t.name} — read only`}
                >
                  {/* READ-ONLY badge */}
                  <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 2, background: 'rgba(0,0,0,0.6)', borderRadius: '6px', padding: '2px 8px', font: '800 9px Urbanist', color: '#fff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Read-only
                  </div>

                  {/* Colored band */}
                  <div style={{
                    background: t.color || '#666', height: '140px', position: 'relative', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '14px 14px 0 0'
                  }}>
                    {(() => {
                      const img = t.icon_image_url || t.icon_value || t.icon;
                      const isImage = t.icon_type === 'image' || (img && (img.startsWith('/') || img.startsWith('http')));
                      if (isImage && img) {
                        const imgUrl = img.startsWith('http') ? img : `${API_URL}${img.startsWith('/') ? '' : '/'}${img}`;
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
                      return <TrackIconRenderer track={t} size={44} style={{ zIndex: 1 }} />;
                    })()}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.3) 100%)', zIndex: 1 }} />
                  </div>

                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, gap: '12px' }}>
                    <div style={{ font: '900 15px Urbanist', color: 'var(--text)' }}>{t.name}</div>
                    <div style={{ font: '700 12px Urbanist', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.color || '#666', display: 'inline-block' }} />
                      {t.phase || 'Active'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', font: '800 12px Urbanist', color: 'var(--text)', marginBottom: '6px' }}>
                        <span>Progress</span><span>{t.progress}%</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ width: `${t.progress}%`, height: '100%', background: t.color || 'var(--accent)' }} />
                      </div>
                    </div>
                    <button
                      className="ghostpill"
                      style={{ marginTop: 'auto', width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', border: `1.5px solid ${t.color || 'var(--input-border)'}22`, cursor: 'pointer' }}
                    >
                      <IconEye size={14} /> Observe track
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* LIST VIEW */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {trackProgress.map(t => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/admin/smartans/${id}/tracks/${t.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    padding: '16px 20px', background: 'var(--card-bg)',
                    border: '1px solid var(--input-border)', borderRadius: '12px',
                    borderLeft: `4px solid ${t.color || 'var(--accent)'}`,
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--card-bg)'}
                >
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '10px',
                    background: `${t.color || '#666'}22`, color: t.color || '#666',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0,
                    overflow: 'hidden'
                  }}>
                    <TrackIconRenderer track={t} size={22} style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: '800 14px Urbanist', color: 'var(--text)' }}>{t.name}</div>
                    <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {t.phase || 'Active'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', minWidth: '140px' }}>
                    <span style={{ font: '800 13px Urbanist', color: 'var(--text)' }}>{t.progress}%</span>
                    <div style={{ width: '120px', height: '6px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ width: `${t.progress}%`, height: '100%', background: t.color || 'var(--accent)' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '700 11.5px Urbanist', color: 'var(--text-muted)', marginLeft: '12px', flexShrink: 0 }}>
                    <IconEye size={14} /> Observe
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MILESTONES TAB — real data from user's milestones table */}
      {activeTab === 'milestones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {milestones.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center', font: '700 14px Urbanist', color: 'var(--text-muted)' }}>
              No milestones recorded yet.
            </div>
          ) : (
            milestones.map((m, idx) => (
              <div
                key={m.id || idx}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '16px 20px', background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)', borderRadius: '14px'
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${m.trackColor || '#C25A3A'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '20px' }}>🏆</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '800 14px Urbanist', color: 'var(--text)' }}>{m.name}</div>
                  <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.trackColor || '#C25A3A', display: 'inline-block', flexShrink: 0 }} />
                    Track: {m.trackName}
                  </div>
                </div>
                <span style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {m.date ? new Date(m.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ACTIVITY TAB — real session logs + full action log with pagination */}
      {activeTab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Session Logs */}
          <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ font: '900 16px Urbanist', color: 'var(--text)', margin: 0 }}>
                Session logs ({sessionLogs.length})
              </h3>
              <button
                onClick={() => navigate(`/admin/smartans/${id}/sessions`)}
                className="ghostpill"
                style={{ padding: '6px 14px', fontSize: '12.5px', border: '1px solid var(--input-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <IconEye size={14} /> Full sessions view
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sessionLogs.length === 0 ? (
                <div style={{ font: '700 13px Urbanist', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>
                  No sessions logged yet.
                </div>
              ) : (
                sessionLogs.slice(0, 15).map((log, i) => (
                  <div
                    key={log.id || i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '13px 16px', background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)', borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                        background: `${log.trackColor || '#C25A3A'}22`, color: log.trackColor || '#C25A3A',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                      }}>
                        {log.trackIcon || '📚'}
                      </div>
                      <div>
                        <div style={{ font: '800 13.5px Urbanist', color: 'var(--text)' }}>{log.topic}</div>
                        <div style={{ font: '600 11.5px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {log.trackName} · {log.duration} min{log.rating ? ` · Rated ${log.rating}/10` : ''}
                        </div>
                      </div>
                    </div>
                    <span style={{ font: '600 11px Urbanist', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {log.date ? new Date(log.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Full Action Log (system events) */}
          <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ font: '900 16px Urbanist', color: 'var(--text)', margin: 0 }}>
              System action log ({totalLogs} events)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activityLog.length === 0 ? (
                <div style={{ font: '700 13px Urbanist', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>
                  No system events recorded.
                </div>
              ) : (
                activityLog.map((a, i) => (
                  <div
                    key={a.id || i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)', borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--page)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        ⚡
                      </div>
                      <div>
                        <div style={{ font: '700 13px Urbanist', color: 'var(--text)' }}>
                          {(a.eventType || '').replace(/_/g, ' ')}
                        </div>
                        <div style={{ font: '600 11px Urbanist', color: 'var(--text-muted)' }}>
                          By: {a.actorName || 'System'}
                        </div>
                      </div>
                    </div>
                    <span style={{ font: '600 11px Urbanist', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </span>
                  </div>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderTop: '1px solid var(--input-border)', paddingTop: '16px' }}>
                <span style={{ font: '800 12.5px Urbanist', color: 'var(--text-muted)' }}>
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="ghostpill"
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                  >
                    <IconChevronLeft size={14} /> Back
                  </button>
                  <button
                    className="ghostpill"
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                  >
                    Next <IconChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
