import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import api, { formatDuration } from './api';
import { supabase } from './supabaseClient';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Tracks from './pages/Tracks';
import TrackView from './pages/TrackView';
import LogSession from './pages/LogSession';
import Analytics from './pages/Analytics';
import Calendar from './pages/Calendar';
import Resources from './pages/Resources';
import Profile from './pages/Profile';
import SettingsPage from './pages/Settings';
import Sessions from './pages/Sessions';
import ImportCurriculum from './pages/ImportCurriculum';
import ReviewCurriculum from './pages/ReviewCurriculum';

// Admin Page Imports
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminSmartans from './pages/AdminSmartans';
import AdminSmartanDetail from './pages/AdminSmartanDetail';
import AdminLeaderboard from './pages/AdminLeaderboard';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminComms from './pages/AdminComms';
import AdminProfile from './pages/AdminProfile';
import AdminTrackView from './pages/AdminTrackView';
import AdminSessions from './pages/AdminSessions';

import {
  IconLayoutDashboard,
  IconBooks,
  IconPencilPlus,
  IconChartBar,
  IconCalendar,
  IconFolderOpen,
  IconUser,
  IconSettings,
  IconLogout,
  IconSun,
  IconMoon,
  IconListCheck,
  IconBolt,
  IconMap,
  IconPuzzle,
  IconBell,
  IconTrophy,
  IconAward
} from '@tabler/icons-react';

// Create contexts
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const SettingsContext = createContext(null);
export const useSettings = () => useContext(SettingsContext);

const CustomDialogContext = createContext(null);
export const useCustomDialog = () => useContext(CustomDialogContext);

// Layout wrapper
function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, setTheme, settings } = useSettings();
  const { showConfirm } = useCustomDialog();
  const location = useLocation();
  const navigate = useNavigate();
  const [streak, setStreak] = useState(0);

  // Success moments and Confetti states
  const [successData, setSuccessData] = useState(null); // { type, duration, trackName }
  const [confetti, setConfetti] = useState([]);

  // Parse current path to highlight active nav
  const getActivePage = () => {
    const path = location.pathname;
    if (path === '/' || path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/tracks')) return 'tracks';
    if (path.startsWith('/log')) return 'log';
    if (path.startsWith('/sessions')) return 'sessions';
    if (path.startsWith('/analytics')) return 'analytics';
    if (path.startsWith('/calendar')) return 'calendar';
    if (path.startsWith('/resources')) return 'resources';
    if (path.startsWith('/profile')) return 'profile';
    if (path.startsWith('/settings')) return 'settings';
    return '';
  };

  const activePage = getActivePage();

  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [location.pathname]);

  // Fetch current streak
  useEffect(() => {
    api.get('/analytics/summary')
      .then(res => {
        setStreak(res.data.streak);
      })
      .catch(err => console.error(err));
  }, [location.pathname]);

  // Success listener
  useEffect(() => {
    const handleSuccess = (e) => {
      setSuccessData(e.detail);
      
      // Spawn confetti particles
      const newConfetti = [];
      const colors = ['#C25A3A', '#4285F4', '#34A853', '#FBBC05', '#A066CB', '#EA4335'];
      const shapes = ['square', 'circle', 'triangle', 'diamond'];
      for (let i = 0; i < 90; i++) {
        newConfetti.push({
          id: i,
          color: colors[Math.floor(Math.random() * colors.length)],
          left: Math.random() * 100, // percentage
          delay: Math.random() * 1.5,
          duration: 2.5 + Math.random() * 2.5,
          size: 6 + Math.random() * 8,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          tilt: Math.random() * 360
        });
      }
      setConfetti(newConfetti);
    };

    window.addEventListener('show-success', handleSuccess);
    return () => window.removeEventListener('show-success', handleSuccess);
  }, []);

  const getSuccessConfig = (type) => {
    switch (type) {
      case 'session_logged':
        return {
          title: 'Session logged successfully!',
          subtitle: `${formatDuration(successData?.duration || 90)} of ${successData?.trackName || 'Cybersecurity'}. That's momentum you can feel.`,
          color: '#C25A3A',
          icon: <IconBolt size={26} style={{ fill: '#C25A3A' }} />
        };
      case 'course_created':
        return {
          title: 'Course created successfully!',
          subtitle: 'Your new course is live and ready for modules.',
          color: '#1D4ED8',
          icon: <IconBooks size={26} />
        };
      case 'track_created':
        return {
          title: 'Track created successfully!',
          subtitle: "A brand new path to master. Let's fill it up.",
          color: '#047857',
          icon: <IconMap size={26} />
        };
      case 'module_added':
        return {
          title: 'Module added successfully!',
          subtitle: 'One more building block locked into place.',
          color: '#6B21A8',
          icon: <IconPuzzle size={26} />
        };
      case 'session_planned':
        return {
          title: 'Session planned!',
          subtitle: 'It’s on the calendar, show up for the future you.',
          color: '#0369A1',
          icon: <IconCalendar size={26} />
        };
      case 'resource_added':
        return {
          title: 'Resource added successfully!',
          subtitle: 'Saved to your library, ready whenever you need it.',
          color: '#D97706',
          icon: <IconFolderOpen size={26} />
        };
      default:
        return {
          title: 'Success!',
          subtitle: 'Action completed successfully.',
          color: '#C25A3A',
          icon: <IconBolt size={26} />
        };
    }
  };

  const navItems = [
    { page: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: <IconLayoutDashboard size={22} /> },
    { page: 'tracks', path: '/tracks', label: 'Tracks', icon: <IconBooks size={22} /> },
    { page: 'log', path: '/log', label: 'Log Session', icon: <IconPencilPlus size={22} /> },
    { page: 'sessions', path: '/sessions', label: 'Sessions & Milestones', icon: <IconListCheck size={22} /> },
    { page: 'analytics', path: '/analytics', label: 'Analytics', icon: <IconChartBar size={22} /> },
    { page: 'calendar', path: '/calendar', label: 'Calendar', icon: <IconCalendar size={22} /> },
    { page: 'resources', path: '/resources', label: 'Resources', icon: <IconFolderOpen size={22} /> },
    { page: 'profile', path: '/profile', label: 'Profile', icon: <IconUser size={22} /> }
  ];

  return (
    <>
      {/* SIDEBAR RAIL */}
      <aside className="rail">
        {/* LOGO */}
        <div 
          onClick={() => navigate('/dashboard')} 
          style={{ 
            width: '46px', 
            height: '46px', 
            borderRadius: '15px', 
            background: 'var(--text)', 
            color: 'var(--page)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontFamily: 'Urbanist, sans-serif', 
            fontSize: '22px', 
            fontWeight: '900', 
            cursor: 'pointer',
            marginBottom: '10px'
          }}
        >
          SV
        </div>

        {/* KENTE DIVIDER */}
        <div className="kthin" style={{ width: '46px', marginBottom: '16px', borderRadius: '999px' }} />

        {/* NAV ITEMS */}
        {navItems.map((item) => (
          <Link
            key={item.page}
            to={item.path}
            className={`rico ${activePage === item.page ? 'on' : ''}`}
            data-page={item.page}
          >
            {item.icon}
            <span className="nav-tooltip">{item.label}</span>
          </Link>
        ))}
        
        {/* SETTINGS */}
        <Link
          to="/settings"
          className={`rico ${activePage === 'settings' ? 'on' : ''}`}
          data-page="settings"
          style={{ marginTop: 'auto' }}
        >
          <IconSettings size={22} />
          <span className="nav-tooltip">Settings</span>
        </Link>

        {/* LOGOUT */}
        <a 
          onClick={async (e) => {
            e.preventDefault();
            const confirmLogout = await showConfirm("Log out of Smartan Varsity?", "Log Out");
            if (confirmLogout) {
              logout();
            }
          }} 
          className="rico" 
          style={{ cursor: 'pointer' }}
        >
          <IconLogout size={22} />
          <span className="nav-tooltip">Logout</span>
        </a>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <nav className="mobile-nav">
        <Link to="/dashboard" className={`rico ${activePage === 'dashboard' ? 'on' : ''}`}>
          <IconLayoutDashboard size={22} />
        </Link>
        <Link to="/tracks" className={`rico ${activePage === 'tracks' ? 'on' : ''}`}>
          <IconBooks size={22} />
        </Link>
        <Link to="/log" className="rico" style={{ background: 'var(--text)', color: 'var(--page)', borderRadius: '50%' }}>
          <IconPencilPlus size={22} />
        </Link>
        <Link to="/sessions" className={`rico ${activePage === 'sessions' ? 'on' : ''}`}>
          <IconListCheck size={22} />
        </Link>
        <Link to="/analytics" className={`rico ${activePage === 'analytics' ? 'on' : ''}`}>
          <IconChartBar size={22} />
        </Link>
        <Link to="/profile" className={`rico ${activePage === 'profile' ? 'on' : ''}`}>
          <IconUser size={22} />
        </Link>
      </nav>

      {/* MAIN CONTAINER */}
      <div className="app-container">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
              Smartan <span>Varsity</span>
            </div>
            <div className="topbar-page-title" style={{ textTransform: 'capitalize' }}>
              · {activePage === 'dashboard' ? 'Dashboard' : activePage || 'Home'}
            </div>
          </div>
          
          <div className="topbar-right">
            <div 
              style={(() => {
                if (streak === 0) {
                  return {
                    background: 'var(--input-bg)',
                    color: 'var(--text-muted)',
                    border: '1.5px solid var(--input-border)',
                    borderRadius: '99px',
                    padding: '4px 12px',
                    font: '800 12px Urbanist',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  };
                }
                let bg = '#C25A3A15';
                let col = '#C25A3A';
                let bdr = '1.5px solid #C25A3A50';
                let shd = 'none';
                if (streak >= 30) {
                  bg = '#D9770620';
                  col = '#D97706';
                  bdr = '1.5px solid #D97706';
                  shd = '0 0 10px rgba(217, 119, 6, 0.4)';
                } else if (streak >= 7) {
                  bg = '#C25A3A25';
                  col = '#C25A3A';
                  bdr = '1.5px solid #C25A3A';
                  shd = '0 0 10px rgba(194, 90, 58, 0.4)';
                }
                return {
                  background: bg,
                  color: col,
                  border: bdr,
                  boxShadow: shd,
                  borderRadius: '99px',
                  padding: '4px 12px',
                  font: '800 12px Urbanist',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.3s'
                };
              })()}
            >
              <span style={{ fontSize: '14px' }}>⚡</span>
              <span className="hide-on-mobile">{streak === 0 ? 'Start your streak' : `${streak} day streak`}</span>
              <span className="show-on-mobile-inline">{streak === 0 ? 'Start' : `${streak}d`}</span>
            </div>
            
            <div style={{ position: 'relative' }}>
              <button 
                className="iconbtn" 
                onClick={() => {
                  setIsNotifOpen(!isNotifOpen);
                  // Mark all unread notifications as read when opening the list
                  notifications.forEach(async (n) => {
                    if (!n.read) {
                      await api.post(`/notifications/${n.id}/read`);
                    }
                  });
                  fetchNotifications();
                }} 
                title="Notifications"
                style={{ cursor: 'pointer', position: 'relative' }}
              >
                <IconBell size={19} />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    border: '1.5px solid var(--topbar-bg, #fff)'
                  }} />
                )}
              </button>
              
              {isNotifOpen && (
                <div 
                  className="card"
                  style={{
                    position: 'absolute',
                    top: '40px',
                    right: 0,
                    width: '320px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: 'var(--shadow)',
                    border: '1px solid var(--input-border)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--input-border)', paddingBottom: '8px' }}>
                    <span style={{ font: '800 14px Urbanist', color: 'var(--text)' }}>Notifications</span>
                    <button 
                      className="ghostpill" 
                      onClick={() => setIsNotifOpen(false)}
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                    >
                      Close
                    </button>
                  </div>
                  
                  {notifications.length === 0 ? (
                    <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                      No new notifications
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        style={{ 
                          padding: '10px', 
                          borderRadius: '8px', 
                          background: n.read ? 'transparent' : 'var(--input-bg)',
                          borderLeft: n.read ? 'none' : '3px solid var(--accent)',
                          font: '600 12px Urbanist',
                          color: 'var(--text)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ lineHeight: '1.4' }}>{n.message}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <button className="iconbtn hide-on-mobile" onClick={() => navigate('/calendar')} title="Calendar">
              <IconCalendar size={19} />
            </button>
            
            <button 
              className="iconbtn" 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
              style={{ cursor: 'pointer' }}
            >
              {theme === 'dark' ? <IconSun size={19} /> : <IconMoon size={19} />}
            </button>
            
            <div 
              className="iconbtn" 
              onClick={() => navigate('/profile')} 
              title="Profile" 
              style={{ overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 0 }}
            >
              {user?.avatarUrl ? (
                <img 
                  src={`${api.defaults.baseURL || ''}${user.avatarUrl}`} 
                  alt="Avatar" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <span style={{ fontWeight: 800 }}>{user?.fullName?.charAt(0) || 'U'}</span>
              )}
            </div>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="main-content">
          <div className="page active">
            {children}
          </div>
        </main>
      </div>

      {/* Confetti overlay */}
      {successData && confetti.length > 0 && (
        <div className="confetti-container">
          {confetti.map(p => (
            <div
              key={p.id}
              className={`confetti-particle ${p.shape}`}
              style={{
                left: `${p.left}%`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                background: p.shape === 'triangle' ? 'transparent' : p.color,
                borderBottomColor: p.shape === 'triangle' ? p.color : 'transparent',
                width: p.shape === 'triangle' ? '0' : `${p.size}px`,
                height: p.shape === 'triangle' ? '0' : `${p.size}px`,
                transform: `rotate(${p.tilt}deg)`
              }}
            />
          ))}
        </div>
      )}

      {/* Success Moment Popup Modal */}
      {successData && (() => {
        const config = getSuccessConfig(successData.type);
        return (
          <div 
            className="scrim"
            style={{ 
              position: 'fixed', 
              inset: 0, 
              zIndex: 99999, 
              background: 'rgba(16, 13, 24, 0.45)', 
              backdropFilter: 'blur(3px)', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '24px' 
            }}
            onClick={() => setSuccessData(null)}
          >
            <div 
              style={{ 
                background: 'var(--card-bg)', 
                borderRadius: '24px', 
                padding: '36px', 
                width: '400px', 
                maxWidth: '100%', 
                textAlign: 'center', 
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '20px',
                position: 'relative' 
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Icon Container */}
              <div 
                style={{ 
                  background: `${config.color}15`, 
                  borderRadius: '50%', 
                  width: '60px', 
                  height: '60px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: '4px'
                }}
              >
                {config.icon}
              </div>

              {/* Success title */}
              <h3 style={{ font: '900 20px Urbanist', color: 'var(--text)', margin: 0 }}>
                {config.title}
              </h3>

              {/* Success description */}
              <p style={{ font: '600 13.5px/1.5 Urbanist', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                {config.subtitle}
              </p>

              {/* Close Button */}
              <button 
                type="button" 
                style={{ 
                  background: config.color, 
                  color: '#ffffff', 
                  border: 'none', 
                  borderRadius: '99px', 
                  height: '42px', 
                  width: '100%', 
                  maxWidth: '240px',
                  font: '800 14px Urbanist', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
                onClick={() => setSuccessData(null)}
              >
                Nice!
              </button>
            </div>


          </div>
        );
      })()}
    </>
  );
}

// Protected Route Guard
function PrivateRoute({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--page, #F4F2F8)', color: 'var(--text, #100D18)', fontFamily: 'Urbanist, sans-serif', fontWeight: 700 }}>
        Loading OS...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Email not yet confirmed — show waiting screen
  if (!session.user?.email_confirmed_at) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--page, #F4F2F8)', color: 'var(--text, #100D18)', fontFamily: 'Urbanist, sans-serif', gap: '16px', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '32px' }}>📧</div>
        <h2 style={{ font: '900 22px Urbanist', margin: 0 }}>Confirm your email</h2>
        <p style={{ font: '600 14px Urbanist', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: '1.6', margin: 0 }}>
          We sent a confirmation link to <strong>{session.user?.email}</strong>. Click it to activate your account, then refresh this page.
        </p>
        <button
          className="pillbtn"
          style={{ marginTop: '8px', height: '44px', padding: '0 28px' }}
          onClick={() => window.location.reload()}
        >
          I confirmed — refresh
        </button>
        <button
          className="ghostpill"
          style={{ fontSize: '13px' }}
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }}
        >
          Back to login
        </button>
      </div>
    );
  }

  return <Layout>{children}</Layout>;
}

// Protected Route Guard for Admins
function AdminPrivateRoute({ children }) {
  const { session, user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--page, #F4F2F8)', color: 'var(--text, #100D18)', fontFamily: 'Urbanist, sans-serif', fontWeight: 700 }}>
        Loading Admin Console...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user && user.role !== 'admin') {
    // If not admin, bounce back
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

// Layout wrapper for Admin Dashboard
function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useSettings();
  const { showConfirm } = useCustomDialog();
  const navigate = useNavigate();
  const location = useLocation();

  const activePage = location.pathname.split('/').pop() || 'dashboard';

  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [location.pathname]);

  const adminNavItems = [
    { page: 'dashboard', path: '/admin/dashboard', label: 'Dashboard', icon: <IconLayoutDashboard size={22} /> },
    { page: 'smartans', path: '/admin/smartans', label: 'Smartans Directory', icon: <IconBooks size={22} /> },
    { page: 'leaderboard', path: '/admin/leaderboard', label: 'Leaderboard', icon: <IconTrophy size={22} /> },
    { page: 'analytics', path: '/admin/analytics', label: 'Analytics', icon: <IconChartBar size={22} /> },
    { page: 'comms', path: '/admin/comms', label: 'Comms Center', icon: <IconBell size={22} /> },
    { page: 'profile', path: '/admin/profile', label: 'Admin Profile', icon: <IconUser size={22} /> }
  ];

  return (
    <>
      {/* ADMIN SIDEBAR */}
      <aside className="rail" style={{ borderRight: '1px solid var(--rail-border)' }}>
        <div 
          onClick={() => navigate('/admin/dashboard')}
          style={{ 
            width: '46px', 
            height: '46px', 
            background: 'var(--tab-active-border, #C25A3A)', 
            color: '#ffffff', 
            borderRadius: '15px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontFamily: 'Urbanist, sans-serif', 
            fontSize: '22px', 
            fontWeight: '900', 
            cursor: 'pointer',
            marginBottom: '10px'
          }}
        >
          SV
        </div>

        {/* KENTE DIVIDER */}
        <div className="kthin" style={{ width: '46px', marginBottom: '16px', borderRadius: '999px' }} />

        {/* NAV ITEMS */}
        {adminNavItems.map((item) => (
          <Link
            key={item.page}
            to={item.path}
            className={`rico ${activePage === item.page || (item.page === 'smartans' && location.pathname.includes('/admin/smartans/')) ? 'on' : ''}`}
            data-page={item.page}
          >
            {item.icon}
            <span className="nav-tooltip">{item.label}</span>
          </Link>
        ))}

        {/* SETTINGS */}
        <a
          className="rico"
          data-page="settings"
          style={{ marginTop: 'auto', cursor: 'pointer' }}
          onClick={() => {
            alert("Settings are managed in the student panel.");
          }}
        >
          <IconSettings size={22} />
          <span className="nav-tooltip">Settings</span>
        </a>

        {/* LOGOUT */}
        <a 
          onClick={async (e) => {
            e.preventDefault();
            const confirmLogout = await showConfirm("Log out of Varsity Admin?", "Log Out");
            if (confirmLogout) {
              await logout();
              navigate('/admin/login');
            }
          }} 
          className="rico" 
          style={{ cursor: 'pointer' }}
        >
          <IconLogout size={22} />
          <span className="nav-tooltip">Logout</span>
        </a>
      </aside>

      {/* ADMIN CONTAINER */}
      <div className="app-container">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-brand" onClick={() => navigate('/admin/dashboard')} style={{ cursor: 'pointer' }}>
              Smartan <span>Varsity — Admin</span>
            </div>
            <div className="topbar-page-title" style={{ textTransform: 'capitalize' }}>
              · {activePage}
            </div>
          </div>
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <button 
                className="iconbtn" 
                onClick={() => {
                  setIsNotifOpen(!isNotifOpen);
                  notifications.forEach(async (n) => {
                    if (!n.read) {
                      await api.post(`/notifications/${n.id}/read`);
                    }
                  });
                  fetchNotifications();
                }} 
                title="Notifications"
                style={{ cursor: 'pointer', position: 'relative' }}
              >
                <IconBell size={19} />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    border: '1.5px solid var(--topbar-bg, #fff)'
                  }} />
                )}
              </button>
              
              {isNotifOpen && (
                <div 
                  className="card"
                  style={{
                    position: 'absolute',
                    top: '40px',
                    right: 0,
                    width: '320px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: 'var(--shadow)',
                    border: '1px solid var(--input-border)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--input-border)', paddingBottom: '8px' }}>
                    <span style={{ font: '800 14px Urbanist', color: 'var(--text)' }}>Notifications</span>
                    <button 
                      className="ghostpill" 
                      onClick={() => setIsNotifOpen(false)}
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                    >
                      Close
                    </button>
                  </div>
                  
                  {notifications.length === 0 ? (
                    <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                      No new notifications
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        style={{ 
                          padding: '10px', 
                          borderRadius: '8px', 
                          background: n.read ? 'transparent' : 'var(--input-bg)',
                          borderLeft: n.read ? 'none' : '3px solid var(--accent)',
                          font: '600 12px Urbanist',
                          color: 'var(--text)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ lineHeight: '1.4' }}>{n.message}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <button 
              className="iconbtn" 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Theme Toggle"
            >
              {theme === 'dark' ? <IconSun size={19} /> : <IconMoon size={19} />}
            </button>
            <div 
              style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                background: '#e0f2fe', 
                color: '#0284c7', 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: '900 13px Urbanist'
              }}
            >
              {user?.fullName?.charAt(0).toUpperCase() || 'A'}
            </div>
          </div>
        </header>
        <main className="main-content">
          <div className="page active" style={{ padding: '32px' }}>
            {children}
          </div>
        </main>
      </div>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [theme, setTheme] = useState('auto');
  const [loading, setLoading] = useState(true);

  const [isDeactivated, setIsDeactivated] = useState(false);

  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm',
    onConfirm: null,
    onCancel: null
  });

  const showConfirm = (message, title = 'Confirm Action') => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title,
        message,
        type: 'confirm',
        onConfirm: () => {
          setDialogState(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setDialogState(prev => ({ ...prev, isOpen: false }));
          resolve(false);
        }
      });
    });
  };

  const showAlert = (message, title = 'Notification') => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title,
        message,
        type: 'alert',
        onConfirm: () => {
          setDialogState(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: null
      });
    });
  };

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
      setIsDeactivated(false);
    } catch (err) {
      console.error('fetchUser error:', err);
      if (err.response && err.response.status === 403 && err.response.data?.detail === "Account deactivated") {
        setIsDeactivated(true);
      }
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
      if (res.data.theme) {
        setTheme(res.data.theme);
      }
    } catch (err) {
      console.error('fetchSettings error:', err);
    }
  };

  // Initialise from Supabase session on mount, then listen for auth state changes
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(existingSession);
      if (existingSession?.user?.email_confirmed_at) {
        fetchUser();
        fetchSettings();
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        if (newSession?.user?.email_confirmed_at) {
          fetchUser();
          fetchSettings();
        } else if (!newSession) {
          setUser(null);
          setSettings(null);
          try {
            localStorage.removeItem('sv_dashboard_cache');
            localStorage.removeItem('sv_dashboard_cache_timestamp');
            localStorage.removeItem('sv_tracks_cache');
            localStorage.removeItem('sv_tracks_cache_timestamp');
            localStorage.removeItem('sv_profile_cache');
            localStorage.removeItem('sv_profile_cache_timestamp');
            localStorage.removeItem('sv_resources_cache');
            localStorage.removeItem('sv_resources_cache_ts');
            localStorage.removeItem('sv_sessions_tracks_cache');
            localStorage.removeItem('sv_sessions_tracks_cache_ts');
            localStorage.removeItem('sv_analytics_cache');
            localStorage.removeItem('sv_analytics_cache_ts');
            localStorage.removeItem('sv_trackview_cache');
            localStorage.removeItem('sv_trackview_cache_ts');
            localStorage.removeItem('sv_cal_tracks');
            localStorage.removeItem('sv_cal_tracks_ts');
            localStorage.removeItem('sv_cal_months');
          } catch (e) {}
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    try {
      localStorage.removeItem('sv_dashboard_cache');
      localStorage.removeItem('sv_dashboard_cache_timestamp');
      localStorage.removeItem('sv_tracks_cache');
      localStorage.removeItem('sv_tracks_cache_timestamp');
      localStorage.removeItem('sv_profile_cache');
      localStorage.removeItem('sv_profile_cache_timestamp');
      localStorage.removeItem('sv_resources_cache');
      localStorage.removeItem('sv_resources_cache_ts');
      localStorage.removeItem('sv_sessions_tracks_cache');
      localStorage.removeItem('sv_sessions_tracks_cache_ts');
      localStorage.removeItem('sv_analytics_cache');
      localStorage.removeItem('sv_analytics_cache_ts');
      localStorage.removeItem('sv_trackview_cache');
      localStorage.removeItem('sv_trackview_cache_ts');
      localStorage.removeItem('sv_cal_tracks');
      localStorage.removeItem('sv_cal_tracks_ts');
      localStorage.removeItem('sv_cal_months');
    } catch (e) {}
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setSettings(null);
  };

  // Evaluate final dark class trigger
  const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'auto' && isSystemDark);

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dk');
    } else {
      document.body.classList.remove('dk');
    }
  }, [isDark]);

  const authValue = { session, user, loading, login, logout, fetchUser };
  const settingsValue = { settings, refreshSettings: fetchSettings, theme, setTheme };

  return (
    <AuthContext.Provider value={authValue}>
      <SettingsContext.Provider value={settingsValue}>
        <CustomDialogContext.Provider value={{ showConfirm, showAlert }}>
          <div className={`frame ${isDark ? 'dk' : ''}`}>
            {isDeactivated ? (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--page, #F4F2F8)', color: 'var(--text, #100D18)', fontFamily: 'Urbanist, sans-serif', gap: '16px', padding: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px' }}>🔒</div>
                <h2 style={{ font: '900 22px Urbanist', margin: 0 }}>Account Deactivated</h2>
                <p style={{ font: '600 14px Urbanist', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: '1.6', margin: 0 }}>
                  Your account has been deactivated by an administrator. If you believe this is a mistake, please reach out to support.
                </p>
                <button
                  className="ghostpill"
                  style={{ fontSize: '13px', marginTop: '16px', cursor: 'pointer' }}
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setIsDeactivated(false);
                    window.location.href = '/login';
                  }}
                >
                  Back to login
                </button>
              </div>
            ) : (
              <Router>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  
                  <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                  <Route path="/tracks" element={<PrivateRoute><Tracks /></PrivateRoute>} />
                  <Route path="/tracks/:trackId" element={<PrivateRoute><TrackView /></PrivateRoute>} />
                  <Route path="/log" element={<PrivateRoute><LogSession /></PrivateRoute>} />
                  <Route path="/sessions" element={<PrivateRoute><Sessions /></PrivateRoute>} />
                  <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
                  <Route path="/calendar" element={<PrivateRoute><Calendar /></PrivateRoute>} />
                  <Route path="/resources" element={<PrivateRoute><Resources /></PrivateRoute>} />
                  <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                  <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
                  <Route path="/import-curriculum" element={<PrivateRoute><ImportCurriculum /></PrivateRoute>} />
                  <Route path="/import-curriculum/:importId" element={<PrivateRoute><ReviewCurriculum /></PrivateRoute>} />

                  {/* Admin routes */}
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/admin/dashboard" element={<AdminPrivateRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminPrivateRoute>} />
                  <Route path="/admin/smartans" element={<AdminPrivateRoute><AdminLayout><AdminSmartans /></AdminLayout></AdminPrivateRoute>} />
                  <Route path="/admin/smartans/:id" element={<AdminPrivateRoute><AdminLayout><AdminSmartanDetail /></AdminLayout></AdminPrivateRoute>} />
                  <Route path="/admin/leaderboard" element={<AdminPrivateRoute><AdminLayout><AdminLeaderboard /></AdminLayout></AdminPrivateRoute>} />
                  <Route path="/admin/analytics" element={<AdminPrivateRoute><AdminLayout><AdminAnalytics /></AdminLayout></AdminPrivateRoute>} />
                  <Route path="/admin/comms" element={<AdminPrivateRoute><AdminLayout><AdminComms /></AdminLayout></AdminPrivateRoute>} />
                  <Route path="/admin/profile" element={<AdminPrivateRoute><AdminLayout><AdminProfile /></AdminLayout></AdminPrivateRoute>} />
                  <Route path="/admin/smartans/:id/tracks/:trackId" element={<AdminPrivateRoute><AdminLayout><AdminTrackView /></AdminLayout></AdminPrivateRoute>} />
                  <Route path="/admin/smartans/:id/sessions" element={<AdminPrivateRoute><AdminLayout><AdminSessions /></AdminLayout></AdminPrivateRoute>} />
                  
                  {/* Fallbacks */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Router>
            )}
          </div>

          {/* RENDER CUSTOM DIALOG OVERLAY */}
          {dialogState.isOpen && (
            <div className="scrim" style={{ zIndex: 9999 }} onClick={dialogState.type === 'alert' ? dialogState.onConfirm : undefined}>
              <div className="modal" style={{ width: '400px', maxWidth: '90%', padding: '28px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                <div className="kthin" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
                <h3 style={{ font: '900 18px Urbanist', color: 'var(--text)', marginBottom: '12px', marginTop: '4px' }}>{dialogState.title}</h3>
                <p style={{ font: '600 14px Urbanist', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '24px' }}>{dialogState.message}</p>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  {dialogState.type === 'confirm' && (
                    <button 
                      className="ghostpill" 
                      onClick={dialogState.onCancel}
                      style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    className="pillbtn" 
                    onClick={dialogState.onConfirm}
                    style={{ 
                      background: dialogState.title.toLowerCase().includes('delete') || dialogState.title.toLowerCase().includes('remove') || dialogState.title.toLowerCase().includes('clear') || dialogState.message.toLowerCase().includes('delete') || dialogState.message.toLowerCase().includes('remove') ? '#ef4444' : 'var(--text)', 
                      color: dialogState.title.toLowerCase().includes('delete') || dialogState.title.toLowerCase().includes('remove') || dialogState.title.toLowerCase().includes('clear') || dialogState.message.toLowerCase().includes('delete') || dialogState.message.toLowerCase().includes('remove') ? '#fff' : 'var(--page)',
                      padding: '8px 16px', 
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {dialogState.type === 'confirm' ? 'Confirm' : 'OK'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </CustomDialogContext.Provider>
      </SettingsContext.Provider>
    </AuthContext.Provider>
  );
}
