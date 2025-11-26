
import React, { useState, useRef } from 'react';
import { ViewState, Theme, ColorFormat } from '../types';
import ColorWheel from './ColorWheel';

interface FloatingUIProps {
    viewState: ViewState;
    currentHue: number;
    setHue: (h: number) => void;
    toleranceData: { val: number, max: number, visible: boolean };
    theme: Theme;
    toggleTheme: () => void;
    colorFormat: ColorFormat;
    toggleColorFormat: () => void;
    showGridLabels: boolean;
    toggleGridLabels: () => void;
}

const FloatingUI: React.FC<FloatingUIProps> = ({
    currentHue,
    setHue,
    toleranceData,
    theme,
    toggleTheme,
    colorFormat,
    toggleColorFormat,
    showGridLabels,
    toggleGridLabels
}) => {
    const [wheelOpen, setWheelOpen] = useState(false);
    const isDark = theme === 'dark';

    // Glassmorphism base styles
    const glassPanelClass = `
        backdrop-blur-xl 
        ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-white/60 border-black/5 text-gray-900'}
        border shadow-[0_8px_32px_rgba(0,0,0,0.12)]
        transition-all duration-300 ease-out
    `;

    const iconButtonClass = `
        w-10 h-10 flex items-center justify-center rounded-full
        hover:bg-current hover:bg-opacity-10 
        active:scale-90 transition-transform cursor-pointer select-none
    `;

    return (
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden font-sans">
            
            {/* Click-outside layer to close wheel */}
            {wheelOpen && (
                <div 
                    className="fixed inset-0 bg-transparent pointer-events-auto"
                    onClick={() => setWheelOpen(false)}
                />
            )}

            {/* Tolerance/Density Indicator (Top Center - Minimalist) */}
            <div 
                className={`absolute top-6 left-1/2 -translate-x-1/2 transition-all duration-500 ease-out ${toleranceData.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
            >
                <div className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest flex items-center gap-3 ${glassPanelClass}`}>
                    <span className="opacity-60">DENSITY</span>
                    <div className="w-24 h-1 bg-current opacity-20 rounded-full overflow-hidden relative">
                        <div 
                            className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-all duration-200"
                            style={{ width: `${((toleranceData.max - toleranceData.val) / (toleranceData.max - 1)) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* EXPANDABLE COLOR CONTROLLER */}
            {/* This container anchors the entire color tool interaction */}
            <div 
                className="absolute transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) pointer-events-auto"
                style={{
                    // Initial position: top-6 (24px), left-6 (24px)
                    // Expanded position: shift out by 100px (reduced from 130px) to better fit the smaller wheel
                    top: '24px',
                    left: '24px',
                    transform: wheelOpen ? 'translate(100px, 100px)' : 'translate(0, 0)',
                    zIndex: 50
                }}
            >
                {/* 1. The Color Wheel Component (Rendered centered on this anchor) */}
                {/* We pass a custom style to center it absolutely relative to this div */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex justify-center items-center">
                    <ColorWheel 
                        isOpen={wheelOpen} 
                        currentHue={currentHue}
                        setHue={setHue}
                        theme={theme}
                        colorFormat={colorFormat}
                    />
                </div>

                {/* 2. The Trigger Button (The visual center) */}
                <div 
                    className="relative group"
                    onClick={() => setWheelOpen(!wheelOpen)}
                >
                    <div 
                        className={`relative w-12 h-12 rounded-full border-[3px] shadow-lg cursor-pointer transition-transform duration-300 hover:scale-105 active:scale-95 ${isDark ? 'border-[#333]' : 'border-white'}`}
                        style={{ backgroundColor: `hsl(${currentHue}, 100%, 50%)` }}
                    >
                        {/* Inner highlight ring for depth */}
                        <div className="absolute inset-0 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)]" />
                    </div>
                </div>
            </div>

            {/* Top Right: Unified Control Island */}
            <div className={`absolute top-6 right-6 flex items-center p-1.5 rounded-full pointer-events-auto ${glassPanelClass}`}>
                
                {/* Theme Toggle */}
                <button 
                    className={iconButtonClass} 
                    onClick={toggleTheme}
                    title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
                >
                    {isDark ? (
                        /* Sun Icon */
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="5"></circle>
                            <line x1="12" y1="1" x2="12" y2="3"></line>
                            <line x1="12" y1="21" x2="12" y2="23"></line>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                            <line x1="1" y1="12" x2="3" y2="12"></line>
                            <line x1="21" y1="12" x2="23" y2="12"></line>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                        </svg>
                    ) : (
                        /* Moon Icon */
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                        </svg>
                    )}
                </button>

                <div className="w-px h-6 bg-current opacity-10 mx-1"></div>

                {/* Color Format Toggle */}
                <button 
                    className={`${iconButtonClass} w-auto px-3 font-mono text-xs font-bold`} 
                    onClick={toggleColorFormat}
                    title="Change Color Format"
                >
                    {colorFormat}
                </button>

                <div className="w-px h-6 bg-current opacity-10 mx-1"></div>

                {/* Grid Labels Toggle */}
                <button 
                    className={iconButtonClass} 
                    onClick={toggleGridLabels}
                    title="Toggle Grid Labels"
                    style={{ opacity: showGridLabels ? 1 : 0.5 }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="3" y1="15" x2="21" y2="15"></line>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                        <line x1="15" y1="3" x2="15" y2="21"></line>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default FloatingUI;
