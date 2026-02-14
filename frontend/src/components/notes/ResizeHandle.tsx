'use client'

import { Separator } from 'react-resizable-panels'

interface ResizeHandleProps {
  id?: string
  orientation?: 'vertical' | 'horizontal'
}

export function ResizeHandle({ id, orientation = 'vertical' }: ResizeHandleProps) {
  const isVertical = orientation === 'vertical'

  return (
    <Separator
      id={id}
      className={`group relative flex items-center justify-center bg-transparent hover:bg-accent/5 active:bg-accent/10 transition-colors duration-150 ${
        isVertical ? 'w-[5px] h-full' : 'h-[5px] w-full'
      }`}
      style={{ cursor: isVertical ? 'col-resize' : 'row-resize' }}
    >
      <div
        className={`absolute bg-gray-200 group-hover:bg-accent/40 group-active:bg-accent/60 transition-colors duration-150 ${
          isVertical ? 'inset-y-0 w-px' : 'inset-x-0 h-px'
        }`}
      />
      <div
        className={`absolute opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${
          isVertical ? 'flex flex-col gap-[3px]' : 'flex flex-row gap-[3px]'
        }`}
      >
        <div className="w-[3px] h-[3px] rounded-full bg-accent/50" />
        <div className="w-[3px] h-[3px] rounded-full bg-accent/50" />
        <div className="w-[3px] h-[3px] rounded-full bg-accent/50" />
      </div>
    </Separator>
  )
}
