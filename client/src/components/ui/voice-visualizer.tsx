import { useEffect, useState } from "react";

interface VoiceVisualizerProps {
  isActive: boolean;
  barCount?: number;
  className?: string;
}

export default function VoiceVisualizer({ 
  isActive, 
  barCount = 5, 
  className = "" 
}: VoiceVisualizerProps) {
  const [heights, setHeights] = useState<number[]>(Array(barCount).fill(4));
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        setAnimationFrame(null);
      }
      setHeights(Array(barCount).fill(4));
      return;
    }

    const updateHeights = () => {
      setHeights(prev => prev.map(() => Math.random() * 16 + 4));
      const frame = requestAnimationFrame(updateHeights);
      setAnimationFrame(frame);
    };

    updateHeights();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isActive, barCount]);

  return (
    <div 
      className={`flex items-center space-x-1 ${className}`} 
      data-testid="voice-visualizer"
    >
      {heights.map((height, index) => (
        <div
          key={index}
          className={`w-1 rounded transition-all duration-150 ease-in-out ${
            isActive 
              ? index < Math.floor(barCount / 2) ? 'bg-cyber-blue' : 'bg-cyber-green'
              : 'bg-gray-500'
          }`}
          style={{ 
            height: `${height}px`,
            animationDelay: `${index * 100}ms`
          }}
        />
      ))}
    </div>
  );
}
