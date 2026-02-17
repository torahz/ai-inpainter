
import React, { useRef, useEffect, useState } from 'react';
import { BrushMode } from '../types';

interface MaskCanvasProps {
  imageSrc: string;
  brushSize: number;
  mode: BrushMode;
  onMaskUpdate: (maskDataUrl: string) => void;
}

export const MaskCanvas: React.FC<MaskCanvasProps> = ({ 
  imageSrc, 
  brushSize, 
  mode, 
  onMaskUpdate 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Initialize canvas and handle resizing
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const parent = canvasRef.current?.parentElement;
      if (!parent) return;
      
      const maxWidth = parent.clientWidth;
      const scale = Math.min(maxWidth / img.width, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      
      setDimensions({ width: w, height: h });
      
      if (canvasRef.current) {
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          contextRef.current = ctx;
        }
      }
    };
  }, [imageSrc]);

  // Update brush settings
  useEffect(() => {
    const ctx = contextRef.current;
    if (!ctx) return;
    
    ctx.lineWidth = brushSize;
    if (mode === BrushMode.DRAW) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
    }
  }, [brushSize, mode]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getCoordinates(e);
    contextRef.current?.beginPath();
    contextRef.current?.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    contextRef.current?.lineTo(x, y);
    contextRef.current?.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    contextRef.current?.closePath();
    setIsDrawing(false);
    
    // We send the data URL of the mask itself
    // Note: The parent app will combine this with the image or send it as is.
    // In this app's current implementation, it expects the full combined image.
    // So let's create a temporary combined canvas for the mask update if needed.
    if (canvasRef.current) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasRef.current.width;
        tempCanvas.height = canvasRef.current.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
            const img = new Image();
            img.src = imageSrc;
            img.onload = () => {
                tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
                tempCtx.drawImage(canvasRef.current!, 0, 0);
                onMaskUpdate(tempCanvas.toDataURL('image/png'));
            };
        }
    }
  };

  return (
    <div className="relative border-2 border-dashed border-slate-300 rounded-3xl overflow-hidden shadow-inner bg-slate-100 flex items-center justify-center min-h-[400px]" style={{ minHeight: dimensions.height }}>
      {/* Background Layer */}
      {dimensions.width > 0 && (
        <img 
          src={imageSrc} 
          className="absolute select-none pointer-events-none" 
          style={{ width: dimensions.width, height: dimensions.height }}
          alt="Background"
        />
      )}
      
      {/* Drawing Layer */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="relative z-10 cursor-crosshair block"
      />
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/70 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold tracking-wide pointer-events-none">
        {mode === BrushMode.DRAW ? 'BRUSHING' : 'ERASING'} MASK
      </div>
    </div>
  );
};
