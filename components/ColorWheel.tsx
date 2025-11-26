
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { describeArc, formatColor } from '../utils';
import { Theme, ColorFormat } from '../types';

interface ColorWheelProps {
    isOpen: boolean;
    currentHue: number;
    setHue: (h: number) => void;
    theme: Theme;
    colorFormat: ColorFormat;
}

const ColorWheel: React.FC<ColorWheelProps> = ({ 
    isOpen, 
    currentHue,
    setHue, 
    theme, 
    colorFormat 
}) => {
    // ---------------- Constants ----------------
    const R_RING_MIN = 60;
    const R_RING_MAX = 90;
    const WHEEL_SIZE = 240; 

    // ---------------- State ----------------
    const [isDragging, setIsDragging] = useState(false);
    const [tolerance, setTolerance] = useState(5); 
    const [showDensity, setShowDensity] = useState(false);
    
    const svgRef = useRef<SVGSVGElement>(null);
    const centerRef = useRef<{x: number, y: number}>({x: 0, y: 0});
    const stripRef = useRef<HTMLDivElement>(null);

    // Limits for tolerance
    const MIN_TOLERANCE = 1;
    const MAX_TOLERANCE = 365;

    // ---------------- Helpers ----------------
    const getAngle = (clientX: number, clientY: number) => {
        const { x, y } = centerRef.current;
        let rad = Math.atan2(clientY - y, clientX - x);
        let deg = rad * (180 / Math.PI);
        deg += 90; 
        if (deg < 0) deg += 360;
        return deg;
    };

    const updateCenter = () => {
        if (svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            centerRef.current = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        }
    };

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => {
                updateCenter();
                setTimeout(updateCenter, 550);
            });
            window.addEventListener('resize', updateCenter);
        }
        return () => window.removeEventListener('resize', updateCenter);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setShowDensity(true);
            const timer = setTimeout(() => setShowDensity(false), 3000);
            return () => clearTimeout(timer);
        } else {
            setShowDensity(false);
        }
    }, [tolerance, isOpen]);

    // ---------------- Wheel Interaction ----------------

    const handlePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        updateCenter();
        setIsDragging(true);
        setHue(getAngle(e.clientX, e.clientY)); 
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        e.stopPropagation();
        e.preventDefault();
        setHue(getAngle(e.clientX, e.clientY));
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        try { (e.target as Element).releasePointerCapture(e.pointerId); } catch(err) {}
    };

    // ---------------- Strip Interaction ----------------

    const handleStripWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = Math.sign(e.deltaY); 
        setTolerance(prev => {
            const next = prev + delta;
            return Math.max(MIN_TOLERANCE, Math.min(MAX_TOLERANCE, next));
        });
    };

    const handleHueClick = (offsetIndex: number) => {
        const diff = offsetIndex * tolerance;
        const newHue = (currentHue + diff + 360) % 360;
        setHue(newHue);
    };

    // ---------------- Visuals ----------------
    const isDark = theme === 'dark';
    const handleColor = isDark ? 'white' : 'black';

    const glassCapsuleClass = `
        backdrop-blur-xl border
        ${isDark ? 'bg-black/60 border-white/10 text-white' : 'bg-white/70 border-black/10 text-gray-900'}
        shadow-[0_8px_32px_rgba(0,0,0,0.12)]
        rounded-2xl flex items-center justify-center font-mono text-sm
    `;

    const hueStripItems = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const offset = i - 3;
            const h = (currentHue + (offset * tolerance) + 360) % 360;
            return { offset, h };
        });
    }, [currentHue, tolerance]);

    return (
        <div 
            className={`relative pointer-events-none transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
            style={{ width: 0, height: 0 }}
        >
            {/* 1. MAIN COLOR RING (Centered) */}
            <div 
                className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2"
                style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
            >
                <svg 
                    ref={svgRef}
                    width="100%" 
                    height="100%" 
                    viewBox={`-${WHEEL_SIZE/2} -${WHEEL_SIZE/2} ${WHEEL_SIZE} ${WHEEL_SIZE}`}
                    className="drop-shadow-2xl overflow-visible" 
                >
                    <g 
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        className="cursor-pointer pointer-events-auto"
                    >
                        <foreignObject 
                            x={-R_RING_MAX} 
                            y={-R_RING_MAX} 
                            width={R_RING_MAX * 2} 
                            height={R_RING_MAX * 2}
                            style={{ pointerEvents: 'none' }} 
                        >
                            <div 
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    background: 'conic-gradient(from 0deg at 50% 50%, red, yellow, lime, aqua, blue, magenta, red)',
                                    mask: `radial-gradient(transparent ${R_RING_MIN}px, black ${R_RING_MIN + 0.5}px)`,
                                    WebkitMask: `radial-gradient(transparent ${R_RING_MIN}px, black ${R_RING_MIN + 0.5}px)`
                                }}
                            />
                        </foreignObject>
                        
                        <path 
                            d={describeArc(0, 0, R_RING_MIN, R_RING_MAX, 0, 359.99)}
                            fill="transparent"
                        />

                        {hueStripItems.map((item) => {
                            if (item.offset === 0) return null;
                            return (
                                <g key={item.offset} transform={`rotate(${item.h})`} className="transition-transform duration-75">
                                    <circle 
                                        cx="0" cy={-(R_RING_MIN + R_RING_MAX)/2} 
                                        r="3" 
                                        fill={isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)"}
                                        stroke="none"
                                        className="pointer-events-none"
                                    />
                                </g>
                            );
                        })}

                        <g transform={`rotate(${currentHue})`}>
                            <circle 
                                cx="0" cy={-(R_RING_MIN + R_RING_MAX)/2} 
                                r="8" 
                                fill="transparent" 
                                stroke={handleColor} 
                                strokeWidth="2"
                                className="pointer-events-none"
                            />
                            <circle 
                                cx="0" cy={-(R_RING_MIN + R_RING_MAX)/2} 
                                r="4" 
                                fill={handleColor} 
                                className="pointer-events-none"
                            />
                        </g>
                    </g>
                </svg>
            </div>

            {/* 2. HUE STRIP (Vertical, Right) */}
            <div 
                ref={stripRef}
                className={`absolute top-0 left-[120px] -translate-y-1/2 h-[220px] w-12 rounded-full py-2 flex flex-col items-center justify-between ${glassCapsuleClass} pointer-events-auto cursor-ns-resize`}
                onWheel={handleStripWheel}
                title="Scroll to adjust density"
            >
                {hueStripItems.map((item) => {
                    const isCenter = item.offset === 0;
                    return (
                        <div 
                            key={item.offset}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleHueClick(item.offset);
                            }}
                            className={`
                                relative rounded-full transition-all duration-200 cursor-pointer
                                ${isCenter 
                                    ? `w-8 h-8 ring-2 ring-offset-1 z-10 scale-110 ${isDark ? 'ring-white ring-offset-black' : 'ring-black ring-offset-white'}` 
                                    : 'w-6 h-6 hover:scale-110 opacity-80 hover:opacity-100'}
                            `}
                            style={{ 
                                backgroundColor: `hsl(${item.h}, 100%, 50%)`,
                            }}
                        >
                             {isCenter && (
                                <div className={`absolute inset-0 rounded-full ring-1 inset-ring ${isDark ? 'ring-white/50' : 'ring-black/20'}`} />
                             )}
                        </div>
                    );
                })}
            </div>

            {/* 3. DENSITY BAR (Vertical, Right of Strip, Transient) */}
            <div 
                className={`absolute top-0 left-[176px] -translate-y-1/2 h-[220px] flex items-center transition-opacity duration-500 pointer-events-none ${showDensity ? 'opacity-100' : 'opacity-0'}`}
            >
                 <div className={`w-1.5 h-full rounded-full overflow-hidden relative ${isDark ? 'bg-white/20' : 'bg-black/10'}`}>
                    <div 
                        className="absolute bottom-0 left-0 w-full bg-indigo-500 rounded-full transition-all duration-200"
                        style={{ height: `${((MAX_TOLERANCE - tolerance) / (MAX_TOLERANCE - MIN_TOLERANCE)) * 100}%` }}
                    />
                </div>
            </div>

            {/* 4. COLOR CODE CAPSULE (Bottom) */}
            <div className={`absolute top-[120px] left-0 -translate-x-1/2 px-4 py-2 pointer-events-auto ${glassCapsuleClass}`}>
                <span className="font-bold opacity-60">H {Math.round(currentHue)}°</span>
                <span className="w-px h-4 bg-current opacity-20 mx-3"></span>
                <span className="font-bold select-all min-w-[80px] text-center">
                    {formatColor({ h: currentHue, s: 100, l: 50 }, colorFormat)}
                </span>
            </div>
        </div>
    );
};

export default ColorWheel;
