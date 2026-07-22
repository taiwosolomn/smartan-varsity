import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { IconUpload, IconFileText, IconAlertCircle, IconX, IconCopy, IconCheck } from '@tabler/icons-react';
import { CURRICULUM_IMPORT_PROMPT } from '../utils/aiPrompts.js';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
      <style>{skeletonStyle}</style>
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="skeleton-box" style={{ height: '22px', width: '220px' }} />
        <div className="skeleton-box" style={{ height: '14px', width: '160px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '16px', borderLeft: '3px solid var(--input-border)' }}>
              <div className="skeleton-box" style={{ height: '16px', width: '180px' }} />
              {[1, 2, 3].map(j => (
                <div key={j} style={{ display: 'flex', gap: '8px', paddingLeft: '12px' }}>
                  <div className="skeleton-box" style={{ height: '12px', width: '140px' }} />
                  <div className="skeleton-box" style={{ height: '12px', width: '80px', marginLeft: 'auto' }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ImportCurriculum() {
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [clientError, setClientError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const fileInputRef = useRef(null);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CURRICULUM_IMPORT_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const validateClientSide = (content) => {
    try {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, error: 'File is not a valid JSON object.', parsed: null };
      }
      if (!parsed.lms_export) {
        return { ok: false, error: "Missing required top-level key 'lms_export'. Check that you uploaded the correct file.", parsed: null };
      }
      return { ok: true, error: '', parsed };
    } catch (e) {
      return { ok: false, error: `Invalid JSON: ${e.message}`, parsed: null };
    }
  };

  const processFile = useCallback((f) => {
    setClientError('');
    setUploadError('');
    if (!f) return;
    if (!f.name.endsWith('.json')) {
      setClientError('Only .json files are accepted.');
      return;
    }
    setFile(f);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    processFile(f);
  }, [processFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleFileInput = (e) => {
    processFile(e.target.files?.[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setClientError('');
    setUploadError('');

    // Client-side pre-validation
    const content = await file.text();
    const { ok, error: cErr, parsed } = validateClientSide(content);
    if (!ok) {
      setClientError(cErr);
      return;
    }

    setUploading(true);
    try {
      const res = await api.post('/curriculum-imports', {
        json_data: parsed,
        filename: file.name
      });
      const { import_id } = res.data;
      navigate(`/import-curriculum/${import_id}`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setUploadError(typeof detail === 'string' ? detail : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page active" style={{ paddingBottom: '48px', maxWidth: '720px', margin: '0 auto' }}>
      <style>{skeletonStyle}</style>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 className="dashboard-title" style={{ fontSize: '28px' }}>Import Your Curriculum</h1>
        <p style={{ font: '600 14px/1.6 Urbanist', color: 'var(--text-muted)', marginTop: '8px', maxWidth: '560px' }}>
          Upload a pre-generated curriculum JSON file to instantly populate your account with a full 
          Track → Course → Module structure. You'll review everything before it goes live.
        </p>
      </div>

      {/* How it works */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(194,90,58,0.06) 0%, transparent 100%)', borderColor: 'rgba(194,90,58,0.2)' }}>
        <div style={{ font: '800 11px Urbanist', color: '#C25A3A', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>How it works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { n: '1', text: 'Generate your curriculum JSON using your preferred AI tool (ChatGPT, Claude, Gemini, etc.) with the Smartan Varsity curriculum prompt' },
            { n: '2', text: 'Upload the .json file here — we validate it instantly' },
            { n: '3', text: 'Review every Track, Course, and Module before confirming' },
            { n: '4', text: 'Confirm, and your full study schedule is live immediately' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ minWidth: '22px', height: '22px', borderRadius: '50%', background: '#C25A3A', color: '#fff', font: '800 11px Urbanist', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
              <span style={{ font: '600 13.5px/1.5 Urbanist', color: 'var(--text-muted)' }}>{s.text}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCopyPrompt}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            marginTop: '16px', padding: '9px 16px', borderRadius: '99px',
            background: promptCopied ? 'rgba(52,168,83,0.12)' : 'var(--card-bg)',
            color: promptCopied ? '#34A853' : 'var(--text)',
            font: '700 12.5px Urbanist',
            border: `1.5px solid ${promptCopied ? 'rgba(52,168,83,0.35)' : 'var(--input-border)'}`,
            cursor: 'pointer',
          }}
        >
          {promptCopied ? <><IconCheck size={14} /> Copied to clipboard</> : <><IconCopy size={14} /> Copy the curriculum generation prompt</>}
        </button>
      </div>

      {/* Drop zone */}
      <div
        id="curriculum-drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !file && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#C25A3A' : file ? '#34A853' : 'var(--input-border)'}`,
          borderRadius: '16px',
          padding: '48px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          cursor: file ? 'default' : 'pointer',
          background: dragOver ? 'rgba(194,90,58,0.04)' : file ? 'rgba(52,168,83,0.04)' : 'var(--card-bg)',
          transition: 'all 0.2s ease',
          textAlign: 'center',
          minHeight: '220px',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />

        {file ? (
          <>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(52,168,83,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconFileText size={26} style={{ color: '#34A853' }} />
            </div>
            <div>
              <div style={{ font: '800 15px Urbanist', color: 'var(--text)', marginBottom: '4px' }}>{file.name}</div>
              <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)' }}>
                {(file.size / 1024).toFixed(1)} KB · .json file
              </div>
            </div>
            <button
              className="ghostpill"
              style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={e => { e.stopPropagation(); setFile(null); setClientError(''); setUploadError(''); }}
            >
              <IconX size={13} /> Remove file
            </button>
          </>
        ) : (
          <>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(194,90,58,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconUpload size={26} style={{ color: '#C25A3A' }} />
            </div>
            <div>
              <div style={{ font: '800 15px Urbanist', color: 'var(--text)', marginBottom: '4px' }}>
                {dragOver ? 'Drop it here' : 'Drag & drop your curriculum JSON'}
              </div>
              <div style={{ font: '600 12px Urbanist', color: 'var(--text-muted)' }}>
                or click to browse · .json files only
              </div>
            </div>
          </>
        )}
      </div>

      {/* Client-side error */}
      {clientError && (
        <div style={{
          marginTop: '12px',
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <IconAlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px' }} />
          <div style={{ font: '600 13px/1.5 Urbanist', color: '#EF4444' }}>{clientError}</div>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div style={{
          marginTop: '12px',
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <IconAlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px' }} />
          <div style={{ font: '600 13px/1.5 Urbanist', color: '#EF4444' }}>{uploadError}</div>
        </div>
      )}

      {/* Upload skeleton while processing */}
      {uploading && <ReviewSkeleton />}

      {/* Actions */}
      <div className="import-actions-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
        <button
          className="ghostpill"
          style={{ fontSize: '13px', cursor: 'pointer' }}
          onClick={() => navigate('/tracks')}
        >
          ← Back to Tracks
        </button>

        <button
          id="curriculum-upload-btn"
          className="pillbtn"
          disabled={!file || uploading}
          onClick={handleUpload}
          style={{
            opacity: !file || uploading ? 0.5 : 1,
            cursor: !file || uploading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '11px 22px',
            fontSize: '14px',
          }}
        >
          {uploading ? (
            <>
              <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Validating…
            </>
          ) : (
            <>
              <IconUpload size={15} />
              Upload & Validate
            </>
          )}
        </button>
      </div>
    </div>
  );
}
