'use client';

import { useTranslations } from 'next-intl';
import { Tool } from '@/engine';

interface BrushControlsProps {
  brushRadius: number;
  currentTool: Tool;
  onBrushChange: (radius: number) => void;
  compact?: boolean;
}

const TOOL_COLORS: Record<Tool, string> = {
  tbsa: '#c95a8a',
  dbsa: '#636e72',
  eraser: '#999',
};

export function BrushControls({ brushRadius, currentTool, onBrushChange, compact }: BrushControlsProps) {
  const t = useTranslations('brush');
  const color = TOOL_COLORS[currentTool];
  const dotSize = Math.max(4, brushRadius * 0.7);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-1 pl-2">
        <input
          type="range"
          min={3}
          max={40}
          value={brushRadius}
          onChange={(e) => onBrushChange(parseInt(e.target.value))}
          className="flex-1"
          style={{ accentColor: color }}
        />
        <div className="w-[22px] h-[22px] flex items-center justify-center">
          <div
            className="rounded-full"
            style={{
              width: `${dotSize}px`,
              height: `${dotSize}px`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white border-t border-[#b0b0a8]">
      <label className="text-xs font-semibold text-[#555]">{t('label')}:</label>
      <input
        type="range"
        min={3}
        max={40}
        value={brushRadius}
        onChange={(e) => onBrushChange(parseInt(e.target.value))}
        className="flex-1 max-w-[200px]"
        style={{ accentColor: color }}
      />
      <div className="w-[30px] h-[30px] flex items-center justify-center">
        <div
          className="rounded-full"
          style={{
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}
