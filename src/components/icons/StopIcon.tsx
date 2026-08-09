import React from 'react';

export interface StopIconProps {
  color: string;
  isIda?: boolean;
  size?: number;
  style?: React.CSSProperties;
}

export const StopIcon: React.FC<StopIconProps> = ({
  color,
  isIda = true,
  size = 17,
  style
}) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={size} height={size} style={{ display: 'block', ...style }}>
      <rect width="32" height="32" rx="8" fill={color} />
      <rect x="1.5" y="1.5" width="29" height="29" rx="6.5" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray={!isIda ? '3,2' : undefined} />
      <g transform="translate(4,4)">
        <path fill="#FFFFFF" d="M4,16c0,0.88 0.39,1.67 1,2.22l0,1.78c0,0.55 0.45,1 1,1l1,0c0.55,0 1,-0.45 1,-1l0,-1l8,0l0,1c0,0.55 0.45,1 1,1l1,0c0.55,0 1,-0.45 1,-1l0,-1.78c0.61,-0.55 1,-1.34 1,-2.22L20,6c0,-3.5 -3.58,-4 -8,-4s-8,0.5 -8,4l0,10zM7.5,17c-0.83,0 -1.5,-0.67 -1.5,-1.5S6.67,14 7.5,14s1.5,0.67 1.5,1.5S8.33,17 7.5,17zM16.5,17c-0.83,0 -1.5,-0.67 -1.5,-1.5s0.67,-1.5 1.5,-1.5s1.5,0.67 1.5,1.5S17.33,17 16.5,17zM18,11L6,11L6,6l12,0L18,11z" />
      </g>
    </svg>
  );
};

export const getStopIconSvgString = (color: string, isIda: boolean, size: number) => {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
      <rect width="32" height="32" rx="8" fill="${color}"/>
      <rect x="1.5" y="1.5" width="29" height="29" rx="6.5" fill="none" stroke="#ffffff" strokeWidth="1.5" stroke-dasharray="${!isIda ? '3,2' : 'none'}" />
      <g transform="translate(4,4)"><path fill="#FFFFFF" d="M4,16c0,0.88 0.39,1.67 1,2.22l0,1.78c0,0.55 0.45,1 1,1l1,0c0.55,0 1,-0.45 1,-1l0,-1l8,0l0,1c0,0.55 0.45,1 1,1l1,0c0.55,0 1,-0.45 1,-1l0,-1.78c0.61,-0.55 1,-1.34 1,-2.22L20,6c0,-3.5 -3.58,-4 -8,-4s-8,0.5 -8,4l0,10zM7.5,17c-0.83,0 -1.5,-0.67 -1.5,-1.5S6.67,14 7.5,14s1.5,0.67 1.5,1.5S8.33,17 7.5,17zM16.5,17c-0.83,0 -1.5,-0.67 -1.5,-1.5s0.67,-1.5 1.5,-1.5s1.5,0.67 1.5,1.5S17.33,17 16.5,17zM18,11L6,11L6,6l12,0L18,11z"/></g>
    </svg>
  `;
};
