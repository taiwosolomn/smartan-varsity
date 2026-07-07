import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { IconSearch, IconChevronRight, IconLoader, IconAlertCircle } from '@tabler/icons-react';

export default function AdminSmartans() {
  const navigate = useNavigate();

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Directory and flags data
  const [smartans, setSmartans] = useState([]);
  const [flaggedIds, setFlaggedIds] = useState(new Set());

  // Search input and debouncing
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All'); // All, Active, Flagged, Inactive

  // Cache loading
  useEffect(() => {
    try {
      const cached = localStorage.getItem('sv_admin_smartans_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        setSmartans(parsed.smartans);
        setFlaggedIds(new Set(parsed.flaggedIds));
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchData = async (retryCount = 0) => {
    try {
      const [resSmartans, resDashboard] = await Promise.all([
        api.get('/admin/smartans', { timeout: 10000 }),
        api.get('/admin/dashboard', { timeout: 10000 })
      ]);

      const list = resSmartans.data;
      const flagged = resDashboard.data.engagementFlags.map(f => f.smartanId);

      setSmartans(list);
      setFlaggedIds(new Set(flagged));
      
      setLoading(false);
      setError(false);

      // Save cache
      localStorage.setItem('sv_admin_smartans_cache', JSON.stringify({
        smartans: list,
        flaggedIds: flagged
      }));
    } catch (err) {
      console.error(err);
      if (retryCount < 2) {
        setTimeout(() => fetchData(retryCount + 1), (retryCount + 1) * 1000);
      } else {
        if (smartans.length === 0) setError(true);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtering based on debounced query
  const filteredSmartans = smartans.filter(s => {
    const matchesSearch = 
      s.fullName.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(debouncedQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeFilter === 'Active') {
      return s.status === 'Active';
    }
    if (activeFilter === 'Inactive') {
      return s.status === 'Deactivated';
    }
    if (activeFilter === 'Flagged') {
      return flaggedIds.has(s.id);
    }
    return true; // All
  });

  const renderTableSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="shimmer-bg" style={{ height: '54px', borderRadius: '12px' }} />
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'Urbanist, sans-serif' }}>
      
      {/* PAGE TITLE */}
      <div>
        <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
        <h1 className="dashboard-title">Smartan Directory</h1>
        <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
          All registered Smartans · <span style={{ color: 'var(--accent, #C25A3A)', fontWeight: 700 }}>Observer access</span>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '36px' }}>

      {/* Search and Filters Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', width: '320px' }}>
          <IconSearch size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px 16px 12px 42px', 
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: '99px',
              font: '600 13.5px Urbanist',
              color: 'var(--text)',
              outline: 'none'
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['All', 'Active', 'Flagged', 'Inactive'].map(opt => (
            <button
              key={opt}
              onClick={() => setActiveFilter(opt)}
              style={{
                background: activeFilter === opt ? 'var(--text)' : 'var(--input-bg)',
                color: activeFilter === opt ? 'var(--page)' : 'var(--text-muted)',
                border: '1px solid var(--input-border)',
                padding: '8px 18px',
                borderRadius: '99px',
                font: '800 13px Urbanist',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {opt}
            </button>
          ))}
        </div>

      </div>

      {/* Main content or skeleton */}
      {loading ? renderTableSkeleton() : error ? (
        <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center' }}>
          <IconAlertCircle size={32} style={{ color: '#ef4444' }} />
          <span style={{ font: '600 14px Urbanist', color: 'var(--text-muted)' }}>Failed to load directory.</span>
          <button className="pillbtn" onClick={() => { setLoading(true); fetchData(); }} style={{ padding: '8px 16px', fontSize: '13px' }}>Retry</button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', font: '600 13.5px Urbanist' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--input-border)', color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                <th style={{ padding: '16px 20px', fontWeight: 800 }}>Name</th>
                <th style={{ padding: '16px 20px', fontWeight: 800 }}>Email</th>
                <th style={{ padding: '16px 20px', fontWeight: 800 }}>Joined</th>
                <th style={{ padding: '16px 20px', fontWeight: 800 }}>Last Active</th>
                <th style={{ padding: '16px 20px', fontWeight: 800 }}>Status</th>
                <th style={{ padding: '16px 20px', width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredSmartans.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No registered Smartans matched.
                  </td>
                </tr>
              ) : (
                filteredSmartans.map(s => {
                  const isFlagged = flaggedIds.has(s.id);
                  return (
                    <tr 
                      key={s.id} 
                      onClick={() => navigate(`/admin/smartans/${s.id}`)}
                      style={{ borderBottom: '1px solid var(--input-border)', cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '18px 20px', font: '800 14px Urbanist', color: 'var(--text)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {s.fullName}
                          {isFlagged && (
                            <span 
                              title="Active Inactivity Flag"
                              style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} 
                            />
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '18px 20px', color: 'var(--text-muted)' }}>{s.email}</td>
                      <td style={{ padding: '18px 20px' }}>
                        {s.joinDate ? new Date(s.joinDate).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                      </td>
                      <td style={{ padding: '18px 20px' }}>
                        {s.lastActive && s.lastActive !== 'Never' ? new Date(s.lastActive).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'}
                      </td>
                      <td style={{ padding: '18px 20px' }}>
                        <span style={{ 
                          padding: '4px 12px', 
                          borderRadius: '99px', 
                          fontSize: '11px',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          background: s.status === 'Active' ? '#10b98115' : '#6b728015',
                          color: s.status === 'Active' ? '#10b981' : '#6b7280',
                          border: s.status === 'Active' ? '1px solid #10b98130' : '1px solid #6b728030'
                        }}>
                          {s.status}
                        </span>
                      </td>
                      <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                        <IconChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && (
        <div style={{ font: '800 12px Urbanist', color: 'var(--text-muted)', marginTop: '8px' }}>
          {filteredSmartans.length} Smartans
        </div>
      )}

      </div>
    </div>
  );
}
