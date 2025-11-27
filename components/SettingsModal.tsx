import React, { useState, useEffect } from 'react';
import { Theme } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    theme: Theme;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, theme }) => {
    const [apiKey, setApiKey] = useState('');
    
    useEffect(() => {
        const storedKey = localStorage.getItem('GEMINI_API_KEY');
        if (storedKey) {
            setApiKey(storedKey);
        }
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('GEMINI_API_KEY', apiKey);
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={onClose}>
            <div 
                className={`w-full max-w-md p-6 ${glassPanelClass} transform transition-all scale-100 opacity-100`}
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold mb-4">Settings</h2>
                
                <div className="mb-6">
                    <label className="block text-sm font-medium mb-2 opacity-70">GEMINI API KEY</label>
                    <input 
                        type="password" 
                        className={`w-full px-4 py-2 rounded-lg outline-none border ${isDark ? 'bg-white/5 border-white/10 focus:border-indigo-500' : 'bg-black/5 border-black/10 focus:border-indigo-500'}`}
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
