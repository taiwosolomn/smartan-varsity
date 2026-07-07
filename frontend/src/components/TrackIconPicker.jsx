import React, { useState, useRef, useCallback } from 'react';
import { TRACK_ICON_LIBRARY, ALL_LIBRARY_ICONS } from './TrackIconLibrary.jsx';
import api, { API_URL } from '../api.js';

const SUGGESTED_EMOJIS = [
  '🧠', '🛡️', '📐', '🧬', '⚙️', '💻', '🔬', '📊', '🎯', '🚀',
  '⚡', '🌐', '📚', '🔐', '🧪', '🔭', '💡', '🏗️', '🎓', '🔥',
  '🎨', '🎵', '🏋️', '🌿', '🧘', '🤝', '📈', '🔮', '🌍', '💎',
];

/**
 * TrackIconPicker — 3-tab icon picker
 *
 * Props:
 *   value        — { type: 'emoji'|'image'|'library', value: string, imageUrl?: string, thumbUrl?: string }
 *   onChange     — (iconState) => void
 *   usedIcons    — array of icon values already used by other tracks (for emoji clash detection)
 *   trackColor   — the track's accent color (for preview)
 */
export default function TrackIconPicker({ value, onChange, usedIcons = [], trackColor = '#cc3333' }) {
  const [tab, setTab] = useState(value?.type || 'emoji');
  const [customEmoji, setCustomEmoji] = useState(value?.type === 'emoji' ? value.value : '');
  const [libSearch, setLibSearch] = useState('');
  const [libCategory, setLibCategory] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const emit = (type, val, imageUrl, thumbUrl) =>
    onChange({ type, value: val, imageUrl: imageUrl || null, thumbUrl: thumbUrl || null });

  const filteredLibIcons = ALL_LIBRARY_ICONS.filter(icon => {
    const matchesSearch = !libSearch || icon.label.toLowerCase().includes(libSearch.toLowerCase());
    const matchesCat = libCategory === 'all' || 
      Object.entries(TRACK_ICON_LIBRARY).some(([cat, icons]) =>
        cat === libCategory && icons.some(i => i.id === icon.id)
      );
    return matchesSearch && matchesCat;
  });

  // ── Upload handler ────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (JPG, PNG, WebP, GIF).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadError('File is too large. Maximum size is 15 MB.');
      return;
    }
    setUploadError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/tracks/upload-icon', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      emit('image', res.data.iconUrl, res.data.iconUrl, res.data.thumbUrl || res.data.iconUrl);
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Upload failed. Please try again.';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  const onFileInputChange = e => {
    const file = e.target.files[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const onDrop = e => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const tabStyle = (t) => ({
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    borderRadius: '8px',
    background: tab === t ? 'var(--text)' : 'transparent',
    color: tab === t ? 'var(--page)' : 'var(--text-muted)',
    fontFamily: 'Urbanist',
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    letterSpacing: '0.3px',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Tab switcher ── */}
      <div style={{
        display: 'flex',
        gap: '4px',
        background: 'var(--input-bg)',
        borderRadius: '10px',
        padding: '4px',
      }}>
        <button type="button" style={tabStyle('emoji')}   onClick={() => setTab('emoji')}>   Emoji</button>
        <button type="button" style={tabStyle('library')} onClick={() => setTab('library')}> Library</button>
        <button type="button" style={tabStyle('image')}   onClick={() => setTab('image')}>   Upload</button>
      </div>

      {/* ── Emoji Tab ── */}
      {tab === 'emoji' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(10, 1fr)',
            gap: '5px',
          }}>
            {SUGGESTED_EMOJIS.map(emoji => {
              const inUse = usedIcons.some(u => u.type === 'emoji' && u.value === emoji);
              const selected = value?.type === 'emoji' && value?.value === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  disabled={inUse}
                  title={inUse ? `${emoji} already in use` : `Select ${emoji}`}
                  onClick={() => {
                    if (inUse) return;
                    setCustomEmoji(emoji);
                    emit('emoji', emoji);
                  }}
                  style={{
                    background: selected ? trackColor : 'var(--input-bg)',
                    border: selected ? `2px solid ${trackColor}` : '2px solid transparent',
                    borderRadius: '7px',
                    height: '30px',
                    fontSize: '15px',
                    cursor: inUse ? 'not-allowed' : 'pointer',
                    opacity: inUse ? 0.3 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s',
                    boxShadow: selected ? `0 0 0 2px ${trackColor}40` : 'none',
                  }}
                >{emoji}</button>
              );
            })}
          </div>
          <input
            className="field"
            placeholder="Or type a custom emoji…"
            value={customEmoji}
            maxLength={8}
            onChange={e => {
              const v = e.target.value;
              setCustomEmoji(v);
              if (v.trim()) emit('emoji', v.trim());
            }}
          />
        </div>
      )}

      {/* ── Library Tab ── */}
      {tab === 'library' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            className="field"
            placeholder="Search icons…"
            value={libSearch}
            onChange={e => setLibSearch(e.target.value)}
            style={{ marginBottom: 0 }}
          />
          {/* Category filter pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['all', ...Object.keys(TRACK_ICON_LIBRARY)].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setLibCategory(cat)}
                style={{
                  padding: '3px 10px',
                  borderRadius: '999px',
                  border: 'none',
                  background: libCategory === cat ? 'var(--text)' : 'var(--input-bg)',
                  color: libCategory === cat ? 'var(--page)' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontFamily: 'Urbanist',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
          {/* Icon grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '6px',
            maxHeight: '200px',
            overflowY: 'auto',
            paddingRight: '2px',
          }}>
            {filteredLibIcons.length === 0 && (
              <div style={{
                gridColumn: '1/-1',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '12px',
                padding: '20px 0',
              }}>No icons found</div>
            )}
            {filteredLibIcons.map(icon => {
              const selected = value?.type === 'library' && value?.value === icon.id;
              return (
                <button
                  key={icon.id}
                  type="button"
                  title={icon.label}
                  onClick={() => emit('library', icon.id)}
                  style={{
                    background: selected ? `${trackColor}22` : 'var(--input-bg)',
                    border: selected ? `2px solid ${trackColor}` : '2px solid transparent',
                    borderRadius: '10px',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: selected ? trackColor : 'var(--text-muted)',
                    transition: 'all 0.12s',
                    aspectRatio: '1',
                  }}
                >
                  <span style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center' }}>
                    {icon.svg}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Upload Tab ── */}
      {tab === 'image' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? trackColor : 'var(--card-border)'}`,
              borderRadius: '12px',
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              background: dragOver ? `${trackColor}10` : 'var(--input-bg)',
              transition: 'all 0.15s',
              position: 'relative',
              minHeight: '120px',
            }}
          >
            {uploading ? (
              <>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  border: `3px solid ${trackColor}30`,
                  borderTopColor: trackColor,
                  animation: 'spin 0.7s linear infinite',
                }}/>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Uploading…</div>
              </>
            ) : value?.type === 'image' && value?.imageUrl ? (
              <>
                <img
                  src={value.imageUrl.startsWith('http') ? value.imageUrl : `${API_URL}${value.imageUrl.startsWith('/') ? '' : '/'}${value.imageUrl}`}
                  alt="Track icon preview"
                  style={{
                    width: '80px', height: '80px',
                    borderRadius: '12px',
                    objectFit: 'cover',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  }}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Click or drop to replace
                </div>
              </>
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Drop image here</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>or click to browse · JPG, PNG, WebP · max 15 MB</div>
              </>
            )}
          </div>

          {uploadError && (
            <div style={{
              color: '#FF5E5E',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {uploadError}
            </div>
          )}

          {/* Clear button */}
          {value?.type === 'image' && value?.imageUrl && (
            <button
              type="button"
              onClick={() => emit('emoji', '🧠')}
              style={{
                background: 'transparent',
                border: '1.5px solid var(--card-border)',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12px',
                fontFamily: 'Urbanist',
                fontWeight: 700,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              Remove image
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
            style={{ display: 'none' }}
            onChange={onFileInputChange}
          />
        </div>
      )}
    </div>
  );
}
