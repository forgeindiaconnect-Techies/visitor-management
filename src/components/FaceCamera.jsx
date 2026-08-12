import { useEffect, useRef, useState } from "react";

const FaceCamera = ({ onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [cameraError, setCameraError] = useState("");

  const startCamera = async () => {
    try {
      setCameraError("");

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Camera error:", error);

      setCameraError(
        "Unable to access the camera. Please allow camera permission."
      );
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageData = canvas.toDataURL("image/jpeg", 0.85);

    setPhoto(imageData);
    onCapture(imageData);
  };

  const retakePhoto = () => {
    setPhoto(null);
    onCapture(null);
  };

  useEffect(() => {
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  return (
    <div className="face-camera bg-slate-50/50 border border-gray-200/80 p-4 rounded-2xl text-center space-y-4">
      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Capture Visitor Photo</h3>

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
              className="w-full h-48 sm:h-56 object-cover rounded-xl"
            />
            {/* Oval Face Guide Overlay */}
            <div className="absolute inset-0 border-2 border-dashed border-indigo-500/50 rounded-full w-36 h-44 m-auto pointer-events-none flex items-center justify-center">
              <span className="text-[10px] text-indigo-600 font-bold bg-white/90 px-2.5 py-1 rounded-md shadow-sm border border-indigo-100">Align Face</span>
            </div>
          </div>

          <button
            type="button"
            onClick={capturePhoto}
            className="w-full py-2.5 rounded-xl bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            Capture Photo
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
    </div>
  );
};

export default FaceCamera;
