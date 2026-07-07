import React, { useState, useEffect } from 'react';
import api from '../api';
import { IconBell, IconUser, IconChevronLeft, IconLoader, IconSearch } from '@tabler/icons-react';

export default function AdminComms() {
  const [smartans, setSmartans] = useState([]);
  const [step, setStep] = useState(1); // 1 = Select Recipient Type, 2 = Compose Message
  const [recipientType, setRecipientType] = useState(''); // varsity, smartan
  const [selectedSmartan, setSelectedSmartan] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchSmartans = async () => {
    try {
      const res = await api.get('/admin/smartans');
      setSmartans(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSmartans();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (recipientType === 'smartan' && !selectedSmartan) {
      alert('Please select a recipient Smartan first.');
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      await api.post('/admin/notifications', {
        message: message,
        recipient_id: recipientType === 'varsity' ? null : selectedSmartan.id
      });
      setMessage('');
      setSuccess(true);
      setStep(1);
      setRecipientType('');
      setSelectedSmartan(null);
      setSearchQuery('');
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      console.error('Failed to send notification', e);
      alert('Error sending notification.');
    } finally {
      setLoading(false);
    }
  };

  const selectVarsity = () => {
    setRecipientType('varsity');
    setStep(2);
  };

  const selectSmartanType = () => {
    setRecipientType('smartan');
    setStep(2);
  };

  const handleSelectSmartan = (s) => {
    setSelectedSmartan(s);
    setSearchQuery(s.fullName);
    setShowSearchDropdown(false);
  };

  // Filter dropdown matches
  const matchedSmartans = smartans.filter(s => 
    s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'Urbanist, sans-serif' }}>
      
      {/* PAGE TITLE */}
      <div style={{ marginBottom: '8px' }}>
        <div className="kthin" style={{ width: '40px', borderRadius: '99px', marginBottom: '16px' }} />
        <h1 className="dashboard-title">Communications</h1>
        <div style={{ font: '600 13.5px Urbanist', color: 'var(--text-muted)', marginTop: '4px' }}>
          Broadcast messages and direct notifications to Smartans
        </div>
      </div>

      {success && (
        <div style={{ background: '#10b98115', color: '#10b981', font: '700 13px Urbanist', padding: '12px 16px', borderRadius: '12px', border: '1px solid #10b98130' }}>
          ✓ Notification successfully dispatched to the recipient feed!
        </div>
      )}

      {/* STEP 1: SELECT RECIPIENT TYPE */}
      {step === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '12px' }}>
          
          {/* Card A: Entire Varsity */}
          <div 
            onClick={selectVarsity}
            style={{ 
              background: 'var(--card-bg)', 
              border: '1.5px solid var(--input-border)',
              borderRadius: '20px',
              padding: '32px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--text)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--input-border)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconBell size={22} />
            </div>
            <h3 style={{ font: '900 16px Urbanist', color: 'var(--text)', margin: 0 }}>Entire Varsity</h3>
            <p style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', margin: 0 }}>Broadcast an announcement or alert to all registered Smartans simultaneously.</p>
          </div>

          {/* Card B: One Smartan */}
          <div 
            onClick={selectSmartanType}
            style={{ 
              background: 'var(--card-bg)', 
              border: '1.5px solid var(--input-border)',
              borderRadius: '20px',
              padding: '32px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--text)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--input-border)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconUser size={22} />
            </div>
            <h3 style={{ font: '900 16px Urbanist', color: 'var(--text)', margin: 0 }}>One Smartan</h3>
            <p style={{ font: '600 12px Urbanist', color: 'var(--text-muted)', margin: 0 }}>Target a single student with a personalized check-in or specific follow-up query.</p>
          </div>

        </div>
      )}

      {/* STEP 2: COMPOSE MESSAGE */}
      {step === 2 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px' }}>
          
          {/* Header check-in step */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--input-border)', paddingBottom: '16px' }}>
            <button 
              onClick={() => {
                setStep(1);
                setSelectedSmartan(null);
                setSearchQuery('');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', font: '800 13px Urbanist', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <IconChevronLeft size={16} /> Back to selection
            </button>
            <div style={{ font: '800 12px Urbanist', color: 'var(--text)', background: 'var(--input-bg)', padding: '6px 14px', borderRadius: '99px', border: '1px solid var(--input-border)' }}>
              Recipient: <strong>{recipientType === 'varsity' ? 'Entire Varsity' : selectedSmartan ? selectedSmartan.fullName : 'Choose Smartan'}</strong>
            </div>
          </div>

          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* If Individual: Select Smartan Typeahead */}
            {recipientType === 'smartan' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                <label style={{ font: '800 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Search Smartan</label>
                <div style={{ position: 'relative' }}>
                  <IconSearch size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text"
                    placeholder="Type name or email..."
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setShowSearchDropdown(true);
                      if (selectedSmartan) setSelectedSmartan(null);
                    }}
                    onFocus={() => setShowSearchDropdown(true)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: '8px',
                      font: '600 13.5px Urbanist',
                      color: 'var(--text)',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Dropdown matched list */}
                {showSearchDropdown && matchedSmartans.length > 0 && (
                  <div 
                    style={{ 
                      position: 'absolute', 
                      top: '68px', 
                      left: 0, 
                      width: '100%', 
                      background: 'var(--card-bg)', 
                      border: '1px solid var(--input-border)', 
                      borderRadius: '12px', 
                      maxHeight: '180px', 
                      overflowY: 'auto', 
                      zIndex: 100,
                      boxShadow: '0 8px 20px rgba(0,0,0,0.06)'
                    }}
                  >
                    {matchedSmartans.map(s => (
                      <div
                        key={s.id}
                        onClick={() => handleSelectSmartan(s)}
                        style={{ padding: '10px 14px', cursor: 'pointer', font: '600 13px Urbanist', color: 'var(--text)', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontWeight: 800 }}>{s.fullName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.email}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                {showSearchDropdown && (
                  <div 
                    onClick={() => setShowSearchDropdown(false)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }}
                  />
                )}
              </div>
            )}

            {/* Message Draft Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ font: '800 11px Urbanist', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Message Body</label>
              <textarea
                rows="6"
                placeholder={recipientType === 'varsity' ? "Broadcast a varsity-wide notification..." : "Type custom check-in or personal prompt..."}
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  borderRadius: '12px',
                  font: '600 14px Urbanist',
                  color: 'var(--text)',
                  outline: 'none',
                  resize: 'vertical',
                  lineHeight: '1.5'
                }}
              />
            </div>

            {/* Submit button */}
            <button 
              type="submit"
              className="pillbtn"
              disabled={loading || (recipientType === 'smartan' && !selectedSmartan)}
              style={{
                padding: '12px 24px',
                alignSelf: 'flex-end',
                background: 'var(--text)',
                color: 'var(--page)',
                cursor: (recipientType === 'smartan' && !selectedSmartan) ? 'not-allowed' : 'pointer',
                opacity: (recipientType === 'smartan' && !selectedSmartan) ? 0.5 : 1
              }}
            >
              {loading ? 'Dispatching...' : 'Send Notification'}
            </button>

          </form>

        </div>
      )}

    </div>
  );
}
