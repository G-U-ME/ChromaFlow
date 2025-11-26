import React, { useState, useRef, useEffect } from 'react';
import GridCanvas from './components/GridCanvas';
import FloatingUI from './components/FloatingUI';
import { ViewState, Theme, ColorFormat } from './types';

function App() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [hue, setHue] = useState(210); // Default Blue
  
  // Center of the infinite grid (0,0) should be at center of screen initially
  const [viewState, setViewState] = useState<ViewState>({
    x: window.innerWidth / 2, 
    y: window.innerHeight / 2,
    scale: 1,
    step: 5,
  });

  const [colorFormat, setColorFormat] = useState<ColorFormat>('HSL');
  const [showGridLabels, setShowGridLabels] = useState(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);

  // Tolerance UI State
  const [toleranceData, setToleranceData] = useState({ val: 5, max: 25, visible: false });
  const toleranceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize theme detection
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }, []);

  const handleToleranceChange = (val: number, max: number) => {
    setToleranceData({ val, max, visible: true });
    if (toleranceTimeout.current) clearTimeout(toleranceTimeout.current);
    toleranceTimeout.current = setTimeout(() => {
        setToleranceData(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  const toggleColorFormat = () => {
    const formats: ColorFormat[] = ['HSL', 'HEX', 'RGB'];
    const next = formats[(formats.indexOf(colorFormat) + 1) % formats.length];
    setColorFormat(next);
  };

  return (
    <div className={`w-screen h-screen overflow-hidden relative ${theme === 'dark' ? 'bg-[#101010]' : 'bg-[#E8E7E5]'}`}>
      
      <GridCanvas 
        viewState={viewState}
        setViewState={setViewState}
        hue={hue}
        theme={theme}
        colorFormat={colorFormat}
        showGridLabels={showGridLabels}
        onToleranceChange={handleToleranceChange}
        isDraggingCanvas={isDraggingCanvas}
        setIsDraggingCanvas={setIsDraggingCanvas}
      />

      <FloatingUI 
        viewState={viewState}
        currentHue={hue}
        setHue={setHue}
        toleranceData={toleranceData}
        theme={theme}
        toggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
        colorFormat={colorFormat}
        toggleColorFormat={toggleColorFormat}
        showGridLabels={showGridLabels}
        toggleGridLabels={() => setShowGridLabels(!showGridLabels)}
      />
      
    </div>
  );
}

export default App;