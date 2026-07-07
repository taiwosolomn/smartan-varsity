import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { 
  IconArrowLeft, IconSearch, IconClock, IconCalendar, IconLoader, IconAlertCircle 
} from '@tabler/icons-react';

export default function AdminSessions() {
  const { id: studentId } = useParams();
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filters
  const [selectedTrackId, setSelectedTrackId] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSessions = async (retryCount = 0) => {
    try {
      const res = await api.get(`/admin/smartans/${studentId}/sessions`, { timeout: 10000 });
      setLogs(res.data.logs);
      setTracks(res.data.tracks);
      setLoading(false);
      setError(false);
    } catch (err) {
      console.error(err);
      if (retryCount < 2) {
        setTimeout(() => fetchSessions(retryCount + 1), (retryCount + 1) * 1000);
      } else {
        setError(true);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [studentId]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.topic.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (log.description && log.description.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;

    if (selectedTrackId !== 'All') {
      return log.trackId === selectedTrackId;
    }
    return true;
  });

  const getTrackDetails = (trackId) => {
    const t = tracks.find(x => x.id === trackId);
    return t ? { name: t.name, color: t.color, icon: t.icon } : { name: 'Unknown Track', color: 'var(--text-muted)', icon: '📚' };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        <IconLoader size={36} className="spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center', fontFamily: 'Urbanist, sans-serif' }}>
        <IconAlertCircle size={32} style={{ color: '#ef4444' }} />
        <span style={{ font: '600 14px Urbanist', color: 'var(--text-muted)' }}>Failed to load student sessions.</span>
        <button className="pillbtn" onClick={() => { setLoading(true); fetchSessions(); }} style={{ padding: '8px 16px', fontSize: '13px' }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'Urbanist, sans-serif' }}>
      
      {/* HEADER CARD */}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h2 style={{ font: '900 24px Urbanist', color: 'var(--text)', margin: 0 }}>Student study sessions</h2>
            <p style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Read-only list of all session logs logged by this Smartan.
            </p>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', width: '280px' }}>
            <IconSearch size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search session topics..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '99px',
                font: '600 13px Urbanist',
                color: 'var(--text)',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* TRACK FILTERS ROW */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          onClick={() => setSelectedTrackId('All')}
          style={{
            background: selectedTrackId === 'All' ? 'var(--text)' : 'var(--input-bg)',
            color: selectedTrackId === 'All' ? 'var(--page)' : 'var(--text-muted)',
            border: '1px solid var(--input-border)',
            padding: '6px 14px',
            borderRadius: '99px',
            font: '800 12px Urbanist',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          All logs
        </button>
        {tracks.map(t => (
          <button
            key={t.id}
            onClick={() => setSelectedTrackId(t.id)}
            style={{
              background: selectedTrackId === t.id ? t.color || 'var(--text)' : 'var(--input-bg)',
              color: selectedTrackId === t.id ? '#ffffff' : 'var(--text-muted)',
              border: `1px solid ${selectedTrackId === t.id ? t.color : 'var(--input-border)'}`,
              padding: '6px 14px',
              borderRadius: '99px',
              font: '800 12px Urbanist',
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{t.icon}</span>
            <span>{t.name}</span>
          </button>
        ))}
      </div>

      {/* SESSIONS CONTENT LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredLogs.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No sessions match your filters.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const trackDetails = getTrackDetails(log.trackId);
            return (
              <div key={log.id} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h4 style={{ font: '900 16px Urbanist', color: 'var(--text)', margin: 0 }}>{log.topic}</h4>
                      <span style={{ 
                        background: `${trackDetails.color}15`, 
                        color: trackDetails.color, 
                        border: `1px solid ${trackDetails.color}30`, 
                        borderRadius: '99px', 
                        padding: '2px 8px', 
                        fontSize: '10px',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>{trackDetails.icon}</span>
                        <span>{trackDetails.name}</span>
                      </span>
                    </div>
                    {log.description && (
                      <p style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', margin: 0 }}>
                        {log.description}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', font: '800 12.5px Urbanist', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <IconClock size={15} />
                      <span>{log.duration} mins</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <IconCalendar size={15} />
                      <span>{new Date(log.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    {log.rating && (
                      <div style={{ display: 'flex', alignItems: 'center', background: '#f59e0b15', color: '#f59e0b', padding: '3px 10px', borderRadius: '6px' }}>
                        ★ {log.rating}/10
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
