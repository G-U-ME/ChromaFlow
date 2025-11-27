import React, { useState, useRef, useEffect } from 'react';
import { Theme, HSL } from '../types';
import { HexToRGB, RGBToHSL } from '../utils';

interface AISearchProps {
    theme: Theme;
    onColorSelect: (color: HSL) => void;
    openSettings: () => void;
}

const AISearch: React.FC<AISearchProps> = ({ theme, onColorSelect, openSettings }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [showResult, setShowResult] = useState(false);
    const [generatedColors, setGeneratedColors] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const isDark = theme === 'dark';

    const glassPanelClass = `
        backdrop-blur-xl 
        ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-white/60 border-black/5 text-gray-900'}
        border shadow-[0_8px_32px_rgba(0,0,0,0.12)]
        transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
    `;

    const handleSend = async () => {
        if (!prompt.trim()) return;

        const apiKey = localStorage.getItem('GEMINI_API_KEY');
        if (!apiKey) {
            openSettings();
            return;
        }

        setLoading(true);
        setIsExpanded(false); // Contract to circle during loading
        setError(null);

        try {
            const systemInstruction = "请根据以上内容，生成1-7个相符的HEX颜色代码，以JSON格式输出。如果是经典的颜色名称，如“卡其色”，则只需给出这个名称对应的一个颜色即可。请注意，最终的输出以JSON格式只输出HEX颜色代码。";
            const finalPrompt = `${prompt}\n\n${systemInstruction}`;

            // Construct the API request
            // Using gemini-1.5-flash as a safe default if the user-specified model 'gemini-3-pro-preview' fails or doesn't exist.
            // However, strictly following the user request to use 'gemini-3-pro-preview'.
            // Note: If this model doesn't exist, this will fail.
            const modelName = 'gemini-3-pro-preview'; 
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: finalPrompt }]
                    }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!response.ok) {
                // Fallback logic or error handling
                // If 404, maybe try a standard model?
                // For now, just throw error.
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'API Request Failed');
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!textResponse) throw new Error('No content generated');

            let parsedColors: string[] = [];
            try {
                // Clean markdown code blocks if present
                const cleanedText = textResponse.replace(/```json\n?|\n?```/g, '');
                const json = JSON.parse(cleanedText);
                
                // Handle different potential JSON structures
                if (Array.isArray(json)) {
                    parsedColors = json;
                } else if (json.colors && Array.isArray(json.colors)) {
                    parsedColors = json.colors;
                } else {
                    // Try to find any array of strings in values
                    const values = Object.values(json);
                    const arrayVal = values.find(v => Array.isArray(v));
                    if (arrayVal) parsedColors = arrayVal as string[];
                }

                // Validate HEX codes
                parsedColors = parsedColors.filter(c => /^#?[0-9A-F]{6}$/i.test(c));
                
                if (parsedColors.length === 0) throw new Error('No valid HEX colors found');

            } catch (e) {
                console.error("JSON Parse Error:", e);
                throw new Error('Failed to parse color data');
            }

            setGeneratedColors(parsedColors);
            setShowResult(true);
            setIsExpanded(true); // Expand to show results

        } catch (err: any) {
            console.error(err);
            setError(err.message);
            // Reset state on error so user can try again
            setIsExpanded(true);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setPrompt('');
        setGeneratedColors([]);
        setShowResult(false);
        setIsExpanded(true); // Go back to input mode
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleCollapse = () => {
        setIsExpanded(false);
    };

    const handleColorClick = (hex: string) => {
        const rgb = HexToRGB(hex);
        if (rgb) {
            onColorSelect(RGBToHSL(rgb[0], rgb[1], rgb[2]));
        }
    };

    // Determine width based on state
    // Circle: w-12 or w-14
    // Input Expanded: w-[300px] to w-[500px]
    // Result Expanded: depends on color count. Approx 40px per color + padding.
    
    let containerWidth = 'w-12 h-12 sm:w-14 sm:h-14'; // Default Circle
    if (isExpanded) {
        if (showResult) {
            // Base padding + icon (40) + colors * 40 + extra
            const width = 60 + (generatedColors.length * 44); 
            containerWidth = `w-[${width}px] h-12 sm:h-14`;
        } else {
            containerWidth = 'w-[320px] sm:w-[400px] h-12 sm:h-14';
        }
    }

    return (
        <>
            {/* Floating Prompt Display (When Loading or Showing Result) */}
            {(loading || showResult) && prompt && (
                <div className={`absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 max-w-[90vw] sm:max-w-md z-40 pointer-events-none`}>
                     <div className={`p-4 rounded-2xl text-sm sm:text-base shadow-xl ${glassPanelClass} pointer-events-auto animate-fade-in-up`}>
                        <p className="line-clamp-4 opacity-90">{prompt}</p>
                     </div>
                </div>
            )}

            <div 
                className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center ${glassPanelClass} rounded-full overflow-hidden transition-all duration-500 cubic-bezier(0.34,1.56,0.64,1)`}
                style={{
                    width: isExpanded 
                        ? (showResult ? `${50 + generatedColors.length * 44}px` : 'min(90vw, 400px)') 
                        : '3.5rem',
                    height: '3.5rem'
                }}
            >
                {loading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current opacity-50" />
                ) : (
                    <div className="w-full h-full flex items-center relative">
                        
                        {/* Left Icon / Toggle */}
                        <button
                            className="absolute left-0 top-0 h-full w-14 flex items-center justify-center cursor-pointer z-10 hover:scale-110 active:scale-90 transition-transform"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isExpanded) {
                                    setIsExpanded(true);
                                    setTimeout(() => inputRef.current?.focus(), 100);
                                } else if (showResult) {
                                    handleReset();
                                } else if (prompt.length === 0) {
                                    handleCollapse();
                                } else {
                                    // If text exists but not result, maybe just clear text?
                                    // Or collapse? Prompt says: "Blank input -> click icon -> collapse"
                                    // So if not blank, maybe nothing? Or clear? 
                                    // Let's assume clicking icon while typing does nothing or focuses?
                                    // Actually, let's make it toggle collapse if user wants to cancel
                                    handleCollapse();
                                }
                            }}
                        >
                            {showResult ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 12h18M3 6h18M3 18h18"/>
                                </svg>
                            ) : (
                                /* Sparkles Icon */
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 3l1.912 5.813a2 2 0 001.272 1.272L21 12l-5.813 1.912a2 2 0 00-1.272 1.272L12 21l-1.912-5.813a2 2 0 00-1.272-1.272L3 12l5.813-1.912a2 2 0 001.272-1.272L12 3z" />
                                </svg>
                            )}
                        </button>

                        {/* Content Area */}
                        <div 
                            className={`flex-1 flex items-center h-full transition-opacity duration-300 ${isExpanded ? 'opacity-100 ml-12 pr-2' : 'opacity-0 pointer-events-none'}`}
                        >
                            {showResult ? (
                                /* Color Results */
                                <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide pr-2">
                                    {generatedColors.map((color, idx) => (
                                        <button
                                            key={idx}
                                            className="w-8 h-8 rounded-full border-2 border-white/20 shadow-sm hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                            style={{ backgroundColor: color }}
                                            onClick={() => handleColorClick(color)}
                                            title={color}
                                        />
                                    ))}
                                </div>
                            ) : (
                                /* Text Input */
                                <div className="flex items-center w-full gap-2">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        id="ai-color-search"
                                        name="ai-color-search"
                                        autoComplete="off"
                                        className="flex-1 bg-transparent outline-none placeholder-current placeholder-opacity-50 text-sm sm:text-base"
                                        placeholder="Describe a color mood..."
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        maxLength={1000}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    />
                                    <button 
                                        className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${!prompt.trim() ? 'opacity-30 cursor-not-allowed' : ''}`}
                                        onClick={handleSend}
                                        disabled={!prompt.trim()}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="22" y1="2" x2="11" y2="13"></line>
                                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default AISearch;
