
import React from 'react';
import { PokemonType, Language } from '../types';
import { TYPE_COLORS, TYPE_NAMES_ZH } from '../constants';

interface Props {
  type: PokemonType | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  lang?: Language;
}

export const TypeBadge: React.FC<Props> = ({ type, size = 'md', className = '', onClick, selected = false, lang = 'en' }) => {
  // Normalize string input to Enum (handle casing like 'fire' -> 'Fire')
  // This ensures that even if AI returns lowercase, we map it correctly to the Chinese constant
  let normalizedKey = type as string;
  if (typeof type === 'string' && type.length > 0) {
    normalizedKey = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  }

  const typeKey = Object.values(PokemonType).includes(normalizedKey as PokemonType) 
    ? (normalizedKey as PokemonType) 
    : PokemonType.None;

  const color = TYPE_COLORS[typeKey];
  const displayName = lang === 'zh' ? (TYPE_NAMES_ZH[typeKey] || type) : type;
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base font-bold'
  };

  return (
    <>
      <style>
        {`
          @keyframes pop {
            0% { transform: scale(1); }
            50% { transform: scale(1.15); }
            100% { transform: scale(1.05); }
          }
          .badge-selected {
            animation: pop 0.2s ease-out forwards;
          }
        `}
      </style>
      <span 
        onClick={onClick}
        className={`
          inline-block rounded-md shadow-sm uppercase tracking-wider font-display transition-all duration-200 border-2
          ${sizeClasses[size]}
          ${className}
          ${onClick ? 'cursor-pointer' : ''}
          ${selected ? 'ring-2 ring-white badge-selected' : 'opacity-90 hover:opacity-100'}
          hover:scale-110
        `}
        style={{ 
          backgroundColor: color, 
          color: '#fff', 
          borderColor: 'transparent', // Default border
          textShadow: '0px 1px 2px rgba(0,0,0,0.3)',
          boxShadow: selected ? `0 0 10px ${color}` : 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = color; // Match background color on hover (appears as solid expansion)
          e.currentTarget.style.filter = 'brightness(1.1)'; // Slight brightness bump
        }}
        onMouseLeave={(e) => {
           e.currentTarget.style.borderColor = 'transparent';
           e.currentTarget.style.filter = 'none';
        }}
      >
        {displayName}
      </span>
    </>
  );
};
