import React from 'react';
import axios from 'axios';
import TrackIconRenderer from './components/TrackIconRenderer.jsx';
import { supabase } from './supabaseClient';

export const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `http://${window.location.hostname}:8000` : 'http://127.0.0.1:8000');

const api = axios.create({
  baseURL: API_URL,
});

// Attach Supabase session token to every request (auto-refreshed by Supabase SDK)
api.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    console.log(`[API Request] ${config.method.toUpperCase()} ${config.url} - session token present: ${!!session?.access_token}`);
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    } else {
      console.warn(`[API Request] No session token found for request to ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// On 401, sign out and redirect to login (if we actually sent a token that was rejected and we are not on login/signup pages)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      const sentToken = !!error.config?.headers?.Authorization;
      const isLoginPage = window.location.pathname.endsWith('/login') || window.location.pathname.endsWith('/signup');
      
      if (sentToken && !isLoginPage) {
        console.warn("[API] 401 Unauthorized received for authenticated request. Signing out...");
        await supabase.auth.signOut();
        window.location.href = '/login';
      } else {
        console.log("[API] 401 received for unauthenticated request or login/signup page. Skipping signout.");
      }
    }
    return Promise.reject(error);
  }
);

/**
 * renderTrackIcon — backwards-compatible helper used across the app.
 * Accepts either a track object (preferred) or a bare icon string (legacy).
 */
export const renderTrackIcon = (trackOrIcon, size = 16, style = {}) => {
  if (!trackOrIcon) return null;

  // If we received a full track object use the new renderer directly
  if (typeof trackOrIcon === 'object' && trackOrIcon !== null) {
    return React.createElement(TrackIconRenderer, { track: trackOrIcon, size, style });
  }

  // Legacy: bare icon string (emoji or URL)
  const icon = trackOrIcon;
  const isUrl = icon.startsWith('http') || icon.startsWith('/') || icon.includes('static');
  const syntheticTrack = {
    icon,
    icon_type: isUrl ? 'image' : 'emoji',
    icon_value: icon,
    icon_image_url: isUrl ? icon : null,
    icon_thumb_url: isUrl ? icon : null,
    name: '',
    color: 'var(--text)',
  };
  return React.createElement(TrackIconRenderer, { track: syntheticTrack, size, style });
};

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

// Activity Log Render Helpers
import { 
  IconBolt, 
  IconTrophy, 
  IconRefresh, 
  IconAlertCircle, 
  IconBell, 
  IconKey, 
  IconLogout, 
  IconAward 
} from '@tabler/icons-react';

export const renderActivityIcon = (eventType, size = 16) => {
  switch (eventType) {
    case 'session_logged':
      return React.createElement(IconBolt, { size, style: { color: '#ef4444' } });
    case 'milestone_recorded':
      return React.createElement(IconTrophy, { size, style: { color: '#f59e0b' } });
    case 'account_reactivated':
      return React.createElement(IconRefresh, { size, style: { color: '#10b981' } });
    case 'account_deactivated':
      return React.createElement(IconAlertCircle, { size, style: { color: '#ef4444' } });
    case 'notification_sent':
      return React.createElement(IconBell, { size, style: { color: '#3b82f6' } });
    case 'login':
      return React.createElement(IconLogout, { size, style: { color: '#6b7280' } });
    case 'password_reset_triggered':
      return React.createElement(IconKey, { size, style: { color: '#a855f7' } });
    case 'admin_role_granted':
      return React.createElement(IconAward, { size, style: { color: '#10b981' } });
    case 'admin_role_revoked':
      return React.createElement(IconAlertCircle, { size, style: { color: '#ef4444' } });
    default:
      return React.createElement(IconBolt, { size, style: { color: '#6b7280' } });
  }
};

export const renderActivityText = (a) => {
  const subject = a.userName || a.detail?.email || 'Someone';
  const actor = a.actorName || 'System';
  switch (a.eventType) {
    case 'session_logged':
      return `${subject} logged a ${a.detail?.duration}min ${a.detail?.trackName || 'session'}`;
    case 'milestone_recorded':
      return `${subject} hit a milestone: ${a.detail?.name}`;
    case 'account_reactivated':
      return `${subject}'s account was reactivated`;
    case 'account_deactivated':
      return `${subject}'s account was deactivated`;
    case 'notification_sent':
      return `${actor} sent a ${a.detail?.broadcast ? 'broadcast' : 'direct'} notification`;
    case 'password_reset_triggered':
      return `${actor} triggered a password reset for ${subject}`;
    case 'admin_role_granted':
      return `${subject} was granted admin role`;
    case 'admin_role_revoked':
      return `${subject} had admin role revoked`;
    default:
      return `${actor} performed event ${a.eventType}`;
  }
};

export const BLOOMS_TAXONOMY_SCALE = {
  1: {
    level: "Remember",
    desc: "Remember: I can recall basic terms, definitions, and facts from the session.",
    color: "#94a3b8" // Slate
  },
  2: {
    level: "Remember",
    desc: "Remember: I can identify key concepts and retrieve basic facts from memory.",
    color: "#94a3b8"
  },
  3: {
    level: "Understand",
    desc: "Understand: I can explain the concept in my own words and grasp the basic idea of how it works.",
    color: "#38bdf8" // Sky
  },
  4: {
    level: "Understand",
    desc: "Understand: I can summarize the concept and translate it to another context.",
    color: "#38bdf8"
  },
  5: {
    level: "Apply",
    desc: "Apply: I used the concept practically (wrote code, ran commands, completed exercises).",
    color: "#4ade80" // Green
  },
  6: {
    level: "Apply",
    desc: "Apply: I can successfully apply the concept to complete a standard task or assignment.",
    color: "#4ade80"
  },
  7: {
    level: "Analyze",
    desc: "Analyze: I can break this down, reason about edge cases, and debug issues.",
    color: "#facc15" // Yellow
  },
  8: {
    level: "Analyze",
    desc: "Analyze: I can see how this connects to other systems and compare different structural options.",
    color: "#facc15"
  },
  9: {
    level: "Evaluate",
    desc: "Evaluate: I can judge, critique, or compare approaches — knowing not just how but why this approach vs. another.",
    color: "#fb923c" // Orange
  },
  10: {
    level: "Create",
    desc: "Create: I can design/build something completely original, or teach the concept to others from first principles.",
    color: "#f472b6" // Pink
  }
};

export default api;
