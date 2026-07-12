import React, { useState, useEffect } from 'react';
import api from '../api';
import { supabase } from '../supabaseClient';
import { useSettings, useAuth, useCustomDialog } from '../App';
import { getFirstName } from '../utils/nameHelper';
import {
  IconUser, IconBell, IconPalette, IconLock, IconAlertTriangle,
  IconKey, IconCheck, IconX, IconEye, IconEyeOff
} from '@tabler/icons-react';

export default function Settings() {
  const { settings, refreshSettings, theme, setTheme } = useSettings();
  const { user } = useAuth();
  const { showConfirm, showAlert } = useCustomDialog();
  
  // Settings states
  const [dailyReminder, setDailyReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState('21:00');
  const [weeklyReview, setWeeklyReview] = useState(false);
  const [streakNotif, setStreakNotif] = useState(true);
  const [streakRiskAlert, setStreakRiskAlert] = useState(true);
  const [notifMethod, setNotifMethod] = useState(localStorage.getItem('sv_notif_method') || 'both');

  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState('account');
  const [isMobile, setIsMobile] = useState(false);

  // Modals Open States
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [isChangeUsernameOpen, setIsChangeUsernameOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isWeeklyPreviewOpen, setIsWeeklyPreviewOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);

  // Form Inputs
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Real-time username validation
  const [usernameAvailability, setUsernameAvailability] = useState({ checked: false, available: false, message: '' });
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [lastSignInAt, setLastSignInAt] = useState(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Real last-login timestamp from Supabase Auth (no location data exists anywhere
  // in the system, so we only ever show the date/time, never a fabricated location).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLastSignInAt(data?.session?.user?.last_sign_in_at || null);
    });
  }, []);

  useEffect(() => {
    if (settings) {
      setDailyReminder(settings.dailyReminder);
      setReminderTime(settings.reminderTime || '21:00');
      setWeeklyReview(settings.weeklyReview);
      setStreakNotif(settings.streakNotif);
    }
  }, [settings]);

  // Debounced username checking
  useEffect(() => {
    if (!newUsername.trim()) {
      setUsernameAvailability({ checked: false, available: false, message: '' });
      return;
    }
    setCheckingUsername(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await api.get(`/auth/check-username?username=${newUsername}`);
        setUsernameAvailability({
          checked: true,
          available: res.data.available,
          message: res.data.message
        });
      } catch (err) {
        setUsernameAvailability({ checked: true, available: false, message: 'Error checking availability' });
      } finally {
        setCheckingUsername(false);
      }
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [newUsername]);

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleUpdate = async (fields) => {
    try {
      await api.put('/settings', fields);
      await refreshSettings();
      showMessage('Settings updated successfully!');
    } catch (err) {
      console.error(err);
      showMessage('Error saving settings');
    }
  };

  const handleSaveEmail = async (e) => {
    e.preventDefault();
    try {
      // Supabase sends a confirmation email to the new address
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      showMessage('Confirmation email sent to ' + newEmail + '. Click the link to confirm the change.');
      setIsChangeEmailOpen(false);
      setNewEmail('');
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Failed to change email');
    }
  };

  const handleSaveUsername = async (e) => {
    e.preventDefault();
    if (!usernameAvailability.available) {
      showMessage('Username is not available');
      return;
    }
    try {
      await api.post('/auth/change-username', {
        newUsername: newUsername,
        // No password needed — authenticated via Supabase JWT
      });
      showMessage('Username changed successfully!');
      setIsChangeUsernameOpen(false);
      setNewUsername('');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error(err);
      showMessage(err.response?.data?.detail || 'Failed to change username');
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showMessage('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      showMessage('Password must be at least 6 characters');
      return;
    }
    try {
      // Supabase handles password update directly — no current password needed
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showMessage('Password updated successfully!');
      setIsChangePasswordOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Failed to change password');
    }
  };

  const handleSignoutEverywhere = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
      showMessage('Signed out from all devices!');
      setTimeout(() => { window.location.href = '/login'; }, 1000);
    } catch (err) {
      console.error(err);
      showMessage('Failed to sign out everywhere');
    }
  };

  const handleDeleteAccountConfirm = async (e) => {
    e.preventDefault();
    if (deleteConfirmText !== 'DELETE') {
      showAlert("Please type 'DELETE' to confirm deletion.", "Action Required");
      return;
    }
    try {
      await api.delete('/auth/delete-account');
      await supabase.auth.signOut();
      document.body.innerHTML = `
        <div style="background:#100d18;color:#ef4444;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Urbanist,sans-serif;" id="goodbye-screen">
          <h1 style="font-size:48px;font-weight:900;letter-spacing:-1px;">Account Deleted.</h1>
          <p style="color:#a1a1aa;margin-top:12px;font-size:16px;">We are sorry to see you go. Closing down the OS...</p>
        </div>
      `;
      setTimeout(() => { window.location.href = '/login'; }, 3000);
    } catch (err) {
      console.error(err);
      showMessage('Failed to delete account');
    }
  };

  const handleExportData = async () => {
    try {
      const res = await api.get('/settings/export');
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `smartan_varsity_backup_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showMessage("Data exported successfully!");
    } catch (err) {
      console.error("Export error", err);
      showMessage("Failed to export data");
    }
  };

  const handleImportFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        setImportFileContent(parsed);
        setIsImportConfirmOpen(true);
      } catch (err) {
        showMessage("Invalid backup file. Must be JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset uploader value
  };

  const executeImportData = async () => {
    if (!importFileContent) return;
    try {
      await api.post('/settings/import', importFileContent);
      setIsImportConfirmOpen(false);
      showMessage("Data restored successfully!");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error("Import error", err);
      showMessage("Import failed. Ensure schema matches.");
    }
  };

  const handleOAuthClick = (provider) => {
    showMessage(`${provider} OAuth authentication mock triggered.`);
  };

  const renderAccountSection = () => (
    <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <span style={{ font: '900 16px Urbanist', color: 'var(--text)' }}>Account</span>
      
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
        <div>
          <label className="flabel" style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
            <span>EMAIL</span>
            <span 
              onClick={() => {
                setNewEmail(user?.email || '');
                setIsChangeEmailOpen(true);
              }}
              style={{ color: '#E5A83C', cursor: 'pointer', fontWeight: 800 }}
            >
              Change email →
            </span>
          </label>
          <input 
            type="text" 
            className="field" 
            value={user?.email || ''} 
            readOnly 
            style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-muted)' }}
          />
        </div>
        <div>
          <label className="flabel" style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
            <span>USERNAME</span>
            <span 
              onClick={() => {
                setNewUsername(user?.username || '');
                setIsChangeUsernameOpen(true);
              }}
              style={{ color: '#E5A83C', cursor: 'pointer', fontWeight: 800 }}
            >
              Change username →
            </span>
          </label>
          <input 
            type="text" 
            className="field" 
            value={user?.username ? `@${user.username}` : (user?.fullName ? `@${user.fullName.toLowerCase().replace(/ /g, '')}` : '@smartan')} 
            readOnly 
            style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-muted)' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
        <button 
          className="ghostpill" 
          style={{ font: '700 13px Urbanist', gap: '8px', padding: '8px 16px', display: 'flex', alignItems: 'center' }} 
          type="button"
          onClick={() => setIsChangePasswordOpen(true)}
        >
          <IconKey size={14} /> Change password
        </button>
      </div>

      {/* OAuth Mock Connections */}
      <div style={{ marginTop: '16px', borderTop: '1px solid var(--rail-border)', paddingTop: '16px' }}>
        <label className="flabel" style={{ fontSize: '10px', marginBottom: '10px' }}>CONNECTED ACCOUNTS</label>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => handleOAuthClick('Google')}
            style={{
              background: 'var(--input-bg)',
              border: '1.5px solid var(--rail-border)',
              borderRadius: '8px',
              padding: '10px 16px',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Connect Google Account
          </button>
          <button 
            onClick={() => handleOAuthClick('GitHub')}
            style={{
              background: 'var(--input-bg)',
              border: '1.5px solid var(--rail-border)',
              borderRadius: '8px',
              padding: '10px 16px',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Connect GitHub Account
          </button>
        </div>
      </div>

      {/* Last Login Info — real timestamp from Supabase Auth, no fabricated location */}
      {lastSignInAt && (
        <div style={{ marginTop: '10px', font: '600 12px Urbanist', color: 'var(--text-muted)' }}>
          Last login: {new Date(lastSignInAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at {new Date(lastSignInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <span style={{ font: '900 16px Urbanist', color: 'var(--text)' }}>Notifications</span>

      {/* Daily streak reminder toggle */}
      <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--rail-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ font: '800 14px Urbanist', color: 'var(--text)' }}>Daily streak reminder</div>
            <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>A nudge before your streak breaks</div>
          </div>
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={dailyReminder}
              onChange={e => {
                setDailyReminder(e.target.checked);
                handleUpdate({ dailyReminder: e.target.checked });
              }}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        {dailyReminder && (
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label className="flabel" style={{ fontSize: '11px', margin: 0 }}>REMINDER TIME</label>
            <input
              type="time"
              value={reminderTime}
              onChange={e => {
                setReminderTime(e.target.value);
                handleUpdate({ reminderTime: e.target.value });
              }}
              style={{
                background: 'var(--input-bg)',
                border: '1.5px solid var(--input-border)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: 'var(--text)',
                font: '800 13px Urbanist',
                outline: 'none'
              }}
            />
          </div>
        )}
      </div>

      {/* Milestone alerts toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--rail-border)' }}>
        <div>
          <div style={{ font: '800 14px Urbanist', color: 'var(--text)' }}>Milestone alerts</div>
          <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>Celebrate every unlock</div>
        </div>
        <label className="toggle-switch">
          <input 
            type="checkbox" 
            checked={streakNotif}
            onChange={e => {
              setStreakNotif(e.target.checked);
              handleUpdate({ streakNotif: e.target.checked });
            }}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      {/* Weekly digest email toggle */}
      <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--rail-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ font: '800 14px Urbanist', color: 'var(--text)' }}>Weekly digest email</div>
            <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>Sunday recap of your grind</div>
          </div>
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={weeklyReview}
              onChange={e => {
                setWeeklyReview(e.target.checked);
                handleUpdate({ weeklyReview: e.target.checked });
              }}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        {weeklyReview && (
          <div style={{ marginTop: '10px' }}>
            <span 
              onClick={() => setIsWeeklyPreviewOpen(true)}
              style={{ color: '#E5A83C', cursor: 'pointer', fontWeight: 800, fontSize: '13px', textDecoration: 'underline' }}
            >
              Preview what you'll receive →
            </span>
          </div>
        )}
      </div>

      {/* Streak at risk alert toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--rail-border)' }}>
        <div>
          <div style={{ font: '800 14px Urbanist', color: 'var(--text)' }}>Streak at risk alert</div>
          <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>Get aggressive alerts if no session logged by 22:00</div>
        </div>
        <label className="toggle-switch">
          <input 
            type="checkbox" 
            checked={streakRiskAlert}
            onChange={e => setStreakRiskAlert(e.target.checked)}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      {/* Segmented Selector for notification methods */}
      <div>
        <label className="flabel" style={{ fontSize: '10px', marginBottom: '8px' }}>NOTIFICATION METHODS</label>
        <div style={{
          display: 'flex',
          background: 'var(--input-bg)',
          borderRadius: '10px',
          padding: '4px',
          border: '1.5px solid var(--rail-border)'
        }}>
          {['inapp', 'both', 'push'].map((method) => {
            const labelMap = { inapp: 'In-app only', both: 'In-app + Email', push: 'Push Notifications' };
            const isSelected = notifMethod === method;
            return (
              <button
                key={method}
                onClick={() => {
                  setNotifMethod(method);
                  localStorage.setItem('sv_notif_method', method);
                  showMessage('Notification method updated');
                }}
                style={{
                  flex: 1,
                  background: isSelected ? 'var(--text)' : 'transparent',
                  color: isSelected ? 'var(--page)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  font: '800 12px Urbanist',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {labelMap[method]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderAppearanceSection = () => (
    <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <span style={{ font: '900 16px Urbanist', color: 'var(--text)' }}>Appearance</span>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {/* Light Mode */}
        <button 
          type="button"
          onClick={() => setTheme('light')}
          style={{
            background: 'none',
            border: theme === 'light' ? '2.5px solid #E5A83C' : '1.5px solid var(--rail-border)',
            borderRadius: '16px',
            padding: '12px',
            cursor: 'pointer',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ width: '100%', height: '48px', background: '#F4F2F8', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)' }}></div>
          <span style={{ font: '800 13px Urbanist', color: theme === 'light' ? '#E5A83C' : 'var(--text)' }}>Light</span>
        </button>

        {/* Dark Mode */}
        <button 
          type="button"
          onClick={() => setTheme('dark')}
          style={{
            background: 'none',
            border: theme === 'dark' ? '2.5px solid #E5A83C' : '1.5px solid var(--rail-border)',
            borderRadius: '16px',
            padding: '12px',
            cursor: 'pointer',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ width: '100%', height: '48px', background: '#100D18', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}></div>
          <span style={{ font: '800 13px Urbanist', color: theme === 'dark' ? '#E5A83C' : 'var(--text)' }}>Dark</span>
        </button>

        {/* Auto Mode (Diagonal linear gradient) */}
        <button 
          type="button"
          onClick={() => setTheme('auto')}
          style={{
            background: 'none',
            border: theme === 'auto' ? '2.5px solid #E5A83C' : '1.5px solid var(--rail-border)',
            borderRadius: '16px',
            padding: '12px',
            cursor: 'pointer',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ 
            width: '100%', 
            height: '48px', 
            background: 'linear-gradient(135deg, #F4F2F8 50%, #100D18 50%)', 
            borderRadius: '8px', 
            border: '1px solid rgba(0,0,0,0.06)' 
          }}></div>
          <span style={{ font: '800 13px Urbanist', color: theme === 'auto' ? '#E5A83C' : 'var(--text)' }}>Auto</span>
        </button>
      </div>
    </div>
  );

  const renderPrivacySection = () => (
    <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <span style={{ font: '900 16px Urbanist', color: 'var(--text)' }}>Privacy & Backup</span>
      <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', lineHeight: '1.5' }}>
        Export a full backup of all tracks, milestones, and sessions to your computer, or import a previously saved JSON snapshot.
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button 
          onClick={handleExportData}
          style={{
            background: 'var(--text)',
            color: 'var(--page)',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          Export all my data
        </button>
        
        <label 
          style={{
            background: 'var(--input-bg)',
            border: '1.5px solid var(--rail-border)',
            color: 'var(--text)',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          Import from backup
          <input 
            type="file" 
            accept=".json" 
            onChange={handleImportFileSelected}
            style={{ display: 'none' }}
          />
        </label>
      </div>
    </div>
  );

  const renderDangerSection = () => (
    <div 
      className="card" 
      style={{ 
        padding: '28px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px', 
        background: 'var(--dk-danger-bg, #FEF2F2)',
        border: '1.5px solid rgba(239, 68, 68, 0.2)'
      }}
    >
      <span style={{ font: '900 16px Urbanist', color: '#EF4444' }}>Danger zone</span>
      <div style={{ font: '600 13.5px Urbanist', color: 'var(--text)', lineHeight: '1.5' }}>
        Deleting your account erases every track, log and milestone. No undo.
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button 
          className="pillbtn" 
          onClick={() => setIsDeleteAccountOpen(true)}
          style={{ background: '#ef4444', color: '#ffffff', font: '700 13px Urbanist', padding: '10px 20px', cursor: 'pointer' }} 
          type="button"
        >
          Delete account
        </button>
        <button 
          className="ghostpill" 
          onClick={handleSignoutEverywhere}
          style={{ font: '700 13px Urbanist', padding: '10px 20px', cursor: 'pointer', border: '1.5px solid #EF4444', color: '#EF4444' }} 
          type="button"
        >
          Sign out of all devices
        </button>
      </div>
    </div>
  );

  const renderSectionContent = (id) => {
    switch (id) {
      case 'account':
        return renderAccountSection();
      case 'notifications':
        return renderNotificationsSection();
      case 'appearance':
        return renderAppearanceSection();
      case 'privacy':
        return renderPrivacySection();
      case 'danger':
        return renderDangerSection();
      default:
        return null;
    }
  };

  const sections = [
    { id: 'account', label: 'Account', icon: <IconUser size={16} /> },
    { id: 'notifications', label: 'Notifications', icon: <IconBell size={16} /> },
    { id: 'appearance', label: 'Appearance', icon: <IconPalette size={16} /> },
    { id: 'privacy', label: 'Privacy', icon: <IconLock size={16} /> },
    { id: 'danger', label: 'Danger zone', icon: <IconAlertTriangle size={16} /> }
  ];

  return (
    <div className="page active" id="page-settings" style={{ paddingBottom: '48px' }}>
      {message && (
        <div className="toast show" style={{ zIndex: 1000, font: '800 13.5px Urbanist', borderRadius: '12px' }}>
          {message}
        </div>
      )}

      {isMobile ? (
        // Mobile Accordion Layout
        <div>
          <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
          <h1 className="dashboard-title" style={{ fontSize: '32px', marginBottom: '4px' }}>Settings</h1>
          <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginBottom: '24px' }}>Your account. Your preferences.</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sections.map(s => {
              const isOpen = activeSection === s.id;
              return (
                <div key={s.id} style={{ border: '1.5px solid var(--rail-border)', borderRadius: '12px', overflow: 'hidden' }}>
                  <button
                    onClick={() => setActiveSection(isOpen ? null : s.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px',
                      background: isOpen ? 'rgba(229, 168, 60, 0.08)' : 'var(--card-bg)',
                      border: 'none',
                      font: '800 15px Urbanist',
                      color: isOpen ? '#E5A83C' : 'var(--text)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {s.icon}
                      <span>{s.label}</span>
                    </div>
                    <span>{isOpen ? '▼' : '▶'}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '16px', background: 'var(--page)' }}>
                      {renderSectionContent(s.id)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Desktop Two-Column Layout
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '48px', alignItems: 'start', marginTop: '20px' }}>
          {/* Left Column Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'sticky', top: '100px' }}>
            <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
            <h1 className="dashboard-title" style={{ fontSize: '32px', marginBottom: '4px' }}>Settings</h1>
            <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginBottom: '24px' }}>Your account. Your preferences.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sections.map(s => {
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveSection(s.id);
                      const el = document.getElementById(`sect-${s.id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      font: '700 14px Urbanist',
                      color: isActive ? '#E5A83C' : 'var(--text-muted)',
                      background: isActive ? 'rgba(229, 168, 60, 0.08)' : 'transparent',
                      textAlign: 'left',
                      width: '100%',
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ display: 'flex', opacity: isActive ? 1 : 0.7 }}>
                      {s.icon}
                    </span>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '680px' }}>
            {sections.map(s => (
              <div key={s.id} id={`sect-${s.id}`}>
                {renderSectionContent(s.id)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CHANGE EMAIL MODAL */}
      {isChangeEmailOpen && (
        <div className="scrim" onClick={() => setIsChangeEmailOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Change Email Address</span>
              <span className="modal-close" onClick={() => setIsChangeEmailOpen(false)}>×</span>
            </div>
            <p style={{ font: '600 13px Urbanist', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
              A confirmation link will be sent to your new email. Click it to complete the change.
            </p>
            <form onSubmit={handleSaveEmail} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="flabel">NEW EMAIL ADDRESS</label>
                <input 
                  type="email" 
                  required
                  className="field" 
                  value={newEmail} 
                  onChange={e => setNewEmail(e.target.value)} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="ghostpill" onClick={() => setIsChangeEmailOpen(false)}>Cancel</button>
                <button type="submit" className="pillbtn">Send Confirmation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE USERNAME MODAL */}
      {isChangeUsernameOpen && (
        <div className="scrim" onClick={() => setIsChangeUsernameOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Change Username</span>
              <span className="modal-close" onClick={() => setIsChangeUsernameOpen(false)}>×</span>
            </div>
            <form onSubmit={handleSaveUsername} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="flabel">NEW USERNAME</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    required
                    className="field" 
                    value={newUsername} 
                    onChange={e => setNewUsername(e.target.value)} 
                  />
                  {checkingUsername && (
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      Checking...
                    </span>
                  )}
                </div>
                {usernameAvailability.checked && (
                  <div style={{ 
                    marginTop: '6px', 
                    fontSize: '12px', 
                    fontWeight: 700, 
                    color: usernameAvailability.available ? '#10B981' : '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {usernameAvailability.available ? <IconCheck size={14} /> : <IconX size={14} />}
                    {usernameAvailability.message}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="ghostpill" onClick={() => setIsChangeUsernameOpen(false)}>Cancel</button>
                <button type="submit" className="pillbtn" disabled={!usernameAvailability.available}>Save Username</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {isChangePasswordOpen && (
        <div className="scrim" onClick={() => setIsChangePasswordOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Change Password</span>
              <span className="modal-close" onClick={() => setIsChangePasswordOpen(false)}>×</span>
            </div>
            <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="flabel">NEW PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    required
                    minLength={6}
                    className="field" 
                    style={{ paddingRight: '40px', width: '100%' }}
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    {showNewPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="flabel">CONFIRM NEW PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    required
                    className="field" 
                    style={{ paddingRight: '40px', width: '100%' }}
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    {showConfirmPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="ghostpill" onClick={() => setIsChangePasswordOpen(false)}>Cancel</button>
                <button type="submit" className="pillbtn">Update Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WEEKLY DIGEST PREVIEW MODAL */}
      {isWeeklyPreviewOpen && (
        <div className="scrim" onClick={() => setIsWeeklyPreviewOpen(false)}>
          <div className="modal" style={{ maxWidth: '520px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Weekly Digest Email Preview</span>
              <span className="modal-close" onClick={() => setIsWeeklyPreviewOpen(false)}>×</span>
            </div>
            <div style={{ background: '#fff', color: '#100D18', borderRadius: '12px', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
              <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'bold' }}>SMARTAN VARSITY · DIGEST</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#111827', marginTop: '2px' }}> Grinde Recap: {getFirstName(user?.fullName, user?.email) || 'Smartan'}</div>
              </div>
              <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>Here is what you accomplished from Monday to Sunday:</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '20px 0' }}>
                <div style={{ background: '#f3f4f6', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase' }}>TIME LOGGED</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginTop: '4px' }}>4 hr 48 min</div>
                </div>
                <div style={{ background: '#f3f4f6', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase' }}>SESSIONS COMPLETE</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginTop: '4px' }}>4 sessions</div>
                </div>
              </div>

              <div style={{ background: '#fef3c7', borderRadius: '8px', padding: '12px', borderLeft: '4px solid #f59e0b', marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', color: '#b45309', fontWeight: 'bold', textTransform: 'uppercase' }}>BREAKTHROUGHS</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#78350f', marginTop: '4px' }}>🏆 Set up core API architecture and seed data migrations.</div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '24px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsWeeklyPreviewOpen(false)}
                  style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT RESTORE CONFIRM MODAL */}
      {isImportConfirmOpen && (
        <div className="scrim" onClick={() => setIsImportConfirmOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ color: 'red' }}>Import and Overwrite Data?</span>
              <span className="modal-close" onClick={() => setIsImportConfirmOpen(false)}>×</span>
            </div>
            
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6', fontWeight: 600 }}>
              <p><b>WARNING:</b> Importing this backup will permanently overwrite all current tracks, courses, modules, logs, calendar events, resources, and milestones.</p>
              <p style={{ marginTop: '8px' }}>This action CANNOT be undone. Are you absolutely sure you want to proceed?</p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="ghostpill" onClick={() => setIsImportConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="pillbtn" style={{ background: 'red', color: '#fff' }} onClick={executeImportData}>
                Overwrite & Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT DELETION MODAL */}
      {isDeleteAccountOpen && (
        <div className="scrim" onClick={() => setIsDeleteAccountOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ color: '#EF4444' }}>Permanently Delete Account?</span>
              <span className="modal-close" onClick={() => setIsDeleteAccountOpen(false)}>×</span>
            </div>
            
            <form onSubmit={handleDeleteAccountConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', fontWeight: 600 }}>
                <p>This action is irreversible and will delete your login credentials, profile details, and all logged learning data.</p>
                <p style={{ marginTop: '8px' }}>To confirm deletion, please type the word <b>DELETE</b> in the input field below.</p>
              </div>

              <div>
                <input 
                  type="text" 
                  required
                  placeholder="Type DELETE"
                  className="field" 
                  value={deleteConfirmText} 
                  onChange={e => setDeleteConfirmText(e.target.value)} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="ghostpill" onClick={() => setIsDeleteAccountOpen(false)}>Cancel</button>
                <button 
                  type="submit" 
                  className="pillbtn" 
                  style={{ background: '#EF4444', color: '#fff' }}
                  disabled={deleteConfirmText !== 'DELETE'}
                >
                  Delete Account Permanently
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}