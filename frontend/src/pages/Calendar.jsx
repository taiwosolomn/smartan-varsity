import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { IconChevronLeft, IconChevronRight, IconPlus } from '@tabler/icons-react';

// LocalStorage-backed caches
let calTracksCache = null;
let calTracksCacheTs = 0;
let calMonthsCache = {};

try {
  const tv = localStorage.getItem('sv_cal_tracks');
  const tt = localStorage.getItem('sv_cal_tracks_ts');
  const mv = localStorage.getItem('sv_cal_months');
  if (tv && tt) {
    const parsedTv = JSON.parse(tv);
    if (Array.isArray(parsedTv)) {
      calTracksCache = parsedTv;
      calTracksCacheTs = parseInt(tt, 10) || 0;
    }
  }
  if (mv) {
    const parsedMv = JSON.parse(mv);
    if (parsedMv && typeof parsedMv === 'object') {
      calMonthsCache = parsedMv;
    }
  }
} catch (e) {}

const toLocalYYYYMMDD = (date) => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingMonth, setIsFetchingMonth] = useState(false);

  // Month Caching state: { '2026-07': { events: [...], logs: [...] } }
  const [cachedMonths, setCachedMonths] = useState({});

  // Unified Plan/Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [topic, setTopic] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [planTime, setPlanTime] = useState('09:00');
  const [duration, setDuration] = useState(90);
  const [repeatType, setRepeatType] = useState('none'); // none, day, weekday, week, 2weeks, month

  // Recurrence confirmation popup
  const [recurrenceAction, setRecurrenceAction] = useState(null); // { type: 'edit'|'delete', event: ... }

  // Slide-in toast notification state
  const [toast, setToast] = useState(null); // { message: '', visible: false }
  const [deletingIds, setDeletingIds] = useState([]);
  
  const showToast = (message) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast(prev => prev ? { ...prev, visible: false } : null);
      setTimeout(() => {
        setToast(null);
      }, 400);
    }, 2000);
  };

  // Log details modal state
  const [selectedLog, setSelectedLog] = useState(null);
  const [isLogEditing, setIsLogEditing] = useState(false);
  const [logEditTrackId, setLogEditTrackId] = useState('');
  const [logEditTopic, setLogEditTopic] = useState('');
  const [logEditDate, setLogEditDate] = useState('');
  const [logEditDuration, setLogEditDuration] = useState(60);
  const [logEditRating, setLogEditRating] = useState(8);
  const [logEditNotes, setLogEditNotes] = useState('');
  const [logEditMilestoneReached, setLogEditMilestoneReached] = useState(false);
  const [logEditMilestoneName, setLogEditMilestoneName] = useState('');

  // Day View Modal state
  const [isDayViewOpen, setIsDayViewOpen] = useState(false);
  const [selectedDayStr, setSelectedDayStr] = useState('');

  // Tooltip position state
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [tooltipCoords, setTooltipCoords] = useState({ x: 0, y: 0 });

  // Grid Keyboard Focus state
  const [focusedCellIndex, setFocusedCellIndex] = useState(null);

  const now = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  // Helper to ensure Cybersecurity track color is red (#EF4444)
  const getTrackColor = (t) => {
    if (!t) return 'var(--text-muted)';
    if (t.name?.toLowerCase().includes('cyber') || t.id?.toLowerCase().includes('cyber')) {
      return '#EF4444';
    }
    return t.color;
  };

  // Helper to parse recurrence metadata and strip redundant prefixes
  const parseTopic = (rawTopic) => {
    if (!rawTopic) return { displayTopic: '', seriesId: null, isDeadline: false };
    
    let clean = rawTopic;
    let isDeadline = false;
    
    // Strip "Deadline: " prefix
    if (clean.startsWith('Deadline: ')) {
      clean = clean.substring(10);
      isDeadline = true;
    }
    
    // Strip day name prefix like "Mon - " or "Mon  "
    clean = clean.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*[-•|:—]?\s*/i, '');
    
    const match = clean.match(/(.*?)\s*\[rec:(series_[a-zA-Z0-9]+)\]$/);
    if (match) {
      return { displayTopic: match[1], seriesId: match[2], isDeadline };
    }
    return { displayTopic: clean, seriesId: null, isDeadline };
  };

  // Fetch initial tracks — with localStorage SWR
  const fetchTracks = async (force = false) => {
    // Logout guard
    if (calTracksCache && !localStorage.getItem('sv_cal_tracks')) {
      calTracksCache = null; calTracksCacheTs = 0;
    }
    if (calTracksCache && !force) {
      setTracks(calTracksCache);
      if (calTracksCache.length > 0 && !selectedTrackId) setSelectedTrackId(calTracksCache[0].id);
      // Background refresh if >5 min old
      if (Date.now() - calTracksCacheTs > 300000) {
        api.get('/tracks').then(res => {
          calTracksCache = res.data; calTracksCacheTs = Date.now();
          try { localStorage.setItem('sv_cal_tracks', JSON.stringify(res.data)); localStorage.setItem('sv_cal_tracks_ts', calTracksCacheTs.toString()); } catch (e) {}
          setTracks(res.data);
        }).catch(() => {});
      }
      return;
    }
    try {
      const res = await api.get('/tracks');
      calTracksCache = res.data; calTracksCacheTs = Date.now();
      try { localStorage.setItem('sv_cal_tracks', JSON.stringify(res.data)); localStorage.setItem('sv_cal_tracks_ts', calTracksCacheTs.toString()); } catch (e) {}
      setTracks(res.data);
      if (res.data.length > 0 && !selectedTrackId) setSelectedTrackId(res.data[0].id);
    } catch (err) {
      console.error('Failed to fetch tracks', err);
    }
  };

  // Fetch data for a specific month
  const fetchMonthData = async (monthKey) => {
    try {
      const [eventsRes, logsRes] = await Promise.all([
        api.get(`/calendar?month=${monthKey}`),
        api.get(`/logs?month=${monthKey}`)
      ]);
      return { events: eventsRes.data, logs: logsRes.data };
    } catch (err) {
      console.error(`Failed to fetch data for month ${monthKey}`, err);
      return { events: [], logs: [] };
    }
  };

  // Pre-load and background prefetch handler
  const loadActiveMonth = async () => {
    setIsFetchingMonth(true);

    // Logout guard for month cache
    if (calMonthsCache && Object.keys(calMonthsCache).length > 0 && !localStorage.getItem('sv_cal_months')) {
      calMonthsCache = {};
    }

    // Fetch tracks (uses cache internally)
    fetchTracks();

    if (!cachedMonths[currentMonthKey] && !calMonthsCache[currentMonthKey]) {
      const data = await fetchMonthData(currentMonthKey);
      // Update both React state and persistent cache
      calMonthsCache[currentMonthKey] = data;
      try { localStorage.setItem('sv_cal_months', JSON.stringify(calMonthsCache)); } catch (e) {}
      setCachedMonths(prev => ({ ...prev, [currentMonthKey]: data }));
    } else if (!cachedMonths[currentMonthKey] && calMonthsCache[currentMonthKey]) {
      // Restore from localStorage into React state instantly
      setCachedMonths(prev => ({ ...prev, [currentMonthKey]: calMonthsCache[currentMonthKey] }));
      // Background refresh silently
      fetchMonthData(currentMonthKey).then(data => {
        calMonthsCache[currentMonthKey] = data;
        try { localStorage.setItem('sv_cal_months', JSON.stringify(calMonthsCache)); } catch (e) {}
        setCachedMonths(prev => ({ ...prev, [currentMonthKey]: data }));
      }).catch(() => {});
    }

    setIsFetchingMonth(false);
    setLoading(false);

    // Prefetch surrounding months silently in background
    const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const nextKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

    prefetchSilently(prevKey);
    prefetchSilently(nextKey);
  };

  const prefetchSilently = async (monthKey) => {
    if (cachedMonths[monthKey] || calMonthsCache[monthKey]) return;
    const data = await fetchMonthData(monthKey);
    calMonthsCache[monthKey] = data;
    try { localStorage.setItem('sv_cal_months', JSON.stringify(calMonthsCache)); } catch (e) {}
    setCachedMonths(prev => ({ ...prev, [monthKey]: data }));
  };

  useEffect(() => {
    loadActiveMonth();
  }, [currentDate]);

  // Flatten all cached data for seamless border/boundary matching
  const allEvents = Object.values(cachedMonths).reduce((acc, m) => [...acc, ...m.events], []);
  const allLogs = Object.values(cachedMonths).reduce((acc, m) => [...acc, ...m.logs], []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleGoToToday = () => {
    setCurrentDate(new Date());
  };

  const getMonthLabel = () => {
    return currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  const openPlanSession = (dateStr = '', eventObj = null) => {
    if (eventObj) {
      // Edit mode
      const { displayTopic } = parseTopic(eventObj.topic);
      setEditingEventId(eventObj.id);
      setSelectedTrackId(eventObj.trackId);
      setTopic(displayTopic);
      setPlanDate(eventObj.date);
      setPlanTime(eventObj.time || '09:00');
      setDuration(eventObj.duration || 90);
      setRepeatType('none'); // Recurrence series editing handled separately
    } else {
      // Create mode
      setEditingEventId(null);
      setTopic('');
      setPlanDate(dateStr || toLocalYYYYMMDD(new Date()));
      setPlanTime('09:00');
      setDuration(90);
      setRepeatType('none');
    }
    setIsModalOpen(true);
  };

  // Helper to generate recurrence sequence dates
  const generateRecurrenceDates = (startDateStr, type) => {
    const dates = [];
    const start = new Date(startDateStr + 'T12:00:00');
    const limit = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days range limit
    let curr = new Date(start);

    // Skip the first date since we are already saving it
    const advanceDate = (d) => {
      if (type === 'day') {
        d.setDate(d.getDate() + 1);
      } else if (type === 'weekday') {
        do {
          d.setDate(d.getDate() + 1);
        } while (d.getDay() === 0 || d.getDay() === 6);
      } else if (type === 'week') {
        d.setDate(d.getDate() + 7);
      } else if (type === '2weeks') {
        d.setDate(d.getDate() + 14);
      } else if (type === 'month') {
        d.setMonth(d.getMonth() + 1);
      }
    };

    advanceDate(curr);
    while (curr <= limit) {
      dates.push(toLocalYYYYMMDD(curr));
      advanceDate(curr);
    }
    return dates;
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!topic.trim() || !planDate || !selectedTrackId) return;

    try {
      if (editingEventId) {
        // Checking if it's recurring
        const originalEvent = allEvents.find(x => x.id === editingEventId);
        const { seriesId } = parseTopic(originalEvent?.topic);

        if (seriesId) {
          setRecurrenceAction({
            type: 'edit',
            event: { id: editingEventId, trackId: selectedTrackId, topic, date: planDate, time: planTime, duration, seriesId }
          });
          setIsModalOpen(false);
          return;
        }

        // Standard event update
        await api.put(`/calendar/${editingEventId}`, {
          trackId: selectedTrackId,
          topic: topic.trim(),
          date: planDate,
          time: planTime,
          duration: parseInt(duration)
        });
        window.dispatchEvent(new CustomEvent('show-success', { detail: { type: 'session_planned' } }));
      } else {
        // Creating event(s)
        if (repeatType !== 'none') {
          const seriesId = `series_${Math.random().toString(36).substring(2, 8)}`;
          const fullTopic = `${topic.trim()} [rec:${seriesId}]`;
          
          // Save initial event
          await api.post('/calendar', {
            trackId: selectedTrackId,
            topic: fullTopic,
            date: planDate,
            time: planTime,
            duration: parseInt(duration)
          });

          // Generate recurring chain dates
          const chainDates = generateRecurrenceDates(planDate, repeatType);
          
          // Submit chain dates sequentially
          for (const dStr of chainDates) {
            await api.post('/calendar', {
              trackId: selectedTrackId,
              topic: fullTopic,
              date: dStr,
              time: planTime,
              duration: parseInt(duration)
            });
          }
          window.dispatchEvent(new CustomEvent('show-success', { detail: { type: 'session_planned' } }));
        } else {
          // Standard single event save
          await api.post('/calendar', {
            trackId: selectedTrackId,
            topic: topic.trim(),
            date: planDate,
            time: planTime,
            duration: parseInt(duration)
          });
          window.dispatchEvent(new CustomEvent('show-success', { detail: { type: 'session_planned' } }));
        }
      }

      setIsModalOpen(false);
      // Force refresh cached active month
      const refreshed = await fetchMonthData(currentMonthKey);
      setCachedMonths(prev => ({ ...prev, [currentMonthKey]: refreshed }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEventId) return;

    try {
      const originalEvent = allEvents.find(x => x.id === editingEventId);
      const { seriesId } = parseTopic(originalEvent?.topic);

      if (seriesId) {
        setRecurrenceAction({
          type: 'delete',
          event: originalEvent
        });
        setIsModalOpen(false);
        return;
      }

      const eventMonthKey = originalEvent.date.slice(0, 7);
      setDeletingIds(prev => [...prev, editingEventId]);

      setIsModalOpen(false);
      showToast('Planned session deleted.');
      await api.delete(`/calendar/${editingEventId}`);
      
      const refreshed = await fetchMonthData(eventMonthKey);
      setCachedMonths(prev => ({ ...prev, [eventMonthKey]: refreshed }));
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => {
        setDeletingIds(prev => prev.filter(id => id !== editingEventId));
      }, 500);
    }
  };

  // Recurrence modifications batch runners
  const executeRecurrenceAction = async (applyToAll) => {
    if (!recurrenceAction) return;
    const { type, event } = recurrenceAction;
    setRecurrenceAction(null);

    try {
      if (type === 'delete') {
        if (applyToAll) {
          showToast('Planned session series deleted.');
          const { seriesId } = parseTopic(event.topic);
          const targets = allEvents.filter(x => {
            const parsed = parseTopic(x.topic);
            return parsed.seriesId === seriesId && x.date >= event.date;
          });

          for (const item of targets) {
            await api.delete(`/calendar/${item.id}`);
          }
        } else {
          showToast('Planned session deleted.');
          await api.delete(`/calendar/${event.id}`);
        }
      } else if (type === 'edit') {
        if (applyToAll) {
          const targets = allEvents.filter(x => {
            const parsed = parseTopic(x.topic);
            return parsed.seriesId === event.seriesId && x.date >= event.date;
          });

          const fullTopic = `${event.topic.trim()} [rec:${event.seriesId}]`;
          for (const item of targets) {
            await api.put(`/calendar/${item.id}`, {
              trackId: event.trackId,
              topic: fullTopic,
              date: item.date, // keep original repeating date
              time: event.time,
              duration: parseInt(event.duration)
            });
          }
        } else {
          // Edit this session only: strips recurrence metadata to decouple it
          await api.put(`/calendar/${event.id}`, {
            trackId: event.trackId,
            topic: event.topic.trim(),
            date: event.date,
            time: event.time,
            duration: parseInt(event.duration)
          });
        }
      }

      const refreshed = await fetchMonthData(currentMonthKey);
      setCachedMonths(prev => ({ ...prev, [currentMonthKey]: refreshed }));
    } catch (err) {
      console.error(err);
    }
  };

  // Open Log Details side view modal
  const handleOpenLogDetails = (log) => {
    setSelectedLog(log);
    setIsLogEditing(false);
    setLogEditTrackId(log.trackId);
    setLogEditTopic(log.topic);
    setLogEditDate(log.date);
    setLogEditDuration(log.duration);
    setLogEditRating(log.rating);
    setLogEditNotes(log.notes || '');
    setLogEditMilestoneReached(log.milestoneReached || false);
    setLogEditMilestoneName(log.milestoneName || '');
  };

  const handleSaveLogEdit = async (e) => {
    e.preventDefault();
    if (!selectedLog) return;

    try {
      await api.put(`/logs/${selectedLog.id}`, {
        trackId: logEditTrackId,
        topic: logEditTopic.trim(),
        duration: parseInt(logEditDuration),
        date: logEditDate,
        rating: parseInt(logEditRating),
        notes: logEditNotes.trim(),
        milestoneReached: logEditMilestoneReached,
        milestoneName: logEditMilestoneReached ? logEditMilestoneName.trim() : null
      });

      setSelectedLog(null);
      const refreshed = await fetchMonthData(currentMonthKey);
      setCachedMonths(prev => ({ ...prev, [currentMonthKey]: refreshed }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLog = async () => {
    if (!selectedLog) return;
    const logId = selectedLog.id;
    const logMonthKey = selectedLog.date.slice(0, 7);
    
    setDeletingIds(prev => [...prev, logId]);
    setSelectedLog(null);
    showToast('Session log deleted.');
    
    try {
      await api.delete(`/logs/${logId}`);
      const refreshed = await fetchMonthData(logMonthKey);
      setCachedMonths(prev => ({ ...prev, [logMonthKey]: refreshed }));
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => {
        setDeletingIds(prev => prev.filter(id => id !== logId));
      }, 500);
    }
  };

  // ICS Export formatting builder
  const handleExportICS = () => {
    const formatICSDate = (dStr, tStr) => {
      const [y, m, d] = dStr.split('-');
      const [hh, mm] = (tStr || '09:00').split(':');
      return `${y}${m}${d}T${hh}${mm}00`;
    };

    const getICSDateEnd = (dStr, tStr, durationMins) => {
      const [y, m, d] = dStr.split('-');
      const [hh, mm] = (tStr || '09:00').split(':');
      const date = new Date(y, m - 1, d, hh, mm);
      date.setMinutes(date.getMinutes() + (durationMins || 90));
      const pad = (num) => String(num).padStart(2, '0');
      return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
    };

    const calendarPlannedOnly = allEvents; // standard filter export
    let icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Smartan Varsity//Calendar Export//EN',
      'CALSCALE:GREGORIAN'
    ];

    calendarPlannedOnly.forEach(ev => {
      const tr = tracks.find(x => x.id === ev.trackId);
      const dtStart = formatICSDate(ev.date, ev.time);
      const dtEnd = getICSDateEnd(ev.date, ev.time, ev.duration);
      const { displayTopic } = parseTopic(ev.topic);

      icsLines.push(
        'BEGIN:VEVENT',
        `UID:${ev.id}@smartan-varsity`,
        `DTSTAMP:${dtStart}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${displayTopic}`,
        `DESCRIPTION:Track: ${tr?.name || 'Unknown'}\\nPlanned Duration: ${ev.duration} min`,
        'END:VEVENT'
      );
    });

    icsLines.push('END:VCALENDAR');

    const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sta-calendar-export-${toLocalYYYYMMDD(new Date())}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate calendar days sequence helper
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay() || 7; // Mon = 1, Sun = 7
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month overflow buffer
    for (let i = firstDayIndex - 1; i > 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevDays - i + 1),
        isOtherMonth: true
      });
    }

    // Active month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: new Date(year, month, d),
        isOtherMonth: false
      });
    }

    // Next month overflow buffer to complete grid weeks
    while (days.length % 7 !== 0) {
      const nextDaysCount = days.length - daysInMonth - (firstDayIndex - 1);
      days.push({
        date: new Date(year, month + 1, nextDaysCount + 1),
        isOtherMonth: true
      });
    }

    return days;
  };

  // Hover position calculation helper
  const handlePillMouseEnter = (e, info) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredEvent(info);
    setTooltipCoords({
      x: rect.left + rect.width / 2 + window.scrollX,
      y: rect.top - 8 + window.scrollY
    });
  };

  // Handle cell grid arrow navigation
  const handleKeyDown = (e, index, dateKey) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') nextIndex = index + 1;
    else if (e.key === 'ArrowLeft') nextIndex = index - 1;
    else if (e.key === 'ArrowDown') nextIndex = index + 7;
    else if (e.key === 'ArrowUp') nextIndex = index - 7;
    else if (e.key === 'Enter') {
      setSelectedDayStr(dateKey);
      setIsDayViewOpen(true);
      return;
    } else return;

    const cells = getCalendarDays();
    if (nextIndex >= 0 && nextIndex < cells.length) {
      e.preventDefault();
      setFocusedCellIndex(nextIndex);
      const nextEl = document.getElementById(`cal-cell-${nextIndex}`);
      if (nextEl) nextEl.focus();
    }
  };

  const daysList = getCalendarDays();
  const todayStr = toLocalYYYYMMDD(now);
  const isCurrentMonth = currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth();

  return (
    <div className="page active" id="page-calendar" style={{ paddingBottom: '40px' }}>
      <style>{`
        .slide-toast {
          position: fixed;
          top: -100px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--card-bg);
          border: 1.5px solid var(--text-muted);
          border-radius: 12px;
          padding: 12px 24px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          font: 800 13.5px Urbanist;
          color: var(--text);
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 10px;
          pointer-events: none;
          transition: top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease;
          opacity: 0;
        }
        .slide-toast.show {
          top: 20px;
          opacity: 1;
        }
        @keyframes pillFadeOut {
          0% { opacity: 1; transform: scale(1); max-height: 24px; padding-top: 3px; padding-bottom: 3px; margin-top: 0; margin-bottom: 0; }
          100% { opacity: 0; transform: scale(0.8); max-height: 0px; padding-top: 0px; padding-bottom: 0px; margin-top: 0px; margin-bottom: 0px; overflow: hidden; border: none; }
        }
        .pill-deleting {
          animation: pillFadeOut 0.4s forwards !important;
          pointer-events: none;
        }
      `}</style>

      {/* Dynamic Slide down toast message feedback */}
      {toast && (
        <div className={`slide-toast ${toast.visible ? 'show' : ''}`}>
          <span style={{ color: '#E5A83C', fontWeight: '900' }}>✓</span> {toast.message}
        </div>
      )}

      {/* Page accent bar standardizer */}
      <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />

      {/* HEADER SECTION */}
      <div className="dashboard-header-row" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="dashboard-title">Calendar</h1>
          <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
            Grind scheduled is grind executed.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Calendar arrows navigation wrapper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--input-bg)', border: '1px solid var(--rail-border)', borderRadius: '12px', padding: '4px 12px' }}>
            <button 
              className="cal-nav-btn" 
              style={{ width: '28px', height: '28px' }} 
              onClick={handlePrevMonth}
              aria-label="Previous month"
            >
              <IconChevronLeft size={16} />
            </button>
            <span style={{ font: '600 14px Urbanist', color: 'var(--text)', minWidth: '110px', textAlign: 'center' }}>
              {getMonthLabel()}
            </span>
            <button 
              className="cal-nav-btn" 
              style={{ width: '28px', height: '28px' }} 
              onClick={handleNextMonth}
              aria-label="Next month"
            >
              <IconChevronRight size={16} />
            </button>
          </div>

          {/* Today reset control */}
          <button 
            className="ghostpill"
            style={{ 
              padding: '6px 14px', 
              fontSize: '12px', 
              fontWeight: '700',
              borderColor: 'var(--rail-border)',
              opacity: isCurrentMonth ? 0.5 : 1,
              pointerEvents: isCurrentMonth ? 'none' : 'auto'
            }}
            onClick={handleGoToToday}
          >
            Today
          </button>

          {/* Calendar ICS exporter */}
          <button 
            className="ghostpill" 
            style={{ padding: '8px 12px', borderColor: 'var(--rail-border)' }}
            onClick={handleExportICS}
            title="Export calendar to .ics"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          </button>

          {/* New plan trigger button */}
          <button className="pillbtn" onClick={() => openPlanSession()}>
            <IconPlus size={16} />
            <span className="btn-text-responsive">Plan session</span>
          </button>
        </div>
      </div>

      {/* MOBILE LIST LAYOUT VIEW (screens < 768px) */}
      <div className="mobile-only-calendar-list" style={{ display: 'none' }}>
        {daysList
          .filter(d => {
            const dateStr = toLocalYYYYMMDD(d.date);
            const eventsCount = allEvents.filter(e => e.date === dateStr).length;
            const logsCount = allLogs.filter(l => l.date === dateStr).length;
            return !d.isOtherMonth && (eventsCount > 0 || logsCount > 0);
          })
          .map(d => {
            const dateStr = toLocalYYYYMMDD(d.date);
            const isToday = dateStr === todayStr;
            const dayEvents = allEvents.filter(e => e.date === dateStr);
            const dayLogs = allLogs.filter(l => l.date === dateStr);

            return (
              <div 
                key={dateStr} 
                style={{ 
                  background: 'var(--card-bg)', 
                  border: '1px solid var(--rail-border)',
                  borderRadius: '12px',
                  padding: '12px', 
                  marginBottom: '10px',
                  display: 'flex',
                  gap: '12px'
                }}
                onClick={() => {
                  setSelectedDayStr(dateStr);
                  setIsDayViewOpen(true);
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {d.date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: isToday ? 'var(--rico-active-bg, #E5A83C)' : 'transparent',
                    color: isToday ? 'var(--rico-active-color, #1C1712)' : 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '13px',
                    marginTop: '2px'
                  }}>
                    {d.date.getDate()}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  {dayLogs.map(l => {
                    const tr = tracks.find(x => x.id === l.trackId);
                    return (
                      <div 
                        key={l.id} 
                        style={{ 
                          borderLeft: `3px solid ${getTrackColor(tr)}`, 
                          background: `${getTrackColor(tr)}12`,
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}
                      >
                        ✓ {l.topic}
                      </div>
                    );
                  })}
                  {dayEvents.map(e => {
                    const tr = tracks.find(x => x.id === e.trackId);
                    const { displayTopic, seriesId } = parseTopic(e.topic);
                    return (
                      <div 
                        key={e.id} 
                        style={{ 
                          borderLeft: `3px dashed ${getTrackColor(tr)}`, 
                          background: `${getTrackColor(tr)}06`,
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span>{displayTopic}</span>
                        {seriesId && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        {daysList.filter(d => {
          const dateStr = toLocalYYYYMMDD(d.date);
          return !d.isOtherMonth && (allEvents.some(e => e.date === dateStr) || allLogs.some(l => l.date === dateStr));
        }).length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600' }}>
            No sessions planned or logged for this month.
          </div>
        )}
      </div>

      {/* MONTHLY CALENDAR GRID VIEW */}
      <div className="desktop-only-calendar-grid" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--rail-border)', background: 'var(--card-bg)' }}>
        {/* Day Week headers grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--calendar-border, rgba(255,255,255,0.06))' }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
            const isWeekend = idx === 5 || idx === 6;
            return (
              <div 
                key={day} 
                style={{ 
                  textAlign: 'center', 
                  padding: '12px 0', 
                  font: '800 11px Urbanist', 
                  color: 'var(--text-muted)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.6px',
                  opacity: isWeekend ? 0.5 : 0.8
                }}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Cells Grid */}
        <div 
          role="grid"
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            background: 'var(--calendar-border, rgba(255, 255, 255, 0.05))', 
            gap: '1px' 
          }}
        >
          {daysList.map(({ date, isOtherMonth }, index) => {
            const dateKey = toLocalYYYYMMDD(date);
            const isToday = dateKey === todayStr;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            
            const eventsOnDate = allEvents.filter(e => e.date === dateKey);
            const logsOnDate = allLogs.filter(l => l.date === dateKey);
            
            const cellItems = [
              ...logsOnDate.map(l => ({ ...l, itemType: 'log' })),
              ...eventsOnDate.map(e => ({ ...e, itemType: 'planned' }))
            ];
            
            const displayLimit = 3;
            const visibleItems = cellItems.slice(0, displayLimit);
            const overflowCount = cellItems.length - displayLimit;

            return (
              <div 
                id={`cal-cell-${index}`}
                role="gridcell"
                tabIndex={0}
                key={index} 
                style={{ 
                  background: isToday ? 'rgba(229, 168, 60, 0.03)' : 'var(--card-bg)', 
                  minHeight: '110px', 
                  padding: '8px', 
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  opacity: isOtherMonth ? 0.3 : 1,
                  position: 'relative',
                  minWidth: 0,
                  overflow: 'hidden',
                  outline: focusedCellIndex === index ? '2px solid var(--accent, #E5A83C)' : 'none'
                }}
                onKeyDown={(e) => handleKeyDown(e, index, dateKey)}
                onClick={(e) => {
                  // Ignore cell click when clicking interactive pills inside
                  if (e.target.closest('.event-pill')) return;
                  setSelectedDayStr(dateKey);
                  setIsDayViewOpen(true);
                }}
                aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })} — ${cellItems.length > 0 ? cellItems.length + ' events' : 'no events'}`}
              >
                {/* Shimmer loading overlay for month data fetch */}
                {isFetchingMonth && (
                  <div className="skeleton-shimmer" style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    opacity: 0.1,
                    zIndex: 2,
                    pointerEvents: 'none'
                  }} />
                )}

                {/* Date display layout */}
                <div style={{ 
                  font: '700 13px Urbanist', 
                  color: isToday ? '#ffffff' : (isWeekend ? 'var(--text-muted)' : 'var(--text)'),
                  opacity: isWeekend && !isToday ? 0.6 : 1,
                  alignSelf: 'flex-start',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: isToday ? 'var(--accent, #E5A83C)' : 'transparent',
                  fontWeight: isToday ? '800' : '400',
                  boxShadow: isToday ? '0 2px 6px rgba(229, 168, 60, 0.3)' : 'none'
                }}>
                  {date.getDate()}
                </div>

                {/* Visible items inside grid cell */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, zIndex: 3 }}>
                  {visibleItems.map(item => {
                    const tr = tracks.find(x => x.id === item.trackId);
                    const trackColorHex = getTrackColor(tr);
                    
                    if (item.itemType === 'log') {
                      // Logged sessions style
                      return (
                        <div 
                          key={item.id} 
                          className={`event-pill ${deletingIds.includes(item.id) ? 'pill-deleting' : ''}`}
                          role="link"
                          tabIndex={0}
                          style={{ 
                            background: trackColorHex ? `${trackColorHex}1f` : 'var(--phbar-bg)',
                            borderLeft: `3px solid ${trackColorHex}`,
                            color: 'var(--event-pill-color)',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            font: '700 10.5px Urbanist',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            lineHeight: '1.35',
                            overflow: 'hidden',
                            transition: 'opacity 0.15s ease'
                          }}
                          aria-label={`logged: ${item.topic}, track: ${tr?.name || 'unknown'}, duration: ${item.duration} minutes`}
                          onMouseEnter={(e) => handlePillMouseEnter(e, { ...item, trackName: tr?.name, trackColor: trackColorHex })}
                          onMouseLeave={() => setHoveredEvent(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenLogDetails(item);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              handleOpenLogDetails(item);
                            }
                          }}
                        >
                          ✓ {item.topic}
                        </div>
                      );
                    } else {
                      // Planned events style
                      const { displayTopic, seriesId, isDeadline } = parseTopic(item.topic);
                      return (
                        <div 
                          key={item.id} 
                          className={`event-pill ${deletingIds.includes(item.id) ? 'pill-deleting' : ''}`}
                          role="link"
                          tabIndex={isDeadline ? -1 : 0}
                          style={{ 
                            background: isDeadline ? `${trackColorHex}15` : (trackColorHex ? `${trackColorHex}0f` : 'var(--input-bg)'),
                            borderLeft: isDeadline ? `3px solid ${trackColorHex}` : `3px dashed ${trackColorHex}`,
                            color: isDeadline ? 'var(--text)' : 'var(--event-pill-planned-color)',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            font: isDeadline ? '700 10px Urbanist' : '600 10.5px Urbanist',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            lineHeight: '1.35',
                            overflow: 'hidden',
                            transition: 'opacity 0.15s ease',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '4px',
                            cursor: isDeadline ? 'default' : 'pointer'
                          }}
                          aria-label={isDeadline ? `deadline: ${displayTopic}, track: ${tr?.name || 'unknown'}` : `planned: ${displayTopic}, track: ${tr?.name || 'unknown'}, duration: ${item.duration} minutes`}
                          onMouseEnter={(e) => handlePillMouseEnter(e, { ...item, topic: displayTopic, trackName: tr?.name, trackColor: trackColorHex })}
                          onMouseLeave={() => setHoveredEvent(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isDeadline) {
                              openPlanSession('', item);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isDeadline) {
                              e.stopPropagation();
                              openPlanSession('', item);
                            }
                          }}
                        >
                          <span style={{ overflow: 'hidden', wordBreak: 'break-word', flex: 1 }}>
                            {isDeadline ? `📅 ${displayTopic}` : displayTopic}
                          </span>
                          {seriesId && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>}
                        </div>
                      );
                    }
                  })}

                  {/* Overflow count link */}
                  {overflowCount > 0 && (
                    <div 
                      style={{ 
                        font: '800 10px Urbanist', 
                        color: 'var(--accent, #E5A83C)', 
                        padding: '2px 0 0 4px', 
                        cursor: 'pointer' 
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDayStr(dateKey);
                        setIsDayViewOpen(true);
                      }}
                    >
                      +{overflowCount} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FLOAT FLOATING BODY-LEVEL TOOLTIP */}
      {hoveredEvent && (
        <div 
          style={{
            position: 'absolute',
            top: tooltipCoords.y,
            left: tooltipCoords.x,
            transform: 'translate(-50%, -100%)',
            background: 'var(--card-bg, #241D18)',
            border: '1px solid var(--rail-border)',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '11px',
            color: 'var(--text)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            pointerEvents: 'none',
            zIndex: 9999,
            textAlign: 'center',
            minWidth: '160px',
            fontFamily: 'Urbanist'
          }}
        >
          <div style={{ fontWeight: 800, color: hoveredEvent.trackColor }}>
            {hoveredEvent.trackName || 'General'}
          </div>
          <div style={{ fontWeight: 600, margin: '2px 0 4px 0', fontSize: '11.5px', color: 'var(--text)' }}>
            {hoveredEvent.topic}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', opacity: 0.8, fontSize: '10.5px' }}>
            <span>⏱️ {hoveredEvent.duration} min</span>
            {hoveredEvent.rating && <span>⭐ {hoveredEvent.rating}/10</span>}
          </div>
        </div>
      )}

      {/* DAY VIEW popover/modal */}
      {isDayViewOpen && (
        <div className="scrim" onClick={() => setIsDayViewOpen(false)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ textTransform: 'capitalize' }}>
                {new Date(selectedDayStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="modal-close" onClick={() => setIsDayViewOpen(false)}>×</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '16px 0', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {/* Filter and display logs + planned events */}
              {[
                ...allLogs.filter(l => l.date === selectedDayStr).map(l => ({ ...l, type: 'log' })),
                ...allEvents.filter(e => e.date === selectedDayStr).map(e => ({ ...e, type: 'planned' }))
              ].map((item, idx) => {
                const tr = tracks.find(x => x.id === item.trackId);
                const isLog = item.type === 'log';
                const { displayTopic, seriesId, isDeadline } = parseTopic(item.topic);

                return (
                  <div 
                    key={idx}
                    style={{
                      borderLeft: `4px ${isLog ? 'solid' : (isDeadline ? 'solid' : 'dashed')} ${getTrackColor(tr)}`,
                      background: 'var(--input-bg)',
                      padding: '12px',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: isDeadline ? 'default' : 'pointer'
                    }}
                    onClick={() => {
                      if (isDeadline) return;
                      setIsDayViewOpen(false);
                      if (isLog) {
                        handleOpenLogDetails(item);
                      } else {
                        openPlanSession('', item);
                      }
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: getTrackColor(tr), textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {tr?.name}
                      </div>
                      <div style={{ font: '700 13.5px Urbanist', color: 'var(--text)', margin: '3px 0' }}>
                        {isLog ? '✓ ' : (isDeadline ? '📅 ' : '')}{displayTopic}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '10px' }}>
                        {!isDeadline && <span>⏱️ {item.duration} mins</span>}
                        {!isDeadline && item.time && <span>⏰ {item.time}</span>}
                        {isLog && <span>⭐ {item.rating}/10</span>}
                        {isDeadline && <span>🏁 Module Deadline</span>}
                      </div>
                    </div>
                    {seriesId && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>}
                  </div>
                );
              })}

              {allLogs.filter(l => l.date === selectedDayStr).length === 0 &&
               allEvents.filter(e => e.date === selectedDayStr).length === 0 && (
                <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
                  No sessions planned or logged for this day.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--rail-border)', paddingTop: '12px' }}>
              <button className="ghostpill" onClick={() => setIsDayViewOpen(false)}>Close</button>
              <button 
                className="pillbtn" 
                onClick={() => {
                  setIsDayViewOpen(false);
                  openPlanSession(selectedDayStr);
                }}
              >
                + Plan session for this day
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAN/EDIT PLANNED SESSION MODAL */}
      {isModalOpen && (
        <div className="scrim" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editingEventId ? 'Edit Planned Session' : 'Plan Session'}</span>
              <span className="modal-close" onClick={() => setIsModalOpen(false)}>×</span>
            </div>
            
            <form onSubmit={handleSavePlan} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="flabel">TRACK</label>
                <select 
                  className="field"
                  value={selectedTrackId}
                  onChange={e => setSelectedTrackId(e.target.value)}
                  required
                >
                  {tracks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.icon && !t.icon.includes('/') ? t.icon : '🧠'} {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flabel">TOPIC / GOAL</label>
                <input 
                  className="field" 
                  placeholder="e.g. Linear algebra — vectors"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="flabel">DATE</label>
                  <input 
                    type="date"
                    className="field"
                    value={planDate}
                    onChange={e => setPlanDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="flabel">TIME</label>
                  <input 
                    type="time"
                    className="field"
                    value={planTime}
                    onChange={e => setPlanTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Grid split for Duration & Recurrence Repeat */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="flabel">DURATION (MINUTES)</label>
                  <input 
                    type="number"
                    className="field"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="flabel">REPEAT RECURRENCE</label>
                  <select 
                    className="field"
                    value={repeatType}
                    onChange={e => setRepeatType(e.target.value)}
                    disabled={!!editingEventId} // series edit selection handled differently
                  >
                    <option value="none">Does not repeat</option>
                    <option value="day">Every day</option>
                    <option value="weekday">Every weekday</option>
                    <option value="week">Every week</option>
                    <option value="2weeks">Every 2 weeks</option>
                    <option value="month">Every month</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '10px' }}>
                {editingEventId ? (
                  <button 
                    type="button" 
                    className="ghostpill" 
                    style={{ borderColor: 'var(--tab-active-color)', color: 'var(--tab-active-color)' }}
                    onClick={handleDeleteEvent}
                  >
                    Delete Event
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="ghostpill" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="pillbtn">
                    {editingEventId ? 'Save changes' : 'Plan session'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECURRENCE BATCH ACTION OPTIONS DECISION SCRIM */}
      {recurrenceAction && (
        <div className="scrim" onClick={() => setRecurrenceAction(null)}>
          <div className="modal" style={{ maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Recurring Session</span>
              <span className="modal-close" onClick={() => setRecurrenceAction(null)}>×</span>
            </div>
            
            <div style={{ margin: '14px 0', fontSize: '13px', color: 'var(--text)', lineHeight: '1.5' }}>
              This is part of a recurring series of events. Would you like to apply this action to this specific session only, or this and all future sessions in this series?
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <button className="pillbtn" style={{ background: 'var(--accent, #E5A83C)' }} onClick={() => executeRecurrenceAction(false)}>
                {recurrenceAction.type === 'delete' ? 'Delete this session only' : 'Edit this session only'}
              </button>
              <button className="pillbtn" onClick={() => executeRecurrenceAction(true)}>
                {recurrenceAction.type === 'delete' ? 'Delete all future sessions' : 'Edit all future sessions'}
              </button>
              <button className="ghostpill" onClick={() => setRecurrenceAction(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* LOG DETAILS SIDE VIEW MODAL */}
      {selectedLog && (
        <div className="scrim" onClick={() => setSelectedLog(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{isLogEditing ? 'Edit Session Log' : 'Completed Session Details'}</span>
              <span className="modal-close" onClick={() => setSelectedLog(null)}>×</span>
            </div>

            {isLogEditing ? (
              <form onSubmit={handleSaveLogEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="flabel">TRACK</label>
                  <select 
                    className="field"
                    value={logEditTrackId}
                    onChange={e => setLogEditTrackId(e.target.value)}
                    required
                  >
                    {tracks.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.icon && !t.icon.includes('/') ? t.icon : '🧠'} {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="flabel">TOPIC</label>
                  <input 
                    className="field"
                    value={logEditTopic}
                    onChange={e => setLogEditTopic(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="flabel">DATE</label>
                    <input 
                      type="date"
                      className="field"
                      value={logEditDate}
                      onChange={e => setLogEditDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="flabel">DURATION (MIN)</label>
                    <input 
                      type="number"
                      className="field"
                      value={logEditDuration}
                      onChange={e => setLogEditDuration(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="flabel">MASTERY RATING (1-10)</label>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    className="field"
                    value={logEditRating}
                    onChange={e => setLogEditRating(e.target.value)}
                  />
                  <div style={{ textAlign: 'center', fontWeight: '800', font: '14px Urbanist', color: 'var(--accent)' }}>
                    {logEditRating}/10
                  </div>
                </div>

                <div>
                  <label className="flabel">NOTES</label>
                  <textarea 
                    className="field"
                    style={{ minHeight: '60px', resize: 'vertical' }}
                    value={logEditNotes}
                    onChange={e => setLogEditNotes(e.target.value)}
                  />
                </div>

                {/* Milestone Edit Sync fields */}
                <div style={{ border: '1px solid var(--rail-border)', borderRadius: '8px', padding: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', font: '700 12px Urbanist' }}>
                    <input 
                      type="checkbox"
                      checked={logEditMilestoneReached}
                      onChange={e => setLogEditMilestoneReached(e.target.checked)}
                    />
                    Mark as Milestone reached
                  </label>
                  {logEditMilestoneReached && (
                    <div style={{ marginTop: '8px' }}>
                      <label className="flabel">MILESTONE NAME</label>
                      <input 
                        className="field"
                        placeholder="e.g. Breakthrough in recursion"
                        value={logEditMilestoneName}
                        onChange={e => setLogEditMilestoneName(e.target.value)}
                        required={logEditMilestoneReached}
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button type="button" className="ghostpill" onClick={() => setIsLogEditing(false)}>Cancel</button>
                  <button type="submit" className="pillbtn">Save edits</button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ borderLeft: `4px solid ${getTrackColor(tracks.find(t => t.id === selectedLog.trackId))}`, paddingLeft: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: getTrackColor(tracks.find(t => t.id === selectedLog.trackId)), textTransform: 'uppercase' }}>
                    {tracks.find(t => t.id === selectedLog.trackId)?.name}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text)', margin: '4px 0' }}>
                    ✓ {selectedLog.topic}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '4px' }}>
                  <div style={{ border: '1.5px solid var(--input-border)', borderRadius: '12px', padding: '10px 14px', background: 'var(--input-bg)' }}>
                    <div style={{ font: '800 9px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Date</div>
                    <div style={{ font: '800 12px Urbanist', color: 'var(--text)' }}>
                      {new Date(selectedLog.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ border: '1.5px solid var(--input-border)', borderRadius: '12px', padding: '10px 14px', background: 'var(--input-bg)' }}>
                    <div style={{ font: '800 9px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Duration</div>
                    <div style={{ font: '800 12px Urbanist', color: 'var(--text)' }}>{selectedLog.duration} mins</div>
                  </div>
                  <div style={{ border: '1.5px solid var(--input-border)', borderRadius: '12px', padding: '10px 14px', background: 'var(--input-bg)' }}>
                    <div style={{ font: '800 9px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Rating</div>
                    <div style={{ font: '800 12px Urbanist', color: 'var(--text)' }}>⭐ {selectedLog.rating}/10</div>
                  </div>
                  {selectedLog.milestoneReached && (
                    <div style={{ gridColumn: '1 / -1', border: '1.5px solid var(--input-border)', borderRadius: '12px', padding: '10px 14px', background: 'var(--input-bg)' }}>
                      <div style={{ font: '800 9px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Milestone Reached</div>
                      <div style={{ font: '800 12px Urbanist', color: 'var(--text)' }}>🏆 {selectedLog.milestoneName || 'Milestone'}</div>
                    </div>
                  )}
                </div>

                {selectedLog.notes && (
                  <div>
                    <div style={{ font: '800 10px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Notes</div>
                    <div style={{ 
                      border: '1.5px solid var(--input-border)', 
                      borderRadius: '12px', 
                      padding: '16px', 
                      background: 'var(--input-bg)',
                      font: '600 13px/1.5 Urbanist',
                      color: 'var(--text)',
                      minHeight: '60px',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {selectedLog.notes}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', borderTop: '1px solid var(--rail-border)', paddingTop: '16px', marginTop: '10px' }}>
                  <button 
                    className="ghostpill" 
                    style={{ borderColor: 'var(--tab-active-color)', color: 'var(--tab-active-color)' }}
                    onClick={handleDeleteLog}
                  >
                    Delete Log
                  </button>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="ghostpill" onClick={() => setIsLogEditing(true)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px' }}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      Edit
                    </button>
                    <button className="ghostpill" onClick={() => setSelectedLog(null)}>Close</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}