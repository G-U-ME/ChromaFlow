
import React, { useState, useRef } from 'react';
import { ViewState, Theme, ColorFormat, HSL } from '../types';
import ColorWheel from './ColorWheel';
import SearchBar from './SearchBar';
import SettingsModal from './SettingsModal';
import AISearch from './AISearch';

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
    currentColor: HSL;
    onColorChange: (color: HSL) => void;
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
    toggleGridLabels,
    currentColor,
    onColorChange
}) => {
    const [wheelOpen, setWheelOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const isDark = theme === 'dark';

    // Glassmorphism base styles
    const glassPanelClass = `
        backdrop-blur-xl 
        ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-white/60 border-black/5 text-gray-900'}
        border shadow-[0_8px_32px_rgba(0,0,0,0.12)]
        transition-all duration-300 ease-out
    `;

    const iconButtonClass = `
        w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full
        ${isDark ? 'hover:bg-white/20' : 'hover:bg-black/10'} 
        active:scale-90 transition-transform cursor-pointer select-none
    `;

    return (
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden font-sans">
            
            {/* Modals */}
            <div className="pointer-events-auto">
                <SettingsModal 
                    isOpen={settingsOpen} 
                    onClose={() => setSettingsOpen(false)} 
                    theme={theme} 
                />
            </div>

            {/* Bottom Left: Search Bar */}
            <div className="pointer-events-auto">
                <SearchBar 
                    currentColor={currentColor}
                    onColorChange={onColorChange}
                    colorFormat={colorFormat}
                    theme={theme}
                />
            </div>

            {/* Bottom Center: AI Search */}
            <div className="pointer-events-auto">
                <AISearch 
                    theme={theme}
                    onColorSelect={onColorChange}
                    openSettings={() => setSettingsOpen(true)}
                />
            </div>

            {/* Top Right: Settings Trigger */}
            <div className={`absolute top-4 right-4 sm:top-6 sm:right-6 pointer-events-auto ${glassPanelClass} rounded-full`}>
                 <button 
                    className={iconButtonClass}
                    onClick={() => setSettingsOpen(true)}
                    title="Settings"
                 >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                 </button>
            </div>

            {/* Tolerance/Density Indicator (Top Center - Minimalist) */}
            <div 
                className={`absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 transition-all duration-500 ease-out ${toleranceData.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
            >
                <div className={`px-3 py-1 sm:px-4 sm:py-2 rounded-full text-xs font-bold tracking-widest flex items-center gap-3 ${glassPanelClass}`}>
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
                className={`absolute top-4 left-4 sm:top-6 sm:left-6 transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) pointer-events-auto z-50
                            ${wheelOpen ? 'translate-x-[80px] translate-y-[80px] sm:translate-x-[100px] sm:translate-y-[100px]' : 'translate-x-0 translate-y-0'}`}
            >
                {/* 1. The Color Wheel Component (Rendered centered on this anchor) */}
                {/* We pass a custom style to center it absolutely relative to this div */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex justify-center items-center transform scale-75 sm:scale-100 origin-center">
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
                        className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full border-[3px] shadow-lg cursor-pointer transition-transform duration-300 hover:scale-105 active:scale-95 ${isDark ? 'border-[#333]' : 'border-white'}`}
                        style={{ backgroundColor: `hsl(${currentHue}, 100%, 50%)` }}
                    >
                        {/* Inner highlight ring for depth */}
                        <div className="absolute inset-0 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)]" />
                    </div>
                </div>
            </div>

            {/* Bottom Right: Unified Control Island */}
            <div className={`absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex flex-col items-center p-1 sm:p-1.5 rounded-full pointer-events-auto ${glassPanelClass}`}>
                
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

                <div className="h-px w-6 bg-current opacity-10 my-1"></div>

                {/* Color Format Toggle */}
                <button 
                    className={`${iconButtonClass} h-auto py-1 font-mono text-[15px] font-bold`} 
                    onClick={toggleColorFormat}
                    title="Change Color Format"
                >
                    {colorFormat}
                </button>

                <div className="h-px w-6 bg-current opacity-10 my-1"></div>

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
