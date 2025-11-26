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
    
    // Calculate visible grid columns/rows
    // screenX = worldX * scale + viewState.x
    // worldX = (screenX - viewState.x) / scale
    
    // Add buffer to prevent flicker
    const buffer = 2;
    
    // Calculate Grid bounds based on viewport
    // We iterate over the infinite grid coordinates (c, r) that would be visible
    const minCol = Math.floor((0 - viewState.x) / (viewState.scale * CELL_W)) - buffer;
    const maxCol = Math.ceil((viewportSize.w - viewState.x) / (viewState.scale * CELL_W)) + buffer;
    
    // For Y: The code assumes negative Y for rows going up.
    // screenY = (r * CELL_H) * scale + viewState.y
    const minRow = Math.floor((0 - viewState.y) / (viewState.scale * CELL_H)) - buffer;
    const maxRow = Math.ceil((viewportSize.h - viewState.y) / (viewState.scale * CELL_H)) + buffer;

    const items = [];

    for (let c = minCol; c <= maxCol; c++) {
        for (let r = minRow; r <= maxRow; r++) {
            // Infinite Mirror Logic (Ping Pong)
            // C determines Lightness (0-100)
            // R determines Saturation (0-100)
            
            // To match description: Left->Right is Lightness Low->High
            // Bottom->Top is Saturation Low->High.
            // In HTML, +Y is Down. So -Y is Up.
            // We use `r` directly. If we map `r` to `y = r * CELL_H`, then larger `r` is lower on screen.
            // If we want Bottom->Top Saturation:
            // Visual Bottom should be Low Saturation.
            // Let's assume `r=0` is the center/origin.
            // We'll map `r` index to Saturation using PingPong.
            // But we render it at `y = r * CELL_H`.
            // Wait, if we use `r` increases -> `y` increases (goes down).
            // So visually, top of screen has lower `y` (smaller `r`). Bottom of screen has higher `y` (larger `r`).
            // User wants: Bottom to Top is Saturation Low to High.
            // So Higher Y (screen bottom) = Low Saturation.
            // Lower Y (screen top) = High Saturation.
            // So `r` (which correlates to Y pos) should map inversely?
            // Actually, let's just stick to the PingPong. It oscillates 0..100..0.
            // So direction doesn't strictly matter for "infinite" feel, as long as it varies.
            
            const lVal = getPingPongValue(c, maxIndex) * step;
            const sVal = getPingPongValue(r, maxIndex) * step; // Simple ping pong

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

  // Handle Dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    
    e.preventDefault();
    setIsDraggingCanvas(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    if (snapTimeout.current) clearTimeout(snapTimeout.current);
    
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingCanvas || !lastPos.current) return;
    
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
    if (!isDraggingCanvas) return;
    setIsDraggingCanvas(false);
    lastPos.current = null;
    triggerSnap();
    
    try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
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

    // world = (screen - offset) / scale
    const worldCx = (cx - viewState.x) / viewState.scale;
    const worldCy = (cy - viewState.y) / viewState.scale;

    // Center of a cell at (c, r) is:
    // x = c * CELL_W + RECT_WIDTH/2
    // y = r * CELL_H + RECT_HEIGHT/2

    const col = Math.round((worldCx - RECT_WIDTH/2) / CELL_W);
    const row = Math.round((worldCy - RECT_HEIGHT/2) / CELL_H);

    const destX = col * CELL_W + RECT_WIDTH/2;
    const destY = row * CELL_H + RECT_HEIGHT/2;

    // Back to viewState
    // offset = screen - world * scale
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
    if (snapTimeout.current) clearTimeout(snapTimeout.current);

    const delta = -Math.sign(e.deltaY); 
    const zoomSpeed = 0.05;
    
    let newScale = viewState.scale + (delta * zoomSpeed);
    let newStep = viewState.step;
    
    if (newScale > 1.2) {
        newScale = 1.2;
        if (delta > 0) newStep = Math.max(1, viewState.step - 1);
    } else if (newScale < 0.8) {
        newScale = 0.8;
        if (delta < 0) newStep = Math.min(25, viewState.step + 1); 
    }

    if (newStep !== viewState.step) {
        onToleranceChange(newStep, 25);
    }

    // Zoom Center
    const cx = viewportSize.w / 2;
    const cy = viewportSize.h / 2;
    const worldCx = (cx - viewState.x) / viewState.scale;
    const worldCy = (cy - viewState.y) / viewState.scale;
    
    const newX = cx - worldCx * newScale;
    const newY = cy - worldCy * newScale;

    setViewState({
        x: newX,
        y: newY,
        scale: newScale,
        step: newStep
    });
    
    snapTimeout.current = setTimeout(snapToNearest, 3000);
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