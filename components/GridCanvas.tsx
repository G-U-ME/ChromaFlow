import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ViewState, ColorFormat, Theme, HSL } from '../types';
import { formatColor, getContrastColor, getBouncedValue } from '../utils';

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
  selectedColor: HSL;
  onColorSelect: (color: HSL) => void;
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
  selectedColor,
  onColorSelect
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const snapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  
  // Selection and Color State
  const [selectedCell, setSelectedCell] = useState<{ c: number, r: number }>({ c: 0, r: 0 });
  const [gridOrigin, setGridOrigin] = useState<{ l: number, s: number }>({ l: 50, s: 50 });
  // Store visible color codes as strings "L_S"
  const [visibleColorCodes, setVisibleColorCodes] = useState<Set<string>>(new Set());

  const prevStepRef = useRef(viewState.step);

  // --- JUMP LOGIC ---
  // Check if the external selectedColor matches our current internal selection.
  // If not, it means the user changed it via SearchBar, so we "jump" the grid.
  useEffect(() => {
      // Calculate what the current selected cell's color *should* be
      const currentL = getBouncedValue(gridOrigin.l + selectedCell.c * prevStepRef.current, 100);
      const currentS = getBouncedValue(gridOrigin.s + selectedCell.r * prevStepRef.current, 100);
      
      // Compare with epsilon for float tolerance
      const epsilon = 0.01;
      const diffL = Math.abs(currentL - selectedColor.l);
      const diffS = Math.abs(currentS - selectedColor.s);
      
      if (diffL > epsilon || diffS > epsilon) {
          // Jump needed!
          // We set the grid origin to exactly the target color
          // And reset selected cell to (0,0)
          setGridOrigin({ l: selectedColor.l, s: selectedColor.s });
          setSelectedCell({ c: 0, r: 0 });
          
          // Also recenter the view on (0,0)
          const cx = viewportSize.w / 2;
          const cy = viewportSize.h / 2;
          // (0,0) is at World(0,0). 
          // ScreenX = ViewState.x + 0 * Scale -> ViewState.x = ScreenX
          // We want (0,0) to be at Center(cx, cy).
          setViewState(prev => ({
             ...prev,
             x: cx, // Offset so that 0 is at cx
             y: cy
          }));
      }
  }, [selectedColor, viewportSize]); // Depend on selectedColor. When it changes, we check.


  useEffect(() => {
    const currentStep = viewState.step;
    if (Math.abs(currentStep - prevStepRef.current) > 0.0001) {
        const delta = prevStepRef.current - currentStep;
        setGridOrigin(prev => ({
            l: prev.l + selectedCell.c * delta,
            s: prev.s + selectedCell.r * delta
        }));
        prevStepRef.current = currentStep;
    }
  }, [viewState.step, selectedCell]);

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
    const step = viewState.step;
    
    const buffer = 2;
    // Calculate visible range
    const minCol = Math.floor((0 - viewState.x) / (viewState.scale * CELL_W)) - buffer;
    const maxCol = Math.ceil((viewportSize.w - viewState.x) / (viewState.scale * CELL_W)) + buffer;
    const minRow = Math.floor((0 - viewState.y) / (viewState.scale * CELL_H)) - buffer;
    const maxRow = Math.ceil((viewportSize.h - viewState.y) / (viewState.scale * CELL_H)) + buffer;

    const items = [];

    for (let c = minCol; c <= maxCol; c++) {
        for (let r = minRow; r <= maxRow; r++) {
            // Calculate color relative to grid origin (0,0) for stability
            const lVal = getBouncedValue(gridOrigin.l + c * step, 100);
            const sVal = getBouncedValue(gridOrigin.s + r * step, 100);

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
  }, [viewState, viewportSize, gridOrigin]);

  // Zoom Logic - Anchored to Selected Cell
  const performZoom = (newRawScale: number, pinchDelta: number = 0) => {
    if (snapTimeout.current) clearTimeout(snapTimeout.current);

    let newScale = newRawScale;
    let newStep = viewState.step;

    // Step change thresholds
    if (newScale > 1.2) {
        newScale = 1.2; 
        
        if (pinchDelta !== 0) {
             // Continuous Touch Logic for Density (Tolerance)
             // When screen > 120% continue double finger enlarge (pinchDelta > 0), 
             // Density size will be real-time change.
             const DENSITY_SENSITIVITY = 0.05;
             // Expanding fingers (delta > 0) -> finer detail (smaller step)
             // Pinching in (delta < 0) -> coarser detail (larger step)
             newStep = Math.max(1, Math.min(25, viewState.step - Math.floor(pinchDelta * DENSITY_SENSITIVITY)));
        } else {
             // Discrete Mouse/Key Logic (Fallback)
             if (newRawScale > viewState.scale) {
                 newStep = Math.min(25, Math.max(1, viewState.step - 1));
             }
        }
        
    } else if (newScale < 0.8) {
        newScale = 0.8; 
        if (pinchDelta !== 0) {
            // Continuous Touch Logic for Density (Tolerance)
            // When screen < 80% continue double finger pinch (pinchDelta < 0), 
            // Density size will be real-time change.
            const DENSITY_SENSITIVITY = 0.05;
            // Pinching in (delta < 0) -> coarser detail (larger step)
            // Expanding fingers (delta > 0) -> finer detail (smaller step)
            newStep = Math.max(1, Math.min(25, viewState.step - Math.floor(pinchDelta * DENSITY_SENSITIVITY)));
        } else {
            // Discrete Mouse/Key Logic (Fallback)
            if (newRawScale < viewState.scale) {
                 newStep = Math.min(25, Math.max(1, viewState.step + 1)); 
            }
        }
    }

    if (Math.abs(newStep - viewState.step) > 0.0001) {
        onToleranceChange(newStep, 25);
    }

    // Calculate new view position to keep SELECTED CELL fixed on screen
    
    // Current Screen Position of Selected Cell
    // Screen = Offset + World * Scale
    const selWorldX = selectedCell.c * CELL_W;
    const selWorldY = selectedCell.r * CELL_H;
    
    const selScreenX = viewState.x + selWorldX * viewState.scale;
    const selScreenY = viewState.y + selWorldY * viewState.scale;

    // New Offset = Screen - World * NewScale
    const newX = selScreenX - selWorldX * newScale;
    const newY = selScreenY - selWorldY * newScale;

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
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (pointers.current.size === 1) {
        if (e.button !== 0) return; 
        setIsDraggingCanvas(true);
        lastPos.current = { x: e.clientX, y: e.clientY };
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        if (snapTimeout.current) clearTimeout(snapTimeout.current);
    } else if (pointers.current.size === 2) {
        setIsDraggingCanvas(false);
        const pts = Array.from(pointers.current.values()) as { x: number; y: number }[];
        lastPinchDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // PINCH ZOOM
    if (pointers.current.size === 2) {
        const pts = Array.from(pointers.current.values()) as { x: number; y: number }[];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        
        if (lastPinchDist.current) {
            const pinchDelta = dist - lastPinchDist.current;
            const rawRatio = dist / lastPinchDist.current;
            // Dampen the pinch sensitivity significantly
            const sensitivity = 1;
            const ratio = 1 + (rawRatio - 1) * sensitivity;

            const newRawScale = viewState.scale * ratio;
            performZoom(newRawScale, pinchDelta);
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
        if (isDraggingCanvas) {
            setIsDraggingCanvas(false);
            triggerSnap();
        }
        lastPos.current = null;
    } else if (pointers.current.size === 1) {
        const p = pointers.current.values().next().value as { x: number; y: number };
        lastPos.current = { x: p.x, y: p.y };
        setIsDraggingCanvas(true);
    }
  };

  const handleCellClick = (c: number, r: number, l: number, s: number) => {
      // 1. Update Selection
      setSelectedCell({ c, r });
      
      // Notify App
      onColorSelect({ h: hue, s, l });
      
      // 2. Toggle Visibility of this color
      const colorKey = `${l.toFixed(2)}_${s.toFixed(2)}`;
      
      setVisibleColorCodes(prev => {
          const next = new Set(prev);
          if (next.has(colorKey)) {
              next.delete(colorKey);
          } else {
              next.add(colorKey);
          }
          return next;
      });
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
    const delta = -Math.sign(e.deltaY); 
    const zoomSpeed = 0.05;
    const newRawScale = viewState.scale + (delta * zoomSpeed);
    
    performZoom(newRawScale);
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
            const isSelected = selectedCell.c === item.c && selectedCell.r === item.r;
            const colorKey = `${item.l.toFixed(2)}_${item.s.toFixed(2)}`;
            const isCodeVisible = visibleColorCodes.has(colorKey);
            
            const hslString = `hsl(${hue}, ${item.s}%, ${item.l}%)`;
            const code = formatColor({ h: hue, s: item.s, l: item.l }, colorFormat);
            const contrastColor = getContrastColor({ h: hue, s: item.s, l: item.l });

            return (
                <div key={item.key} className="absolute group" style={{
                    transform: `translate(${item.x}px, ${item.y}px)`, 
                    width: RECT_WIDTH,
                    height: RECT_HEIGHT,
                    willChange: 'transform',
                    zIndex: isSelected ? 10 : 1
                }}>
                    <div 
                        className={`w-full h-full rounded-[8px] transition-transform duration-200 ease-out origin-center
                            hover:scale-110 active:scale-95 no-select flex items-center justify-center`}
                        style={{ 
                            backgroundColor: hslString,
                            // Use the contrast color for the ring if selected
                            boxShadow: isSelected 
                                ? `0 0 0 4px ${contrastColor}, 0px 0px 15px rgba(0, 0, 0, 0.5)` 
                                : 'none'
                        }}
                        onPointerUp={(e) => {
                            if (dragStartPos.current) {
                                const dist = Math.sqrt(
                                    Math.pow(e.clientX - dragStartPos.current.x, 2) + 
                                    Math.pow(e.clientY - dragStartPos.current.y, 2)
                                );
                                if (dist < 5) {
                                    handleCellClick(item.c, item.r, item.l, item.s);
                                }
                            }
                        }}
                    >
                        {isCodeVisible && (
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