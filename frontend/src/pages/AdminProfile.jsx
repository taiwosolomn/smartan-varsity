import React, { useState, useEffect } from 'react';
import api, { renderActivityIcon, renderActivityText } from '../api';
import { useAuth } from '../App';
import { IconEdit, IconLoader, IconAlertCircle } from '@tabler/icons-react';

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
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const cached = localStorage.getItem('sv_admin_profile_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        setData(parsed);
        setFullName(parsed.profile.fullName);
        setTagline(parsed.profile.mission || '');
        setAvatarUrl(parsed.profile.avatarUrl || '');
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
      setAvatarUrl(res.data.profile.avatarUrl || '');
      
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
        avatarUrl
      };
      setData(prev => ({ ...prev, profile: updatedProfile }));
      
      await api.post('/admin/profile/edit', {
        fullName,
        mission: tagline,
        avatarUrl
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'Urbanist, sans-serif' }}>
      
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
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl.startsWith('http') ? profile.avatarUrl : `${api.defaults.baseURL || ''}${profile.avatarUrl}`} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              profile.fullName.charAt(0).toUpperCase()
            )}
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
                <label style={{ font: '800 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Avatar URL</label>
                <input 
                  type="text" 
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
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

    </div>
  );
}
