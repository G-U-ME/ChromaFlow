import React, { useState, useRef } from 'react';
import { Theme, HSL } from '../types';
import { RGBToHSL, RGBToHex } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageColorPickerProps {
    theme: Theme;
    onColorSelect: (color: HSL) => void;
}

const ImageColorPicker: React.FC<ImageColorPickerProps> = ({ theme, onColorSelect }) => {
    const [loading, setLoading] = useState(false);
    const [colors, setColors] = useState<string[]>([]);
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isDark = theme === 'dark';

    const glassPanelClass = `
        backdrop-blur-xl 
        ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-white/60 border-black/5 text-gray-900'}
        border shadow-[0_8px_32px_rgba(0,0,0,0.12)]
        transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
    `;

    const handleButtonClick = () => {
        if (showResult) {
            // Reset
            setColors([]);
            setThumbnail(null);
            setShowResult(false);
        } else {
            fileInputRef.current?.click();
        }
    };

    // Redmean color distance approximation
    const redmeanColorDistance = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) => {
        const rBar = (r1 + r2) / 2;
        const deltaR = r1 - r2;
        const deltaG = g1 - g2;
        const deltaB = b1 - b2;
        
        return Math.sqrt(
            (2 + rBar / 256) * (deltaR * deltaR) + 
            4 * (deltaG * deltaG) + 
            (2 + (255 - rBar) / 256) * (deltaB * deltaB)
        );
    };

    const extractColors = (imageSrc: string) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Resize for performance (max 300px)
            const maxSize = 300;
            let w = img.width;
            let h = img.height;
            if (w > h) {
                if (w > maxSize) {
                    h = Math.round((h * maxSize) / w);
                    w = maxSize;
                }
            } else {
                if (h > maxSize) {
                    w = Math.round((w * maxSize) / h);
                    h = maxSize;
                }
            }
            
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            
            const imageData = ctx.getImageData(0, 0, w, h).data;
            const pixelCount = w * h;
            
            // Retrieve settings from localStorage or defaults
            const sampleStep = parseInt(localStorage.getItem('IMG_PICKER_SAMPLE_STEP') || '16');
            const q = parseInt(localStorage.getItem('IMG_PICKER_QUANT_FACTOR') || '10');
            const minDistance = parseInt(localStorage.getItem('IMG_PICKER_MIN_DIST') || '45');
            
            // Color Quantization & Histogram
            const colorMap: { [key: string]: { r: number, g: number, b: number, count: number } } = {};
            
            for (let i = 0; i < pixelCount * 4; i += 4 * sampleStep) {
                const r = imageData[i];
                const g = imageData[i + 1];
                const b = imageData[i + 2];
                const a = imageData[i + 3];
                
                if (a < 128) continue; // Skip transparent

                // Quantize
                const qr = Math.round(r / q) * q;
                const qg = Math.round(g / q) * q;
                const qb = Math.round(b / q) * q;
                
                // Clamp values to 0-255
                const cr = Math.min(255, Math.max(0, qr));
                const cg = Math.min(255, Math.max(0, qg));
                const cb = Math.min(255, Math.max(0, qb));

                const key = `${cr},${cg},${cb}`;
                if (!colorMap[key]) {
                    colorMap[key] = { r: cr, g: cg, b: cb, count: 0 };
                }
                colorMap[key].count++;
            }

            // Convert to array and sort
            const sortedColors = Object.values(colorMap).sort((a, b) => b.count - a.count);
            
            // Select distinct colors using Redmean distance
            const distinctColors: string[] = [];
            
            for (const c of sortedColors) {
                if (distinctColors.length >= 7) break;
                
                const isDistinct = distinctColors.every(existingHex => {
                    const bigint = parseInt(existingHex.slice(1), 16);
                    const er = (bigint >> 16) & 255;
                    const eg = (bigint >> 8) & 255;
                    const eb = bigint & 255;
                    
                    const dist = redmeanColorDistance(c.r, c.g, c.b, er, eg, eb);
                    return dist > minDistance;
                });

                if (isDistinct) {
                    distinctColors.push(RGBToHex(c.r, c.g, c.b));
                }
            }

            setColors(distinctColors);
            setLoading(false);
            setShowResult(true);
        };
        img.src = imageSrc;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            setThumbnail(result);
            extractColors(result);
        };
        reader.readAsDataURL(file);
        
        // Reset input so same file can be selected again if needed
        e.target.value = '';
    };

    const handleColorClick = (hex: string) => {
        // Parse hex manually or use helper
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            const r = parseInt(result[1], 16);
            const g = parseInt(result[2], 16);
            const b = parseInt(result[3], 16);
            onColorSelect(RGBToHSL(r, g, b));
        }
    };

    // Position: above search bar.
    // Mobile SearchBar is bottom-16 (4rem), Height 2.5rem -> Ends ~6.5rem.
    // So we need to be above 7rem. Let's use bottom-28 (7rem).
    // Desktop SearchBar is bottom-6 (1.5rem), Height 3.5rem -> Ends ~5rem.
    // So bottom-24 (6rem) is fine.

    return (
        <div className="absolute bottom-28 left-4 sm:bottom-24 sm:left-6 z-50 flex flex-col items-start gap-2 pointer-events-none">
            
            <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
                ref={fileInputRef} 
            />

            {/* Thumbnail (Above) */}
            {showResult && thumbnail && (
                <div className={`pointer-events-auto origin-bottom-left animate-fade-in-up mb-2 p-1 ${glassPanelClass} rounded-xl`}>
                     <img 
                        src={thumbnail} 
                        alt="Uploaded" 
                        className="h-16 w-auto max-w-[120px] object-cover rounded-lg border border-white/10"
                     />
                </div>
            )}

            {/* Main Capsule */}
            <motion.div 
                layout
                className={`pointer-events-auto flex items-center ${glassPanelClass} rounded-full h-10 sm:h-14 overflow-hidden
                            ${showResult ? 'pl-1 pr-2 sm:pl-2' : 'w-10 sm:w-14 justify-center hover:scale-105 cursor-pointer'}`}
                onClick={(e) => {
                    if (!showResult) handleButtonClick();
                }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            >
                {loading ? (
                     <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current opacity-50 mx-auto" />
                ) : showResult ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center h-full whitespace-nowrap"
                    >
                        {/* Close/Reset Button on Left */}
                        <button 
                            className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 mr-1"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleButtonClick(); // Resets
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6L6 18M6 6l12 12"></path>
                            </svg>
                        </button>
                        
                        {/* Colors */}
                        <div className="flex items-center gap-1 sm:gap-2">
                            {colors.map((c, i) => (
                                <motion.button
                                    key={i}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-white/20 shadow-sm hover:scale-110 flex-shrink-0"
                                    style={{ backgroundColor: c }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleColorClick(c);
                                    }}
                                    title={c}
                                />
                            ))}
                        </div>
                    </motion.div>
                ) : (
                    /* Upload Icon */
                    <motion.svg 
                        layoutId="upload-icon"
                        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </motion.svg>
                )}
            </motion.div>
        </div>
    );
};

export default ImageColorPicker;
