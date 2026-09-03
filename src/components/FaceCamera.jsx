import { useEffect, useRef, useState } from "react";
import {
  FaceDetector,
  FilesetResolver
} from '@mediapipe/tasks-vision';

const FaceCamera = ({ onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const streamRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [showCameraWarning, setShowCameraWarning] = useState(false);
  const [cameraWarningMessage, setCameraWarningMessage] = useState('');
  const [faceDetectorReady, setFaceDetectorReady] = useState(false);
  const [userStartedCamera, setUserStartedCamera] = useState(false);

  useEffect(() => {
    let active = true;
    const initFaceDetector = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU"
          },
          runningMode: "VIDEO"
        });
        if (active) {
          faceDetectorRef.current = faceDetector;
          setFaceDetectorReady(true);
        }
      } catch (err) {
        console.warn("FaceDetector GPU init failed, attempting CPU fallback:", err);
        try {
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
          );
          const faceDetector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
              delegate: "CPU"
            },
            runningMode: "VIDEO"
          });
          if (active) {
            faceDetectorRef.current = faceDetector;
            setFaceDetectorReady(true);
          }
        } catch (cpuErr) {
          console.error("FaceDetector initialization failed:", cpuErr);
        }
      }
    };
    initFaceDetector();
    return () => {
      active = false;
      if (faceDetectorRef.current) {
        try { faceDetectorRef.current.close(); } catch (e) {}
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError('');
      setCameraReady(false);
      setShowCameraWarning(false);

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;
      }

      setPhoto(null);
      onCapture(null);

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          'Camera is not supported in this browser.'
        );
      }

      const mediaStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });

      const video = videoRef.current;

      if (!video) {
        mediaStream
          .getTracks()
          .forEach((track) => track.stop());

        throw new Error(
          'Camera preview is unavailable.'
        );
      }

      video.srcObject = mediaStream;
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setUserStartedCamera(true);

      await video.play();

      if (
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        setCameraReady(true);
      }
    } catch (error) {
      console.error('Camera error:', error);

      setCameraReady(false);
      setStream(null);

      setCameraError(
        error.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access.'
          : error.message ||
            'Unable to access the camera.'
      );
    }
  };

  const hasUsableCameraFrame = (
    video,
    canvas
  ) => {
    const context =
      canvas.getContext('2d', {
        willReadFrequently: true
      });

    if (!context) return false;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const pixels = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    ).data;

    let brightnessTotal = 0;
    let brightnessSquaredTotal = 0;
    let samples = 0;

    // Sample pixels for faster validation.
    for (
      let index = 0;
      index < pixels.length;
      index += 160
    ) {
      const brightness =
        pixels[index] * 0.299 +
        pixels[index + 1] * 0.587 +
        pixels[index + 2] * 0.114;

      brightnessTotal += brightness;
      brightnessSquaredTotal +=
        brightness * brightness;

      samples += 1;
    }

    const average =
      brightnessTotal / samples;

    const variance =
      brightnessSquaredTotal / samples -
      average * average;

    const deviation = Math.sqrt(
      Math.max(variance, 0)
    );

    // Reject black, covered, or nearly blank frames.
    return average >= 20 && deviation >= 10;
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const cameraIsLive =
      stream &&
      stream
        .getVideoTracks()
        .some(
          (track) =>
            track.enabled &&
            track.readyState === 'live'
        );

    if (
      !cameraIsLive ||
      !cameraReady ||
      !video ||
      video.readyState < 2 ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      setCameraWarningMessage(
        'Please turn on the camera and wait for the live preview before capturing your photo.'
      );
      setShowCameraWarning(true);
      return;
    }

    if (!userStartedCamera) {
      setCameraWarningMessage(
        'Please turn on the camera before capturing your photo.'
      );
      setShowCameraWarning(true);
      return;
    }

    if (!hasUsableCameraFrame(video, canvas)) {
      setCameraWarningMessage(
        'The camera image is dark, covered, or unavailable. Turn on the camera, ensure proper lighting, and try again.'
      );
      setShowCameraWarning(true);
      return;
    }

    if (
      !faceDetectorReady ||
      !faceDetectorRef.current
    ) {
      setCameraWarningMessage(
        'Face detection is still loading. Please wait a moment and try again.'
      );
      setShowCameraWarning(true);
      return;
    }

    try {
      const detectionResult =
        faceDetectorRef.current.detectForVideo(
          video,
          performance.now()
        );

      const detections =
        detectionResult?.detections || [];

      if (detections.length === 0) {
        setCameraWarningMessage(
          'No face was detected. Position your face clearly inside the oval and try again.'
        );
        setShowCameraWarning(true);
        return;
      }

      if (detections.length > 1) {
        setCameraWarningMessage(
          'Multiple faces were detected. Only one visitor must be visible in the camera.'
        );
        setShowCameraWarning(true);
        return;
      }

      const detection = detections[0];
      const box = detection.boundingBox;

      if (!box) {
        setCameraWarningMessage(
          'Your face could not be detected clearly. Please try again.'
        );
        setShowCameraWarning(true);
        return;
      }

      const frameWidth = video.videoWidth;
      const frameHeight = video.videoHeight;

      const faceWidthRatio =
        box.width / frameWidth;

      const faceHeightRatio =
        box.height / frameHeight;

      const faceCenterX =
        (box.originX + box.width / 2) /
        frameWidth;

      const faceCenterY =
        (box.originY + box.height / 2) /
        frameHeight;

      const faceIsLargeEnough =
        faceWidthRatio >= 0.22 &&
        faceHeightRatio >= 0.28;

      const faceIsCentered =
        faceCenterX >= 0.25 &&
        faceCenterX <= 0.75 &&
        faceCenterY >= 0.2 &&
        faceCenterY <= 0.8;

      if (!faceIsLargeEnough) {
        setCameraWarningMessage(
          'Your face is too far from the camera. Move closer and align your face inside the oval.'
        );
        setShowCameraWarning(true);
        return;
      }

      if (!faceIsCentered) {
        setCameraWarningMessage(
          'Please center your face inside the oval before capturing.'
        );
        setShowCameraWarning(true);
        return;
      }

      if (!canvas) {
        throw new Error(
          'Photo canvas is unavailable.'
        );
      }

      const context =
        canvas.getContext('2d');

      if (!context) {
        throw new Error(
          'Unable to process the camera image.'
        );
      }

      canvas.width = frameWidth;
      canvas.height = frameHeight;

      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const imageData =
        canvas.toDataURL(
          'image/jpeg',
          0.85
        );

      stream
        .getTracks()
        .forEach((track) => track.stop());

      video.srcObject = null;

      streamRef.current = null;
      setUserStartedCamera(false);
      setStream(null);
      setCameraReady(false);
      setPhoto(imageData);
      setCameraWarningMessage('');

      onCapture(imageData);
    } catch (error) {
      console.error(
        'Face detection error:',
        error
      );

      setCameraWarningMessage(
        'Face verification failed. Keep the camera on and try again.'
      );

      setShowCameraWarning(true);
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    onCapture(null);
    startCamera(); // Restart camera when user wants to retake
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;
      }
    };
  }, []);

  return (
    <div className="face-camera bg-slate-50/50 border border-gray-200/80 p-4 rounded-2xl text-center space-y-4">
      <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider">
        Capture Visitor Photo — Validation V2
      </h3>

      {cameraError && (
        <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl font-medium">
          {cameraError}
        </div>
      )}

      {!photo ? (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-black border border-gray-200 flex items-center justify-center max-w-sm mx-auto shadow-inner">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedData={() => {
                if (
                  videoRef.current?.videoWidth > 0 &&
                  videoRef.current?.videoHeight > 0
                ) {
                  setCameraReady(true);
                }
              }}
              onError={() => {
                setCameraReady(false);
                setCameraError(
                  'Camera preview failed to load.'
                );
              }}
              className="w-full h-48 sm:h-56 object-cover rounded-xl"
            />
            {/* Oval Face Guide Overlay */}
            <div className="absolute inset-0 border-2 border-dashed border-indigo-500/50 rounded-full w-36 h-44 m-auto pointer-events-none flex items-center justify-center">
              <span className="text-[10px] text-indigo-600 font-bold bg-white/90 px-2.5 py-1 rounded-md shadow-sm border border-indigo-100">Align Face</span>
            </div>
          </div>

          {!cameraReady && (
            <button
              type="button"
              onClick={startCamera}
              className="w-full rounded-xl border border-indigo-600 bg-white px-4 py-2.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50"
            >
              Turn On Camera
            </button>
          )}

          <button
            type="button"
            onClick={capturePhoto}
            className="w-full py-2.5 rounded-xl bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            {cameraReady ? 'Capture Photo' : 'Camera Is Off'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative w-40 h-40 mx-auto rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-md">
            <img
              src={photo}
              alt="Captured visitor"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={retakePhoto}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-gray-300 transition-colors inline-flex items-center gap-2"
            >
              Retake
            </button>

            <button
              type="button"
              onClick={() => onCapture(photo)}
              className="px-4 py-2 rounded-xl bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
            >
              Confirm Photo
            </button>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{ display: "none" }}
      />

      {showCameraWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">
              📷
            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-900">
              Photo Cannot Be Captured
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              {cameraWarningMessage}
            </p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowCameraWarning(false)
                }
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCameraWarning(false);
                  startCamera();
                }}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Turn On Camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceCamera;
