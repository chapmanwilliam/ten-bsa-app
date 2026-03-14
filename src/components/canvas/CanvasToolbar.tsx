'use client';

import { useTranslations } from 'next-intl';
import { Tool } from '@/engine';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface CanvasToolbarProps {
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
}

const toolDefs: { id: Tool; tKey: string; icon: string }[] = [
  { id: 'tbsa', tKey: 'tools.tbsa', icon: '\u{1F58C}' },
  { id: 'dbsa', tKey: 'tools.dbsa', icon: '\u{1F58C}' },
  { id: 'eraser', tKey: 'tools.eraser', icon: '\u25FB' },
];

export function CanvasToolbar({ currentTool, onToolChange }: CanvasToolbarProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-1.5">
      {toolDefs.map((tool) => {
        const isActive = currentTool === tool.id;
        let className =
          'w-[60px] py-2 px-1 rounded-md border-2 font-semibold text-[11px] text-center cursor-pointer shadow-sm transition-colors ';

        if (tool.id === 'tbsa') {
          className += isActive
            ? 'border-[#c95a8a] bg-[#c95a8a] text-white'
            : 'border-[#c95a8a] bg-[rgba(201,90,138,0.15)] text-[#c95a8a]';
        } else if (tool.id === 'dbsa') {
          className += isActive
            ? 'border-[#636e72] bg-[#636e72] text-white'
            : 'border-[#636e72] bg-[rgba(99,110,114,0.15)] text-[#636e72]';
        } else {
          className += isActive
            ? 'border-[#333] bg-[#333] text-white'
            : 'border-[#b0b0a8] bg-white text-[#555]';
        }

        const infoColor = tool.id === 'tbsa' ? '#c95a8a' : tool.id === 'dbsa' ? '#636e72' : null;

        return (
          <div key={tool.id} className="flex items-center gap-1.5">
            <button
              className={className}
              onClick={() => onToolChange(tool.id)}
            >
              <span className="text-lg block mb-0.5">{tool.icon}</span>
              {t(tool.tKey)}
            </button>
            {infoColor && (
              <InfoTooltip text={t(`info.${tool.id}`)} color={infoColor} position="right" />
            )}
          </div>
        );
      })}
    </div>
  );
}
