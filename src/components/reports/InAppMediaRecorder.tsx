'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RECORDING_LIMITS,
  describeMediaError,
  fitWithin,
  formatDuration,
  pickRecorderMimeType,
  type RecordKind,
} from '@/lib/media-recording';

type Mode = 'photo' | RecordKind;

interface MediaRecorderProps {
  onRecordingComplete: (blob: Blob, type: Mode) => void;
  onCancel: () => void;
}

const PHOTO_MAX_DIMENSION = 1920;
const PHOTO_QUALITY = 0.85;

const supportsCapture = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export function InAppMediaRecorder({ onRecordingComplete, onCancel }: MediaRecorderProps) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bytesRef = useRef(0);
  const discardRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** Stop the recorder and release camera/microphone. Safe to call repeatedly. */
  const stopAll = useCallback((discard: boolean) => {
    discardRef.current = discard;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorderRef.current = null;
    setStream((current) => {
      current?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setIsRecording(false);
  }, []);

  // Release devices and object URLs when the recorder closes.
  useEffect(() => () => stopAll(true), [stopAll]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  // Attach the live stream once both it and the <video> element exist.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream, mode]);

  // Recording timer with an automatic stop at the duration limit.
  useEffect(() => {
    if (!isRecording || (mode !== 'video' && mode !== 'audio')) return;
    const started = Date.now();
    const limit = RECORDING_LIMITS.maxSeconds[mode];
    const t = setInterval(() => {
      const seconds = (Date.now() - started) / 1000;
      setElapsed(seconds);
      if (seconds >= limit) {
        setNotice(`Recording stopped at the ${formatDuration(limit)} limit.`);
        stopAll(false);
      }
    }, 250);
    return () => clearInterval(t);
  }, [isRecording, mode, stopAll]);

  const start = useCallback(
    async (type: Mode) => {
      setError(null);
      setNotice(null);
      setPreview(null);
      setElapsed(0);
      setMode(type);

      if (!supportsCapture()) {
        setError('Your browser does not support in-app recording. Please use the file picker instead.');
        return;
      }

      let media: MediaStream | null = null;
      try {
        media = await navigator.mediaDevices.getUserMedia({
          video:
            type === 'audio'
              ? false
              : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: type !== 'photo',
        });
        setStream(media);
        if (type === 'photo') return;

        const mimeType =
          typeof MediaRecorder !== 'undefined'
            ? pickRecorderMimeType(type, (t) => MediaRecorder.isTypeSupported(t))
            : undefined;
        const recorder = new MediaRecorder(media, {
          ...(mimeType ? { mimeType } : {}),
          ...(type === 'video' ? { videoBitsPerSecond: 1_000_000 } : {}),
        });
        recorderRef.current = recorder;
        chunksRef.current = [];
        bytesRef.current = 0;
        discardRef.current = false;

        recorder.ondataavailable = (event) => {
          if (event.data.size === 0) return;
          chunksRef.current.push(event.data);
          bytesRef.current += event.data.size;
          if (bytesRef.current >= RECORDING_LIMITS.maxBytes) {
            setNotice('Recording stopped at the 10 MB upload limit.');
            stopAll(false);
          }
        };
        recorder.onstop = () => {
          if (discardRef.current || chunksRef.current.length === 0) return;
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || `${type}/webm` });
          setPreview({ url: URL.createObjectURL(blob), blob });
        };

        // Timeslice so size is checked while recording, not only at the end.
        recorder.start(1000);
        setIsRecording(true);
      } catch (err) {
        media?.getTracks().forEach((t) => t.stop());
        stopAll(true);
        setError(describeMediaError(err));
      }
    },
    [stopAll]
  );

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    const { width, height } = fitWithin(video.videoWidth, video.videoHeight, PHOTO_MAX_DIMENSION);
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Could not capture the photo. Please try again.');
          return;
        }
        setPreview({ url: URL.createObjectURL(blob), blob });
        stopAll(true);
      },
      'image/jpeg',
      PHOTO_QUALITY
    );
  }, [stopAll]);

  const useRecording = () => {
    if (!preview || !mode) return;
    onRecordingComplete(preview.blob, mode);
  };

  const retake = () => {
    if (mode) void start(mode);
  };

  const cancel = () => {
    stopAll(true);
    onCancel();
  };

  if (!supportsCapture()) {
    return (
      <div className="media-recorder-fallback">
        <p>In-app recording is not supported on this browser. Please use the file picker instead.</p>
        <button onClick={onCancel} className="btn-secondary">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="media-recorder">
      {error && (
        <div className="recorder-error" role="alert">
          ⚠️ {error}
        </div>
      )}
      {notice && <div className="recorder-notice" role="status">{notice}</div>}

      {!mode && (
        <div className="recorder-options">
          <h4>Record Media</h4>
          <button onClick={() => void start('photo')} className="btn-primary">
            📸 Take Photo
          </button>
          <button onClick={() => void start('video')} className="btn-primary">
            🎥 Record Video (up to {formatDuration(RECORDING_LIMITS.maxSeconds.video)})
          </button>
          <button onClick={() => void start('audio')} className="btn-primary">
            🎙️ Record Audio (up to {formatDuration(RECORDING_LIMITS.maxSeconds.audio)})
          </button>
          <button onClick={cancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      )}

      {mode && (
        <div className="recorder-preview">
          {!preview && mode !== 'audio' && <video ref={videoRef} autoPlay muted playsInline className="recorder-live" />}
          <canvas ref={canvasRef} hidden />

          {preview && (
            <div className="recorder-result">
              {mode === 'photo' && <img src={preview.url} alt="Captured photo preview" />}
              {mode === 'video' && <video src={preview.url} controls playsInline />}
              {mode === 'audio' && <audio src={preview.url} controls />}
            </div>
          )}

          {!preview && isRecording && (
            <div className="recorder-indicator" aria-live="polite">
              ● Recording {formatDuration(elapsed)} / {formatDuration(RECORDING_LIMITS.maxSeconds[mode as RecordKind])}
            </div>
          )}

          <div className="recorder-controls">
            {!preview && mode === 'photo' && stream && (
              <button onClick={takePhoto} className="btn-primary">
                📸 Capture
              </button>
            )}
            {!preview && mode !== 'photo' && isRecording && (
              <button onClick={() => stopAll(false)} className="btn-danger">
                ⏹ Stop Recording
              </button>
            )}
            {preview && (
              <>
                <button onClick={useRecording} className="btn-primary">
                  ✅ Use This
                </button>
                <button onClick={retake} className="btn-secondary">
                  🔄 Retake
                </button>
              </>
            )}
            {error && !preview && (
              <button onClick={() => setMode(null)} className="btn-secondary">
                Back
              </button>
            )}
            <button onClick={cancel} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
