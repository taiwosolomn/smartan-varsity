import React, { useState, useEffect, useRef } from 'react';
import api, { renderTrackIcon } from '../api';
import { IconPlus, IconExternalLink, IconX, IconChevronDown } from '@tabler/icons-react';

// Custom Broken Link Icon
function IconBrokenLink() {
  return (
    <svg 
      width="14" 
      height="14" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      style={{ color: '#F59E0B', verticalAlign: 'middle' }}
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

// LocalStorage-backed SWR cache
let resourcesCache = null;
let resourcesCacheTimestamp = 0;

try {
  const cv = localStorage.getItem('sv_resources_cache');
  const ct = localStorage.getItem('sv_resources_cache_ts');
  if (cv && ct) {
    resourcesCache = JSON.parse(cv);
    resourcesCacheTimestamp = parseInt(ct, 10);
  }
} catch (e) {}

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedTrackId, setSelectedTrackId] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, az, za, type
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Article');
  const [newTrackId, setNewTrackId] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newNotes, setNewNotes] = useState('');
  
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [autoDetectedLabel, setAutoDetectedLabel] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editResourceId, setEditResourceId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('Article');
  const [editTrackId, setEditTrackId] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Expander inline edit states
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [editingNotesId, setEditingNotesId] = useState(null);
  const [tempNotesText, setTempNotesText] = useState('');
  
  const [editingUrlId, setEditingUrlId] = useState(null);
  const [tempUrlText, setTempUrlText] = useState('');

  // Inline delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Optimistic Undo toast states
  const [undoToast, setUndoToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const undoToastRef = useRef(null);

  useEffect(() => {
    undoToastRef.current = undoToast;
  }, [undoToast]);

  useEffect(() => {
    return () => {
      if (undoToastRef.current) {
        clearTimeout(undoToastRef.current.timerId);
        api.delete(`/resources/${undoToastRef.current.id}`).catch(err => console.error(err));
      }
    };
  }, []);

  const searchRef = useRef(null);
  const cardGridRef = useRef(null);


  const fetchResourcesData = async (forceRefresh = false) => {
    // Invalidate stale in-memory cache if localStorage was cleared (e.g. logout)
    if (resourcesCache && !localStorage.getItem('sv_resources_cache')) {
      resourcesCache = null;
      resourcesCacheTimestamp = 0;
    }

    const now = Date.now();
    const hasValidCache = resourcesCache && 
      resourcesCache.resources && 
      resourcesCache.tracks && 
      (now - resourcesCacheTimestamp < 300000); // 5 min

    if (resourcesCache && resourcesCache.resources && resourcesCache.tracks && !forceRefresh) {
      // Show cached data instantly
      setResources(resourcesCache.resources);
      setTracks(resourcesCache.tracks);
      if (resourcesCache.tracks.length > 0 && !newTrackId) {
        setNewTrackId(resourcesCache.tracks[0].id);
      }
      setLoading(false);

      // Background refresh if stale
      if (!hasValidCache) {
        Promise.all([api.get('/tracks'), api.get('/resources')])
          .then(([tracksRes, resourcesRes]) => {
            const newData = { tracks: tracksRes.data, resources: resourcesRes.data };
            resourcesCache = newData;
            resourcesCacheTimestamp = Date.now();
            try {
              localStorage.setItem('sv_resources_cache', JSON.stringify(newData));
              localStorage.setItem('sv_resources_cache_ts', resourcesCacheTimestamp.toString());
            } catch (e) {}
            setTracks(newData.tracks);
            setResources(newData.resources);
          })
          .catch(err => console.error('Silent resources refresh failed', err));
      }
      return;
    }

    setLoading(true);
    try {
      // Parallel fetch — was sequential (2x waterfall round trips)
      const [tracksRes, resourcesRes] = await Promise.all([
        api.get('/tracks'),
        api.get('/resources')
      ]);
      const newData = { tracks: tracksRes.data, resources: resourcesRes.data };
      resourcesCache = newData;
      resourcesCacheTimestamp = Date.now();
      try {
        localStorage.setItem('sv_resources_cache', JSON.stringify(newData));
        localStorage.setItem('sv_resources_cache_ts', resourcesCacheTimestamp.toString());
      } catch (e) {}
      setTracks(newData.tracks);
      if (newData.tracks.length > 0 && !newTrackId) {
        setNewTrackId(newData.tracks[0].id);
      }
      setResources(newData.resources);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResourcesData();
  }, []);

  // Keyboard Escape clears search & returns focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setExpandedCardId(null);
        setSearch('');
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close card on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (expandedCardId && cardGridRef.current && !cardGridRef.current.contains(e.target)) {
        setExpandedCardId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [expandedCardId]);

  const invalidateCache = () => {
    resourcesCache = null;
    resourcesCacheTimestamp = 0;
    try {
      localStorage.removeItem('sv_resources_cache');
      localStorage.removeItem('sv_resources_cache_ts');
    } catch (e) {}
  };

  // Paste URL title / type pre-fetchers
  const handleUrlBlur = async () => {
    if (!newUrl || newUrl.trim() === '') return;

    // Detect type
    const detectedType = detectResourceType(newUrl);
    setNewType(detectedType);
    setAutoDetectedLabel(true);

    if (newTitle.trim() !== '') return;

    setFetchingTitle(true);
    try {
      const res = await api.get('/resources/fetch-title', { params: { url: newUrl.trim() } });
      if (res.data && res.data.title) {
        setNewTitle(res.data.title);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingTitle(false);
    }
  };

  const detectResourceType = (url) => {
    if (!url) return 'Article';
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'Video';
    if (lower.includes('arxiv.org') || lower.includes('doi.org')) return 'Paper';
    if (lower.includes('github.com')) return 'Tool';
    if (lower.includes('coursera.org') || lower.includes('udemy.com') || lower.includes('edx.org')) return 'Course';
    return 'Article';
  };

  const openAddResourceModal = () => {
    setNewTitle('');
    setNewType('Article');
    setNewUrl('');
    setNewNotes('');
    setAutoDetectedLabel(false);
    setSaveError('');
    if (tracks.length > 0) {
      setNewTrackId(tracks[0].id);
    }
    setIsModalOpen(true);
  };

  const handleCreateResource = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newTrackId) return;

    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        title: newTitle.trim(),
        type: newType,
        trackId: newTrackId,
        url: newUrl.trim() || null,
        notes: newNotes.trim() || null
      };

      const res = await api.post('/resources', payload);

      const newList = [res.data, ...resources];
      setResources(newList);
      
      // Update in-memory and persistent cache
      const updatedCache = { tracks, resources: newList };
      resourcesCache = updatedCache;
      resourcesCacheTimestamp = Date.now();
      try {
        localStorage.setItem('sv_resources_cache', JSON.stringify(updatedCache));
        localStorage.setItem('sv_resources_cache_ts', resourcesCacheTimestamp.toString());
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('show-success', {
        detail: { type: 'resource_added' }
      }));

      // Reset
      setNewTitle('');
      setNewType('Article');
      setNewUrl('');
      setNewNotes('');
      setAutoDetectedLabel(false);
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      setSaveError(typeof detail === 'string' ? detail : 'Failed to save resource. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const triggerDeleteResource = (id) => {
    const target = resources.find(r => r.id === id);
    if (!target) return;

    // Filter local list optimistically
    const optimisticList = resources.filter(r => r.id !== id);
    setResources(optimisticList);
    
    // Update in-memory and persistent cache immediately
    const updatedCache = { tracks, resources: optimisticList };
    resourcesCache = updatedCache;
    try {
      localStorage.setItem('sv_resources_cache', JSON.stringify(updatedCache));
    } catch (e) {}

    if (undoToast) {
      clearTimeout(undoToast.timerId);
      api.delete(`/resources/${undoToast.id}`).catch(err => console.error(err));
    }

    const timerId = setTimeout(async () => {
      try {
        await api.delete(`/resources/${id}`);
        invalidateCache();
      } catch (err) {
        console.error(err);
      }
      setUndoToast(null);
    }, 5000);

    setUndoToast({
      id,
      resource: target,
      timerId
    });
    setDeleteConfirmId(null);
  };

  const handleUndoDelete = () => {
    if (!undoToast) return;
    clearTimeout(undoToast.timerId);

    const restoredList = [undoToast.resource, ...resources];
    setResources(restoredList);
    
    // Restore in-memory and persistent cache
    const updatedCache = { tracks, resources: restoredList };
    resourcesCache = updatedCache;
    try {
      localStorage.setItem('sv_resources_cache', JSON.stringify(updatedCache));
    } catch (e) {}

    setUndoToast(null);
  };

  const handleSaveNotesInline = async (id, currentRes) => {
    try {
      const updatedNotes = tempNotesText.trim() || null;
      const payload = {
        title: currentRes.title,
        type: currentRes.type,
        trackId: currentRes.trackId,
        url: currentRes.url,
        notes: updatedNotes
      };
      const res = await api.put(`/resources/${id}`, payload);
      
      const updatedList = resources.map(r => r.id === id ? res.data : r);
      setResources(updatedList);
      resourcesCache = updatedList;

      setEditingNotesId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveUrlInline = async (id, currentRes) => {
    try {
      const updatedUrl = tempUrlText.trim() || null;
      const payload = {
        title: currentRes.title,
        type: currentRes.type,
        trackId: currentRes.trackId,
        url: updatedUrl,
        notes: currentRes.notes
      };
      const res = await api.put(`/resources/${id}`, payload);
      
      const updatedList = resources.map(r => r.id === id ? res.data : r);
      setResources(updatedList);
      resourcesCache = updatedList;

      setEditingUrlId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const openEditModal = (r) => {
    setEditResourceId(r.id);
    setEditTitle(r.title);
    setEditType(r.type);
    setEditTrackId(r.trackId);
    setEditUrl(r.url || '');
    setEditNotes(r.notes || '');
    setIsEditModalOpen(true);
    setExpandedCardId(null);
  };

  const handleUpdateResource = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: editTitle.trim(),
        type: editType,
        trackId: editTrackId,
        url: editUrl.trim() || null,
        notes: editNotes.trim() || null
      };

      const res = await api.put(`/resources/${editResourceId}`, payload);

      const updatedList = resources.map(r => r.id === editResourceId ? res.data : r);
      setResources(updatedList);
      resourcesCache = updatedList;

      setIsEditModalOpen(false);
      window.dispatchEvent(new CustomEvent('show-success', {
        detail: { type: 'resource_updated' }
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const highlightText = (text, searchWord) => {
    if (!searchWord || !text) return text;
    const regex = new RegExp(`(${searchWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} style={{ background: 'rgba(194, 90, 58, 0.25)', color: 'inherit', borderRadius: '2px', padding: '0 2px' }}>{part}</mark> : part
    );
  };

  // Badge count calculation pipeline
  const getBadgeCounts = () => {
    const counts = {
      types: { Article: 0, Video: 0, Book: 0, Tool: 0, Paper: 0, Course: 0, all: resources.length },
      tracks: {}
    };

    tracks.forEach(t => {
      counts.tracks[t.id] = 0;
    });
    counts.tracks['all'] = resources.length;

    resources.forEach(r => {
      if (selectedTrackId === 'all' || r.trackId === selectedTrackId) {
        if (counts.types[r.type] !== undefined) {
          counts.types[r.type]++;
        }
      }
      if (selectedType === 'all' || r.type === selectedType) {
        if (counts.tracks[r.trackId] !== undefined) {
          counts.tracks[r.trackId]++;
        }
      }
    });

    return counts;
  };

  const counts = getBadgeCounts();

  // Search & sorting pipeline logic
  const processedResources = resources
    .filter(r => {
      const query = search.toLowerCase().trim();
      const t = tracks.find(x => x.id === r.trackId);
      const trackName = t ? t.name.toLowerCase() : '';
      
      const matchesSearch = !query || 
        r.title.toLowerCase().includes(query) || 
        (r.notes && r.notes.toLowerCase().includes(query)) ||
        r.type.toLowerCase().includes(query) ||
        trackName.includes(query);

      const matchesType = selectedType === 'all' || r.type === selectedType;
      const matchesTrack = selectedTrackId === 'all' || r.trackId === selectedTrackId;
      
      return matchesSearch && matchesType && matchesTrack;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.addedAt) - new Date(a.addedAt);
      if (sortBy === 'oldest') return new Date(a.addedAt) - new Date(b.addedAt);
      if (sortBy === 'az') return a.title.localeCompare(b.title);
      if (sortBy === 'za') return b.title.localeCompare(a.title);
      if (sortBy === 'type') return a.type.localeCompare(b.type);
      return 0;
    });

  const typesList = ['Article', 'Video', 'Book', 'Tool', 'Paper', 'Course'];

  return (
    <div className="page active" id="page-resources">
      <style>{`
        .kthin {
          height: 4px;
          background: repeating-linear-gradient(90deg, #C25A3A 0 20%, #E5A83C 20% 40%, #2E6E4E 40% 60%, #1F4E79 60% 80%, #7A3F8F 80% 100%);
        }
        .resources-layout {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 32px;
          align-items: start;
        }
        .resource-sidebar {
          width: 180px;
          flex-shrink: 0;
          overflow-y: auto;
          max-height: calc(100vh - 200px);
          padding-right: 8px;
        }
        .resource-sidebar::-webkit-scrollbar {
          width: 4px;
        }
        .resource-sidebar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 99px;
        }
        .resource-card-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          align-content: start;
        }
        .resource-card {
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: var(--card-bg);
          padding: 24px;
          padding-top: 28px;
          position: relative;
          overflow: hidden;
          transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.2s, height 0.2s;
          display: flex;
          flex-direction: column;
          min-height: 190px;
        }
        .dk .resource-card {
          border: 1px solid rgba(255,255,255,0.08);
        }
        .resource-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }
        .card-del-btn {
          opacity: 0;
          transition: opacity 0.15s ease;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          display: flex;
        }
        .resource-card:hover .card-del-btn {
          opacity: 1;
        }
        .horizontal-filter-strip {
          display: none;
        }
        .res-open-btn {
          text-decoration: none; 
          padding: 6px 12px; 
          font: 700 11px Urbanist; 
          display: inline-flex; 
          align-items: center; 
          gap: 6px; 
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          color: var(--text-muted);
          border-radius: 6px;
          transition: all 0.15s ease;
        }
        .res-open-btn:hover {
          background: rgba(255,255,255,0.06);
          color: var(--text);
          border-color: var(--text-muted);
        }
        @media (max-width: 1023px) {
          .resources-layout {
            grid-template-columns: 1fr;
          }
          .resource-sidebar {
            display: none;
          }
          .horizontal-filter-strip {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 20px;
          }
          .filter-scroll-row {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 6px;
            -webkit-overflow-scrolling: touch;
          }
          .filter-scroll-row::-webkit-scrollbar {
            display: none;
          }
        }
        @media (max-width: 767px) {
          .resource-card-grid {
            grid-template-columns: 1fr;
          }
          .hide-on-mobile {
            display: none;
          }
        }
        .add-res-dashed-card {
          border: 2px dashed rgba(255,255,255,0.4);
          border-radius: 12px;
          background: transparent;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 190px;
          height: 100%;
          cursor: pointer;
          gap: 12px;
          color: var(--text-muted);
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          padding: 24px;
        }
        .dk .add-res-dashed-card {
          border: 2px dashed rgba(255,255,255,0.25);
        }
        .add-res-dashed-card:hover {
          background: rgba(255,255,255,0.02);
          border-color: rgba(255,255,255,0.45);
          color: var(--text);
        }
        .add-plus-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
          transition: transform 0.2s, border-color 0.2s, color 0.2s;
        }
        .add-res-dashed-card:hover .add-plus-circle {
          transform: rotate(90deg);
          border-color: var(--text);
          color: var(--text);
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* HEADER ACCENT BAR */}
      <div className="dashboard-header-row" style={{ marginBottom: '16px' }}>
        <div>
          <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
          <h1 className="dashboard-title">Resources</h1>
          <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
            Everything you're learning from, in one place.
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Search Field */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              ref={searchRef}
              className="field" 
              style={{ width: '220px', height: '40px', paddingRight: search ? '32px' : '12px' }}
              placeholder="Search resources..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => {
                  setSearch('');
                  searchRef.current?.focus();
                }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Clear search"
              >
                <IconX size={16} />
              </button>
            )}
          </div>
          <button className="pillbtn" onClick={openAddResourceModal}>
            <IconPlus size={16} />
            <span className="hide-on-mobile">Add resource</span>
          </button>
        </div>
      </div>

      {/* SUMMARY AND SORT BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--rail-border)', paddingBottom: '12px' }}>
        <div style={{ font: '600 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          {search || selectedType !== 'all' || selectedTrackId !== 'all' ? (
            <>
              Showing {processedResources.length} of {resources.length} resources
              {selectedTrackId !== 'all' && ` · ${tracks.find(t => t.id === selectedTrackId)?.name}`}
              {search && ` matching '${search}'`}
            </>
          ) : (
            `Showing ${resources.length} resources`
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ font: '700 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sort:</span>
          <div style={{ position: 'relative' }}>
            <select
              className="field"
              style={{ height: '28px', padding: '0 24px 0 8px', fontSize: '12px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '6px', cursor: 'pointer' }}
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="az">Title A–Z</option>
              <option value="za">Title Z–A</option>
              <option value="type">Type</option>
            </select>
          </div>
        </div>
      </div>

      {/* HORIZONTAL FILTERS UNDER 1024px */}
      <div className="horizontal-filter-strip">
        <div className="filter-scroll-row">
          <button
            onClick={() => setSelectedType('all')}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: selectedType === 'all' ? '1.5px solid #C25A3A' : '1.5px solid var(--input-border)',
              font: '700 12px Urbanist',
              background: selectedType === 'all' ? '#C25A3A' : 'var(--input-bg)',
              color: selectedType === 'all' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            All types ({resources.length})
          </button>
          {typesList.map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: selectedType === type ? '1.5px solid #C25A3A' : '1.5px solid var(--input-border)',
                font: '700 12px Urbanist',
                background: selectedType === type ? '#C25A3A' : 'var(--input-bg)',
                color: selectedType === type ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                opacity: counts.types[type] === 0 ? 0.4 : 1
              }}
            >
              {type} ({counts.types[type]})
            </button>
          ))}
        </div>

        <div className="filter-scroll-row">
          <button
            onClick={() => setSelectedTrackId('all')}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: selectedTrackId === 'all' ? '1.5px solid #C25A3A' : '1.5px solid var(--input-border)',
              font: '700 12px Urbanist',
              background: selectedTrackId === 'all' ? '#C25A3A' : 'var(--input-bg)',
              color: selectedTrackId === 'all' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            All tracks ({resources.length})
          </button>
          {tracks.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTrackId(t.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: selectedTrackId === t.id ? `1.5px solid ${t.color}` : '1.5px solid var(--input-border)',
                font: '700 12px Urbanist',
                background: selectedTrackId === t.id ? t.color : 'var(--input-bg)',
                color: selectedTrackId === t.id ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: counts.tracks[t.id] === 0 ? 0.4 : 1
              }}
            >
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: selectedTrackId === t.id ? '#fff' : t.color }} />
              {t.name} ({counts.tracks[t.id]})
            </button>
          ))}
        </div>
      </div>

      <div className="resources-layout">
        {/* SIDEBAR FILTERS PANEL */}
        <div className="resource-sidebar">
          {/* TYPE SECTION LABEL */}
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '800' }}>
            TYPE
          </div>
          
          <div 
            onClick={() => setSelectedType('all')}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              font: '700 13px Urbanist',
              color: selectedType === 'all' ? '#C25A3A' : 'var(--text-muted)',
              background: selectedType === 'all' ? 'rgba(194, 90, 58, 0.06)' : 'transparent',
              borderLeft: selectedType === 'all' ? '2px solid #C25A3A' : '2px solid transparent',
              transition: 'all 0.15s',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2px'
            }}
          >
            <span>All types</span>
            <span style={{ fontSize: '10.5px', opacity: 0.6 }}>{resources.length}</span>
          </div>

          {typesList.map(type => {
            const isActive = selectedType === type;
            const count = counts.types[type];
            return (
              <div 
                key={type}
                onClick={() => setSelectedType(type)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  font: '700 13px Urbanist',
                  color: isActive ? '#C25A3A' : 'var(--text-muted)',
                  background: isActive ? 'rgba(194, 90, 58, 0.06)' : 'transparent',
                  borderLeft: isActive ? '2px solid #C25A3A' : '2px solid transparent',
                  transition: 'all 0.15s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: count === 0 ? 0.4 : 1,
                  marginBottom: '2px'
                }}
              >
                <span>{type}</span>
                <span style={{ fontSize: '10.5px', opacity: 0.6 }}>{count}</span>
              </div>
            );
          })}

          {/* TRACK SECTION LABEL */}
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', margin: '24px 0 8px', fontWeight: '800' }}>
            TRACK
          </div>
          
          <div 
            onClick={() => setSelectedTrackId('all')}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              font: '700 13px Urbanist',
              color: selectedTrackId === 'all' ? '#C25A3A' : 'var(--text-muted)',
              background: selectedTrackId === 'all' ? 'rgba(194, 90, 58, 0.06)' : 'transparent',
              borderLeft: selectedTrackId === 'all' ? '2px solid #C25A3A' : '2px solid transparent',
              transition: 'all 0.15s',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2px'
            }}
          >
            <span>All tracks</span>
            <span style={{ fontSize: '10.5px', opacity: 0.6 }}>{resources.length}</span>
          </div>

          {tracks.map(t => {
            const isActive = selectedTrackId === t.id;
            const count = counts.tracks[t.id];
            
            // Standard colors mapped in prompt
            let exactColor = t.color;
            const lowerName = t.name.toLowerCase();
            if (lowerName.includes('machine') || lowerName.includes('ai')) exactColor = '#3B82F6';
            else if (lowerName.includes('cybersecurity')) exactColor = '#EF4444';
            else if (lowerName.includes('mathematics')) exactColor = '#10B981';
            else if (lowerName.includes('biology')) exactColor = '#F59E0B';
            else if (lowerName.includes('project') || lowerName.includes('swatches')) exactColor = '#8B5CF6';

            return (
              <div 
                key={t.id}
                onClick={() => setSelectedTrackId(t.id)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  font: '700 13px Urbanist',
                  color: isActive ? '#C25A3A' : 'var(--text-muted)',
                  background: isActive ? 'rgba(194, 90, 58, 0.06)' : 'transparent',
                  borderLeft: isActive ? `2px solid ${exactColor}` : '2px solid transparent',
                  transition: 'all 0.15s',
                  opacity: count === 0 ? 0.4 : 1,
                  marginBottom: '2px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: exactColor, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </span>
                </div>
                <span style={{ fontSize: '10.5px', opacity: 0.6, paddingLeft: '4px' }}>{count}</span>
              </div>
            );
          })}
        </div>

        {/* CARDS GRID */}
        <div style={{ flex: 1 }} ref={cardGridRef}>
          {loading ? (
            <div className="resource-card-grid">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="resource-card" style={{ pointerEvents: 'none' }}>
                  <div className="skeleton-box" style={{ width: '40px', height: '14px', marginBottom: '12px' }} />
                  <div className="skeleton-box" style={{ width: '80%', height: '20px', marginBottom: '12px' }} />
                  <div className="skeleton-box" style={{ width: '100px', height: '22px', borderRadius: '24px', marginBottom: '14px' }} />
                  <div className="skeleton-box" style={{ width: '100%', height: '36px', marginBottom: '20px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto' }}>
                    <div className="skeleton-box" style={{ width: '60px', height: '12px' }} />
                    <div className="skeleton-box" style={{ width: '50px', height: '24px', borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : processedResources.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', border: '1px solid var(--card-border)', borderRadius: '12px', background: 'var(--card-bg)' }}>
              <div style={{ font: '600 15px Urbanist', color: 'var(--text-muted)', marginBottom: '12px' }}>
                No resources matching "{search || 'filters'}"
              </div>
              <button 
                className="ghostpill"
                onClick={() => {
                  setSearch('');
                  setSelectedType('all');
                  setSelectedTrackId('all');
                }}
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="resource-card-grid">
              {processedResources.map(r => {
                const t = tracks.find(x => x.id === r.trackId);
                const formattedDate = new Date(r.addedAt + 'T12:00:00').toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });
                
                let trackColor = t ? t.color : '#ccc';
                const lowerTrackName = t ? t.name.toLowerCase() : '';
                if (lowerTrackName.includes('machine') || lowerTrackName.includes('ai')) trackColor = '#3B82F6';
                else if (lowerTrackName.includes('cybersecurity')) trackColor = '#EF4444';
                else if (lowerTrackName.includes('mathematics')) trackColor = '#10B981';
                else if (lowerTrackName.includes('biology')) trackColor = '#F59E0B';
                else if (lowerTrackName.includes('project') || lowerTrackName.includes('swatches')) trackColor = '#8B5CF6';

                const isExpanded = expandedCardId === r.id;
                const isDeleting = deleteConfirmId === r.id;

                return (
                  <div 
                    key={r.id} 
                    className="resource-card" 
                    onClick={(e) => {
                      if (isExpanded) return;
                      setExpandedCardId(r.id);
                    }}
                    style={{ 
                      cursor: isExpanded ? 'default' : 'pointer',
                      border: isExpanded ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.08)',
                      gridColumn: isExpanded ? '1 / -1' : 'auto'
                    }}
                  >
                    {/* Top Solid Track Color Bar */}
                    <div 
                      style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        height: '4px', 
                        background: trackColor,
                        borderRadius: '12px 12px 0 0'
                      }} 
                    />

                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ font: '900 10px Urbanist', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.6px' }}>
                        {r.type}
                      </span>
                      
                      <button 
                        className="card-del-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(r.id);
                        }}
                        title="Delete resource"
                      >
                        <IconX size={14} />
                      </button>
                    </div>

                    {/* Title */}
                    <h3 
                      style={{ 
                        font: '600 15px Urbanist', 
                        color: 'var(--text)', 
                        lineHeight: '1.4', 
                        marginBottom: '12px',
                        overflow: isExpanded ? 'visible' : 'hidden',
                        textOverflow: isExpanded ? 'clip' : 'ellipsis',
                        display: isExpanded ? 'block' : '-webkit-box',
                        WebkitLineClamp: isExpanded ? 'none' : 2,
                        WebkitBoxOrient: 'vertical'
                      }}
                      title={r.title}
                    >
                      {highlightText(r.title, search)}
                    </h3>
                    
                    {/* Track Badge Pill */}
                    {t && (
                      <div style={{ marginBottom: '14px' }}>
                        <span 
                          style={{ 
                            background: `${trackColor}15`, 
                            color: trackColor, 
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 10px',
                            borderRadius: '24px',
                            font: '800 10px Urbanist',
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px'
                          }}
                        >
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.45)', marginRight: '6px', flexShrink: 0 }}></span>
                          {t.name}
                        </span>
                      </div>
                    )}

                    {/* Notes area */}
                    {isExpanded ? (
                      <div onClick={e => e.stopPropagation()} style={{ marginBottom: '20px' }}>
                        <label className="flabel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Notes</span>
                          {editingNotesId !== r.id ? (
                            <button 
                              onClick={() => {
                                setEditingNotesId(r.id);
                                setTempNotesText(r.notes || '');
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', font: '800 11px Urbanist', cursor: 'pointer', textTransform: 'uppercase' }}
                            >
                              Edit notes
                            </button>
                          ) : null}
                        </label>

                        {editingNotesId !== r.id ? (
                          <div style={{ font: '600 13px Urbanist', color: 'var(--text-muted)', lineHeight: '1.5', whiteSpace: 'pre-wrap', background: 'var(--input-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--input-border)' }}>
                            {r.notes ? highlightText(r.notes, search) : <i>No notes added. Click edit to add notes.</i>}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <textarea
                              className="field"
                              value={tempNotesText}
                              onChange={e => setTempNotesText(e.target.value)}
                              placeholder="Why this resource, what to focus on..."
                              style={{ minHeight: '80px', resize: 'vertical' }}
                              autoFocus
                            />
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button className="ghostpill" onClick={() => setEditingNotesId(null)} style={{ padding: '4px 10px', fontSize: '11px' }}>
                                Cancel
                              </button>
                              <button className="pillbtn" onClick={() => handleSaveNotesInline(r.id, r)} style={{ padding: '4px 10px', fontSize: '11px' }}>
                                Save
                              </button>
                            </div>
                          </div>
                        )}

                        {/* URL field */}
                        <div style={{ marginTop: '16px' }}>
                          <label className="flabel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>URL Link</span>
                            {editingUrlId !== r.id ? (
                              <button 
                                onClick={() => {
                                  setEditingUrlId(r.id);
                                  setTempUrlText(r.url || '');
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', font: '800 11px Urbanist', cursor: 'pointer', textTransform: 'uppercase' }}
                              >
                                Edit URL
                              </button>
                            ) : null}
                          </label>

                          {editingUrlId !== r.id ? (
                            <div style={{ font: '600 13px Urbanist', color: 'var(--text-muted)', background: 'var(--input-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--input-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                                {r.url ? r.url : <i>No URL link set.</i>}
                              </span>
                              {r.url && (
                                <a href={r.url} target="_blank" rel="noreferrer" style={{ color: trackColor, display: 'flex', alignItems: 'center' }}>
                                  <IconExternalLink size={14} />
                                </a>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <input
                                className="field"
                                value={tempUrlText}
                                onChange={e => setTempUrlText(e.target.value)}
                                placeholder="https://"
                                autoFocus
                              />
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button className="ghostpill" onClick={() => setEditingUrlId(null)} style={{ padding: '4px 10px', fontSize: '11px' }}>
                                  Cancel
                                </button>
                                <button className="pillbtn" onClick={() => handleSaveUrlInline(r.id, r)} style={{ padding: '4px 10px', fontSize: '11px' }}>
                                  Save URL
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Expander Footer */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--rail-border)', paddingTop: '16px' }}>
                          <button className="ghostpill" onClick={() => openEditModal(r)}>
                            Edit details
                          </button>
                          <button className="pillbtn" onClick={() => setExpandedCardId(null)}>
                            Close
                          </button>
                        </div>
                      </div>
                    ) : (
                      r.notes && (
                        <div style={{ font: '600 12.5px Urbanist', color: 'var(--text-muted)', flexGrow: 1, marginBottom: '20px', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {highlightText(r.notes, search)}
                        </div>
                      )
                    )}
                    
                    {/* Bottom Row */}
                    {!isExpanded && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                        <span style={{ font: '700 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {formattedDate}
                          {r.linkStatus === 'broken' && (
                            <span title={`Link may be broken — last checked ${r.lastChecked}`}>
                              <IconBrokenLink />
                            </span>
                          )}
                        </span>
                        {r.url && (
                          <a 
                            href={r.url} 
                            target="_blank" 
                            rel="noreferrer" 
                            onClick={e => e.stopPropagation()}
                            className="res-open-btn"
                          >
                            Open <IconExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Inline Deletion Confirmation Glassmorphic Frost Overlay */}
                    {isDeleting && (
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        style={{ 
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'rgba(20, 20, 20, 0.95)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          zIndex: 20,
                          padding: '20px',
                          textAlign: 'center',
                          borderRadius: '12px',
                          backdropFilter: 'blur(4px)'
                        }}
                      >
                        <div style={{ font: '800 13px Urbanist', color: '#FF5E5E', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Delete this resource?
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button 
                            onClick={() => triggerDeleteResource(r.id)}
                            className="pillbtn"
                            style={{ background: '#FF5E5E', color: '#fff', padding: '6px 14px', fontSize: '11px' }}
                          >
                            Yes, delete
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmId(null)}
                            className="ghostpill"
                            style={{ padding: '6px 14px', fontSize: '11px' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ADD A RESOURCE PLACEHOLDER DASHED CARD */}
              <div 
                className="add-res-dashed-card"
                onClick={openAddResourceModal}
              >
                <div className="add-plus-circle">
                  +
                </div>
                <div style={{ font: '800 11px Urbanist', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  ADD A RESOURCE
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ADD RESOURCE MODAL */}
      {isModalOpen && (
        <div className="scrim" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '480px' }}>
            <div className="modal-header">
              <span className="modal-title">Add Resource</span>
              <span className="modal-close" onClick={() => setIsModalOpen(false)}>×</span>
            </div>
            
            <form onSubmit={handleCreateResource} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Live Preview section */}
              <div>
                <label className="flabel" style={{ marginBottom: '8px' }}>Live Preview</label>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                  <div 
                    className="resource-card"
                    style={{ 
                      width: '280px', 
                      minHeight: '180px', 
                      pointerEvents: 'none', 
                      margin: 0,
                      boxShadow: 'none',
                      border: '1.5px solid var(--input-border)',
                      borderRadius: '12px',
                      padding: '24px',
                      paddingTop: '28px',
                      position: 'relative',
                      overflow: 'hidden',
                      background: 'var(--card-bg)'
                    }}
                  >
                    <div 
                      style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        height: '4px', 
                        background: tracks.find(x => x.id === newTrackId)?.color || 'var(--text-muted)',
                        borderRadius: '12px 12px 0 0'
                      }} 
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ font: '900 10px Urbanist', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {newType}
                      </span>
                    </div>
                    <h3 style={{ font: '800 15px Urbanist', color: 'var(--text)', marginBottom: '8px', height: '40px', overflow: 'hidden' }}>
                      {newTitle || 'Resource Title'}
                    </h3>
                    {newTrackId && (() => {
                      const t = tracks.find(x => x.id === newTrackId);
                      return t && (
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ background: `${t.color}15`, color: t.color, display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '24px', font: '800 10px Urbanist', textTransform: 'uppercase' }}>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)', marginRight: '6px' }}></span>
                            {t.name}
                          </span>
                        </div>
                      );
                    })()}
                    <div style={{ font: '600 12.5px Urbanist', color: 'var(--text-muted)', WebkitLineClamp: 2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>
                      {newNotes || 'Resource notes preview...'}
                    </div>
                  </div>
                </div>
              </div>

              {/* URL LINK */}
              <div>
                <label className="flabel" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>URL (optional)</span>
                  {autoDetectedLabel && <span style={{ color: '#05B6D4', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Auto-detected</span>}
                </label>
                <input 
                  className="field" 
                  placeholder="https://"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  onBlur={handleUrlBlur}
                />
              </div>

              {/* TITLE */}
              <div style={{ position: 'relative' }}>
                <label className="flabel">Title</label>
                <input 
                  className="field" 
                  placeholder={fetchingTitle ? "Fetching title..." : "e.g. Molecular Biology of the Cell"}
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                  disabled={fetchingTitle}
                  style={{ 
                    opacity: fetchingTitle ? 0.6 : 1,
                    paddingRight: fetchingTitle ? '36px' : '12px'
                  }}
                />
                {fetchingTitle && (
                  <div 
                    style={{ 
                      position: 'absolute', 
                      right: '12px', 
                      bottom: '12px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}
                  >
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.2)',
                      borderTop: '2px solid var(--text)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  </div>
                )}
              </div>

              <div>
                <label className="flabel">Type</label>
                <select 
                  className="field"
                  value={newType}
                  onChange={e => {
                    setNewType(e.target.value);
                    setAutoDetectedLabel(false);
                  }}
                  required
                >
                  <option value="Article">Article</option>
                  <option value="Video">Video</option>
                  <option value="Book">Book</option>
                  <option value="Tool">Tool</option>
                  <option value="Paper">Paper</option>
                  <option value="Course">Course</option>
                </select>
              </div>

              {/* Track selector buttons pills */}
              <div>
                <label className="flabel">Track</label>
                <div className="track-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                  {tracks.map(t => {
                    const isSelected = newTrackId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className="track-pill-btn"
                        onClick={() => setNewTrackId(t.id)}
                        style={{
                          background: isSelected ? t.color : 'var(--input-bg)',
                          color: isSelected ? '#fff' : 'var(--text-muted)',
                          borderColor: isSelected ? t.color : 'var(--input-border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: isSelected ? '#fff' : t.color, flexShrink: 0 }} />
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                          {renderTrackIcon(t, 12, { borderRadius: '50%', flexShrink: 0 })}
                          <span>{t.name}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="flabel">Your notes</label>
                <textarea 
                  className="field" 
                  placeholder="Why this resource, what to focus on..." 
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                />
              </div>

              {saveError && (
                <div style={{ color: 'var(--red, #e06c75)', font: '600 13px Urbanist', marginTop: '6px' }}>
                  {saveError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="ghostpill" onClick={() => setIsModalOpen(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="pillbtn" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {saving ? (
                    <>
                      <span style={{
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                        border: '2px solid rgba(255,255,255,0.2)',
                        borderTop: '2px solid #fff',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Saving...
                    </>
                  ) : (
                    'Save resource'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT RESOURCE MODAL */}
      {isEditModalOpen && (
        <div className="scrim" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '480px' }}>
            <div className="modal-header">
              <span className="modal-title">Edit Resource</span>
              <span className="modal-close" onClick={() => setIsEditModalOpen(false)}>×</span>
            </div>
            
            <form onSubmit={handleUpdateResource} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label className="flabel">Title</label>
                <input 
                  className="field" 
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="flabel">Type</label>
                <select 
                  className="field"
                  value={editType}
                  onChange={e => setEditType(e.target.value)}
                  required
                >
                  <option value="Article">Article</option>
                  <option value="Video">Video</option>
                  <option value="Book">Book</option>
                  <option value="Tool">Tool</option>
                  <option value="Paper">Paper</option>
                  <option value="Course">Course</option>
                </select>
              </div>

              {/* Edit Modal Track Selection button pills */}
              <div>
                <label className="flabel">Track</label>
                <div className="track-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                  {tracks.map(t => {
                    const isSelected = editTrackId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className="track-pill-btn"
                        onClick={() => setEditTrackId(t.id)}
                        style={{
                          background: isSelected ? t.color : 'var(--input-bg)',
                          color: isSelected ? '#fff' : 'var(--text-muted)',
                          borderColor: isSelected ? t.color : 'var(--input-border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: isSelected ? '#fff' : t.color, flexShrink: 0 }} />
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                          {renderTrackIcon(t, 12, { borderRadius: '50%', flexShrink: 0 })}
                          <span>{t.name}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="flabel">URL Link</label>
                <input 
                  className="field" 
                  value={editUrl}
                  onChange={e => setEditUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="flabel">Your notes</label>
                <textarea 
                  className="field" 
                  style={{ minHeight: '85px', resize: 'vertical' }}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="ghostpill" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="pillbtn">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OPTIMISTIC UNDO TOAST */}
      {undoToast && (
        <div 
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--card-bg)',
            border: '1.5px solid var(--text-muted)',
            borderRadius: '10px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            zIndex: 1000,
            animation: 'fadeIn 0.2s'
          }}
        >
          <span style={{ font: '600 13.5px Urbanist', color: 'var(--text)' }}>
            Resource deleted.
          </span>
          <button 
            onClick={handleUndoDelete}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#C25A3A', 
              font: '800 13px Urbanist', 
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px' 
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}