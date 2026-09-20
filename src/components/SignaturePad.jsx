import React, { useRef, useState, useEffect } from 'react';

export default function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Setup high-DPI canvas
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0B0F19'; // orac-ink
    }
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.closePath();
      setIsDrawing(false);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    // For demo/simplicity, we return a data URL. 
    // In production, this would upload to S3 and return the URL.
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-orac-border rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-48 touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="flex justify-between items-center text-sm text-orac-slate">
        <span>Sign above</span>
        <button type="button" onClick={clearCanvas} className="text-orac-cyan hover:underline">
          Clear Signature
        </button>
      </div>
      <div className="flex space-x-3 pt-4 border-t border-orac-border">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 bg-orac-surface border border-orac-border text-orac-slate rounded hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={saveSignature}
          className="flex-1 py-2 bg-orac-navy text-white rounded hover:bg-orac-navy/90"
        >
          Confirm & Save
        </button>
      </div>
    </div>
  );
}
