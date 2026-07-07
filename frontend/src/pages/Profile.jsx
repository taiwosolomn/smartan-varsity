import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { renderTrackIcon, formatDuration } from '../api';
import { useAuth, useCustomDialog } from '../App';
import { IconEdit, IconLoader, IconAlertCircle, IconCheck, IconX, IconUser, IconAward, IconBolt, IconClock, IconCalendar } from '@tabler/icons-react';

export default function Profile() {
  const { fetchUser } = useAuth();
  const { showConfirm, showAlert } = useCustomDialog();
  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [totalHours, setTotalHours] = useState('0.0');
  const [bestStreak, setBestStreak] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState('mission'); // mission, scope, activity

  // Edit details form state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editMission, setEditMission] = useState('');
  const [editProjectSummary, setEditProjectSummary] = useState('');
  const [editGoals, setEditGoals] = useState([]);
  const [newGoalText, setNewGoalText] = useState('');
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  const fetchProfileData = async (forceRefresh = false) => {
    try {
      const [userRes, tracksRes, summaryRes, logsRes, milestonesRes, streakRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/tracks/detailed'),
        api.get('/analytics/summary'),
        api.get('/logs'),
        api.get('/milestones'),
        api.get('/analytics/streak')
      ]);

      setUser(userRes.data);
      setTracks(tracksRes.data);
      setTotalHours(summaryRes.data.totalHours);
      setLogs(logsRes.data);
      setMilestones(milestonesRes.data);
      setBestStreak(streakRes.data.bestStreak || 0);

      // Populate edit states
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

  useEffect(() => {
    fetchProfileData();
  }, []);

  const handleEditProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/auth/profile', {
        fullName: editFullName,
        location: editLocation,
        mission: editMission,
        projectSummary: editProjectSummary,
        goals: editGoals
      });
      await fetchProfileData(true);
      await fetchUser(); // Sync with global topbar avatar/name
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to update details.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGoal = async (goalIndex) => {
    if (!user) return;
    const updatedGoals = user.goals.map((g, idx) => {
      if (idx === goalIndex) {
        return { ...g, completed: !g.completed };
      }
      return g;
    });
    try {
      // Optimistic update
      setUser(prev => ({ ...prev, goals: updatedGoals }));
      await api.put('/auth/profile', { goals: updatedGoals });
      await fetchProfileData(true);
    } catch (err) {
      console.error("Error toggling goal", err);
    }
  };

  const handleAddGoal = () => {
    if (!newGoalText.trim()) return;
    const newGoal = { text: newGoalText.trim(), completed: false };
    setEditGoals(prev => [...prev, newGoal]);
    setNewGoalText('');
  };

  const handleRemoveGoal = (index) => {
    setEditGoals(prev => prev.filter((_, idx) => idx !== index));
  };

  const calculateTrackProgress = (t) => {
    let total = 0;
    let done = 0;
    (t.courses || []).forEach(c => {
      (c.modules || []).forEach(m => {
        total++;
        if (m.status === 'completed' || m.status === 'done') {
          done++;
        }
      });
    });
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  };

  const renderProfileSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="card shimmer-bg" style={{ height: '152px', borderRadius: '16px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        {[1,2,3,4].map(i => <div key={i} className="card shimmer-bg" style={{ height: '110px', borderRadius: '16px' }} />)}
      </div>
      <div className="card shimmer-bg" style={{ height: '320px', borderRadius: '16px' }} />
    </div>
  );

  if (loading) return renderProfileSkeleton();

  if (error || !user) {
    return (
      <div className="card" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center', fontFamily: 'Urbanist, sans-serif' }}>
        <IconAlertCircle size={32} style={{ color: '#ef4444' }} />
        <span style={{ font: '600 14px Urbanist', color: 'var(--text-muted)' }}>Failed to load profile details.</span>
        <button className="pillbtn" onClick={() => { setLoading(true); fetchProfileData(); }} style={{ padding: '8px 16px', fontSize: '13px' }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'Urbanist, sans-serif' }}>
      
      {/* 1. HEADER HERO */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--tab-active-border, #C25A3A)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '32px',
            fontWeight: 900
          }}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `${api.defaults.baseURL || ''}${user.avatarUrl}`} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              user.fullName.charAt(0).toUpperCase()
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ font: '900 24px Urbanist', color: 'var(--text)', margin: 0 }}>{user.fullName}</h2>
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
                Smartan
              </span>
            </div>
            <p style={{ font: '600 14px Urbanist', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
              "{user.mission || 'To acquire state-of-the-art knowledge and build solutions.'}"
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '24px', textAlign: 'center' }}>
          <span style={{ font: '900 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>HOURS LOGGED</span>
          <span style={{ font: '900 32px Urbanist', color: 'var(--text)' }}>{totalHours}h</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '24px', textAlign: 'center' }}>
          <span style={{ font: '900 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>CURRENT STREAK</span>
          <span style={{ font: '900 32px Urbanist', color: 'var(--text)' }}>{bestStreak} days</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '24px', textAlign: 'center' }}>
          <span style={{ font: '900 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>SESSIONS LOGGED</span>
          <span style={{ font: '900 32px Urbanist', color: 'var(--text)' }}>{logs.length}</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '24px', textAlign: 'center' }}>
          <span style={{ font: '900 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>MILESTONES PASSED</span>
          <span style={{ font: '900 32px Urbanist', color: 'var(--text)' }}>{milestones.length}</span>
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

      {/* 4. TAB CONTENTS */}
      <div className="tab-content" style={{ marginTop: '8px' }}>
        
        {/* MISSION TAB */}
        {activeTab === 'mission' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px' }}>
              <h3 style={{ font: '900 17px Urbanist', color: 'var(--text)', margin: 0 }}>Mission & Scope Statement</h3>
              <p style={{ font: '600 14px Urbanist', color: 'var(--text-muted)', lineHeight: '1.7', margin: 0 }}>
                {user.mission || 'No mission set yet. Describe what drives you in the edit modal.'}
              </p>

              {user.projectSummary && (
                <div style={{ borderTop: '1px solid var(--input-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ font: '800 14px Urbanist', color: 'var(--text)', margin: 0 }}>Project Summary</h4>
                  <p style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
                    {user.projectSummary}
                  </p>
                </div>
              )}
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px' }}>
              <h3 style={{ font: '900 17px Urbanist', color: 'var(--text)', margin: 0 }}>Milestone Goals Checklist</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(!user.goals || user.goals.length === 0) ? (
                  <div style={{ font: '700 13px Urbanist', color: 'var(--text-muted)', fontStyle: 'italic' }}>No goals set yet. Add them in settings.</div>
                ) : (
                  user.goals.map((g, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handleToggleGoal(idx)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px', 
                        padding: '12px 14px', 
                        background: g.completed ? '#10b98110' : 'var(--input-bg)', 
                        border: `1.5px solid ${g.completed ? '#10b98130' : 'var(--input-border)'}`, 
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ 
                        width: '18px', 
                        height: '18px', 
                        borderRadius: '4px', 
                        border: `1.5px solid ${g.completed ? '#10b981' : 'var(--text-muted)'}`, 
                        background: g.completed ? '#10b981' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff'
                      }}>
                        {g.completed && <IconCheck size={12} strokeWidth={4} />}
                      </div>
                      <span style={{ font: '700 13px Urbanist', color: g.completed ? 'var(--text-muted)' : 'var(--text)', textDecoration: g.completed ? 'line-through' : 'none' }}>
                        {g.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* SCOPE TAB */}
        {activeTab === 'scope' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {tracks.length > 0 ? (
              [...tracks].sort((a, b) => a.name.localeCompare(b.name)).map(t => {
                const p = calculateTrackProgress(t);
                return (
                  <div 
                    key={t.id} 
                    className="track-card-item" 
                    onClick={() => navigate(`/tracks/${t.id}`)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '16px',
                      borderLeft: `4px solid ${t.color}`,
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      padding: '16px 20px',
                      background: 'var(--card-bg)',
                      borderRadius: '8px',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div style={{ 
                      width: '44px', 
                      height: '44px', 
                      borderRadius: '50%', 
                      background: `${t.color}18`, 
                      color: t.color, 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      flexShrink: 0
                    }}>
                      {renderTrackIcon(t.icon, 22)}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>{t.name}</div>
                      <div style={{ font: '600 12.5px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {t.phase} · {t.courses?.length || 0} courses · {p.done} of {p.total} modules complete
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', minWidth: '120px' }}>
                      <span style={{ font: '800 13px Urbanist', color: 'var(--text)' }}>{p.pct}%</span>
                      <div style={{ width: '100px', background: 'var(--input-bg)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${p.pct}%`, height: '100%', background: t.color, borderRadius: '3px' }} />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', font: '700 14px Urbanist' }}>
                No custom tracks registered yet. Go to tracks tab to register one.
              </div>
            )}
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ font: '900 16px Urbanist', color: 'var(--text)', margin: '0 0 4px 0' }}>Your Action Timeline</h3>
            {logs.length === 0 ? (
              <div style={{ font: '700 13px Urbanist', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>No study sessions logged yet.</div>
            ) : (
              logs.slice(0, 30).map((log, idx) => (
                <div 
                  key={log.id || idx} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '14px 18px', 
                    background: 'var(--input-bg)', 
                    border: '1px solid var(--input-border)',
                    borderRadius: '16px' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ⚡
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ font: '800 13.5px Urbanist', color: 'var(--text)' }}>{log.topic}</span>
                      <span style={{ font: '600 11px Urbanist', color: 'var(--text-muted)' }}>
                        Logged {log.duration} mins {log.rating ? `· Rated ${log.rating}/10` : ''}
                      </span>
                    </div>
                  </div>
                  <span style={{ font: '600 11px Urbanist', color: 'var(--text-muted)' }}>
                    {new Date(log.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* EDIT PROFILE DETAILS MODAL */}
      {showEditModal && (
        <div className="scrim" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '480px', maxWidth: '90%' }}>
            <div className="modal-header">
              <span className="modal-title">Edit Profile Details</span>
              <span className="modal-close" onClick={() => setShowEditModal(false)}>×</span>
            </div>
            
            <form onSubmit={handleEditProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="flabel">FULL NAME</label>
                <input 
                  type="text" 
                  className="field" 
                  value={editFullName} 
                  onChange={e => setEditFullName(e.target.value)} 
                  required 
                />
              </div>

              <div>
                <label className="flabel">MISSION TAGLINE</label>
                <input 
                  type="text" 
                  className="field" 
                  value={editMission} 
                  onChange={e => setEditMission(e.target.value)} 
                  placeholder="e.g. Building next generation secure systems"
                />
              </div>

              <div>
                <label className="flabel">PROJECT SUMMARY</label>
                <textarea 
                  className="field" 
                  style={{ height: '80px', resize: 'vertical' }}
                  value={editProjectSummary} 
                  onChange={e => setEditProjectSummary(e.target.value)}
                  placeholder="Summary of what you are building..."
                />
              </div>

              {/* Goals Editor section */}
              <div>
                <label className="flabel">MILESTONE GOALS</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', marginBottom: '8px', padding: '6px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '8px' }}>
                  {editGoals.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No goals defined.</span>
                  ) : (
                    editGoals.map((g, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--page)', padding: '6px 10px', borderRadius: '6px' }}>
                        <span style={{ font: '700 12px Urbanist', color: 'var(--text)' }}>{g.text}</span>
                        <button type="button" onClick={() => handleRemoveGoal(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 900 }}>×</button>
                      </div>
                    ))
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="field" 
                    placeholder="New goal text..."
                    value={newGoalText}
                    onChange={e => setNewGoalText(e.target.value)}
                  />
                  <button type="button" className="pillbtn" onClick={handleAddGoal} style={{ height: '40px' }}>Add</button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="ghostpill" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="pillbtn" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}