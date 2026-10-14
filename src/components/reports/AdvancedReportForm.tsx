'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { InAppMediaRecorder } from './InAppMediaRecorder';
import type { ResolvedLocation } from '../PinPickerMap';
import {
  distanceMeters,
  extensionForMime,
  isPlausibleGps,
  plausibleCaptureDate,
  toDatetimeLocal,
} from '../../lib/media-recording';
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
  const [showRecorder, setShowRecorder] = useState(false);

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
  const [occurredAt, setOccurredAt] = useState(() => toDatetimeLocal(new Date()));
  const [occurredAtTouched, setOccurredAtTouched] = useState(false);
  const [county, setCounty] = useState('');
  const [resolveToken, setResolveToken] = useState(0);
  const [photoGps, setPhotoGps] = useState<{ lat: number; lng: number; source: 'photo' | 'device' } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  // Free the local preview URL when it is replaced or the form closes.
  useEffect(() => {
    if (!imagePreview) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const types = infrastructureClass ? INFRASTRUCTURE_TAXONOMY[infrastructureClass] || [] : [];
  const steps = mode === 'quick' ? ['Issue', 'Location', 'Evidence'] : ['Issue', 'Location', 'Impact', 'Evidence', 'Review'];

  const uploadFile = async (file: File) => {
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data.error || 'Upload failed');
        return null;
      }
      return data.url as string;
    } catch {
      setUploadError('Upload failed. Check your connection and try again.');
      return null;
    }
  };

  /** Address fields always follow the pin: replace them (stale values from an earlier pin are wrong). */
  const applyLocation = (loc: ResolvedLocation | null) => {
    setAddressLine(loc?.addressLine || '');
    setCity(loc?.city || '');
    setStateProvince(loc?.stateProvince || '');
    setPostalCode(loc?.postalCode || '');
    setCounty(loc?.county || '');
    if (loc?.countryCode) setCountryCode(['US', 'ZW'].includes(loc.countryCode) ? loc.countryCode : 'OTHER');
    setLocationNote(loc ? null : 'No address found for this spot — you can type it in.');
  };

  const movePin = (lat: number, lng: number, resolve = true) => {
    setLatitude(parseFloat(lat.toFixed(6)));
    setLongitude(parseFloat(lng.toFixed(6)));
    if (resolve) setResolveToken((n) => n + 1);
  };

  /** Read GPS position and capture time from a photo (loaded on demand: exifr is large). */
  const readPhotoMeta = async (file: File): Promise<{ lat?: number; lng?: number; takenAt?: Date | null }> => {
    try {
      const { default: exifr } = await import('exifr');
      const data = await exifr.parse(file, { gps: true, pick: ['DateTimeOriginal', 'latitude', 'longitude'] });
      if (!data) return {};
      return { lat: data.latitude, lng: data.longitude, takenAt: plausibleCaptureDate(data.DateTimeOriginal) };
    } catch (error) {
      console.warn('Could not read photo metadata:', error);
      return {};
    }
  };

  /** Offer (never force) a location from a photo or the device when it differs from the pin. */
  const suggestLocation = (lat: number, lng: number, source: 'photo' | 'device') => {
    const far = distanceMeters({ lat, lng }, { lat: latitude, lng: longitude }) > 50;
    setPhotoGps(far ? { lat, lng, source } : null);
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImagePreview(URL.createObjectURL(file));
    try {
      // Upload and read EXIF at the same time.
      const [url, meta] = await Promise.all([uploadFile(file), readPhotoMeta(file)]);
      if (url) setImageUrl(url);
      if (isPlausibleGps(meta.lat, meta.lng)) suggestLocation(meta.lat!, meta.lng!, 'photo');
      if (meta.takenAt && !occurredAtTouched) setOccurredAt(toDatetimeLocal(meta.takenAt));
    } finally {
      setUploading(false);
    }
  };

  const handleRecordingComplete = async (blob: Blob, type: 'photo' | 'video' | 'audio') => {
    setShowRecorder(false);
    const extension = extensionForMime(blob.type, type);
    const file = new File([blob], `recorded-${type}-${Date.now()}.${extension}`, { type: blob.type });
    setUploading(true);
    try {
      const url = await uploadFile(file);
      if (!url) return;
      if (type === 'photo') {
        setImageUrl(url);
        setImagePreview(URL.createObjectURL(blob));
        // In-app photos carry no EXIF: offer the device position instead.
        navigator.geolocation?.getCurrentPosition(
          (pos) => suggestLocation(pos.coords.latitude, pos.coords.longitude, 'device'),
          () => {},
          { maximumAge: 60_000, timeout: 10_000 }
        );
      } else if (type === 'video') {
        setVideoUrl(url);
      } else {
        setAudioUrl(url);
      }
    } finally {
      setUploading(false);
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationNote('This browser cannot share its location.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => movePin(pos.coords.latitude, pos.coords.longitude),
      () => setLocationNote('Could not detect your location. Allow location access or click the map.'),
      { timeout: 10_000 }
    );
  };

  const canProceed = () => {
    if (step === 0) return title.trim() && infrastructureClass && severity;
    if (step === 1) return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
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
          county,
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
          costEstimateSource:
            estimatedCostLow || estimatedCostHigh ? 'citizen_estimate' : undefined,
        }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        const field = data.fields ? Object.entries(data.fields)[0] : null;
        setSubmitError(
          res.status === 429
            ? 'You have submitted many reports recently. Please try again later.'
            : field
              ? `${field[0]}: ${field[1]}`
              : data.error || 'Failed to submit'
        );
      }
    } catch {
      setSubmitError('Failed to submit. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-content modal-content-wide">
        <div className="modal-header">
          <h3>Report Infrastructure Issue</h3>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="report-form-mode-tabs">
          <button
            type="button"
            className={mode === 'quick' ? 'active' : ''}
            onClick={() => {
              setMode('quick');
              setStep(0);
            }}
          >
            Quick report
          </button>
          <button
            type="button"
            className={mode === 'advanced' ? 'active' : ''}
            onClick={() => {
              setMode('advanced');
              setStep(0);
            }}
          >
            Advanced science form
          </button>
        </div>

        <div className="report-form-steps">
          {steps.map((label, i) => (
            <span
              key={label}
              className={`report-form-step ${i === step ? 'active' : ''} ${
                i < step ? 'done' : ''
              }`}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>

        {step === 0 && (
          <div className="form-step">
            <div className="form-group">
              <label>Issue Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Collapsed storm drain on 14th St"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What failed, when, and who is affected?"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Failure Type</label>
                <select
                  value={failureType}
                  onChange={(e) => setFailureType(e.target.value)}
                >
                  <option value="">Select failure type</option>
                  {FAILURE_TYPES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Infrastructure Class</label>
                <select
                  value={infrastructureClass}
                  onChange={(e) => {
                    setInfrastructureClass(e.target.value);
                    setInfrastructureType('');
                  }}
                >
                  <option value="">Select class</option>
                  {Object.keys(INFRASTRUCTURE_TAXONOMY).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select
                  value={infrastructureType}
                  onChange={(e) => setInfrastructureType(e.target.value)}
                  disabled={!infrastructureClass}
                >
                  <option value="">Select type</option>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Action</label>
                <select
                  value={postAction}
                  onChange={(e) => setPostAction(e.target.value)}
                >
                  {POST_ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Severity (1–5)</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
                >
                  {[1, 2, 3, 4, 5].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="form-step">
            <div className="form-group">
              <label>Location</label>
              <PinPickerMap
                latitude={latitude}
                longitude={longitude}
                onChange={(lat, lng) => movePin(lat, lng, false)}
                onLocationChange={applyLocation}
                resolveToken={resolveToken}
              />
              {locationNote && <p className="field-error">{locationNote}</p>}
              <div className="location-picker-row">
                <input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  aria-label="Latitude"
                  value={Number.isFinite(latitude) ? latitude : ''}
                  onChange={(e) => setLatitude(e.target.value === '' ? NaN : parseFloat(e.target.value))}
                  onBlur={() => Number.isFinite(latitude) && setResolveToken((n) => n + 1)}
                />
                <input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  aria-label="Longitude"
                  value={Number.isFinite(longitude) ? longitude : ''}
                  onChange={(e) => setLongitude(e.target.value === '' ? NaN : parseFloat(e.target.value))}
                  onBlur={() => Number.isFinite(longitude) && setResolveToken((n) => n + 1)}
                />
                <button
                  type="button"
                  className="btn-detect"
                  onClick={detectLocation}
                >
                  Use my location
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Street Address (optional)</label>
              <input
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="123 Main St"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>City</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Auto-filled from map"
                />
              </div>
              <div className="form-group">
                <label>State</label>
                <input
                  value={stateProvince}
                  onChange={(e) => setStateProvince(e.target.value)}
                  placeholder="Auto-filled from map"
                />
              </div>
              <div className="form-group">
                <label>ZIP</label>
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Auto-filled from map"
                  maxLength={20}
                />
              </div>
              <div className="form-group">
                <label>County</label>
                <input
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  placeholder="Auto-filled from map"
                  maxLength={120}
                />
              </div>
              <div className="form-group">
                <label>Country</label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                >
                  <option value="US">United States</option>
                  <option value="ZW">Zimbabwe</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            {(city || stateProvince || postalCode) && (
              <div style={{ fontSize: '12px', color: '#2e7d32', marginTop: '4px' }}>
                📍 Location auto-filled from map
              </div>
            )}
          </div>
        )}

        {mode === 'advanced' && step === 2 && (
          <div className="form-step">
            <div className="form-row">
              <div className="form-group">
                <label>Est. Cost Low (USD)</label>
                <input
                  type="number"
                  min="0"
                  value={estimatedCostLow}
                  onChange={(e) => setEstimatedCostLow(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Est. Cost High (USD)</label>
                <input
                  type="number"
                  min="0"
                  value={estimatedCostHigh}
                  onChange={(e) => setEstimatedCostHigh(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>People Affected</label>
                <input
                  type="number"
                  min="0"
                  value={peopleAffected}
                  onChange={(e) => setPeopleAffected(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Outage Hours</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={outageDurationHours}
                  onChange={(e) => setOutageDurationHours(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Asset / Facility</label>
                <input
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Responsible Agency</label>
                <input
                  value={responsibleAgency}
                  onChange={(e) => setResponsibleAgency(e.target.value)}
                  placeholder="DOT, DPW, Utility…"
                />
              </div>
            </div>
            <div className="impact-flags">
              <label>
                <input
                  type="checkbox"
                  checked={safetyImpact}
                  onChange={(e) => setSafetyImpact(e.target.checked)}
                />{' '}
                Safety impact
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={accessibilityImpact}
                  onChange={(e) => setAccessibilityImpact(e.target.checked)}
                />{' '}
                Accessibility impact
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={environmentalImpact}
                  onChange={(e) => setEnvironmentalImpact(e.target.checked)}
                />{' '}
                Environmental impact
              </label>
            </div>
          </div>
        )}

        {((mode === 'quick' && step === 2) ||
          (mode === 'advanced' && step === 3)) && (
          <div className="form-step">
            <div className="recording-buttons" style={{ marginBottom: '16px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowRecorder(true)}
              >
                🎥 Record Media In-App
              </button>
            </div>

            {showRecorder && (
              <div
                className="recorder-modal"
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.8)',
                  zIndex: 2000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                }}
              >
                <div
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    maxWidth: '500px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                  }}
                >
                  <InAppMediaRecorder
                    onRecordingComplete={handleRecordingComplete}
                    onCancel={() => setShowRecorder(false)}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Or Upload Photo</label>
              <input type="file" accept="image/*" onChange={handleImage} />
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="upload-preview" />
              )}
              {photoGps && (
                <div className="location-suggestion" role="status">
                  📍 {photoGps.source === 'photo' ? 'This photo was taken' : 'You are'}{' '}
                  {(distanceMeters({ lat: photoGps.lat, lng: photoGps.lng }, { lat: latitude, lng: longitude }) / 1000).toFixed(1)} km
                  from the pin.
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      movePin(photoGps.lat, photoGps.lng);
                      setPhotoGps(null);
                    }}
                  >
                    Use this location
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setPhotoGps(null)}>
                    Keep my pin
                  </button>
                </div>
              )}
            </div>
            {(videoUrl || audioUrl) && (
              <div className="attached-media">
                {videoUrl && (
                  <span className="media-chip">
                    🎥 Video attached
                    <button type="button" aria-label="Remove video" onClick={() => setVideoUrl(null)}>×</button>
                  </span>
                )}
                {audioUrl && (
                  <span className="media-chip">
                    🎙️ Audio attached
                    <button type="button" aria-label="Remove audio" onClick={() => setAudioUrl(null)}>×</button>
                  </span>
                )}
              </div>
            )}
            {uploadError && <p className="field-error" role="alert">{uploadError}</p>}
            {mode === 'advanced' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Video</label>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setUploading(true);
                        const url = await uploadFile(f);
                        if (url) setVideoUrl(url);
                        setUploading(false);
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Audio</label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setUploading(true);
                        const url = await uploadFile(f);
                        if (url) setAudioUrl(url);
                        setUploading(false);
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Evidence Type</label>
                    <select
                      value={evidenceType}
                      onChange={(e) => setEvidenceType(e.target.value)}
                    >
                      {EVIDENCE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Observation Confidence (1–5)</label>
                    <select
                      value={observationConfidence}
                      onChange={(e) =>
                        setObservationConfidence(parseInt(e.target.value, 10))
                      }
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Occurred At</label>
                    <input
                      type="datetime-local"
                      value={occurredAt}
                      max={toDatetimeLocal(new Date())}
                      onChange={(e) => {
                        setOccurredAtTouched(true);
                        setOccurredAt(e.target.value);
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {mode === 'advanced' && step === 4 && (
          <div className="form-step review-summary">
            <h4>Review before submit</h4>
            <p>
              <strong>{title}</strong> · Severity {severity}
            </p>
            <p>
              {infrastructureClass}
              {infrastructureType ? ` → ${infrastructureType}` : ''} ·{' '}
              {failureType || 'Unspecified failure'}
            </p>
            <p>
              {city || 'City TBD'}
              {stateProvince ? `, ${stateProvince}` : ''} · {Number.isFinite(latitude) ? latitude.toFixed(4) : '?'},{' '}
              {Number.isFinite(longitude) ? longitude.toFixed(4) : '?'}
            </p>
            {(estimatedCostLow || estimatedCostHigh) && (
              <p>
                Est. cost: ${estimatedCostLow || '?'} – ${estimatedCostHigh || '?'}
              </p>
            )}
            {peopleAffected && <p>People affected: {peopleAffected}</p>}
          </div>
        )}

        {submitError && <p className="field-error report-form-error" role="alert">{submitError}</p>}
        <div className="report-form-actions">
          {step > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              type="button"
              className="btn-primary"
              disabled={!canProceed()}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={submitting || uploading || !canProceed()}
              onClick={submit}
            >
              {uploading
                ? 'Uploading…'
                : submitting
                ? 'Submitting…'
                : 'Submit Report'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}