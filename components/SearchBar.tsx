import React, { useState, useEffect, useRef } from 'react';
import { Theme, ColorFormat, HSL } from '../types';
import { HSLToRGB, RGBToHSL, HexToRGB, RGBToHex } from '../utils';

interface SearchBarProps {
    currentColor: HSL;
    onColorChange: (color: HSL) => void;
    colorFormat: ColorFormat;
    theme: Theme;
}

const SearchBar: React.FC<SearchBarProps> = ({
    currentColor,
    onColorChange,
    colorFormat,
    theme
}) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // We keep local state for inputs to allow typing without jitter
    // However, we must sync with currentColor when it changes externally
    const [rgbValues, setRgbValues] = useState<[string, string, string]>(['0', '0', '0']);
    const [hslValues, setHslValues] = useState<[string, string, string]>(['0', '0', '0']);
    const [hexValues, setHexValues] = useState<string[]>(Array(6).fill('0'));
    
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    
    const isDark = theme === 'dark';
    const glassPanelClass = `
        backdrop-blur-xl 
        ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-white/60 border-black/5 text-gray-900'}
        border shadow-[0_8px_32px_rgba(0,0,0,0.12)]
        transition-all duration-500 ease-out
    `;

    // Sync Local State with Current Color
    useEffect(() => {
        const { h, s, l } = currentColor;
        
        // HSL
        const fmt = (n: number) => Number.isInteger(n) ? n.toString() : n.toFixed(2);
        setHslValues([fmt(h), fmt(s), fmt(l)]);

        // RGB
        const [r, g, b] = HSLToRGB(h, s, l);
        setRgbValues([r.toString(), g.toString(), b.toString()]);

        // HEX
        const hex = RGBToHex(r, g, b).replace('#', ''); // returns "RRGGBB"
        setHexValues(hex.split(''));

    }, [currentColor]);

    const handleRGBChange = (index: number, valStr: string) => {
        // Regex to allow digits only
        if (!/^\d*$/.test(valStr)) return;

        let val = valStr === '' ? 0 : parseInt(valStr, 10);
        
        // Constraint: 0-256 (exclusive) -> 0-255
        if (val > 255) val = 255;

        const newValues = [...rgbValues] as [string, string, string];
        // If empty string was passed (delete), we conceptually treat as 0 for conversion,
        // but might want to keep displaying empty string while typing? 
        // Prompt says: "if delete all digits, becomes 0".
        // So if valStr is empty, it becomes '0'.
        newValues[index] = valStr === '' ? '0' : val.toString();
        
        setRgbValues(newValues);

        const [r, g, b] = newValues.map(v => parseInt(v, 10));
        onColorChange(RGBToHSL(r, g, b));
    };

    const handleHSLChange = (index: number, valStr: string) => {
         // Regex to allow digits and decimal point? 
         // Prompt says: "User edits -> integer (floor)". 
         // "First input... max 3 digits... 0-360"
         // "2nd/3rd... max 3 digits... 0-101"
         
         // If user types, we strictly force integer logic per prompt "becomes downward rounded integer"
         // Actually prompt says: "Once user changes... all 3 values become floor integers".
         
         if (!/^\d*$/.test(valStr)) return;

         let val = valStr === '' ? 0 : parseInt(valStr, 10);
         const max = index === 0 ? 359 : 100;

         if (val > max) val = max;

         const newValues = [...hslValues] as [string, string, string];
         
         // If we edit one, we force all to be integers based on current real values if they were decimals?
         // Or just the one we edited?
         // Prompt: "Once user modifies... immediately let search bar 3 values all become floor integers"
         
         // So we should read current values, floor them, update the modified one.
         const currentFloored = hslValues.map(v => Math.floor(parseFloat(v)).toString());
         currentFloored[index] = valStr === '' ? '0' : val.toString();
         
         setHslValues(currentFloored as [string, string, string]);

         const [h, s, l] = currentFloored.map(v => parseInt(v, 10));
         onColorChange({ h, s, l });
    };

    const handleHexInput = (index: number, key: string) => {
        // Check if valid hex char
        if (!/^[0-9a-fA-F]$/.test(key)) return;

        const upperKey = key.toUpperCase();
        const newValues = [...hexValues];
        
        // "Input directly replaces content"
        newValues[index] = upperKey;
        setHexValues(newValues);

        // Auto focus next
        if (index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Update Color
        const hexStr = "#" + newValues.join('');
        const rgb = HexToRGB(hexStr);
        if (rgb) {
            onColorChange(RGBToHSL(rgb[0], rgb[1], rgb[2]));
        }
    };

    const handleHexKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            const newValues = [...hexValues];
            newValues[index] = '0'; // "Delete operation makes char 0"
            setHexValues(newValues);
            
            // Logic for backspace focus? Not specified, but usually stays or goes back.
            // Prompt only says "Delete operation makes... 0".
            
            // Update Color
            const hexStr = "#" + newValues.join('');
            const rgb = HexToRGB(hexStr);
            if (rgb) {
                onColorChange(RGBToHSL(rgb[0], rgb[1], rgb[2]));
            }
        }
    };

    // Render Helpers
    const renderRGB = () => (
        <div className="flex items-center gap-0.5 sm:gap-1 text-sm sm:text-base">
            {[0, 1, 2].map(i => (
                <React.Fragment key={i}>
                    <input
                        className={`bg-transparent text-center outline-none font-mono font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
                        style={{ width: `${Math.max(1, rgbValues[i].length)}ch` }}
                        value={rgbValues[i]}
                        onChange={(e) => handleRGBChange(i, e.target.value)}
                        maxLength={3}
                    />
                    {i < 2 && <span className="opacity-50 font-bold">,</span>}
                </React.Fragment>
            ))}
        </div>
    );

    const renderHSL = () => (
        <div className="flex items-center gap-0.5 sm:gap-1 text-sm sm:text-base">
            <input
                className={`bg-transparent text-right outline-none font-mono font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
                style={{ width: `${Math.max(1, hslValues[0].length)}ch` }}
                value={hslValues[0]}
                onChange={(e) => handleHSLChange(0, e.target.value)}
                maxLength={3}
            />
            <span className="opacity-50 font-bold mr-0.5 sm:mr-1">,</span>
            
            <input
                className={`bg-transparent text-right outline-none font-mono font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
                style={{ width: `${Math.max(1, hslValues[1].length)}ch` }}
                value={hslValues[1]}
                onChange={(e) => handleHSLChange(1, e.target.value)}
                maxLength={3}
            />
            <span className="opacity-50 font-bold mr-0.5 sm:mr-1">%,</span>

            <input
                className={`bg-transparent text-right outline-none font-mono font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
                style={{ width: `${Math.max(1, hslValues[2].length)}ch` }}
                value={hslValues[2]}
                onChange={(e) => handleHSLChange(2, e.target.value)}
                maxLength={3}
            />
            <span className="opacity-50 font-bold">%</span>
        </div>
    );

    const renderHEX = () => (
        <div className="flex items-center gap-0.5 sm:gap-1 text-sm sm:text-base">
            <span className="font-bold opacity-50 mr-0.5 sm:mr-1">#</span>
            {hexValues.map((char, i) => (
                <input
                    key={i}
                    ref={el => inputRefs.current[i] = el}
                    className={`bg-transparent text-center outline-none font-mono font-bold border-b-2 ${isDark ? 'border-white/20 focus:border-white' : 'border-black/10 focus:border-black'}`}
                    style={{ width: '1.5ch' }}
                    value={char}
                    onKeyDown={(e) => {
                        // Handle alphanumeric
                        if (/^[0-9a-zA-Z]$/.test(e.key)) {
                            e.preventDefault(); // Prevent double input since we handle it manually
                            handleHexInput(i, e.key);
                        } else {
                            handleHexKeyDown(i, e);
                        }
                    }}
                    onChange={() => {}} // Handled by onKeyDown to support the "replace" behavior strictly
                    onFocus={(e) => e.target.select()} // Auto select for easy replace?
                />
            ))}
        </div>
    );

    return (
        <div 
            className={`absolute bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 flex items-center overflow-hidden ${glassPanelClass} ${isOpen ? 'rounded-full pl-3 pr-5 sm:pr-6 h-10 sm:h-14' : 'rounded-full w-10 h-10 sm:w-14 sm:h-14 justify-center cursor-pointer hover:scale-105'}`}
            onClick={() => !isOpen && setIsOpen(true)}
            style={{ transitionProperty: 'width, height, border-radius, background-color' }}
        >
             <div 
                className="flex items-center justify-center flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 cursor-pointer"
                onClick={(e) => {
                    if (isOpen) {
                        e.stopPropagation();
                        setIsOpen(false);
                    }
                }}
             >
                {/* Magnifying Glass Icon */}
                <svg className="w-4 h-4 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
             </div>

             {/* Expanded Content */}
             <div 
                className={`flex items-center ml-4 transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none absolute'}`}
             >
                {colorFormat === 'RGB' && renderRGB()}
                {colorFormat === 'HSL' && renderHSL()}
                {colorFormat === 'HEX' && renderHEX()}
             </div>
        </div>
    );
};

export default SearchBar;