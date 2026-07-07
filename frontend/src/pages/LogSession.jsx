import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { IconCheck, IconQuestionMark, IconClock } from '@tabler/icons-react';

// Custom reusable hoverable Track Pill component
function TrackPill({ track, isSelected, onClick }) {
  const [hovered, setHovered] = useState(false);
  
  // Hover tints: unselected hover gets a faint 5% opacity tint of the track color
  const background = isSelected 
    ? track.color 
    : (hovered ? `${track.color}0D` : 'var(--input-bg)');
  
  const borderColor = isSelected 
    ? track.color 
    : (hovered ? track.color : 'var(--input-border)');
    
  const textColor = isSelected 
    ? '#ffffff' 
    : 'var(--text)'; // text brightens on hover

  return (
    <button
      type="button"
      className="track-pill-btn"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        background,
        color: textColor,
        borderColor,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.15s ease',
        cursor: 'pointer'
      }}
    >
      <span style={{ 
        display: 'inline-block', 
        width: '8px', 
        height: '8px', 
        borderRadius: '50%', 
        background: isSelected ? '#ffffff' : track.color 
      }}></span>
      {track.name}
    </button>
  );
}

export default function LogSession() {
  const [searchParams] = useSearchParams();
  const [tracks, setTracks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields refs for validation
  const trackSectionRef = useRef(null);
  const topicInputRef = useRef(null);
  const milestoneInputRef = useRef(null);
  const notesRef = useRef(null);

  const navigate = useNavigate();

  // Form state (Default mastery rating is 7)
  const [selectedTrackId, setSelectedTrackId] = useState(searchParams.get('trackId') || '');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(''); // quick select
  const [customDuration, setCustomDuration] = useState(''); // typed
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mastery, setMastery] = useState(7); // Honest default is 7
  const [notes, setNotes] = useState('');
  const [isMilestone, setIsMilestone] = useState(false);
  const [milestoneName, setMilestoneName] = useState('');

  // Auto-save draft states
  const [draftExists, setDraftExists] = useState(false);
  const [draftData, setDraftData] = useState(null);

  // Shake feedback validation states
  const [shakeTrack, setShakeTrack] = useState(false);
  const [shakeTopic, setShakeTopic] = useState(false);
  const [shakeDuration, setShakeDuration] = useState(false);
  const [shakeMilestone, setShakeMilestone] = useState(false);

  // Clock picker states
  const [activeClock, setActiveClock] = useState(null); // 'start' | 'end' | null
  const [tempHour, setTempHour] = useState('1');
  const [tempMinute, setTempMinute] = useState('15');
  const [tempAmpm, setTempAmpm] = useState('AM');

  // Duplicate / short warning modal confirmations
  const [pendingSavePayload, setPendingSavePayload] = useState(null);
  const [warningType, setWarningType] = useState(null); // 'duplicate' | 'short' | null

  // Toast status
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('standard'); // 'standard' | 'milestone'

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch initial database records
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tracksRes, logsRes] = await Promise.all([
          api.get('/tracks'),
          api.get('/logs')
        ]);
        setTracks(tracksRes.data);
        setLogs(logsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Load auto-saved draft from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sv_log_draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.topic || parsed.notes || parsed.customDuration || parsed.startTime || parsed.selectedTrackId)) {
          setDraftData(parsed);
          setDraftExists(true);
        }
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
  }, []);

  // Auto-save draft changes to localStorage
  useEffect(() => {
    const hasTypedContent = topic.trim() || notes.trim() || customDuration || startTime || endTime || selectedTrackId || isMilestone;
    if (hasTypedContent) {
      const draft = {
        selectedTrackId,
        topic,
        duration,
        customDuration,
        startTime,
        endTime,
        date,
        mastery,
        notes,
        isMilestone,
        milestoneName,
        timestamp: Date.now()
      };
      localStorage.setItem('sv_log_draft', JSON.stringify(draft));
    }
  }, [selectedTrackId, topic, duration, customDuration, startTime, endTime, date, mastery, notes, isMilestone, milestoneName]);

  // Resume / Discard drafts handlers
  const handleResumeDraft = () => {
    if (draftData) {
      setSelectedTrackId(draftData.selectedTrackId || '');
      setTopic(draftData.topic || '');
      setDuration(draftData.duration || '');
      setCustomDuration(draftData.customDuration || '');
      setStartTime(draftData.startTime || '');
      setEndTime(draftData.endTime || '');
      setDate(draftData.date || new Date().toISOString().slice(0, 10));
      setMastery(draftData.mastery ?? 7);
      setNotes(draftData.notes || '');
      setIsMilestone(draftData.isMilestone || false);
      setMilestoneName(draftData.milestoneName || '');
    }
    setDraftExists(false);
    setDraftData(null);
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem('sv_log_draft');
    setDraftExists(false);
    setDraftData(null);
  };

  // Browser leave guard if form has unsaved modifications
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const isDirty = topic.trim() || notes.trim() || duration || customDuration || startTime || endTime;
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Leave anyway?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [topic, notes, duration, customDuration, startTime, endTime]);

  // Textarea auto-expansion resizing handler
  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.style.height = 'auto';
      notesRef.current.style.height = `${notesRef.current.scrollHeight}px`;
    }
  }, [notes]);

  // Keyboard shortcuts event listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInputFocused = 
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable;

      // 1. Cmd/Ctrl + Enter -> submit form
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        // Pass event or dummy event
        handleFormSubmit(e);
      }

      // 2. Escape -> close Clock popups / Warning modal confirmations
      if (e.key === 'Escape') {
        if (activeClock) {
          e.preventDefault();
          setActiveClock(null);
        }
        if (warningType) {
          e.preventDefault();
          setWarningType(null);
          setPendingSavePayload(null);
        }
      }

      // 3. Numbers 1-9, 0 -> Select quality/mastery rating (if no input is focused)
      if (!isInputFocused) {
        if (e.key >= '1' && e.key <= '9') {
          e.preventDefault();
          setMastery(parseInt(e.key));
        } else if (e.key === '0') {
          e.preventDefault();
          setMastery(10);
        }

        // 4. T key -> Focus topic field
        if (e.key.toLowerCase() === 't') {
          e.preventDefault();
          topicInputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTrackId, topic, duration, customDuration, startTime, endTime, date, mastery, notes, isMilestone, milestoneName, activeClock, warningType]);

  // Time parsing and formatting helpers
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;
    let hrs = parseInt(match[1]);
    const mins = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hrs < 12) hrs += 12;
    if (ampm === 'AM' && hrs === 12) hrs = 0;
    return hrs * 60 + mins;
  };

  const formatMinutesToTimeStr = (totalMins) => {
    let hrs = Math.floor(totalMins / 60) % 24;
    const mins = totalMins % 60;
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    let displayHrs = hrs % 12;
    if (displayHrs === 0) displayHrs = 12;
    return `${displayHrs}:${mins.toString().padStart(2, '0')} ${ampm}`;
  };

  // Convert 12h AM/PM string to 24h HH:MM for mobile inputs
  const convertTo24h = (timeStr) => {
    if (!timeStr) return '';
    const mins = parseTimeToMinutes(timeStr);
    if (mins === null) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Convert 24h HH:MM to 12h AM/PM for storage
  const convertTo12h = (val24) => {
    if (!val24) return '';
    const parts = val24.split(':');
    if (parts.length < 2) return '';
    let h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    const ampm = h >= 12 ? 'PM' : 'AM';
    let displayH = h % 12;
    if (displayH === 0) displayH = 12;
    return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const addMinutesToTimeStr = (timeStr, minsToAdd) => {
    const startMins = parseTimeToMinutes(timeStr);
    if (startMins === null) return '';
    const endMins = (startMins + minsToAdd) % (24 * 60);
    return formatMinutesToTimeStr(endMins);
  };

  // State Machine Sync logic
  const handleQuickSelect = (durVal) => {
    const valInt = parseInt(durVal);
    setDuration(durVal.toString());
    setCustomDuration(durVal.toString());

    if (startTime) {
      const formattedEnd = addMinutesToTimeStr(startTime, valInt);
      setEndTime(formattedEnd);
    }
  };

  const handleDurationInputChange = (newValStr) => {
    setCustomDuration(newValStr);
    
    if (newValStr === '') {
      setDuration('');
      if (startTime) {
        setEndTime('');
      }
      return;
    }

    const valInt = parseInt(newValStr);
    if (isNaN(valInt) || valInt <= 0) {
      setDuration('');
      return;
    }

    if ([30, 45, 60, 90, 120].includes(valInt)) {
      setDuration(valInt.toString());
    } else {
      setDuration('');
    }

    if (startTime) {
      const formattedEnd = addMinutesToTimeStr(startTime, valInt);
      setEndTime(formattedEnd);
    }
  };

  const handleStartTimeChange = (newStartVal) => {
    setStartTime(newStartVal);

    if (newStartVal === '') {
      setEndTime('');
      return;
    }

    const currentDur = parseInt(customDuration) || parseInt(duration) || 0;
    if (currentDur > 0) {
      const formattedEnd = addMinutesToTimeStr(newStartVal, currentDur);
      setEndTime(formattedEnd);
    }
  };

  const handleEndTimeChange = (newEndVal) => {
    setEndTime(newEndVal);

    if (newEndVal === '') {
      return;
    }

    if (startTime) {
      const startMins = parseTimeToMinutes(startTime);
      const endMins = parseTimeToMinutes(newEndVal);
      if (startMins !== null && endMins !== null) {
        let diff = endMins - startMins;
        if (diff < 0) diff += 24 * 60; // crossed midnight
        
        setCustomDuration(diff.toString());
        if ([30, 45, 60, 90, 120].includes(diff)) {
          setDuration(diff.toString());
        } else {
          setDuration('');
        }
      }
    }
  };

  // Clock picker modal handlers
  const handleOpenClock = (field) => {
    if (isMobile) return;
    setActiveClock(field);
    const currentVal = field === 'start' ? startTime : endTime;
    
    const match = currentVal.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      setTempHour(match[1]);
      setTempMinute(match[2]);
      setTempAmpm(match[3].toUpperCase());
    } else {
      if (field === 'end') {
        setTempHour('2');
        setTempMinute('45');
        setTempAmpm('AM');
      } else {
        setTempHour('1');
        setTempMinute('15');
        setTempAmpm('AM');
      }
    }
  };

  const updateClockTimeValue = (h, m, ampm) => {
    const formatted = `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
    if (activeClock === 'start') {
      handleStartTimeChange(formatted);
    } else if (activeClock === 'end') {
      handleEndTimeChange(formatted);
    }
  };

  const handleSelectHour = (hr) => {
    setTempHour(hr);
    updateClockTimeValue(hr, tempMinute, tempAmpm);
  };

  const handleSelectMinute = (min) => {
    setTempMinute(min);
    updateClockTimeValue(tempHour, min, tempAmpm);
  };

  const handleSelectAmpm = (ap) => {
    setTempAmpm(ap);
    updateClockTimeValue(tempHour, tempMinute, ap);
  };

  const showToast = (msg, type = 'standard', durationMs = 2500) => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), durationMs);
  };

  const getNextDayStr = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  };

  // Form submit handler with custom shake validations
  const handleFormSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // 1. Shake Track Section if unselected
    if (!selectedTrackId) {
      setShakeTrack(true);
      setTimeout(() => setShakeTrack(false), 400);
      showToast('Select a track to continue.', 'standard');
      trackSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // 2. Shake Topic input if empty
    if (!topic.trim()) {
      setShakeTopic(true);
      setTimeout(() => setShakeTopic(false), 400);
      showToast('What did you work on? Add a quick description.', 'standard');
      topicInputRef.current?.focus();
      return;
    }

    // 3. Shake Duration if unresolved
    const finalDuration = parseInt(customDuration) || parseInt(duration);
    if (!finalDuration) {
      setShakeDuration(true);
      setTimeout(() => setShakeDuration(false), 400);
      showToast('Add a duration or time gap.', 'standard');
      return;
    }

    if (date > new Date().toISOString().slice(0, 10)) {
      showToast('You can only log sessions that have already happened.', 'standard');
      return;
    }

    // 4. Shake Milestone input if toggled but empty
    if (isMilestone && !milestoneName.trim()) {
      setShakeMilestone(true);
      setTimeout(() => setShakeMilestone(false), 400);
      showToast('Name your milestone before saving.', 'standard');
      milestoneInputRef.current?.focus();
      return;
    }

    const payload = {
      trackId: selectedTrackId,
      topic: topic.trim(),
      duration: finalDuration,
      date,
      rating: mastery,
      notes: notes.trim() || null,
      milestoneReached: isMilestone,
      milestoneName: isMilestone ? milestoneName.trim() : null,
      startTime: startTime.trim() || null,
      endTime: endTime.trim() || null
    };

    // Duplicate check
    const isDuplicate = logs.some(l => 
      l.trackId === selectedTrackId && 
      l.date === date && 
      l.topic.trim().toLowerCase() === topic.trim().toLowerCase()
    );

    if (isDuplicate) {
      setPendingSavePayload(payload);
      setWarningType('duplicate');
      return;
    }

    if (finalDuration < 5) {
      setPendingSavePayload(payload);
      setWarningType('short');
      return;
    }

    saveSessionLog(payload);
  };

  const saveSessionLog = async (payload) => {
    setSaving(true);
    try {
      await api.post('/logs', {
        trackId: payload.trackId,
        topic: payload.topic,
        duration: payload.duration,
        date: payload.date,
        rating: payload.rating,
        notes: payload.notes,
        milestoneReached: payload.milestoneReached,
        milestoneName: payload.milestoneName,
        startTime: payload.startTime,
        endTime: payload.endTime
      });

      // Clear cached localStorage draft on success
      localStorage.removeItem('sv_log_draft');

      const trackObj = tracks.find(t => t.id === payload.trackId);
      const iconLabel = trackObj?.icon && !trackObj.icon.includes('/') ? trackObj.icon : '📚';

      // Dispatched celebrations
      if (payload.milestoneReached) {
        showToast(`🏆 Milestone reached: ${payload.milestoneName}`, 'milestone', 4000);
        window.dispatchEvent(new CustomEvent('show-success', {
          detail: {
            type: 'milestone_reached',
            milestoneName: payload.milestoneName
          }
        }));
      } else {
        showToast(`${iconLabel} ${trackObj?.name || 'Session'} · ${payload.duration}min logged`, 'standard', 2500);
        window.dispatchEvent(new CustomEvent('show-success', {
          detail: {
            type: 'session_logged',
            duration: payload.duration,
            trackName: trackObj?.name || 'Session'
          }
        }));
      }

      // Reset form fields
      setTopic('');
      setDuration('');
      setCustomDuration('');
      setStartTime('');
      setEndTime('');
      setNotes('');
      setMilestoneName('');
      setIsMilestone(false);
      setMastery(7); // Resets back to honest default 7
      setActiveClock(null);
      
      // Preserve track selection only if the user arrived from a track view
      if (!searchParams.get('trackId')) {
        setSelectedTrackId('');
      }

      // Reload logs database array for next validation cycles
      const logsRes = await api.get('/logs');
      setLogs(logsRes.data);

      // Smart Redirect: Return to track page after 2.5s success duration, otherwise stay on page
      if (searchParams.get('trackId')) {
        setTimeout(() => {
          navigate(`/tracks/${payload.trackId}`);
        }, 2500);
      }

    } catch (err) {
      console.error(err);
      showToast("Something went wrong, your session wasn't saved. Try again.", 'standard');
    } finally {
      setSaving(false);
    }
  };

  const confirmSaveSession = () => {
    if (pendingSavePayload) {
      saveSessionLog(pendingSavePayload);
    }
    setPendingSavePayload(null);
    setWarningType(null);
  };

  const datePastWarning = (() => {
    if (!date) return null;
    const today = new Date();
    const d = new Date(date + 'T12:00:00');
    const diffTime = Math.abs(today - d);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 30) {
      return "Logging a session from over a month ago — that's fine, just making sure.";
    }
    return null;
  })();

  const resolvedDuration = parseInt(customDuration) || parseInt(duration) || 0;
  const showLongDurationWarning = resolvedDuration > 600;
  const crossesMidnight = startTime && endTime && (parseTimeToMinutes(endTime) < parseTimeToMinutes(startTime));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--text-muted)', font: '700 14px Urbanist' }}>
        Loading Log Form...
      </div>
    );
  }

  return (
    <div className="page active" id="page-log">
      {/* HEADER SECTION */}
      <div className="dashboard-header-row" style={{ marginBottom: '24px' }}>
        <div>
          <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
          <h1 className="dashboard-title">Log session</h1>
          <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
            Grind logged is progress made.
          </div>
        </div>
      </div>

      {toastMessage && (
        <div 
          className={`toast show ${toastType === 'milestone' ? 'milestone' : ''}`} 
          style={{ 
            zIndex: 10000, 
            font: '800 13.5px Urbanist', 
            borderRadius: '12px',
            background: toastType === 'milestone' ? '#FEF3C7' : '#C25A3A',
            color: toastType === 'milestone' ? '#D97706' : '#ffffff',
            border: toastType === 'milestone' ? '1.5px solid #F59E0B' : 'none',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            animation: 'toast-slide-down 0.3s forwards'
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* FORM CARD CONTAINER */}
      <div 
        className="card" 
        style={{ 
          maxWidth: '600px', 
          margin: '0 auto', 
          padding: '32px', 
          borderRadius: '16px',
          border: '1px solid var(--card-border)',
          boxShadow: 'none'
        }}
      >
        {/* Unsaved draft banner notifier */}
        {draftExists && draftData && (
          <div 
            style={{ 
              background: 'var(--input-bg)', 
              border: '1.5px solid var(--input-border)', 
              borderRadius: '12px', 
              padding: '12px 16px', 
              marginBottom: '28px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <span style={{ font: '600 13px Urbanist', color: 'var(--text-muted)' }}>
              You have an unsaved draft from <strong style={{ color: 'var(--text)' }}>{new Date(draftData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>. Resume or discard?
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button" 
                onClick={handleResumeDraft} 
                className="pillbtn" 
                style={{ padding: '6px 14px', fontSize: '12px', height: 'auto' }}
              >
                Resume draft
              </button>
              <button 
                type="button" 
                onClick={handleDiscardDraft} 
                className="ghostpill" 
                style={{ padding: '6px 14px', fontSize: '12px', height: 'auto' }}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {tracks.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', background: 'var(--input-bg)', border: '1.5px dashed var(--input-border)', borderRadius: '16px', font: '700 14px Urbanist', color: 'var(--text-muted)' }}>
            No tracks yet. <Link to="/tracks" style={{ color: '#C25A3A', textDecoration: 'underline', fontWeight: '800' }}>Create a track first</Link> to log sessions.
          </div>
        ) : (
          <form onSubmit={handleFormSubmit}>
            
            {/* TRACK SELECTOR */}
            <div 
              ref={trackSectionRef} 
              className={shakeTrack ? 'shake-error' : ''} 
              style={{ marginBottom: '28px', transition: 'transform 0.2s' }}
            >
              <label className="flabel">TRACK</label>
              <div className="track-pills">
                {tracks.map(t => (
                  <TrackPill 
                    key={t.id}
                    track={t}
                    isSelected={selectedTrackId === t.id}
                    onClick={() => setSelectedTrackId(t.id)}
                  />
                ))}
              </div>
            </div>

            {/* WHAT DID YOU WORK ON */}
            <div 
              className={shakeTopic ? 'shake-error' : ''} 
              style={{ marginBottom: '28px', transition: 'transform 0.2s' }}
            >
              <label className="flabel">WHAT DID YOU WORK ON?</label>
              <input
                ref={topicInputRef}
                className="field"
                placeholder="e.g. Python list comprehensions, Kali lab — Samba exploit"
                value={topic}
                onChange={e => setTopic(e.target.value)}
              />
            </div>

            {/* DURATION */}
            <div 
              className={shakeDuration ? 'shake-error' : ''} 
              style={{ marginBottom: '28px', transition: 'transform 0.2s' }}
            >
              <label className="flabel">DURATION (MINUTES)</label>
              <div className="duration-row" style={{ marginBottom: '12px' }}>
                {[30, 45, 60, 90, 120].map(dur => (
                  <button
                    key={dur}
                    type="button"
                    className={`duration-quick ${duration === dur.toString() && !customDuration ? 'sel' : ''}`}
                    onClick={() => handleQuickSelect(dur)}
                  >
                    {dur}
                  </button>
                ))}
              </div>
              <input
                type="number"
                className="field"
                placeholder="Or type custom minutes"
                value={customDuration}
                onChange={e => handleDurationInputChange(e.target.value)}
              />
              
              {showLongDurationWarning && (
                <div style={{ font: '600 12px Urbanist', color: '#B45309', marginTop: '6px' }}>
                  ⚠️ That's a long session. Are you sure?
                </div>
              )}
            </div>

            {/* TIME GAP WITH NATIVE MOBILE OR DESKTOP SELECTOR */}
            <div style={{ marginBottom: '28px' }}>
              <label className="flabel">TIME GAP</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
                
                {/* START TIME FIELD */}
                <div style={{ position: 'relative', flex: 1 }}>
                  <input 
                    type={isMobile ? "time" : "text"} 
                    className="field" 
                    placeholder="1:15 AM"
                    value={isMobile ? convertTo24h(startTime) : startTime}
                    onChange={e => {
                      const val = isMobile ? convertTo12h(e.target.value) : e.target.value;
                      handleStartTimeChange(val);
                    }}
                    onClick={() => handleOpenClock('start')}
                    style={{ cursor: isMobile ? 'default' : 'pointer' }}
                    readOnly={!isMobile}
                  />
                  {!isMobile && (
                    <span 
                      onClick={() => handleOpenClock('start')}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                    >
                      <IconClock size={16} />
                    </span>
                  )}
                  
                  {/* START TIME CLOCK POPUP */}
                  {!isMobile && activeClock === 'start' && (
                    <ClockPicker 
                      val={startTime}
                      setVal={setStartTime}
                      tempH={tempHour}
                      tempM={tempMinute}
                      tempA={tempAmpm}
                      onSelectHour={handleSelectHour}
                      onSelectMinute={handleSelectMinute}
                      onSelectAmpm={handleSelectAmpm}
                      onClose={() => setActiveClock(null)}
                    />
                  )}
                </div>

                <span style={{ font: '700 13px Urbanist', color: 'var(--text-muted)' }}>to</span>

                {/* END TIME FIELD */}
                <div style={{ position: 'relative', flex: 1 }}>
                  <input 
                    type={isMobile ? "time" : "text"} 
                    className="field" 
                    placeholder="2:45 AM"
                    value={isMobile ? convertTo24h(endTime) : endTime}
                    onChange={e => {
                      const val = isMobile ? convertTo12h(e.target.value) : e.target.value;
                      handleEndTimeChange(val);
                    }}
                    onClick={() => {
                      if (startTime) handleOpenClock('end');
                    }}
                    disabled={!startTime}
                    style={{ 
                      cursor: !startTime ? 'not-allowed' : (isMobile ? 'default' : 'pointer'),
                      opacity: !startTime ? 0.5 : 1
                    }}
                    readOnly={!isMobile}
                  />
                  {!isMobile && (
                    <span 
                      onClick={() => startTime && handleOpenClock('end')}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: startTime ? 'pointer' : 'not-allowed', display: 'flex' }}
                    >
                      <IconClock size={16} />
                    </span>
                  )}

                  {/* END TIME CLOCK POPUP */}
                  {!isMobile && activeClock === 'end' && (
                    <ClockPicker 
                      val={endTime}
                      setVal={setEndTime}
                      tempH={tempHour}
                      tempM={tempMinute}
                      tempA={tempAmpm}
                      onSelectHour={handleSelectHour}
                      onSelectMinute={handleSelectMinute}
                      onSelectAmpm={handleSelectAmpm}
                      onClose={() => setActiveClock(null)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* DATE & MILESTONE REACHED SIDE-BY-SIDE */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'end' }}>
                {/* DATE */}
                <div>
                  <label className="flabel">DATE</label>
                  <input
                    type="date"
                    className="field"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                  />
                  
                  {crossesMidnight && (
                    <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', marginTop: '6px' }}>
                      ℹ️ Session ended on {getNextDayStr(date)}
                    </div>
                  )}

                  {datePastWarning && (
                    <div style={{ font: '600 12px Urbanist', color: '#B45309', marginTop: '6px' }}>
                      ⚠️ {datePastWarning}
                    </div>
                  )}
                </div>

                {/* MILESTONE TOGGLE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="flabel">MILESTONE REACHED?</label>
                  <div style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', borderRadius: '12px', height: '42px', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>Mark as milestone</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={isMilestone}
                        onChange={e => {
                          setIsMilestone(e.target.checked);
                          if (!e.target.checked) setMilestoneName(''); // clears milestone name inputs
                        }}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* MILESTONE NAME INPUT WITH SMOOTH ACCORDION SLIDE-DOWN */}
              <div 
                className={shakeMilestone ? 'shake-error' : ''} 
                style={{ 
                  maxHeight: isMilestone ? '90px' : '0', 
                  overflow: 'hidden', 
                  transition: 'max-height 200ms cubic-bezier(0.4, 0, 0.2, 1), margin 200ms, opacity 200ms',
                  opacity: isMilestone ? 1 : 0,
                  marginTop: isMilestone ? '16px' : '0'
                }}
              >
                <label className="flabel">MILESTONE NAME</label>
                <input
                  ref={milestoneInputRef}
                  className="field"
                  placeholder="Name this milestone…"
                  value={milestoneName}
                  onChange={e => setMilestoneName(e.target.value)}
                  required={isMilestone}
                />
              </div>
            </div>

            {/* MASTERY / QUALITY */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <label className="flabel" style={{ margin: 0 }}>SESSION QUALITY / MASTERY (1–10)</label>
                <div className="tooltip-container">
                  <span className="tooltip-icon" tabIndex="0" aria-label="Help explaining session quality">
                    <IconQuestionMark size={13} style={{ border: '1.5px solid var(--text-muted)', borderRadius: '50%', padding: '1px' }} />
                  </span>
                  <div className="tooltip-box">
                    How deeply did this do this session? Score yourself honestly, not on hours spent, but on how well you could explain or apply what you covered right now.
                  </div>
                </div>
              </div>
              <div className="mastery-row">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`mastery-btn ${mastery === m ? 'sel' : ''}`}
                    onClick={() => {
                      if (mastery === m) setMastery(null); // Clicking deselects
                      else setMastery(m);
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* NOTES */}
            <div style={{ marginBottom: '28px', position: 'relative' }}>
              <label className="flabel">NOTES</label>
              <textarea
                ref={notesRef}
                className="field"
                placeholder="What did you cover? What clicked? What blocked you? What's next?"
                style={{ minHeight: '100px', resize: 'none', overflow: 'hidden' }}
                value={notes}
                onChange={e => {
                  if (e.target.value.length <= 2000) {
                    setNotes(e.target.value);
                  }
                }}
              />
              
              {notes.length >= 1800 && (
                <div style={{ font: '800 11px Urbanist', color: notes.length >= 2000 ? '#EF4444' : 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
                  {notes.length} / 2000 characters
                </div>
              )}
            </div>

            {/* SAVE BUTTON */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
              <button
                type="submit"
                disabled={saving}
                className="pillbtn log-save-btn"
                style={{ 
                  width: '100%', 
                  justifyContent: 'center', 
                  height: '50px', 
                  fontSize: '15px', 
                  background: '#100D18', 
                  color: '#ffffff',
                  opacity: saving ? 0.7 : 1,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#ffffff',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    <span>Saving…</span>
                  </div>
                ) : (
                  <span>✓ Save session</span>
                )}
              </button>
            </div>

          </form>
        )}
      </div>

      {/* WARNING / DUPLICATE CONFIRMATION MODAL POPUP */}
      {warningType && (
        <div className="scrim" style={{ zIndex: 10000 }}>
          <div className="modal" style={{ padding: '30px', textAlign: 'center', width: '400px' }}>
            <h3 style={{ font: '900 18px Urbanist', color: 'var(--text)', marginBottom: '12px' }}>
              {warningType === 'duplicate' ? 'Duplicate Session' : 'Very Short Session'}
            </h3>
            <p style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {warningType === 'duplicate' 
                ? 'You logged a session with this same topic today. Log again?' 
                : "That's a very short session. Still worth logging?"}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                type="button" 
                className="pillbtn" 
                style={{ background: '#C25A3A', color: '#fff', padding: '0 24px', height: '38px' }}
                onClick={confirmSaveSession}
              >
                Yes, save
              </button>
              <button 
                type="button" 
                className="ghostpill" 
                style={{ height: '38px' }}
                onClick={() => {
                  setPendingSavePayload(null);
                  setWarningType(null);
                }}
              >
                No, cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Circular designed clock picker dial
function ClockPicker({
  val,
  setVal,
  tempH,
  tempM,
  tempA,
  onSelectHour,
  onSelectMinute,
  onSelectAmpm,
  onClose
}) {
  const hoursList = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  const cx = 80;
  const cy = 80;
  const radius = 52;
  const selectedHInt = parseInt(tempH) || 12;

  // Clock handle angle geometry calculation
  const selAngle = (selectedHInt * 30 - 90) * (Math.PI / 180);
  const selX = cx + radius * Math.cos(selAngle);
  const selY = cy + radius * Math.sin(selAngle);

  return (
    <div 
      className="card" 
      style={{ 
        position: 'absolute', 
        zIndex: 500, 
        top: '46px', 
        left: 0, 
        width: '260px', 
        padding: '20px', 
        background: 'var(--card-bg)', 
        border: '1.5px solid var(--card-border)', 
        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '14px'
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ font: '900 24px Urbanist', color: 'var(--text)', margin: '4px 0 0px 0' }}>
        {val || '1:15 AM'}
      </div>

      {/* CLOCK DIAL CIRCULAR VIEW */}
      <div style={{ position: 'relative', width: '160px', height: '160px' }}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--card-border)" strokeWidth="1" opacity="0.5" />
          <circle cx={cx} cy={cy} r="4" fill="var(--text)" />
          <line x1={cx} y1={cy} x2={selX} y2={selY} stroke="#C25A3A" strokeWidth="2.5" />

          {hoursList.map(h => {
            const hInt = parseInt(h);
            const isSelected = selectedHInt === hInt;
            const angle = (hInt * 30 - 90) * (Math.PI / 180);
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);

            return (
              <g 
                key={h} 
                onClick={() => onSelectHour(h)} 
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {isSelected ? (
                  <>
                    <circle cx={x} cy={y} r="13" fill="#111111" />
                    <text 
                      x={x} 
                      y={y} 
                      fill="#ffffff" 
                      textAnchor="middle" 
                      dominantBaseline="central" 
                      style={{ font: '900 12px Urbanist' }}
                    >
                      {h}
                    </text>
                  </>
                ) : (
                  <>
                    <circle cx={x} cy={y} r="16" fill="transparent" />
                    <text 
                      x={x} 
                      y={y} 
                      fill="var(--text)" 
                      textAnchor="middle" 
                      dominantBaseline="central" 
                      style={{ font: '700 12px Urbanist' }}
                    >
                      {h}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ width: '100%', textAlign: 'left', font: '800 10.5px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '-4px' }}>
        Minutes
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', width: '100%' }}>
        {minutesList.map(m => {
          const isSelected = parseInt(tempM) === parseInt(m);
          return (
            <button
              key={m}
              type="button"
              style={{
                height: '28px',
                borderRadius: '8px',
                border: 'none',
                background: isSelected ? '#111111' : 'var(--input-bg)',
                color: isSelected ? '#fff' : 'var(--text-muted)',
                font: '800 11.5px Urbanist',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.1s'
              }}
              onClick={() => onSelectMinute(m)}
            >
              {m}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
        <button 
          type="button" 
          onClick={() => onSelectAmpm('AM')}
          style={{
            flex: 1,
            height: '34px',
            borderRadius: '10px',
            font: '800 13px Urbanist',
            border: 'none',
            background: tempA === 'AM' ? '#111111' : 'var(--input-bg)',
            color: tempA === 'AM' ? '#ffffff' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.1s'
          }}
        >
          AM
        </button>
        <button 
          type="button" 
          onClick={() => onSelectAmpm('PM')}
          style={{
            flex: 1,
            height: '34px',
            borderRadius: '10px',
            font: '800 13px Urbanist',
            border: 'none',
            background: tempA === 'PM' ? '#111111' : 'var(--input-bg)',
            color: tempA === 'PM' ? '#ffffff' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.1s'
          }}
        >
          PM
        </button>
      </div>

      <button
        type="button"
        style={{
          width: '100%',
          height: '36px',
          background: 'var(--text)',
          color: 'var(--page)',
          borderRadius: '999px',
          border: 'none',
          font: '800 13px Urbanist',
          cursor: 'pointer',
          marginTop: '4px'
        }}
        onClick={onClose}
      >
        Done
      </button>
    </div>
  );
}
