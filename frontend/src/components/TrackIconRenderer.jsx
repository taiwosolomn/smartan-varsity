import React, { useState } from 'react';
import { getLibraryIcon } from './TrackIconLibrary.jsx';

const RAILWAY_URL = 'https://smartan-varsity-production.up.railway.app';
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

let resolvedApiUrl = import.meta.env.VITE_API_URL || '';

if (typeof window !== 'undefined' && !isLocalhost) {
  if (!resolvedApiUrl || resolvedApiUrl.includes('localhost') || resolvedApiUrl.includes('127.0.0.1')) {
    resolvedApiUrl = RAILWAY_URL;
  }
} else if (isLocalhost && !resolvedApiUrl) {
  resolvedApiUrl = 'http://localhost:8000';
}

const API_URL = resolvedApiUrl;

/**
 * TrackIconRenderer — Renders a track icon for any of the 3 icon types.
 *
 * Props:
 *   track        — { icon, icon_type, icon_value, icon_image_url, icon_thumb_url, name, color }
 *   size         — pixel size (number). Default: 32
 *   useThumb     — when true, prefer icon_thumb_url over icon_image_url. Default: false
 *   style        — additional inline styles applied to the outer wrapper
 *   className    — CSS class applied to the outer wrapper
 */
export default function TrackIconRenderer({
  track,
  size = 32,
  useThumb = false,
  style = {},
  className = '',
}) {
  const [imgError, setImgError] = useState(false);

  if (!track) return null;

  const { icon, icon_type, icon_value, icon_image_url, icon_thumb_url, name, color } = track;

  // Determine the effective type, falling back gracefully
  const effectiveType = icon_type || (
    (icon_image_url || (icon && (icon.startsWith('/') || icon.startsWith('http'))))
      ? 'image'
      : 'emoji'
  );

  // ── Fallback: colored square with first letter ──────────────────────────
  const Fallback = () => (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22) + 'px',
        background: color ? `${color}22` : 'var(--input-bg)',
        color: color || 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.45) + 'px',
        fontWeight: 800,
        fontFamily: 'Urbanist',
        userSelect: 'none',
        flexShrink: 0,
        ...style,
      }}
    >
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );

  // ── Image type ──────────────────────────────────────────────────────────
  if (effectiveType === 'image') {
    const rawUrl = useThumb
      ? (icon_thumb_url || icon_image_url || icon_value || icon)
      : (icon_image_url || icon_value || icon);

    if (!rawUrl || imgError) return <Fallback />;

    // Always build an absolute URL — relative paths like /static/... point to the
    // backend server (port 8000), NOT the frontend (port 5180).
    const src = rawUrl.startsWith('http')
      ? rawUrl
      : `${API_URL}${rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl}`;

    return (
      <img
        src={src}
        alt={`${name || 'Track'} icon`}
        className={className}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          objectFit: 'cover',
          borderRadius: Math.round(size * 0.22) + 'px',
          flexShrink: 0,
          display: 'block',
          ...style,
        }}
      />
    );
  }

  // ── Library type ────────────────────────────────────────────────────────
  if (effectiveType === 'library') {
    const libId = icon_value || icon;
    const libIcon = libId ? getLibraryIcon(libId) : null;
    if (!libIcon) return <Fallback />;

    return (
      <span
        className={className}
        role="img"
        aria-label={libIcon.label}
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          ...style,
        }}
      >
        <span style={{ width: size, height: size, display: 'flex', alignItems: 'center' }}>
          {React.cloneElement(libIcon.svg, {
            width: size,
            height: size,
            style: { display: 'block' },
          })}
        </span>
      </span>
    );
  }

  // ── Emoji type (default) ────────────────────────────────────────────────
  const emojiChar = icon_value || icon || '🧠';
  return (
    <span
      className={className}
      role="img"
      aria-label={`${name || 'Track'} icon`}
      style={{
        fontSize: size,
        lineHeight: 1,
        display: 'inline-block',
        userSelect: 'none',
        flexShrink: 0,
        ...style,
      }}
    >
      {emojiChar}
    </span>
  );
}
