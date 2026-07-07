import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { 
  IconArrowLeft, IconChevronDown, IconBook, IconBolt, IconTools, IconFile, IconLoader, IconAlertCircle
} from '@tabler/icons-react';

export default function AdminTrackView() {
  const { id: studentId, trackId } = useParams();
  const navigate = useNavigate();
  
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [collapsedCourses, setCollapsedCourses] = useState({});

  const fetchTrackDetails = async (retryCount = 0) => {
    try {
      const res = await api.get(`/admin/smartans/${studentId}/tracks/${trackId}`, { timeout: 10000 });
      setTrack(res.data);
      setLoading(false);
      setError(false);
    } catch (err) {
      console.error(err);
      if (retryCount < 2) {
        setTimeout(() => fetchTrackDetails(retryCount + 1), (retryCount + 1) * 1000);
      } else {
        setError(true);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchTrackDetails();
  }, [studentId, trackId]);

  const toggleCourse = (courseId) => {
    setCollapsedCourses(prev => ({ ...prev, [courseId]: !prev[courseId] }));
  };

  const getModuleIcon = (type) => {
    if (type === 'reading') return <IconBook size={16} style={{ color: '#3b82f6' }} />;
    if (type === 'session') return <IconBolt size={16} style={{ color: '#e5a83c' }} />;
    if (type === 'project') return <IconTools size={16} style={{ color: '#10b981' }} />;
    return <IconFile size={16} style={{ color: 'var(--text-muted)' }} />;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        <IconLoader size={36} className="spin" />
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="card" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center', fontFamily: 'Urbanist, sans-serif' }}>
        <IconAlertCircle size={32} style={{ color: '#ef4444' }} />
        <span style={{ font: '600 14px Urbanist', color: 'var(--text-muted)' }}>Failed to load track details.</span>
        <button className="pillbtn" onClick={() => { setLoading(true); fetchTrackDetails(); }} style={{ padding: '8px 16px', fontSize: '13px' }}>Retry</button>
      </div>
    );
  }

  // Calculate total modules and completed modules
  const courses = track.courses || [];
  let totalModules = 0;
  let completedModules = 0;
  courses.forEach(c => {
    (c.modules || []).forEach(m => {
      totalModules++;
      if (m.status === 'completed' || m.status === 'done') {
        completedModules++;
      }
    });
  });
  const progressPercent = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'Urbanist, sans-serif' }}>
      
      {/* HEADER HERO */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => navigate(`/admin/smartans/${studentId}`)}
            style={{ 
              background: 'var(--input-bg)', 
              border: '1px solid var(--input-border)', 
              color: 'var(--text-muted)', 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer' 
            }}
          >
            <IconArrowLeft size={16} />
          </button>
          <span style={{ font: '900 12px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Back to student details
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ fontSize: '36px' }}>{track.icon || '🧠'}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ font: '900 24px Urbanist', color: 'var(--text)', margin: 0 }}>{track.name}</h2>
                <span style={{ 
                  background: `${track.color}15`, 
                  color: track.color || 'var(--accent)', 
                  border: `1px solid ${track.color}30`, 
                  borderRadius: '99px', 
                  padding: '2px 10px', 
                  fontSize: '11px',
                  fontWeight: 900
                }}>
                  {track.phase || 'Phase I'}
                </span>
              </div>
              <p style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', margin: 0 }}>
                Read-only observation of student's track syllabus and progress.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <span style={{ font: '900 13px Urbanist', color: 'var(--text-muted)' }}>Progress: {progressPercent}%</span>
            <div style={{ width: '200px', height: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: track.color || 'var(--accent)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* SYLLABUS COURSES LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ font: '900 18px Urbanist', color: 'var(--text)', margin: 0 }}>Syllabus contents</h3>
        
        {courses.length === 0 ? (
          <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No courses found in this track.
          </div>
        ) : (
          courses.map((course) => {
            const isCollapsed = !!collapsedCourses[course.id];
            const courseModules = course.modules || [];
            
            return (
              <div key={course.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Course Header Bar */}
                <div 
                  onClick={() => toggleCourse(course.id)}
                  style={{ 
                    padding: '20px 24px', 
                    background: 'var(--input-bg)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    borderBottom: !isCollapsed ? '1px solid var(--input-border)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ font: '900 15px Urbanist', color: 'var(--text)' }}>{course.name}</span>
                    <span style={{ font: '800 11px Urbanist', color: 'var(--text-muted)', background: 'var(--page)', padding: '2px 8px', borderRadius: '4px' }}>
                      {courseModules.length} modules
                    </span>
                  </div>
                  <IconChevronDown 
                    size={16} 
                    style={{ 
                      color: 'var(--text-muted)', 
                      transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s' 
                    }} 
                  />
                </div>

                {/* Modules list content */}
                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {courseModules.length === 0 ? (
                      <div style={{ padding: '20px 24px', color: 'var(--text-muted)', fontStyle: 'italic', font: '600 13px Urbanist' }}>
                        No modules in this course.
                      </div>
                    ) : (
                      courseModules.map((m) => (
                        <div 
                          key={m.id} 
                          style={{ 
                            padding: '16px 24px', 
                            borderBottom: '1px solid var(--input-border)', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center' 
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {getModuleIcon(m.type)}
                            <span style={{ font: '800 13.5px Urbanist', color: 'var(--text)' }}>{m.title}</span>
                          </div>
                          
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontSize: '11px', 
                            fontWeight: 900,
                            textTransform: 'capitalize',
                            background: m.status === 'completed' || m.status === 'done' ? '#10b98115' : 'var(--input-bg)',
                            color: m.status === 'completed' || m.status === 'done' ? '#10b981' : 'var(--text-muted)',
                            border: m.status === 'completed' || m.status === 'done' ? '1px solid #10b98130' : '1px solid var(--input-border)'
                          }}>
                            {m.status || 'todo'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
