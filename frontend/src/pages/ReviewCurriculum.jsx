import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import {
  IconChevronDown, IconChevronRight, IconAlertCircle, IconCheck, IconX,
  IconTrash, IconEdit, IconCalendar
} from '@tabler/icons-react';

const skeletonStyle = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .skeleton-box {
    background: linear-gradient(90deg, var(--input-bg) 25%, var(--card-border) 50%, var(--input-bg) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

function ReviewSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <style>{skeletonStyle}</style>
      <div className="card" style={{ padding: '24px' }}>
        <div className="skeleton-box" style={{ height: '20px', width: '200px', marginBottom: '8px' }} />
        <div className="skeleton-box" style={{ height: '14px', width: '140px' }} />
      </div>
      {[1, 2].map(i => (
        <div key={i} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="skeleton-box" style={{ height: '18px', width: '220px' }} />
          {[1, 2, 3].map(j => (
            <div key={j} style={{ paddingLeft: '16px', borderLeft: '3px solid var(--input-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton-box" style={{ height: '14px', width: '160px' }} />
              {[1, 2].map(k => (
                <div key={k} style={{ paddingLeft: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div className="skeleton-box" style={{ height: '11px', width: '120px' }} />
                  <div className="skeleton-box" style={{ height: '11px', width: '70px', marginLeft: 'auto' }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ValidationBadge({ errors, field }) {
  const relevant = errors.filter(e => e.field === field || e.field.startsWith(field));
  if (!relevant.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '4px' }}>
      <IconAlertCircle size={13} style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px' }} />
      <span style={{ font: '600 11.5px Urbanist', color: '#EF4444', lineHeight: '1.4' }}>{relevant[0].message}</span>
    </div>
  );
}

function EditableField({ value, onSave, multiline = false, type = 'text', style = {} }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');

  const commit = () => {
    setEditing(false);
    if (val !== value) onSave(val);
  };

  if (!editing) {
    return (
      <span
        onClick={() => { setEditing(true); setVal(value || ''); }}
        title="Click to edit"
        style={{
          cursor: 'pointer',
          borderBottom: '1px dashed var(--input-border)',
          paddingBottom: '1px',
          display: 'inline-block',
          minWidth: '60px',
          ...style
        }}
      >
        {value || <span style={{ opacity: 0.4 }}>—</span>}
      </span>
    );
  }

  if (multiline) {
    return (
      <textarea
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        rows={2}
        style={{ font: 'inherit', width: '100%', border: '1.5px solid var(--accent, #C25A3A)', borderRadius: '6px', padding: '4px 8px', background: 'var(--input-bg)', color: 'var(--text)', resize: 'vertical', ...style }}
      />
    );
  }

  return (
    <input
      autoFocus
      type={type}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      style={{ font: 'inherit', border: '1.5px solid var(--accent, #C25A3A)', borderRadius: '6px', padding: '3px 8px', background: 'var(--input-bg)', color: 'var(--text)', minWidth: '80px', ...style }}
    />
  );
}

export default function ReviewCurriculum() {
  const { importId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [importData, setImportData] = useState(null);
  const [curriculum, setCurriculum] = useState(null); // live editable copy
  const [errors, setErrors] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [expandedTracks, setExpandedTracks] = useState({});
  const [expandedCourses, setExpandedCourses] = useState({});
  const debounceRef = useRef(null);

  // Load import data
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/curriculum-imports/${importId}`);
        const d = res.data;
        setImportData(d);
        // Backend resolves edited_json vs raw_json and returns the merged result as json_data
        const liveJson = d.json_data;
        setCurriculum(liveJson);
        setErrors(d.validation_errors || []);

        // Default: all tracks expanded, courses collapsed
        const lms = liveJson?.lms_export;
        if (lms?.tracks) {
          const tExp = {};
          lms.tracks.forEach((t, i) => { tExp[i] = true; });
          setExpandedTracks(tExp);
        }
      } catch (err) {
        console.error('Failed to load import', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [importId]);

  // Debounced autosave
  const autosave = useCallback((updated) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.put(`/curriculum-imports/${importId}`, { edited_json: updated });
        setErrors(res.data.validation_errors || []);
      } catch (e) {
        console.error('Autosave failed', e);
      }
    }, 500);
  }, [importId]);

  const updateCurriculum = useCallback((updater) => {
    setCurriculum(prev => {
      const next = updater(JSON.parse(JSON.stringify(prev)));
      autosave(next);
      return next;
    });
  }, [autosave]);

  const meta = curriculum?.lms_export?.metadata || {};
  const tracks = curriculum?.lms_export?.tracks || [];

  const handleDiscard = async () => {
    if (!window.confirm('Discard this import? This cannot be undone.')) return;
    try {
      await api.delete(`/curriculum-imports/${importId}`);
      navigate('/import-curriculum');
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setConfirmError('');
    try {
      // Optimistic: show success immediately
      setConfirmed(true);
      await api.post(`/curriculum-imports/${importId}/confirm`);
      // Invalidate tracks cache
      try {
        localStorage.removeItem('sv_tracks_cache');
        localStorage.removeItem('sv_tracks_cache_timestamp');
        localStorage.removeItem('sv_dashboard_cache');
        localStorage.removeItem('sv_dashboard_cache_timestamp');
      } catch (e) {}
    } catch (err) {
      setConfirmed(false);
      const detail = err?.response?.data?.detail;
      if (detail?.validation_errors) {
        setErrors(detail.validation_errors);
        setConfirmError('Validation errors found — please fix them before confirming.');
      } else {
        setConfirmError(typeof detail === 'string' ? detail : 'Confirmation failed. Please try again.');
      }
    } finally {
      setConfirming(false);
    }
  };

  // Success state
  if (confirmed) {
    return (
      <div className="page active" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '24px', textAlign: 'center' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(52,168,83,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCheck size={36} style={{ color: '#34A853' }} />
        </div>
        <div>
          <h2 style={{ font: '900 26px Urbanist', color: 'var(--text)', margin: '0 0 8px' }}>Your curriculum is live! 🎉</h2>
          <p style={{ font: '600 14px/1.6 Urbanist', color: 'var(--text-muted)', maxWidth: '420px', margin: 0 }}>
            All tracks, courses, and modules have been imported into your account. 
            Head to your Tracks or Dashboard to see your full schedule.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="ghostpill" style={{ fontSize: '13px', cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
          <button className="pillbtn" style={{ fontSize: '13px', cursor: 'pointer' }} onClick={() => navigate('/tracks')}>
            View Tracks →
          </button>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="page active" style={{ maxWidth: '860px', margin: '0 auto', paddingBottom: '48px' }}>
      <style>{skeletonStyle}</style>
      <div className="skeleton-box" style={{ height: '28px', width: '260px', marginBottom: '8px' }} />
      <div className="skeleton-box" style={{ height: '14px', width: '180px', marginBottom: '32px' }} />
      <ReviewSkeleton />
    </div>
  );

  if (!curriculum) return (
    <div className="page active" style={{ textAlign: 'center', padding: '60px 32px' }}>
      <IconAlertCircle size={32} style={{ color: '#EF4444', marginBottom: '12px' }} />
      <p style={{ font: '600 14px Urbanist', color: 'var(--text-muted)' }}>Import not found or has already been confirmed/discarded.</p>
      <button className="pillbtn" style={{ marginTop: '16px', cursor: 'pointer' }} onClick={() => navigate('/import-curriculum')}>← Upload a new file</button>
    </div>
  );

  const hasErrors = errors.length > 0;

  return (
    <div className="page active" style={{ paddingBottom: '64px', maxWidth: '860px', margin: '0 auto' }}>
      <style>{skeletonStyle}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="dashboard-title" style={{ fontSize: '26px', margin: '0 0 4px' }}>Review Your Curriculum</h1>
          <div style={{ font: '600 13px Urbanist', color: 'var(--text-muted)' }}>
            {importData?.filename} · {tracks.length} track{tracks.length !== 1 ? 's' : ''} · Edit any field before confirming
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          <button
            className="ghostpill"
            style={{ fontSize: '13px', cursor: 'pointer', color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}
            onClick={handleDiscard}
          >
            <IconTrash size={13} style={{ marginRight: '5px' }} />
            Discard
          </button>
          <button
            id="curriculum-confirm-btn"
            className="pillbtn"
            disabled={hasErrors || confirming}
            onClick={handleConfirm}
            style={{
              opacity: hasErrors || confirming ? 0.5 : 1,
              cursor: hasErrors || confirming ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            {confirming ? (
              <><div style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Confirming…</>
            ) : (
              <><IconCheck size={14} /> Confirm Import</>
            )}
          </button>
        </div>
      </div>

      {/* Validation error summary */}
      {hasErrors && (
        <div style={{
          marginBottom: '20px', padding: '16px',
          borderRadius: '12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <IconAlertCircle size={15} style={{ color: '#EF4444' }} />
            <span style={{ font: '800 13px Urbanist', color: '#EF4444' }}>
              {errors.length} validation issue{errors.length !== 1 ? 's' : ''} — fix to unlock Confirm
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {errors.slice(0, 5).map((e, i) => (
              <div key={i} style={{ font: '600 12px Urbanist', color: 'var(--text-muted)' }}>
                <span style={{ color: '#EF4444', fontWeight: 800 }}>• </span>
                <span style={{ color: '#EF4444', opacity: 0.7 }}>{e.field}: </span>
                {e.message}
              </div>
            ))}
            {errors.length > 5 && (
              <div style={{ font: '600 11px Urbanist', color: 'var(--text-muted)' }}>… and {errors.length - 5} more (shown inline below)</div>
            )}
          </div>
        </div>
      )}

      {confirmError && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', font: '600 13px Urbanist', color: '#EF4444' }}>
          {confirmError}
        </div>
      )}

      {/* Metadata summary card */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <div style={{ font: '800 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>Programme Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Programme', val: meta.programme },
            { label: 'Semester', val: meta.semester_title },
            { label: 'Duration', val: meta.duration_weeks ? `${meta.duration_weeks} weeks` : '—' },
            { label: 'Start Date', val: meta.programme_start_date },
            { label: 'End Date', val: meta.programme_end_date },
            { label: 'Weekly Hours', val: meta.total_weekly_hours },
          ].map(f => (
            <div key={f.label}>
              <div style={{ font: '700 10px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '3px' }}>{f.label}</div>
              <div style={{ font: '800 13.5px Urbanist', color: 'var(--text)' }}>{f.val || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tracks */}
      {tracks.map((track, ti) => {
        const trackErrors = errors.filter(e => e.field.includes(`tracks[${track.id}`));
        const isExpanded = expandedTracks[ti] !== false;

        return (
          <div key={ti} className="card" style={{ marginBottom: '16px', padding: 0, overflow: 'hidden' }}>
            {/* Track header */}
            <div
              onClick={() => setExpandedTracks(p => ({ ...p, [ti]: !isExpanded }))}
              style={{
                padding: '18px 20px',
                display: 'flex', alignItems: 'center', gap: '12px',
                cursor: 'pointer',
                background: isExpanded ? 'var(--input-bg)' : 'transparent',
                borderBottom: isExpanded ? '1px solid var(--rail-border)' : 'none',
                userSelect: 'none'
              }}
            >
              {isExpanded ? <IconChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <IconChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ font: '900 15px Urbanist', color: 'var(--text)' }}>
                    <EditableField
                      value={track.name}
                      onSave={v => updateCurriculum(d => { d.lms_export.tracks[ti].name = v; return d; })}
                      style={{ font: '900 15px Urbanist' }}
                    />
                  </span>
                  {track.code && (
                    <span style={{ font: '700 11px Urbanist', color: 'var(--text-muted)', background: 'var(--phbar-bg)', padding: '2px 8px', borderRadius: '4px' }}>
                      {track.code}
                    </span>
                  )}
                  {trackErrors.length > 0 && (
                    <span style={{ fontSize: '12px', color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '4px', font: '700 11px Urbanist' }}>
                      {trackErrors.length} issue{trackErrors.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {track.weekly_hours && `${track.weekly_hours}h/wk · `}{track.total_hours && `${track.total_hours}h total · `}
                  {track.deadline && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCalendar size={11} /> Deadline: {track.deadline}</span>}
                </div>
              </div>
              <span style={{ font: '700 12px Urbanist', color: 'var(--text-muted)', flexShrink: 0 }}>
                {(track.courses || []).length} course{(track.courses || []).length !== 1 ? 's' : ''}
              </span>
            </div>

            {isExpanded && (
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <ValidationBadge errors={errors} field={`tracks[${track.id}]`} />

                {(track.courses || []).map((course, ci) => {
                  const courseKey = `${ti}-${ci}`;
                  const isCourseExp = expandedCourses[courseKey] !== true; // default collapsed

                  return (
                    <div key={ci} style={{ borderLeft: '3px solid var(--phbar-bg)', paddingLeft: '16px' }}>
                      {/* Course header */}
                      <div
                        onClick={() => setExpandedCourses(p => ({ ...p, [courseKey]: !isCourseExp }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', paddingBottom: '8px', userSelect: 'none' }}
                      >
                        {isCourseExp ? <IconChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <IconChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                        <span style={{ font: '800 13.5px Urbanist', color: 'var(--text)', flex: 1 }}>
                          <EditableField
                            value={course.name}
                            onSave={v => updateCurriculum(d => { d.lms_export.tracks[ti].courses[ci].name = v; return d; })}
                            style={{ font: '800 13.5px Urbanist' }}
                          />
                        </span>
                        {course.deadline && (
                          <span style={{ font: '600 11px Urbanist', color: 'var(--text-muted)' }}>
                            <IconCalendar size={10} style={{ marginRight: '3px' }} />
                            {course.deadline}
                          </span>
                        )}
                        <span style={{ font: '600 11px Urbanist', color: 'var(--text-muted)' }}>
                          {(course.modules || []).length} modules
                        </span>
                      </div>

                      <ValidationBadge errors={errors} field={`tracks[${track.id}].courses[${course.id}`} />

                      {/* Modules (shown when course is expanded) */}
                      {!isCourseExp && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '22px', marginTop: '4px' }}>
                          {(course.modules || []).map((mod, mi) => (
                            <div key={mi} style={{
                              display: 'flex', alignItems: 'flex-start', gap: '10px',
                              padding: '8px 12px', borderRadius: '8px',
                              background: 'var(--input-bg)',
                              border: errors.some(e => e.field.includes(`modules[${mod.id}`)) ? '1.5px solid rgba(239,68,68,0.3)' : '1px solid var(--input-border)'
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ font: '700 12.5px Urbanist', color: 'var(--text)', marginBottom: '2px' }}>
                                  <EditableField
                                    value={mod.name}
                                    onSave={v => updateCurriculum(d => { d.lms_export.tracks[ti].courses[ci].modules[mi].name = v; return d; })}
                                    style={{ font: '700 12.5px Urbanist' }}
                                  />
                                </div>
                                {mod.task && (
                                  <div style={{ font: '600 11.5px Urbanist', color: 'var(--text-muted)', marginTop: '2px' }}>{mod.task}</div>
                                )}
                                <ValidationBadge errors={errors} field={`tracks[${track.id}].courses[${course.id}].modules[${mod.id}`} />
                              </div>
                              {mod.deadline && (
                                <div style={{ font: '700 11px Urbanist', color: errors.some(e => e.field.includes(`modules[${mod.id}`)) ? '#EF4444' : 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <EditableField
                                    value={mod.deadline}
                                    type="date"
                                    onSave={v => updateCurriculum(d => { d.lms_export.tracks[ti].courses[ci].modules[mi].deadline = v; return d; })}
                                    style={{ font: '700 11px Urbanist', color: errors.some(e => e.field.includes(`modules[${mod.id}`)) ? '#EF4444' : 'var(--text-muted)' }}
                                  />
                                </div>
                              )}
                              <button
                                title="Delete module"
                                onClick={() => updateCurriculum(d => {
                                  d.lms_export.tracks[ti].courses[ci].modules.splice(mi, 1);
                                  return d;
                                })}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', flexShrink: 0, opacity: 0.5, transition: 'opacity 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                              >
                                <IconX size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Bottom action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', padding: '16px 20px', background: 'var(--card-bg)', borderRadius: '14px', border: '1px solid var(--input-border)', boxShadow: 'var(--shadow)' }}>
        <button
          className="ghostpill"
          style={{ fontSize: '13px', cursor: 'pointer' }}
          onClick={() => navigate('/import-curriculum')}
        >
          ← Upload different file
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          {hasErrors && (
            <span style={{ font: '600 12px Urbanist', color: '#EF4444', alignSelf: 'center' }}>
              {errors.length} issue{errors.length !== 1 ? 's' : ''} must be fixed first
            </span>
          )}
          <button
            id="curriculum-confirm-btn-bottom"
            className="pillbtn"
            disabled={hasErrors || confirming}
            onClick={handleConfirm}
            style={{
              opacity: hasErrors || confirming ? 0.5 : 1,
              cursor: hasErrors || confirming ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            {confirming ? (
              <><div style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Confirming…</>
            ) : (
              <><IconCheck size={14} /> Confirm & Import Curriculum</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
