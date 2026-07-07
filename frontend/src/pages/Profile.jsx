import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { renderTrackIcon } from '../api';
import { useAuth } from '../App';
import { IconEdit, IconAlertCircle, IconCheck, IconAward } from '@tabler/icons-react';

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
  const { fetchUser } = useAuth();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [totalHours, setTotalHours] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState('mission');

  // Edit form state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editMission, setEditMission] = useState('');
  const [editProjectSummary, setEditProjectSummary] = useState('');
  const [editGoals, setEditGoals] = useState([]);
  const [newGoalText, setNewGoalText] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [saving, setSaving] = useState(false);

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
    } catch (err) {
      console.error(err);
      setError(true);
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfileData(); }, []);

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

  // ── Skeleton ───────────────────────────────────────────────────────────────
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
      <button className="pillbtn" onClick={() => { setLoading(true); fetchProfileData(); }}>Retry</button>
    </div>
  );

  const avatarSrc = user.avatarUrl
    ? (user.avatarUrl.startsWith('http') ? user.avatarUrl : `${api.defaults.baseURL}${user.avatarUrl}`)
    : null;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Urbanist, sans-serif' }}>

      {/* ── MAIN HEADER CARD (avatar + info + stats in one card) ── */}
      <div className="card" style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

          {/* Avatar + user details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
            {/* Avatar circle */}
            <div style={{
              width: '76px', height: '76px', borderRadius: '50%',
              background: 'var(--phbar-bg)', overflow: 'hidden', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '26px', fontWeight: 900, color: 'var(--text-muted)',
            }}>
              {avatarSrc
                ? <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : user.fullName?.charAt(0).toUpperCase()
              }
            </div>

            {/* Name / tagline / mission badge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h2 style={{ font: '900 25px/1.15 Urbanist', color: 'var(--text)', margin: 0 }}>
                {user.fullName}
              </h2>
              <p style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', margin: 0 }}>
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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              id="profile-edit-btn"
              onClick={() => setShowEditModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '10px 20px', borderRadius: '99px',
                background: 'var(--text)', color: 'var(--card-bg)',
                font: '800 13px Urbanist', border: 'none', cursor: 'pointer',
              }}
            >
              <IconEdit size={14} strokeWidth={2.5} />
              Edit details
            </button>
            <button
              id="profile-settings-btn"
              onClick={() => navigate('/settings')}
              style={{
                padding: '10px 20px', borderRadius: '99px',
                background: 'transparent', color: 'var(--text)',
                font: '800 13px Urbanist',
                border: '1.5px solid var(--input-border)', cursor: 'pointer',
              }}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Stats row — inline, not in cards */}
        <div style={{ display: 'flex', gap: '44px' }}>
          {STATS.map((stat, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ font: '900 21px/1.1 Urbanist', color: 'var(--text)' }}>{stat.value}</span>
              <span style={{
                font: '600 10px Urbanist', color: 'var(--text-muted)',
                letterSpacing: '0.7px', textTransform: 'uppercase',
              }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS BAR ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '0',
        borderBottom: '1.5px solid var(--input-border)',
        paddingLeft: '2px',
      }}>
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
                background: 'var(--phbar-bg)', color: 'var(--text-muted)',
                font: '700 11px Urbanist',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ────────────────────────────────────────── */}
      <div>

        {/* MISSION TAB */}
        {activeTab === 'mission' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Mission Statement card */}
            <div className="card" style={{ padding: '28px 32px 28px 24px', position: 'relative', overflow: 'hidden' }}>
              {/* Decorative large quote mark */}
              <div style={{
                position: 'absolute', top: '10px', left: '16px',
                font: '900 72px Georgia, serif',
                color: 'var(--input-border)',
                lineHeight: 1,
                userSelect: 'none', pointerEvents: 'none',
                opacity: 0.7,
              }}>
                "
              </div>
              <div style={{ paddingLeft: '32px' }}>
                <p style={{
                  font: '700 10px Urbanist', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.9px', margin: '0 0 10px 0',
                }}>
                  MISSION STATEMENT
                </p>
                <p style={{ font: '800 22px/1.35 Urbanist', color: 'var(--text)', margin: 0 }}>
                  "{user.mission || 'No mission set yet.'}"
                </p>
              </div>
            </div>

            {/* Active Goals + Project — two columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '16px' }}>

              {/* Goals card */}
              <div className="card" style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{
                  font: '700 10px Urbanist', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.9px', margin: 0,
                }}>
                  ACTIVE GOALS
                </p>
                {(!user.goals || user.goals.length === 0) ? (
                  <span style={{ font: '600 13px Urbanist', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No goals set. Add them via Edit details.
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                    {user.goals.map((g, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleToggleGoal(idx)}
                        style={{
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between', gap: '12px', cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                          {/* Checkbox */}
                          <div style={{
                            width: '15px', height: '15px', flexShrink: 0,
                            borderRadius: '3px',
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
                          <span style={{
                            font: '600 11.5px Urbanist', color: 'var(--text-muted)',
                            flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.3px',
                          }}>
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
                <p style={{
                  font: '700 10px Urbanist', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.9px', margin: 0,
                }}>
                  PROJECT
                </p>
                {user.projectSummary ? (
                  <p style={{ font: '600 13.5px/1.55 Urbanist', color: 'var(--text-muted)', margin: 0 }}>
                    {user.projectSummary}
                  </p>
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
              [...tracks].sort((a, b) => a.name.localeCompare(b.name)).map(t => {
                const p = calculateTrackProgress(t);
                return (
                  <div
                    key={t.id}
                    onClick={() => navigate(`/tracks/${t.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '16px',
                      padding: '16px 20px',
                      background: 'var(--card-bg)',
                      borderRadius: '16px',
                      border: '1px solid var(--card-border)',
                      boxShadow: 'var(--card-shadow)',
                      borderLeft: `4px solid ${t.color}`,
                      cursor: 'pointer',
                      transition: 'opacity 0.15s, box-shadow 0.15s',
                    }}
                  >
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      background: `${t.color}18`, color: t.color,
                      display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
                    }}>
                      {renderTrackIcon(t.icon, 22)}
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
                <div
                  key={m.id || idx}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px',
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '14px',
                    boxShadow: 'var(--card-shadow)',
                  }}
                >
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
                      {m.trackName && (
                        <div style={{ font: '600 11px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>{m.trackName}</div>
                      )}
                    </div>
                  </div>
                  <span style={{ font: '600 11.5px Urbanist', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {m.date ? new Date(m.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── EDIT PROFILE MODAL ─────────────────────────────────── */}
      {showEditModal && (
        <div className="scrim" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '480px', maxWidth: '92%' }}>
            <div className="modal-header">
              <span className="modal-title">Edit Profile Details</span>
              <span className="modal-close" onClick={() => setShowEditModal(false)}>×</span>
            </div>
            <form onSubmit={handleEditProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                      <div key={idx} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: 'var(--page)', padding: '5px 10px', borderRadius: '6px',
                      }}>
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
    </div>
  );
}