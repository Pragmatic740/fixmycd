'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  INFRASTRUCTURE_TAXONOMY,
  FAILURE_TYPES,
  EVIDENCE_TYPES,
  POST_ACTIONS,
} from '../../lib/categories';

const PinPickerMap = dynamic(() => import('../PinPickerMap'), { ssr: false });

interface ReportFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'quick' | 'advanced';

export default function AdvancedReportForm({ onClose, onSuccess }: ReportFormProps) {
  const [mode, setMode] = useState<Mode>('quick');
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [infrastructureClass, setInfrastructureClass] = useState('');
  const [infrastructureType, setInfrastructureType] = useState('');
  const [failureType, setFailureType] = useState('');
  const [postAction, setPostAction] = useState('failure');
  const [severity, setSeverity] = useState(3);
  const [latitude, setLatitude] = useState(38.9072);
  const [longitude, setLongitude] = useState(-77.0369);
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [stateProvince, setStateProvince] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [estimatedCostLow, setEstimatedCostLow] = useState('');
  const [estimatedCostHigh, setEstimatedCostHigh] = useState('');
  const [peopleAffected, setPeopleAffected] = useState('');
  const [outageDurationHours, setOutageDurationHours] = useState('');
  const [safetyImpact, setSafetyImpact] = useState(false);
  const [accessibilityImpact, setAccessibilityImpact] = useState(false);
  const [environmentalImpact, setEnvironmentalImpact] = useState(false);
  const [evidenceType, setEvidenceType] = useState('photo');
  const [observationConfidence, setObservationConfidence] = useState(4);
  const [responsibleAgency, setResponsibleAgency] = useState('');
  const [assetName, setAssetName] = useState('');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));

  const types = infrastructureClass ? INFRASTRUCTURE_TAXONOMY[infrastructureClass] || [] : [];
  const steps = mode === 'quick' ? ['Issue', 'Location', 'Evidence'] : ['Issue', 'Location', 'Impact', 'Evidence', 'Review'];

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Upload failed');
      return null;
    }
    const data = await res.json();
    return data.url as string;
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImagePreview(URL.createObjectURL(file));
    const url = await uploadFile(file);
    if (url) setImageUrl(url);
    setUploading(false);
  };

  const detectLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLatitude(parseFloat(pos.coords.latitude.toFixed(6)));
        setLongitude(parseFloat(pos.coords.longitude.toFixed(6)));
      },
      () => alert('Could not detect location.')
    );
  };

  const canProceed = () => {
    if (step === 0) return title.trim() && infrastructureClass && severity;
    if (step === 1) return latitude != null && longitude != null;
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          latitude,
          longitude,
          severity,
          infrastructureClass,
          infrastructureType,
          category: infrastructureClass,
          subcategory: infrastructureType,
          failureType: failureType || undefined,
          postAction,
          imageUrl,
          videoUrl,
          audioUrl,
          addressLine,
          city,
          postalCode,
          stateProvince,
          countryCode,
          estimatedCostLow: estimatedCostLow || undefined,
          estimatedCostHigh: estimatedCostHigh || undefined,
          peopleAffected: peopleAffected || undefined,
          outageDurationHours: outageDurationHours || undefined,
          safetyImpact,
          accessibilityImpact,
          environmentalImpact,
          evidenceType,
          observationConfidence,
          responsibleAgency: responsibleAgency || undefined,
          assetName: assetName || undefined,
          occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
          costEstimateSource: estimatedCostLow || estimatedCostHigh ? 'citizen_estimate' : undefined,
        }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content modal-content-wide">
        <div className="modal-header">
          <h3>Report Infrastructure Issue</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="report-form-mode-tabs">
          <button type="button" className={mode === 'quick' ? 'active' : ''} onClick={() => { setMode('quick'); setStep(0); }}>
            Quick report
          </button>
          <button type="button" className={mode === 'advanced' ? 'active' : ''} onClick={() => { setMode('advanced'); setStep(0); }}>
            Advanced science form
          </button>
        </div>

        <div className="report-form-steps">
          {steps.map((label, i) => (
            <span key={label} className={`report-form-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              {i + 1}. {label}
            </span>
          ))}
        </div>

        {step === 0 && (
          <div className="form-step">
            <div className="form-group">
              <label>Issue Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Collapsed storm drain on 14th St" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What failed, when, and who is affected?" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Infrastructure Class</label>
                <select value={infrastructureClass} onChange={(e) => { setInfrastructureClass(e.target.value); setInfrastructureType(''); }}>
                  <option value="">Select class</option>
                  {Object.keys(INFRASTRUCTURE_TAXONOMY).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={infrastructureType} onChange={(e) => setInfrastructureType(e.target.value)} disabled={!infrastructureClass}>
                  <option value="">Select type</option>
                  {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Failure Type</label>
                <select value={failureType} onChange={(e) => setFailureType(e.target.value)}>
                  <option value="">Select failure type</option>
                  {FAILURE_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Action</label>
                <select value={postAction} onChange={(e) => setPostAction(e.target.value)}>
                  {POST_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Severity (1–5)</label>
                <select value={severity} onChange={(e) => setSeverity(parseInt(e.target.value, 10))}>
                  {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="form-step">
            <div className="form-group">
              <label>Location</label>
              <PinPickerMap latitude={latitude} longitude={longitude} onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }} />
              <div className="location-picker-row">
                <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(parseFloat(e.target.value))} />
                <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(parseFloat(e.target.value))} />
                <button type="button" className="btn-detect" onClick={detectLocation}>Use my location</button>
              </div>
            </div>
            <div className="form-group">
              <label>Street Address (optional)</label>
              <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="123 Main St" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="form-group">
                <label>State</label>
                <input value={stateProvince} onChange={(e) => setStateProvince(e.target.value)} placeholder="DC / VA / MD" />
              </div>
              <div className="form-group">
                <label>ZIP</label>
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Country</label>
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                  <option value="US">United States</option>
                  <option value="ZW">Zimbabwe</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {mode === 'advanced' && step === 2 && (
          <div className="form-step">
            <div className="form-row">
              <div className="form-group">
                <label>Est. Cost Low (USD)</label>
                <input type="number" min="0" value={estimatedCostLow} onChange={(e) => setEstimatedCostLow(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Est. Cost High (USD)</label>
                <input type="number" min="0" value={estimatedCostHigh} onChange={(e) => setEstimatedCostHigh(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>People Affected</label>
                <input type="number" min="0" value={peopleAffected} onChange={(e) => setPeopleAffected(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Outage Hours</label>
                <input type="number" min="0" step="0.1" value={outageDurationHours} onChange={(e) => setOutageDurationHours(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Asset / Facility</label>
                <input value={assetName} onChange={(e) => setAssetName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Responsible Agency</label>
                <input value={responsibleAgency} onChange={(e) => setResponsibleAgency(e.target.value)} placeholder="DOT, DPW, Utility…" />
              </div>
            </div>
            <div className="impact-flags">
              <label><input type="checkbox" checked={safetyImpact} onChange={(e) => setSafetyImpact(e.target.checked)} /> Safety impact</label>
              <label><input type="checkbox" checked={accessibilityImpact} onChange={(e) => setAccessibilityImpact(e.target.checked)} /> Accessibility impact</label>
              <label><input type="checkbox" checked={environmentalImpact} onChange={(e) => setEnvironmentalImpact(e.target.checked)} /> Environmental impact</label>
            </div>
          </div>
        )}

        {((mode === 'quick' && step === 2) || (mode === 'advanced' && step === 3)) && (
          <div className="form-step">
            <div className="form-group">
              <label>Photo</label>
              <input type="file" accept="image/*" onChange={handleImage} />
              {imagePreview && <img src={imagePreview} alt="Preview" className="upload-preview" />}
            </div>
            {mode === 'advanced' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Video</label>
                    <input type="file" accept="video/*" onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setUploading(true);
                      const url = await uploadFile(f);
                      if (url) setVideoUrl(url);
                      setUploading(false);
                    }} />
                  </div>
                  <div className="form-group">
                    <label>Audio</label>
                    <input type="file" accept="audio/*" onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setUploading(true);
                      const url = await uploadFile(f);
                      if (url) setAudioUrl(url);
                      setUploading(false);
                    }} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Evidence Type</label>
                    <select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
                      {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Observation Confidence (1–5)</label>
                    <select value={observationConfidence} onChange={(e) => setObservationConfidence(parseInt(e.target.value, 10))}>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Occurred At</label>
                    <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {mode === 'advanced' && step === 4 && (
          <div className="form-step review-summary">
            <h4>Review before submit</h4>
            <p><strong>{title}</strong> · Severity {severity}</p>
            <p>{infrastructureClass}{infrastructureType ? ` → ${infrastructureType}` : ''} · {failureType || 'Unspecified failure'}</p>
            <p>{city || 'City TBD'}{stateProvince ? `, ${stateProvince}` : ''} · {latitude.toFixed(4)}, {longitude.toFixed(4)}</p>
            {(estimatedCostLow || estimatedCostHigh) && (
              <p>Est. cost: ${estimatedCostLow || '?'} – ${estimatedCostHigh || '?'}</p>
            )}
            {peopleAffected && <p>People affected: {peopleAffected}</p>}
          </div>
        )}

        <div className="report-form-actions">
          {step > 0 && (
            <button type="button" className="btn-secondary" onClick={() => setStep((s) => s - 1)}>Back</button>
          )}
          {step < steps.length - 1 ? (
            <button type="button" className="btn-primary" disabled={!canProceed()} onClick={() => setStep((s) => s + 1)}>
              Continue
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={submitting || uploading || !canProceed()} onClick={submit}>
              {uploading ? 'Uploading…' : submitting ? 'Submitting…' : 'Submit Report'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
