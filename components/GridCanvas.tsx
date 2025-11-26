import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ViewState, ColorFormat, Theme } from '../types';
import { formatColor, getContrastColor, getPingPongValue } from '../utils';

interface GridCanvasProps {
  viewState: ViewState;
  setViewState: React.Dispatch<React.SetStateAction<ViewState>>;
  hue: number;
  theme: Theme;
  colorFormat: ColorFormat;
  showGridLabels: boolean;
  onToleranceChange: (val: number, max: number) => void;
  isDraggingCanvas: boolean;
  setIsDraggingCanvas: (v: boolean) => void;
}

// Constants for layout
const RECT_WIDTH = 100;
const RECT_HEIGHT = 60;
const GAP = 10;
const CELL_W = RECT_WIDTH + GAP;
const CELL_H = RECT_HEIGHT + GAP;

const GridCanvas: React.FC<GridCanvasProps> = ({
  viewState,
  setViewState,
  hue,
  theme,
  colorFormat,
  showGridLabels,
  onToleranceChange,
  isDraggingCanvas,
  setIsDraggingCanvas,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const snapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeSwatch, setActiveSwatch] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  
  // Pointers for multi-touch
  const pointers = useRef<Map<number, {x: number, y: number}>>(new Map());
  const lastPinchDist = useRef<number | null>(null);

  // Update viewport size on resize
  useEffect(() => {
    const handleResize = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Background color based on theme
  const bgColor = theme === 'dark' ? 'rgb(16, 16, 16)' : 'rgb(232, 231, 229)';
  const labelColor = theme === 'dark' ? 'rgb(232, 231, 229)' : 'rgb(16, 16, 16)';

  // VIRTUALIZATION LOGIC
  const visibleItems = useMemo(() => {
    const step = Math.max(1, Math.round(viewState.step));
    const maxIndex = Math.floor(100 / step); // The index where the value reaches 100
    
    const buffer = 2;
    const minCol = Math.floor((0 - viewState.x) / (viewState.scale * CELL_W)) - buffer;
    const maxCol = Math.ceil((viewportSize.w - viewState.x) / (viewState.scale * CELL_W)) + buffer;
    const minRow = Math.floor((0 - viewState.y) / (viewState.scale * CELL_H)) - buffer;
    const maxRow = Math.ceil((viewportSize.h - viewState.y) / (viewState.scale * CELL_H)) + buffer;

    const items = [];

    for (let c = minCol; c <= maxCol; c++) {
        for (let r = minRow; r <= maxRow; r++) {
            const lVal = getPingPongValue(c, maxIndex) * step;
            const sVal = getPingPongValue(r, maxIndex) * step;

            items.push({
                key: `${c}_${r}`,
                c,
                r,
                l: lVal,
                s: sVal,
                x: c * CELL_W,
                y: r * CELL_H
            });
        }
    }
    
    return items;
  }, [viewState, viewportSize]);

  // Shared Zoom Logic
  const performZoom = (newRawScale: number, center: {x: number, y: number}) => {
    if (snapTimeout.current) clearTimeout(snapTimeout.current);

    let newScale = newRawScale;
    let newStep = viewState.step;

    const isZoomingIn = newRawScale > viewState.scale;
    const isZoomingOut = newRawScale < viewState.scale;

    if (newScale > 1.2) {
        newScale = 1.2;
        if (isZoomingIn) newStep = Math.max(1, viewState.step - 1);
    } else if (newScale < 0.8) {
        newScale = 0.8;
        if (isZoomingOut) newStep = Math.min(25, viewState.step + 1); 
    }

    if (newStep !== viewState.step) {
        onToleranceChange(newStep, 25);
    }

    // Calculate new position to keep focus point fixed
    // world = (screen - offset) / oldScale
    // newOffset = screen - world * newScale
    
    const worldX = (center.x - viewState.x) / viewState.scale;
    const worldY = (center.y - viewState.y) / viewState.scale;

    // Correction for step change (maintaining phase/ratio)
    const oldMaxIndex = Math.floor(100 / viewState.step);
    const newMaxIndex = Math.floor(100 / newStep);
    const stepRatio = (oldMaxIndex > 0 && newMaxIndex > 0) ? newMaxIndex / oldMaxIndex : 1;

    const targetWorldX = worldX * stepRatio;
    const targetWorldY = worldY * stepRatio;

    const newX = center.x - targetWorldX * newScale;
    const newY = center.y - targetWorldY * newScale;

    setViewState({
        x: newX,
        y: newY,
        scale: newScale,
        step: newStep
    });
    
    snapTimeout.current = setTimeout(snapToNearest, 3000);
  };

  // Handle Pointer Events (Mouse + Touch)
  const handlePointerDown = (e: React.PointerEvent) => {
    // Always track pointer
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (pointers.current.size === 1) {
        if (e.button !== 0) return; // Only left click for single pointer
        setIsDraggingCanvas(true);
        lastPos.current = { x: e.clientX, y: e.clientY };
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        if (snapTimeout.current) clearTimeout(snapTimeout.current);
    } else if (pointers.current.size === 2) {
        // Pinch Start
        setIsDraggingCanvas(false); // Disable panning during pinch to avoid conflict
        const pts = Array.from(pointers.current.values());
        lastPinchDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // PINCH ZOOM
    if (pointers.current.size === 2) {
        const pts = Array.from(pointers.current.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const cx = (pts[0].x + pts[1].x) / 2;
        const cy = (pts[0].y + pts[1].y) / 2;

        if (lastPinchDist.current) {
            // Calculate scale ratio
            const ratio = dist / lastPinchDist.current;
            const newRawScale = viewState.scale * ratio;
            performZoom(newRawScale, {x: cx, y: cy});
        }
        lastPinchDist.current = dist;
        return;
    }

    // PANNING
    if (!isDraggingCanvas || !lastPos.current || pointers.current.size !== 1) return;
    
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    
    setViewState(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy
    }));
    
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) {}

    if (pointers.current.size < 2) {
        lastPinchDist.current = null;
    }

    if (pointers.current.size === 0) {
        // All fingers lifted
        if (isDraggingCanvas) {
            setIsDraggingCanvas(false);
            triggerSnap();
        }
        lastPos.current = null;
    } else if (pointers.current.size === 1) {
        // Switched from pinch to single finger?
        // Resume panning from current point to prevent jump
        const p = pointers.current.values().next().value;
        lastPos.current = { x: p.x, y: p.y };
        setIsDraggingCanvas(true);
    }
  };

  const triggerSnap = () => {
    if (snapTimeout.current) clearTimeout(snapTimeout.current);
    snapTimeout.current = setTimeout(() => {
        snapToNearest();
    }, 3000);
  };

  const snapToNearest = () => {
    const cx = viewportSize.w / 2;
    const cy = viewportSize.h / 2;
    const worldCx = (cx - viewState.x) / viewState.scale;
    const worldCy = (cy - viewState.y) / viewState.scale;

    const col = Math.round((worldCx - RECT_WIDTH/2) / CELL_W);
    const row = Math.round((worldCy - RECT_HEIGHT/2) / CELL_H);

    const destX = col * CELL_W + RECT_WIDTH/2;
    const destY = row * CELL_H + RECT_HEIGHT/2;

    const endViewStateX = cx - destX * viewState.scale;
    const endViewStateY = cy - destY * viewState.scale;

    animateTo(endViewStateX, endViewStateY);
  };

  const animateTo = (targetX: number, targetY: number) => {
    const startX = viewState.x;
    const startY = viewState.y;
    const startTime = performance.now();
    const duration = 600; 

    const tick = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        
        setViewState(prev => ({
            ...prev,
            x: startX + (targetX - startX) * ease,
            y: startY + (targetY - startY) * ease
        }));

        if (progress < 1) {
            requestAnimationFrame(tick);
        }
    };
    requestAnimationFrame(tick);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    // Wheel Delta Logic
    const delta = -Math.sign(e.deltaY); 
    const zoomSpeed = 0.05;
    const newRawScale = viewState.scale + (delta * zoomSpeed);
    
    performZoom(newRawScale, { x: viewportSize.w / 2, y: viewportSize.h / 2 });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const moveAmount = 20;
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
            setViewState(prev => {
                let { x, y, scale } = prev;
                if (e.key === 'ArrowUp') {
                    if (e.ctrlKey) scale = Math.min(1.2, scale + 0.05);
                    else y += moveAmount;
                } else if (e.key === 'ArrowDown') {
                     if (e.ctrlKey) scale = Math.max(0.8, scale - 0.05);
                     else y -= moveAmount;
                } else if (e.key === 'ArrowLeft') {
                    if (e.ctrlKey) scale = Math.max(0.8, scale - 0.05);
                    else x += moveAmount;
                } else if (e.key === 'ArrowRight') {
                    if (e.ctrlKey) scale = Math.min(1.2, scale + 0.05);
                    else x -= moveAmount;
                }
                return { ...prev, x, y, scale };
            });
            triggerSnap();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div 
        ref={containerRef}
        className="absolute inset-0 w-full h-full overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        style={{ backgroundColor: bgColor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
    >
      <div
        style={{
            transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
        }}
        className="absolute top-0 left-0 w-0 h-0"
      >
        {visibleItems.map((item) => {
            const isActive = activeSwatch === item.key;
            const hslString = `hsl(${hue}, ${item.s}%, ${item.l}%)`;
            const code = formatColor({ h: hue, s: item.s, l: item.l }, colorFormat);
            const contrastColor = getContrastColor({ h: hue, s: item.s, l: item.l });

            return (
                <div key={item.key} className="absolute group" style={{
                    transform: `translate(${item.x}px, ${item.y}px)`, 
                    width: RECT_WIDTH,
                    height: RECT_HEIGHT,
                    willChange: 'transform'
                }}>
                    <div 
                        className={`w-full h-full rounded-[8px] transition-transform duration-200 ease-out origin-center
                            hover:scale-110 active:scale-95 no-select flex items-center justify-center`}
                        style={{ backgroundColor: hslString }}
                        onPointerUp={(e) => {
                            // Distance check to differentiate Click vs Drag
                            if (dragStartPos.current) {
                                const dist = Math.sqrt(
                                    Math.pow(e.clientX - dragStartPos.current.x, 2) + 
                                    Math.pow(e.clientY - dragStartPos.current.y, 2)
                                );
                                if (dist < 5) {
                                    setActiveSwatch(prev => prev === item.key ? null : item.key);
                                }
                            }
                        }}
                    >
                        {isActive && (
                            <span 
                                className="font-bold text-xs px-2 py-1 rounded select-none pointer-events-none"
                                style={{ color: contrastColor }}
                            >
                                {code}
                            </span>
                        )}
                    </div>
                    
                    {showGridLabels && (
                         <div 
                            className="absolute top-full left-0 w-full flex justify-center items-center text-[8px] font-mono mt-[2px] pointer-events-none"
                            style={{ color: labelColor, height: GAP }}
                         >
                            {code}
                         </div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default GridCanvas;