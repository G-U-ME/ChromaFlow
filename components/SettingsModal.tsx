import React, { useState, useEffect } from 'react';
import { Theme } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    theme: Theme;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, theme }) => {
    const [apiKey, setApiKey] = useState('');
    const [sampleStep, setSampleStep] = useState(10);
    const [quantizationFactor, setQuantizationFactor] = useState(24);
    const [minRedmeanDistance, setMinRedmeanDistance] = useState(50);
    
    useEffect(() => {
        const storedKey = localStorage.getItem('GEMINI_API_KEY');
        if (storedKey) {
            setApiKey(storedKey);
        }

        const storedSampleStep = localStorage.getItem('IMG_PICKER_SAMPLE_STEP');
        if (storedSampleStep) setSampleStep(parseInt(storedSampleStep));

        const storedQuantFactor = localStorage.getItem('IMG_PICKER_QUANT_FACTOR');
        if (storedQuantFactor) setQuantizationFactor(parseInt(storedQuantFactor));

        const storedMinDist = localStorage.getItem('IMG_PICKER_MIN_DIST');
        if (storedMinDist) setMinRedmeanDistance(parseInt(storedMinDist));
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('GEMINI_API_KEY', apiKey);
        localStorage.setItem('IMG_PICKER_SAMPLE_STEP', sampleStep.toString());
        localStorage.setItem('IMG_PICKER_QUANT_FACTOR', quantizationFactor.toString());
        localStorage.setItem('IMG_PICKER_MIN_DIST', minRedmeanDistance.toString());
        onClose();
    };

    if (!isOpen) return null;

    const isDark = theme === 'dark';
    const glassPanelClass = `
        backdrop-blur-xl 
        ${isDark ? 'bg-black/80 border-white/10 text-white' : 'bg-white/90 border-black/5 text-gray-900'}
        border shadow-2xl rounded-2xl
        transition-all duration-300 ease-out
    `;

    const inputClass = `w-full px-4 py-2 rounded-lg outline-none border ${isDark ? 'bg-white/5 border-white/10 focus:border-indigo-500' : 'bg-black/5 border-black/10 focus:border-indigo-500'}`;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={onClose}>
            <div 
                className={`w-full max-w-md p-6 ${glassPanelClass} transform transition-all scale-100 opacity-100 max-h-[85vh] overflow-y-auto`}
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold mb-4">Settings</h2>
                
                <div className="mb-6 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">Image Color Picker</h3>
                    
                    <div>
                        <label className="block text-sm font-medium mb-1 opacity-80">Sample Step (Performance vs Accuracy)</label>
                        <div className="flex items-center gap-3">
                             <input 
                                type="range" min="1" max="50" step="1"
                                className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                value={sampleStep}
                                onChange={(e) => setSampleStep(parseInt(e.target.value))}
                            />
                            <span className="text-sm w-8 text-right">{sampleStep}</span>
                        </div>
                    </div>

                    <div>
                         <label className="block text-sm font-medium mb-1 opacity-80">Quantization Factor (Color Grouping)</label>
                         <div className="flex items-center gap-3">
                            <input 
                                type="range" min="1" max="100" step="1"
                                className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                value={quantizationFactor}
                                onChange={(e) => setQuantizationFactor(parseInt(e.target.value))}
                            />
                            <span className="text-sm w-8 text-right">{quantizationFactor}</span>
                         </div>
                    </div>

                    <div>
                         <label className="block text-sm font-medium mb-1 opacity-80">Min Redmean Distance (Distinctness)</label>
                         <div className="flex items-center gap-3">
                            <input 
                                type="range" min="1" max="200" step="1"
                                className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                value={minRedmeanDistance}
                                onChange={(e) => setMinRedmeanDistance(parseInt(e.target.value))}
                            />
                            <span className="text-sm w-8 text-right">{minRedmeanDistance}</span>
                         </div>
                    </div>
                </div>

                <div className="mb-6 border-t border-current/10 pt-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">AI Configuration</h3>
                    <label className="block text-sm font-medium mb-2 opacity-70">GEMINI API KEY</label>
                    <input 
                        type="password" 
                        className={inputClass}
                        placeholder="Enter your API key..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                    />
                    <p className="text-xs mt-2 opacity-50">
                        Key is stored locally in your browser.
                    </p>
                </div>

                <div className="flex justify-end gap-3">
                    <button 
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button 
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 transition-all"
                        onClick={handleSave}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
