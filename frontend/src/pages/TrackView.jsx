import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api, { renderTrackIcon, formatDuration } from '../api';
import TrackIconPicker from '../components/TrackIconPicker.jsx';
import TrackIconRenderer from '../components/TrackIconRenderer.jsx';
import { 
  IconArrowLeft, IconMenu2, IconPlayerPlay, IconChevronDown, 
  IconPlus, IconDotsVertical, IconX, IconRefresh, IconTrophy, IconTrash,
  IconBook, IconBolt, IconTools, IconCheckbox, IconPencil, IconFile, IconUpload,
  IconCalendar
} from '@tabler/icons-react';

import { useCustomDialog } from '../App';

// LocalStorage-backed SWR cache keyed per track ID
let tvCache = {};
let tvCacheTs = {};

try {
  const cv = localStorage.getItem('sv_trackview_cache');
  const ct = localStorage.getItem('sv_trackview_cache_ts');
  if (cv && ct) {
    const parsedCv = JSON.parse(cv);
    if (parsedCv && typeof parsedCv === 'object') {
      tvCache = parsedCv;
    }
    const parsedCt = JSON.parse(ct);
    if (parsedCt && typeof parsedCt === 'object') {
      tvCacheTs = parsedCt;
    }
  }
} catch (e) {}

export default function TrackView() {
  const { trackId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showConfirm, showAlert } = useCustomDialog();
  
  const [track, setTrack] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  
  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Collapsed sections (courseId -> boolean)
  const [collapsedCourses, setCollapsedCourses] = useState({});
  
  // Modals state
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [isSavingCourse, setIsSavingCourse] = useState(false);

  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleType, setNewModuleType] = useState('reading');
  const [newModuleDescription, setNewModuleDescription] = useState('');
  const [isSavingModule, setIsSavingModule] = useState(false);

  // Edit Module State
  const [isEditModuleOpen, setIsEditModuleOpen] = useState(false);
  const [editModuleId, setEditModuleId] = useState('');
  const [editModuleTitle, setEditModuleTitle] = useState('');
  const [editModuleType, setEditModuleType] = useState('reading');
  const [editModuleDescription, setEditModuleDescription] = useState('');
  const [isSavingEditModule, setIsSavingEditModule] = useState(false);

  // Edit Track State
  const [isEditTrackOpen, setIsEditTrackOpen] = useState(false);
  const [editTrackName, setEditTrackName] = useState('');
  // editIconState: { type: 'emoji'|'image'|'library', value: string, imageUrl?: string, thumbUrl?: string }
  const [editIconState, setEditIconState] = useState({ type: 'emoji', value: '🧠', imageUrl: null, thumbUrl: null });
  const [editTrackColor, setEditTrackColor] = useState('');
  const [editTrackSemester, setEditTrackSemester] = useState('');
  const [isSavingTrack, setIsSavingTrack] = useState(false);

  // Validation & shake animations
  const [allTracks, setAllTracks] = useState([]);
  const [valErrors, setValErrors] = useState({ name: '', color: '', icon: '', combined: '' });
  const [shakeName, setShakeName] = useState(false);
  const [shakeColor, setShakeColor] = useState(false);
  const [shakeIcon, setShakeIcon] = useState(false);

  // Course Rename State
  const [isRenameCourseOpen, setIsRenameCourseOpen] = useState(false);
  const [renameCourseId, setRenameCourseId] = useState('');
  const [renameCourseName, setRenameCourseName] = useState('');
  const [isRenamingCourse, setIsRenamingCourse] = useState(false);

  // Module status-cycle pending state (tracks which module IDs have an in-flight request)
  const [cyclingModuleIds, setCyclingModuleIds] = useState(() => new Set());

  // Course Delete State
  const [isDeleteCourseOpen, setIsDeleteCourseOpen] = useState(false);
  const [deleteCourseId, setDeleteCourseId] = useState('');
  const [deleteCourseName, setDeleteCourseName] = useState('');
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);

  // Module Delete State
  const [isDeleteModuleOpen, setIsDeleteModuleOpen] = useState(false);
  const [deleteModuleId, setDeleteModuleId] = useState('');
  const [deleteModuleTitle, setDeleteModuleTitle] = useState('');
  const [isDeletingModule, setIsDeletingModule] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});

  const openEditTrack = () => {
    if (!track) return;
    setEditTrackName(track.name);
    // Reconstruct iconState from track data
    const iType = track.icon_type || (track.icon_image_url ? 'image' : 'emoji');
    setEditIconState({
      type: iType,
      value: track.icon_value || track.icon || '🧠',
      imageUrl: track.icon_image_url || null,
      thumbUrl: track.icon_thumb_url || null,
    });
    setEditTrackColor(track.color);
    setEditTrackSemester(track.phase);
    setValErrors({ name: '', color: '', icon: '', combined: '' });
    setIsEditTrackOpen(true);
  };

  const handleEditTrack = async (e) => {
    e.preventDefault();
    if (isSavingTrack) return;
    const iconDisplayVal = editIconState.value || '🧠';
    const err = validateFields(editTrackName, editTrackColor, iconDisplayVal, trackId);
    setValErrors(err);
    if (err.name || err.color || err.icon || err.combined) {
      if (err.name)  { setShakeName(true);  setTimeout(() => setShakeName(false), 400); }
      if (err.color) { setShakeColor(true); setTimeout(() => setShakeColor(false), 400); }
      if (err.icon)  { setShakeIcon(true);  setTimeout(() => setShakeIcon(false), 400); }
      return;
    }

    setIsSavingTrack(true);
    try {
      await api.put(`/tracks/${trackId}`, {
        name:           editTrackName.trim(),
        icon:           iconDisplayVal,
        color:          editTrackColor,
        phase:          editTrackSemester,
        icon_type:      editIconState.type,
        icon_value:     iconDisplayVal,
        icon_image_url: editIconState.imageUrl || null,
        icon_thumb_url: editIconState.thumbUrl || null,
      });
      setValErrors({ name: '', color: '', icon: '', combined: '' });
      setIsEditTrackOpen(false);
      await fetchTrackDetails();
      await fetchAllTracks();
    } catch (err) {
      if (err.response && err.response.status === 409) {
        const details = err.response.data.detail || '';
        if (details.toLowerCase().includes('name') || details.toLowerCase().includes('called')) {
          setValErrors(prev => ({ ...prev, name: 'A track with this name already exists.' }));
          setShakeName(true);
          setTimeout(() => setShakeName(false), 400);
        } else if (details.toLowerCase().includes('identical') || details.toLowerCase().includes('combination')) {
          setValErrors(prev => ({ ...prev, combined: details }));
        } else if (details.toLowerCase().includes('color') || details.toLowerCase().includes('colour')) {
          setValErrors(prev => ({ ...prev, color: details }));
          setShakeColor(true);
          setTimeout(() => setShakeColor(false), 400);
        } else if (details.toLowerCase().includes('used by') || details.toLowerCase().includes('icon') || details.toLowerCase().includes('emoji')) {
          setValErrors(prev => ({ ...prev, icon: details }));
          setShakeIcon(true);
          setTimeout(() => setShakeIcon(false), 400);
        } else {
          setValErrors(prev => ({ ...prev, name: details }));
        }
      } else {
        console.error(err);
      }
    } finally {
      setIsSavingTrack(false);
    }
  };

  const openRenameCourse = (courseId, currentName) => {
    setRenameCourseId(courseId);
    setRenameCourseName(currentName);
    setIsRenameCourseOpen(true);
  };

  const handleRenameCourse = async (e) => {
    e.preventDefault();
    if (!renameCourseName.trim() || isRenamingCourse) return;
    setIsRenamingCourse(true);
    try {
      await api.put(`/courses/${renameCourseId}`, { name: renameCourseName.trim() });
      setIsRenameCourseOpen(false);
      await fetchTrackDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRenamingCourse(false);
    }
  };

  const openDeleteCourse = (courseId, courseName) => {
    setDeleteCourseId(courseId);
    setDeleteCourseName(courseName);
    setIsDeleteCourseOpen(true);
  };

  const executeDeleteCourse = async () => {
    if (isDeletingCourse) return;
    setIsDeletingCourse(true);
    try {
      await api.delete(`/courses/${deleteCourseId}`);
      setIsDeleteCourseOpen(false);
      await fetchTrackDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingCourse(false);
    }
  };

  const openDeleteModule = (moduleId, moduleTitle) => {
    setDeleteModuleId(moduleId);
    setDeleteModuleTitle(moduleTitle);
    setIsDeleteModuleOpen(true);
  };

  const executeDeleteModule = async () => {
    if (isDeletingModule) return;
    setIsDeletingModule(true);
    try {
      await api.delete(`/modules/${deleteModuleId}`);
      setIsDeleteModuleOpen(false);
      await fetchTrackDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingModule(false);
    }
  };

  const fetchTrackDetails = async () => {
    try {
      const res = await api.get(`/tracks/${trackId}`);
      setTrack(res.data);
      // Update cache so next visit sees fresh data
      if (tvCache[trackId]) {
        tvCache[trackId] = { ...tvCache[trackId], track: res.data };
        tvCacheTs[trackId] = Date.now();
        try {
          localStorage.setItem('sv_trackview_cache', JSON.stringify(tvCache));
          localStorage.setItem('sv_trackview_cache_ts', JSON.stringify(tvCacheTs));
        } catch (e) {}
      }
      const collapses = {};
      (res.data?.courses || []).forEach(c => {
        collapses[c.id] = false; // default open
      });
      setCollapsedCourses(collapses);
    } catch (err) {
      console.error(err);
      navigate('/tracks');
    }
  };

  const fetchTrackLogs = async () => {
    try {
      const res = await api.get('/logs', { params: { trackId } });
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllTracks = async () => {
    try {
      const res = await api.get('/tracks/detailed');
      setAllTracks(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const getHsl = (hex) => {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let r = parseInt(hex.substring(0, 2), 16) / 255;
    let g = parseInt(hex.substring(2, 4), 16) / 255;
    let b = parseInt(hex.substring(4, 6), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  };

  const isSimilarColor = (col1, col2) => {
    if (!col1 || !col2) return false;
    const hsl1 = getHsl(col1);
    const hsl2 = getHsl(col2);
    let hDiff = Math.abs(hsl1.h - hsl2.h);
    hDiff = Math.min(hDiff, 360 - hDiff);
    return hDiff < 15 && Math.abs(hsl1.s - hsl2.s) < 15 && Math.abs(hsl1.l - hsl2.l) < 10;
  };

  const validateFields = (name, color, emoji, excludeId = null) => {
    let errs = { name: '', color: '', icon: '', combined: '' };
    
    // 1. Name is empty
    if (!name.trim()) {
      errs.name = 'Track name is required.';
      return errs;
    }
    
    // Clean name: case-insensitive & whitespace trimmed
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, ' ');
    const otherTracks = allTracks.filter(t => t.id !== excludeId);
    
    // 2. Name already exists
    const nameExists = otherTracks.some(t => t.name.trim().toLowerCase().replace(/\s+/g, ' ') === cleanName);
    if (nameExists) {
      errs.name = `You already have a track called '${name.trim()}'. Choose a different name.`;
      return errs;
    }

    // 5. Colour AND emoji match (highest precedence check for combined collision)
    const combinedMatch = otherTracks.find(t => (t.color.toLowerCase() === color.toLowerCase() || isSimilarColor(color, t.color)) && t.icon === emoji);
    if (combinedMatch) {
      errs.combined = `This combination is identical to ${combinedMatch.name}. Change at least one.`;
      return errs;
    }

    // 3. Colour too similar
    const colorMatch = otherTracks.find(t => t.color.toLowerCase() === color.toLowerCase() || isSimilarColor(color, t.color));
    if (colorMatch) {
      errs.color = `Colour is too close to your ${colorMatch.name} track (${colorMatch.color}).`;
      return errs;
    }

    // 4. Emoji already in use — only checked for emoji type icons
    if (emoji && !emoji.startsWith('/') && !emoji.startsWith('http')) {
      const emojiMatch = otherTracks.find(t => t.icon === emoji);
      if (emojiMatch) {
        errs.icon = `${emoji} is already used by ${emojiMatch.name}.`;
        return errs;
      }
    }

    return errs;
  };


  useEffect(() => {
    const loadData = async () => {
      // Invalidate stale in-memory cache if localStorage was cleared (e.g. on confirm or logout)
      if (!localStorage.getItem('sv_trackview_cache')) {
        tvCache = {};
        tvCacheTs = {};
      }

      const now = Date.now();
      const cached = tvCache[trackId];
      const cacheAge = now - (tvCacheTs[trackId] || 0);

      if (cached && cached.track && cached.logs && cached.allTracks) {
        // Instant display from cache
        setTrack(cached.track);
        setLogs(cached.logs);
        setAllTracks(cached.allTracks);
        const collapses = {};
        if (cached.track.courses) {
          cached.track.courses.forEach(c => { collapses[c.id] = false; });
        }
        setCollapsedCourses(collapses);
        setLoading(false);

        // Background refresh if cache is older than 30s
        if (cacheAge > 30000) {
          Promise.all([
            api.get(`/tracks/${trackId}`),
            api.get('/logs', { params: { trackId } }),
            api.get('/tracks/detailed')
          ]).then(([trackRes, logsRes, allTracksRes]) => {
            const fresh = { track: trackRes.data, logs: logsRes.data, allTracks: allTracksRes.data };
            tvCache[trackId] = fresh;
            tvCacheTs[trackId] = Date.now();
            try {
              localStorage.setItem('sv_trackview_cache', JSON.stringify(tvCache));
              localStorage.setItem('sv_trackview_cache_ts', JSON.stringify(tvCacheTs));
            } catch (e) {}
            setTrack(fresh.track);
            setLogs(fresh.logs);
            setAllTracks(fresh.allTracks);
          }).catch(err => console.error('Silent TrackView refresh failed', err));
        }
        return;
      }

      setLoading(true);
      try {
        const [trackRes, logsRes, allTracksRes] = await Promise.all([
          api.get(`/tracks/${trackId}`),
          api.get('/logs', { params: { trackId } }),
          api.get('/tracks/detailed')
        ]);
        const fresh = { track: trackRes.data, logs: logsRes.data, allTracks: allTracksRes.data };
        tvCache[trackId] = fresh;
        tvCacheTs[trackId] = Date.now();
        try {
          localStorage.setItem('sv_trackview_cache', JSON.stringify(tvCache));
          localStorage.setItem('sv_trackview_cache_ts', JSON.stringify(tvCacheTs));
        } catch (e) {}
        setTrack(fresh.track);
        const collapses = {};
        if (fresh.track.courses) {
          fresh.track.courses.forEach(c => { collapses[c.id] = false; });
        }
        setCollapsedCourses(collapses);
        setLogs(fresh.logs);
        setAllTracks(fresh.allTracks);
      } catch (err) {
        console.error(err);
        navigate('/tracks');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [trackId]);

  const calculateTrackProgress = () => {
    if (!track || !track.courses) return { total: 0, done: 0, pct: 0 };
    let total = 0;
    let done = 0;
    track.courses.forEach(c => {
      total += c.modules.length;
      done += c.modules.filter(m => m.status === 'done').length;
    });
    return {
      total,
      done,
      pct: total ? Math.round((done / total) * 100) : 0
    };
  };

  const getModuleTypeIcon = (type) => {
    switch (type) {
      case 'reading': return <IconBook size={14} />;
      case 'video': return <IconPlayerPlay size={14} />;
      case 'drill': return <IconBolt size={14} />;
      case 'project': return <IconTools size={14} />;
      case 'assessment': return <IconCheckbox size={14} />;
      case 'note': return <IconPencil size={14} />;
      default: return <IconFile size={14} />;
    }
  };

  const cycleStatus = async (moduleId, currentStatus) => {
    if (cyclingModuleIds.has(moduleId)) return;
    const statusCycle = { 'todo': 'inprogress', 'inprogress': 'done', 'done': 'todo' };
    const nextStatus = statusCycle[currentStatus] || 'todo';

    setCyclingModuleIds(prev => new Set(prev).add(moduleId));
    try {
      await api.put(`/modules/${moduleId}`, { status: nextStatus });
      await fetchTrackDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setCyclingModuleIds(prev => {
        const next = new Set(prev);
        next.delete(moduleId);
        return next;
      });
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourseName.trim() || isSavingCourse) return;

    setIsSavingCourse(true);
    try {
      await api.post(`/courses/track/${trackId}`, { name: newCourseName });
      window.dispatchEvent(new CustomEvent('show-success', {
        detail: { type: 'course_created' }
      }));
      setNewCourseName('');
      setIsCourseModalOpen(false);
      await fetchTrackDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleCreateModule = async (e) => {
    e.preventDefault();
    if (!newModuleTitle.trim() || !selectedCourseId || isSavingModule) return;

    setIsSavingModule(true);
    try {
      await api.post(`/modules/course/${selectedCourseId}`, {
        title: newModuleTitle,
        type: newModuleType,
        description: newModuleDescription.trim() || null
      });
      window.dispatchEvent(new CustomEvent('show-success', {
        detail: { type: 'module_added' }
      }));
      setNewModuleTitle('');
      setNewModuleType('reading');
      setNewModuleDescription('');
      setIsModuleModalOpen(false);
      await fetchTrackDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingModule(false);
    }
  };

  const openEditModule = (module) => {
    setEditModuleId(module.id);
    setEditModuleTitle(module.title);
    setEditModuleType(module.type || 'reading');
    setEditModuleDescription(module.description || '');
    setIsEditModuleOpen(true);
  };

  const handleEditModule = async (e) => {
    e.preventDefault();
    if (!editModuleTitle.trim() || isSavingEditModule) return;

    setIsSavingEditModule(true);
    try {
      await api.put(`/modules/${editModuleId}`, {
        title: editModuleTitle.trim(),
        type: editModuleType,
        description: editModuleDescription.trim() || null
      });
      setIsEditModuleOpen(false);
      await fetchTrackDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingEditModule(false);
    }
  };



  const navigateToContinue = () => {
    // Find first module in first course that is not done
    let firstIncomplete = null;
    if (track && track.courses) {
      for (const c of track.courses) {
        if (c.modules) {
          for (const m of c.modules) {
            if (m.status !== 'done') {
              firstIncomplete = m;
              break;
            }
          }
        }
        if (firstIncomplete) break;
      }
    }
    
    navigate(`/log?trackId=${trackId}&topic=${encodeURIComponent(firstIncomplete ? firstIncomplete.title : '')}`);
  };

  const getCourseProgress = (course) => {
    const modules = course?.modules || [];
    const total = modules.length;
    const done = modules.filter(m => m.status === 'done').length;
    return {
      total,
      done,
      pct: total ? Math.round((done / total) * 100) : 0
    };
  };

  const scrollToModule = (id) => {
    setIsDrawerOpen(false);
    const element = document.getElementById(`task-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.style.background = 'var(--red-dim)';
      setTimeout(() => {
        element.style.background = '';
      }, 1500);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px', 
        color: 'var(--text-muted)',
        fontFamily: 'Urbanist', 
        fontWeight: 700 
      }}>
        Loading Track Details...
      </div>
    );
  }

  const p = calculateTrackProgress();

  // Helper stats for Progress tab
  const totalHours = (logs.reduce((acc, l) => acc + l.duration, 0) / 60).toFixed(1);
  const ratings = logs.map(l => l.rating);
  const avgRating = ratings.length ? (ratings.reduce((x, y) => x + y, 0) / ratings.length).toFixed(1) : '0';

  // SVG Line Chart points calculation for Progress tab
  let chartPath = '';
  let chartPoints = [];
  const chartHeight = 100;
  const chartWidth = 400;
  
  if (logs.length > 1) {
    // Sort logs chronologically for chart plotting
    const sortedLogs = [...logs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const maxLogs = sortedLogs.slice(-10); // plot last 10 logs
    const xStep = chartWidth / (maxLogs.length - 1);
    
    chartPoints = maxLogs.map((l, index) => {
      const x = index * xStep;
      // Map rating 1-10 to Y coordinate (invert since SVG Y-axis is top-down)
      const y = chartHeight - ((l.rating - 1) / 9) * (chartHeight - 20) - 10;
      return { x, y, rating: l.rating, date: l.date };
    });
    
    chartPath = chartPoints.reduce((path, p, index) => {
      return path + (index === 0 ? 'M' : 'L') + ' ' + p.x + ' ' + p.y;
    }, '');
  }

  return (
    <div className="page active" id="page-track">
      {/* Back to Tracks navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button className="ghostpill" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => navigate('/tracks')}>
          <IconArrowLeft size={14} /> Back to tracks
        </button>
      </div>

      {/* TRACK HERO BANNER */}
      {track && (
        <div className="track-hero">
          <div className="track-hero-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%', 
                background: `${track.color}18`, 
                color: track.color, 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                overflow: 'hidden'
              }}>
                <TrackIconRenderer track={track} size={36} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              </div>

              
              <div>
                <span className="track-hero-label">{track.phase} · Self-directed</span>
                <h1 className="track-hero-title">{track.name}</h1>
                <div style={{ font: '600 13px Urbanist', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>{track.courses?.length || 0} courses · {p.done} of {p.total} modules complete</span>
                  {track.deadline && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent, #E5A83C)', fontWeight: 700 }}>
                      <IconCalendar size={12} />
                      Ends: {new Date(track.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
              <span className="track-hero-pct">{p.pct}%</span>
              <div className="phbar" style={{ width: '120px' }}>
                <div className="progress-fill" style={{ width: `${p.pct}%`, background: track.color }}></div>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
            <button className="pillbtn" onClick={navigateToContinue}>
              <IconPlayerPlay size={14} /> Continue track
            </button>
            <button className="ghostpill" onClick={openEditTrack}>
              <IconPencil size={14} /> Edit details
            </button>
          </div>
        </div>
      )}

      {/* TABS SELECTOR */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--rail-border)', marginBottom: '24px' }}>
        <button 
          className={`tabx ${activeTab === 'overview' ? 'on' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Modules
        </button>
        <button 
          className={`tabx ${activeTab === 'progress' ? 'on' : ''}`}
          onClick={() => setActiveTab('progress')}
        >
          Progress
        </button>
        <button 
          className={`tabx ${activeTab === 'log' ? 'on' : ''}`}
          onClick={() => setActiveTab('log')}
        >
          Log
        </button>
      </div>

      {/* MODULES TAB PANEL */}
      {activeTab === 'overview' && (
        <div>
          {track?.courses && track.courses.length > 0 ? (
            track.courses.map(course => {
              const cp = getCourseProgress(course);
            const isCollapsed = collapsedCourses[course.id];
            
            return (
              <div key={course.id} className="course-card-block" id={`sb-${course.id}`}>
                <div 
                  className="course-card-header" 
                  onClick={() => setCollapsedCourses({
                    ...collapsedCourses,
                    [course.id]: !isCollapsed
                  })}
                >
                  <div>
                    <h3 className="course-card-title">{course.name}</h3>
                    <div className="course-card-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '3px' }}>
                      <span>{cp.done} of {cp.total} modules complete</span>
                      {course.deadline && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent, #E5A83C)', fontWeight: 700 }}>
                          <IconCalendar size={12} />
                          Due: {new Date(course.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                        </span>
                      )}
                    </div>
                    <div className="phbar" style={{ width: '140px', marginTop: '6px' }}>
                      <div className="progress-fill" style={{ width: `${cp.pct}%`, background: track.color }}></div>
                    </div>
                  </div>
                  
                  <div className="course-card-controls" onClick={e => e.stopPropagation()}>
                    <button 
                      className="pillbtn" 
                      style={{ padding: '6px 14px', fontSize: '12px' }}
                      onClick={() => {
                        setSelectedCourseId(course.id);
                        setIsModuleModalOpen(true);
                      }}
                    >
                      + Add
                    </button>
                    <button 
                      className="iconbtn" 
                      style={{ width: '32px', height: '32px', fontSize: '14px' }}
                      onClick={() => openRenameCourse(course.id, course.name)}
                      title="Rename Course"
                    >
                      <IconPencil size={14} />
                    </button>
                    <button 
                      className="iconbtn" 
                      style={{ width: '32px', height: '32px', fontSize: '14px', color: 'red' }}
                      onClick={() => openDeleteCourse(course.id, course.name)}
                      title="Delete Course"
                    >
                      <IconTrash size={14} />
                    </button>
                    <button
                      className="iconbtn"
                      style={{ width: '32px', height: '32px', fontSize: '14px' }}
                      onClick={() => setCollapsedCourses({
                        ...collapsedCourses,
                        [course.id]: !isCollapsed
                      })}
                    >
                      <IconChevronDown 
                        size={16} 
                        style={{ transform: !isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                      />
                    </button>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="course-card-body">
                    {course.modules.map(m => {
                      const isExpanded = expandedModules[m.id] === true;
                      return (
                        <div key={m.id} style={{ borderBottom: '1px solid var(--rail-border)' }}>
                          <div 
                            className="module-row-item" 
                            id={`task-${m.id}`}
                            onClick={(e) => {
                              if (e.target.closest('button') || e.target.closest('.module-row-status')) return;
                              setExpandedModules(prev => ({ ...prev, [m.id]: !isExpanded }));
                            }}
                            style={{ cursor: 'pointer', borderBottom: 'none' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, marginRight: '16px' }}>
                              <div className="module-row-icon-wrap" style={{ flexShrink: 0 }}>
                                {m.type === 'reading' && <IconBook size={16} />}
                                {m.type === 'video' && <IconPlayerPlay size={16} />}
                                {m.type === 'drill' && <IconBolt size={16} />}
                                {m.type === 'project' && <IconTools size={16} />}
                                {m.type === 'assessment' && <IconCheckbox size={16} />}
                                {m.type === 'note' && <IconFile size={16} />}
                              </div>
                              
                              <div className="module-row-info" style={{ flex: 1, minWidth: 0, marginLeft: '12px' }}>
                                <div className="module-row-title" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', font: '700 14px Urbanist', color: 'var(--text)' }}>
                                  {m.deadline && (
                                    <span 
                                      style={{
                                        font: '800 11px Urbanist',
                                        color: 'var(--accent, #E5A83C)',
                                        background: 'rgba(229, 168, 60, 0.08)',
                                        border: '1px solid rgba(229, 168, 60, 0.18)',
                                        borderRadius: '4px',
                                        padding: '2px 6px',
                                        marginRight: '4px',
                                        textTransform: 'uppercase',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        flexShrink: 0
                                      }}
                                    >
                                      <IconCalendar size={10} />
                                      {m.day ? `${m.day.slice(0, 3)}, ` : ''}
                                      {new Date(m.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                                    </span>
                                  )}
                                  <span>
                                    {m.deadline
                                      ? m.title.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*[-•|:—]?\s*/i, '')
                                      : m.title}
                                  </span>
                                </div>
                                <div className="module-row-type" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>
                                  <span>{m.type}</span>
                                  <span style={{ fontSize: '9px', opacity: 0.5, fontStyle: 'italic', textTransform: 'none' }}>
                                    · {isExpanded ? 'Click to collapse' : 'Click to expand'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                              {m.day && (
                                <span 
                                  style={{ 
                                    font: '800 11px Urbanist', 
                                    color: 'var(--text-muted)', 
                                    textTransform: 'uppercase', 
                                    letterSpacing: '0.5px',
                                    marginRight: '4px'
                                  }}
                                >
                                  {m.day}
                                </span>
                              )}
                              {m.status === 'done' && <span className="module-row-status done">✓ Done</span>}
                              {m.status === 'inprogress' && <span className="module-row-status inprogress">In progress</span>}
                              {m.status === 'todo' && <span className="module-row-status todo">To do</span>}
                              
                              <button
                                className="iconbtn"
                                style={{ width: '32px', height: '32px', fontSize: '14px', opacity: cyclingModuleIds.has(m.id) ? 0.5 : 1, cursor: cyclingModuleIds.has(m.id) ? 'not-allowed' : 'pointer' }}
                                onClick={() => cycleStatus(m.id, m.status)}
                                disabled={cyclingModuleIds.has(m.id)}
                                title="Cycle status"
                              >
                                <IconRefresh size={14} />
                              </button>
                              
                              <button
                                className="iconbtn"
                                style={{ width: '32px', height: '32px', fontSize: '14px' }}
                                onClick={() => openEditModule(m)}
                                title="Edit module"
                              >
                                <IconPencil size={14} />
                              </button>

                              <button
                                className="iconbtn"
                                style={{ width: '32px', height: '32px', fontSize: '14px', color: 'red' }}
                                onClick={() => openDeleteModule(m.id, m.title)}
                                title="Delete module"
                              >
                                <IconTrash size={14} />
                              </button>
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div style={{ padding: '0 24px 16px 72px', font: '600 13px/1.6 Urbanist', color: 'var(--text-muted)' }}>
                              <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '6px' }}>Full Task Description:</div>
                              <div style={{ background: 'var(--input-bg)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--input-border)', color: 'var(--text)' }}>
                                {m.task || m.description || "No description provided."}
                              </div>
                              {m.notes && (
                                <div style={{ marginTop: '12px' }}>
                                  <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '4px' }}>Study Notes:</div>
                                  <div style={{ fontStyle: 'italic' }}>{m.notes}</div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    <div style={{ padding: '16px 24px' }}>
                      <button 
                        className="ghostpill" 
                        style={{ width: '100%', borderStyle: 'dashed' }}
                        onClick={() => {
                          setSelectedCourseId(course.id);
                          setIsModuleModalOpen(true);
                        }}
                      >
                        + Add module
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0', font: '600 14px Urbanist' }}>
            No courses in this track yet. Add a course to get started!
          </div>
        )}
          
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
            <button className="pillbtn" style={{ background: '#E5A83C', color: '#1C1712' }} onClick={() => setIsCourseModalOpen(true)}>
              + Add course
            </button>
          </div>
        </div>
      )}

      {/* PROGRESS TAB PANEL */}
      {activeTab === 'progress' && (
        <div>
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            <div className="stat-box">
              <span className="stat-box-val">{p.pct}%</span>
              <span className="stat-box-lbl">COMPLETE</span>
            </div>
            <div className="stat-box">
              <span className="stat-box-val">{totalHours}h</span>
              <span className="stat-box-lbl">INVESTED</span>
            </div>
            <div className="stat-box">
              <span className="stat-box-val">{avgRating}<span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/10</span></span>
              <span className="stat-box-lbl">AVG MASTERY</span>
            </div>
            <div className="stat-box">
              <span className="stat-box-val">{logs.length}</span>
              <span className="stat-box-lbl">SESSIONS</span>
            </div>
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <span className="lbl" style={{ marginBottom: '16px' }}>Mastery trend</span>
              <div style={{ width: '100%', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {logs.length > 1 ? (
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <line x1="0" y1="10" x2={chartWidth} y2="10" stroke="var(--phbar-bg)" strokeWidth="1" strokeDasharray="3" />
                    <line x1="0" y1="50" x2={chartWidth} y2="50" stroke="var(--phbar-bg)" strokeWidth="1" strokeDasharray="3" />
                    <line x1="0" y1="90" x2={chartWidth} y2="90" stroke="var(--phbar-bg)" strokeWidth="1" strokeDasharray="3" />
                    
                    <path d={chartPath} fill="none" stroke={track.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    
                    {chartPoints.map((pt, i) => (
                      <g key={i}>
                        <circle cx={pt.x} cy={pt.y} r="5" fill={track.color} stroke="var(--card-bg)" strokeWidth="1.5" />
                        <text x={pt.x} y={pt.y - 10} textAnchor="middle" fill="var(--text)" fontSize="9" fontWeight="800" fontFamily="Urbanist">
                          {pt.rating}
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
                    Log more sessions to generate trend line.
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center', font: '600 11px Urbanist', color: 'var(--text-muted)', marginTop: '10px' }}>
                Last 10 sessions — going up and to the right.
              </div>
            </div>

            <div className="card">
              <span className="lbl" style={{ marginBottom: '16px' }}>By course</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {track?.courses && track.courses.length > 0 ? (
                  track.courses.map(c => {
                    const cp = getCourseProgress(c);
                    return (
                      <div key={c.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
                          <span>{c.name}</span>
                          <span>{cp.pct}%</span>
                        </div>
                        <div className="phbar">
                          <div className="progress-fill" style={{ width: `${cp.pct}%`, background: track.color }}></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
                    No courses added yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'log' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button className="pillbtn" onClick={() => navigate(`/log?trackId=${trackId}`)}>
              <IconPlus size={16} /> Log session
            </button>
          </div>
          
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--rail-border)' }}>
            {logs.length > 0 ? (
              logs.map(l => (
                <div key={l.id} className="activity-row" style={{ cursor: 'default' }}>
                  <div className="activity-row-icon" style={{ background: `${track.color}15`, color: track.color, overflow: 'hidden' }}>
                    {renderTrackIcon(track, 16, { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' })}
                  </div>
                  
                  <div className="activity-row-details">
                    <div className="activity-row-title">{l.topic}</div>
                    <div className="activity-row-subtitle">
                      {new Date(l.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {l.notes && ' · ' + l.notes}
                    </div>
                  </div>

                  <div className="activity-row-side">
                    <div className="activity-row-rating">⭐ {l.rating}/10</div>
                    <div className="activity-row-dur">{formatDuration(l.duration)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0', fontSize: '14px', fontWeight: 600 }}>
                No study sessions logged for this track.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD COURSE MODAL */}
      {isCourseModalOpen && (
        <div className="scrim" onClick={() => setIsCourseModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Course</span>
              <span className="modal-close" onClick={() => setIsCourseModalOpen(false)}>×</span>
            </div>
            
            <form onSubmit={handleCreateCourse} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="flabel">Course name</label>
                <input 
                  className="field" 
                  placeholder="e.g. Scikit-learn"
                  value={newCourseName}
                  onChange={e => setNewCourseName(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="ghostpill" onClick={() => setIsCourseModalOpen(false)} disabled={isSavingCourse}>
                  Cancel
                </button>
                <button type="submit" className="pillbtn" disabled={isSavingCourse} style={{ opacity: isSavingCourse ? 0.6 : 1, cursor: isSavingCourse ? 'not-allowed' : 'pointer' }}>
                  {isSavingCourse ? 'Adding…' : 'Add course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MODULE MODAL */}
      {isModuleModalOpen && (
        <div className="scrim" onClick={() => setIsModuleModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">New Module</span>
              <span className="modal-close" onClick={() => setIsModuleModalOpen(false)}>×</span>
            </div>
            
            <form onSubmit={handleCreateModule} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="flabel">Module Title</label>
                <input 
                  className="field" 
                  placeholder="e.g. Classification and regression drill"
                  value={newModuleTitle}
                  onChange={e => setNewModuleTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="flabel">Type</label>
                <select 
                  className="field" 
                  value={newModuleType}
                  onChange={e => setNewModuleType(e.target.value)}
                >
                  <option value="reading">Reading</option>
                  <option value="video">Video</option>
                  <option value="drill">Drill</option>
                  <option value="project">Project</option>
                  <option value="assessment">Assessment</option>
                  <option value="note">Note</option>
                </select>
              </div>

              <div>
                <label className="flabel">Description (optional)</label>
                <textarea
                  className="field"
                  placeholder="What does this module cover?"
                  value={newModuleDescription}
                  onChange={e => setNewModuleDescription(e.target.value)}
                  rows={4}
                  style={{ resize: 'vertical', minHeight: '90px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="ghostpill" onClick={() => setIsModuleModalOpen(false)} disabled={isSavingModule}>
                  Cancel
                </button>
                <button type="submit" className="pillbtn" disabled={isSavingModule} style={{ opacity: isSavingModule ? 0.6 : 1, cursor: isSavingModule ? 'not-allowed' : 'pointer' }}>
                  {isSavingModule ? 'Adding…' : 'Add module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODULE MODAL */}
      {isEditModuleOpen && (
        <div className="scrim" onClick={() => setIsEditModuleOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Edit Module</span>
              <span className="modal-close" onClick={() => setIsEditModuleOpen(false)}>×</span>
            </div>

            <form onSubmit={handleEditModule} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="flabel">Module Title</label>
                <input
                  className="field"
                  value={editModuleTitle}
                  onChange={e => setEditModuleTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="flabel">Type</label>
                <select
                  className="field"
                  value={editModuleType}
                  onChange={e => setEditModuleType(e.target.value)}
                >
                  <option value="reading">Reading</option>
                  <option value="video">Video</option>
                  <option value="drill">Drill</option>
                  <option value="project">Project</option>
                  <option value="assessment">Assessment</option>
                  <option value="note">Note</option>
                </select>
              </div>

              <div>
                <label className="flabel">Description (optional)</label>
                <textarea
                  className="field"
                  placeholder="What does this module cover?"
                  value={editModuleDescription}
                  onChange={e => setEditModuleDescription(e.target.value)}
                  rows={4}
                  style={{ resize: 'vertical', minHeight: '90px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="ghostpill" onClick={() => setIsEditModuleOpen(false)} disabled={isSavingEditModule}>
                  Cancel
                </button>
                <button type="submit" className="pillbtn" disabled={isSavingEditModule} style={{ opacity: isSavingEditModule ? 0.6 : 1, cursor: isSavingEditModule ? 'not-allowed' : 'pointer' }}>
                  {isSavingEditModule ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TRACK DETAILS MODAL */}
      {isEditTrackOpen && (
        <div className="scrim" onClick={() => setIsEditTrackOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Edit Track</span>
              <span className="modal-close" onClick={() => setIsEditTrackOpen(false)}>×</span>
            </div>
            <form onSubmit={handleEditTrack} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className={shakeName ? 'shake' : ''}>
                <label className="flabel">Track name</label>
                <input 
                  className="field" 
                  value={editTrackName}
                  onChange={e => {
                    setEditTrackName(e.target.value);
                    setValErrors(prev => ({ ...prev, name: '' }));
                  }}
                  onBlur={() => {
                    const err = validateFields(editTrackName, editTrackColor, editIconState.value, trackId);
                    setValErrors(prev => ({ ...prev, name: err.name }));
                    if (err.name) {
                      setShakeName(true);
                      setTimeout(() => setShakeName(false), 400);
                    }
                  }}
                  required
                />
                {valErrors.name && (
                  <div style={{ color: '#FF5E5E', fontSize: '12px', fontWeight: 600, marginTop: '6px' }}>
                    {valErrors.name}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className={shakeIcon ? 'shake' : ''}>
                  <label className="flabel" style={{ marginBottom: '8px' }}>Icon</label>
                  <TrackIconPicker
                    value={editIconState}
                    onChange={setEditIconState}
                    usedIcons={allTracks.filter(t => t.id !== trackId).map(t => ({ type: t.icon_type || 'emoji', value: t.icon_value || t.icon }))}
                    trackColor={editTrackColor}
                  />
                  {valErrors.icon && (
                    <div style={{ color: '#FF5E5E', fontSize: '12px', fontWeight: 600, marginTop: '6px' }}>
                      {valErrors.icon}
                    </div>
                  )}
                </div>

                <div>
                  <label className="flabel">Semester</label>
                  <input 
                    className="field" 
                    value={editTrackSemester}
                    onChange={e => setEditTrackSemester(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={shakeColor ? 'shake' : ''}>
                <label className="flabel">Theme color</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    type="color" 
                    value={editTrackColor}
                    onChange={e => {
                      setEditTrackColor(e.target.value);
                      const err = validateFields(editTrackName, e.target.value, editIconState.value, trackId);
                      setValErrors(err);
                      if (err.color || err.combined) {
                        setShakeColor(true);
                        setTimeout(() => setShakeColor(false), 400);
                      }
                    }}
                    style={{ width: '50px', height: '50px', border: '1.5px solid var(--input-border)', background: 'none', cursor: 'pointer', borderRadius: '12px', padding: '4px' }}
                  />
                  <input 
                    className="field" 
                    value={editTrackColor}
                    onChange={e => {
                      setEditTrackColor(e.target.value);
                      const err = validateFields(editTrackName, e.target.value, editIconState.value, trackId);
                      setValErrors(err);
                      if (err.color || err.combined) {
                        setShakeColor(true);
                        setTimeout(() => setShakeColor(false), 400);
                      }
                    }}
                    style={{ flex: 1 }}
                    required
                  />
                </div>
                {valErrors.color && (
                  <div style={{ color: '#FF5E5E', fontSize: '12px', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {(() => {
                      const conflictingTrack = allTracks.find(t => t.id !== trackId && (t.color.toLowerCase() === editTrackColor.toLowerCase() || isSimilarColor(editTrackColor, t.color)));
                      if (conflictingTrack) {
                        return (
                          <>
                            <span>This colour is too close to your <strong>{conflictingTrack.name}</strong> track</span>
                            <span style={{ 
                              display: 'inline-block', 
                              width: '12px', 
                              height: '12px', 
                              borderRadius: '50%', 
                              background: conflictingTrack.color,
                              border: '1px solid rgba(255,255,255,0.2)' 
                            }}></span>
                          </>
                        );
                      }
                      return valErrors.color;
                    })()}
                  </div>
                )}
              </div>

              {/* COMBINED/GENERAL ERROR */}
              {valErrors.combined && (
                <div style={{ color: '#FF5E5E', fontSize: '12px', fontWeight: 600, marginTop: '4px', textAlign: 'center' }}>
                  {valErrors.combined}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="ghostpill" 
                  style={{ color: 'red', borderColor: 'rgba(255,0,0,0.2)' }}
                  onClick={async () => {
                    setIsEditTrackOpen(false);
                    const isConfirmed = await showConfirm("Are you sure you want to delete this entire track?", "Delete Track");
                    if (isConfirmed) {
                      api.delete(`/tracks/${trackId}`).then(() => {
                        try {
                          localStorage.removeItem('sv_tracks_cache');
                          localStorage.removeItem('sv_tracks_cache_timestamp');
                          localStorage.removeItem('sv_dashboard_cache');
                          localStorage.removeItem('sv_dashboard_cache_timestamp');
                          localStorage.removeItem('sv_cal_tracks');
                          localStorage.removeItem('sv_cal_tracks_ts');
                          localStorage.removeItem('sv_cal_months');
                          localStorage.removeItem('sv_trackview_cache');
                          localStorage.removeItem('sv_trackview_cache_ts');
                        } catch (e) {}
                        navigate('/tracks');
                      });
                    }
                  }}
                >
                  Delete track
                </button>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="ghostpill" disabled={isSavingTrack} onClick={() => {
                    setValErrors({ name: '', color: '', emoji: '', combined: '' });
                    setIsEditTrackOpen(false);
                  }}>
                    Cancel
                  </button>
                  <button type="submit" className="pillbtn" disabled={isSavingTrack} style={{ opacity: isSavingTrack ? 0.6 : 1, cursor: isSavingTrack ? 'not-allowed' : 'pointer' }}>
                    {isSavingTrack ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME COURSE MODAL */}
      {isRenameCourseOpen && (
        <div className="scrim" onClick={() => setIsRenameCourseOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Rename Course</span>
              <span className="modal-close" onClick={() => setIsRenameCourseOpen(false)}>×</span>
            </div>
            
            <form onSubmit={handleRenameCourse} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="flabel">Course name</label>
                <input 
                  className="field" 
                  value={renameCourseName}
                  onChange={e => setRenameCourseName(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="ghostpill" disabled={isRenamingCourse} onClick={() => setIsRenameCourseOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="pillbtn" disabled={isRenamingCourse} style={{ opacity: isRenamingCourse ? 0.6 : 1, cursor: isRenamingCourse ? 'not-allowed' : 'pointer' }}>
                  {isRenamingCourse ? 'Renaming…' : 'Rename'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE COURSE CONFIRM MODAL */}
      {isDeleteCourseOpen && (
        <div className="scrim" onClick={() => setIsDeleteCourseOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ color: 'red' }}>Delete Course?</span>
              <span className="modal-close" onClick={() => setIsDeleteCourseOpen(false)}>×</span>
            </div>
            
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.5', fontWeight: 600 }}>
              Are you sure you want to delete the course <b>"{deleteCourseName}"</b> and all its modules? This action cannot be undone.
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="ghostpill" onClick={() => setIsDeleteCourseOpen(false)} disabled={isDeletingCourse}>
                Cancel
              </button>
              <button
                type="button"
                className="pillbtn"
                style={{ background: 'red', color: '#fff', opacity: isDeletingCourse ? 0.6 : 1, cursor: isDeletingCourse ? 'not-allowed' : 'pointer' }}
                onClick={executeDeleteCourse}
                disabled={isDeletingCourse}
              >
                {isDeletingCourse ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODULE CONFIRM MODAL */}
      {isDeleteModuleOpen && (
        <div className="scrim" onClick={() => setIsDeleteModuleOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ color: 'red' }}>Delete Module?</span>
              <span className="modal-close" onClick={() => setIsDeleteModuleOpen(false)}>×</span>
            </div>
            
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.5', fontWeight: 600 }}>
              Are you sure you want to delete the module <b>"{deleteModuleTitle}"</b>? This action cannot be undone.
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="ghostpill" onClick={() => setIsDeleteModuleOpen(false)} disabled={isDeletingModule}>
                Cancel
              </button>
              <button
                type="button"
                className="pillbtn"
                style={{ background: 'red', color: '#fff', opacity: isDeletingModule ? 0.6 : 1, cursor: isDeletingModule ? 'not-allowed' : 'pointer' }}
                onClick={executeDeleteModule}
                disabled={isDeletingModule}
              >
                {isDeletingModule ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}