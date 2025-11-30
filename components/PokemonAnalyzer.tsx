
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { analyzePokemon } from '../services/geminiService';
import { PokemonAnalysis, Language, Generation, Regulation, MatchupNode, PokemonType } from '../types';
import { TypeBadge } from './TypeBadge';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from 'recharts';
import { TRANSLATIONS } from '../utils/translations';
import { getPokemonSpriteUrl } from '../utils/helpers';
import { getEffectiveness } from '../constants';

interface Props {
    lang: Language;
    generation: Generation;
    season: Regulation;
    initialSearch?: string;
    cachedData?: PokemonAnalysis | null;
    onAnalyzeComplete?: (data: PokemonAnalysis) => void;
}

// Physics Types
interface Vector { x: number; y: number; }
interface GraphNode extends MatchupNode {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    isDragging: boolean;
}

export const PokemonAnalyzer: React.FC<Props> = ({ 
    lang, generation, season, initialSearch, 
    cachedData, onAnalyzeComplete 
}) => {
  const [search, setSearch] = useState(initialSearch || '');
  const [data, setData] = useState<PokemonAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [advancedTopology, setAdvancedTopology] = useState(false);
  const t = TRANSLATIONS[lang];

  // --- Topology View State ---
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  // Transform State for Pan/Zoom
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoveredLink, setHoveredLink] = useState<{ u: string, v: string } | null>(null);

  const requestRef = useRef<number>(0);
  const dragRef = useRef<{ id: string, startX: number, startY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the container to calculate relative tooltip pos
  const centerNodePos = { x: 300, y: 200 }; // Center of the SVG canvas

  // Effect to handle initialization and search updates
  useEffect(() => {
    if (initialSearch) {
        setSearch(initialSearch);
        if (cachedData && (cachedData.nameEn === initialSearch || cachedData.nameZh === initialSearch)) {
            setData(cachedData);
        } else {
            handleAnalyze(initialSearch);
        }
    } else if (cachedData && !data) {
        setData(cachedData);
        setSearch(lang === 'zh' ? cachedData.nameZh : cachedData.nameEn);
    }
  }, [initialSearch, generation, season]); 

  // Initialize Graph Nodes when Data changes
  useEffect(() => {
    if (data?.matchupNetwork) {
        // Initialize positions in a circle to start, then let physics take over
        const count = data.matchupNetwork.length;
        const initialRadius = 120;
        
        const newNodes: GraphNode[] = data.matchupNetwork.map((node, i) => {
            const angle = (i / count) * 2 * Math.PI;
            return {
                ...node,
                id: `node-${i}`,
                x: centerNodePos.x + Math.cos(angle) * initialRadius,
                y: centerNodePos.y + Math.sin(angle) * initialRadius,
                vx: 0,
                vy: 0,
                isDragging: false
            };
        });
        setNodes(newNodes);
        // Reset transform on new analysis
        setTransform({ x: 0, y: 0, scale: 1 });
    }
  }, [data]);

  // Physics Simulation Loop
  const animate = useCallback(() => {
    setNodes(prevNodes => {
        const newNodes = prevNodes.map(node => ({ ...node })); // Shallow copy

        // Constants
        const REPULSION = 20000; // Nodes push each other away
        const SPRING = 0.005; // Nodes pulled to center
        const DAMPING = 0.85; // Friction
        const MAX_SPEED = 2; // Speed limit

        newNodes.forEach((node, i) => {
            if (node.isDragging) return; // Don't move dragged nodes with physics

            let fx = 0;
            let fy = 0;

            // 1. Repulsion (Coulomb's Law)
            newNodes.forEach((other, j) => {
                if (i === j) return;
                const dx = node.x - other.x;
                const dy = node.y - other.y;
                let distSq = dx * dx + dy * dy;
                if (distSq === 0) distSq = 1; // Prevent div by zero
                const dist = Math.sqrt(distSq);
                
                const force = REPULSION / distSq;
                fx += (dx / dist) * force;
                fy += (dy / dist) * force;
            });

            // 1.5 Repulsion from Center (Keep them from collapsing on the main pokemon)
            const cDx = node.x - centerNodePos.x;
            const cDy = node.y - centerNodePos.y;
            const cDist = Math.sqrt(cDx*cDx + cDy*cDy);
            if (cDist < 100) {
                 fx += (cDx / cDist) * 50;
                 fy += (cDy / cDist) * 50;
            }

            // 2. Attraction to Center (Spring Force)
            // Adjust rest length based on number of nodes
            const restLength = 150; 
            const pull = (cDist - restLength) * SPRING;
            
            fx -= (cDx / cDist) * pull;
            fy -= (cDy / cDist) * pull;

            // Apply Force to Velocity
            node.vx += fx;
            node.vy += fy;

            // Speed Limit
            const speed = Math.sqrt(node.vx*node.vx + node.vy*node.vy);
            if (speed > MAX_SPEED) {
                node.vx = (node.vx / speed) * MAX_SPEED;
                node.vy = (node.vy / speed) * MAX_SPEED;
            }

            // Update Position
            node.x += node.vx;
            node.y += node.vy;

            // Damping
            node.vx *= DAMPING;
            node.vy *= DAMPING;

            // Boundary Box (Simulated large bounds to allow drift)
            if (node.x < -500) { node.x = -500; node.vx *= -1; }
            if (node.x > 1100) { node.x = 1100; node.vx *= -1; }
            if (node.y < -500) { node.y = -500; node.vy *= -1; }
            if (node.y > 900) { node.y = 900; node.vy *= -1; }
        });

        return newNodes;
    });

    if (advancedTopology) {
        requestRef.current = requestAnimationFrame(animate);
    }
  }, [advancedTopology]);

  useEffect(() => {
    if (advancedTopology && nodes.length > 0) {
        requestRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [advancedTopology, animate, nodes.length]);

  // --- Pan & Zoom Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
      e.stopPropagation(); 
      // e.preventDefault() is handled by React usually or passive listeners, check console
      const scaleSensitivity = 0.001;
      const newScale = transform.scale + e.deltaY * -scaleSensitivity;
      const clampedScale = Math.min(Math.max(0.2, newScale), 4); // Min 0.2x, Max 4x
      
      setTransform(prev => ({
          ...prev,
          scale: clampedScale
      }));
  };

  const handleSvgMouseDown = (e: React.MouseEvent) => {
      if (e.button === 0) { // Left click
        setIsPanning(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
      }
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    // Handle Node Dragging
    if (dragRef.current && svgRef.current) {
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
        
        // Convert to local group coordinates
        const transformedX = (svgP.x - transform.x) / transform.scale;
        const transformedY = (svgP.y - transform.y) / transform.scale;

        const { id } = dragRef.current;
        setNodes(prev => prev.map(n => {
            if (n.id === id) {
                return { ...n, x: transformedX, y: transformedY, vx: 0, vy: 0 }; 
            }
            return n;
        }));
        return;
    }

    // Handle Panning
    if (isPanning) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        setTransform(prev => ({
            ...prev,
            x: prev.x + dx,
            y: prev.y + dy
        }));
        setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleSvgMouseUp = () => {
      setIsPanning(false);
      if (dragRef.current) {
        const { id } = dragRef.current;
        setNodes(prev => prev.map(n => n.id === id ? { ...n, isDragging: false } : n));
        dragRef.current = null;
      }
  };

  const handleNodeMouseDown = (id: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent panning when clicking a node
      setIsPanning(false);
      
      setNodes(prev => prev.map(n => n.id === id ? { ...n, isDragging: true, vx: 0, vy: 0 } : n));
      dragRef.current = { id, startX: 0, startY: 0 }; // coords updated in mousemove
  };

  const handleAnalyze = async (term?: string) => {
    const query = term || search;
    if (!query.trim()) return;
    
    if (term) setSearch(term);

    setLoading(true);
    setError('');
    
    // Only clear data if it's a completely new search to avoid visual flash
    if (!data || (data.nameEn !== query && data.nameZh !== query)) {
        setData(null);
    }

    const result = await analyzePokemon(query, generation, season);
    if (result) {
      setData(result);
      if (onAnalyzeComplete) onAnalyzeComplete(result);
    } else {
      setError(t.errorAnalyze);
    }
    setLoading(false);
  };

  const chartData = data ? [
    { subject: 'HP', A: data.stats.hp, B: data.comparisonStats?.hp || 0, fullMark: 255 },
    { subject: 'Atk', A: data.stats.attack, B: data.comparisonStats?.attack || 0, fullMark: 190 },
    { subject: 'Def', A: data.stats.defense, B: data.comparisonStats?.defense || 0, fullMark: 250 },
    { subject: 'SpA', A: data.stats.spAtk, B: data.comparisonStats?.spAtk || 0, fullMark: 194 },
    { subject: 'SpD', A: data.stats.spDef, B: data.comparisonStats?.spDef || 0, fullMark: 250 },
    { subject: generation === 'legends-za' ? t.statSpeed : 'SPE', A: data.stats.speed, B: data.comparisonStats?.speed || 0, fullMark: 200 },
  ] : [];

  const getName = () => lang === 'zh' ? data?.nameZh : data?.nameEn;
  const getRole = () => lang === 'zh' ? data?.roleZh : data?.roleEn;
  const getSummary = () => lang === 'zh' ? data?.summaryZh : data?.summaryEn;
  const getStrengths = () => lang === 'zh' ? data?.strengthsZh : data?.strengthsEn;
  const getWeaknesses = () => lang === 'zh' ? data?.weaknessesZh : data?.weaknessesEn;
  
  const getCoverage = () => {
    const list = lang === 'zh' ? data?.coverageZh : data?.coverageEn;
    return (list || []).filter(t => t && t.toLowerCase() !== 'none' && t !== '无' && t !== '无属性');
  };
  
  const getPartners = () => lang === 'zh' ? data?.partnersZh : data?.partnersEn;

  // Render Force Directed Graph
  const renderForceDirectedGraph = () => {
      // Calculate Tooltip Position relative to Container
      const getTooltipStyle = () => {
          if (!hoveredNode) return { display: 'none' };
          
          // Calculate node's position in screen space within the container
          const nodeScreenX = transform.x + hoveredNode.x * transform.scale;
          const nodeScreenY = transform.y + hoveredNode.y * transform.scale;
          
          // Basic Bounds Checking Logic
          // Assume Container Width ~ 100% or 1100px max, Height ~ 500px
          // This logic tries to keep tooltip visible
          let left = nodeScreenX + 15 * transform.scale + 10;
          let top = nodeScreenY + 15 * transform.scale + 10;

          // If overflowing right (rough estimate), flip left
          if (left > 800) left = nodeScreenX - 220; 
          // If overflowing bottom, flip up
          if (top > 400) top = nodeScreenY - 100;

          return {
              left: `${Math.max(10, left)}px`,
              top: `${Math.max(10, top)}px`,
          };
      };

      return (
          // Main Container - NO overflow:hidden here to allow tooltip to poke out if positioned absolutely relative to this
          <div ref={containerRef} className="w-full h-[500px] relative flex justify-center items-center select-none bg-slate-50/50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/5 group">
             
             {/* Controls Overlay */}
             <div className="absolute bottom-4 right-4 z-10 flex gap-2">
                 <button 
                    onClick={() => setTransform({x: 0, y: 0, scale: 1})}
                    className="bg-white dark:bg-za-panel border border-gray-200 dark:border-white/10 p-2 rounded shadow-sm text-xs font-bold hover:bg-gray-100 dark:hover:bg-white/10"
                    title="Reset View"
                 >
                    RESET
                 </button>
             </div>

             {/* Hover Tooltip Overlay - Rendered OUTSIDE SVG to avoid clipping, Positioned Dynamically */}
             {hoveredNode && (
                 <div 
                    className="absolute z-50 pointer-events-none bg-gray-900/95 backdrop-blur text-white text-xs p-3 rounded shadow-xl border border-white/10 w-48 animate-fade-in origin-top-left"
                    style={getTooltipStyle() as React.CSSProperties}
                 >
                     <div className="font-bold mb-1 border-b border-white/20 pb-1 text-za-cyan text-sm">
                         {lang === 'zh' ? hoveredNode.opponentZh : hoveredNode.opponentEn}
                     </div>
                     <div className={`text-[10px] uppercase font-bold mb-2 inline-block px-1 rounded ${
                        hoveredNode.result === 'win' ? 'bg-green-500 text-black' : 
                        hoveredNode.result === 'lose' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'
                     }`}>
                         {hoveredNode.result.toUpperCase()}
                     </div>
                     <div className="text-gray-300 leading-tight">
                         {lang === 'zh' ? hoveredNode.descriptionZh : hoveredNode.descriptionEn}
                     </div>
                 </div>
             )}

             {/* SVG Container with Overflow Hidden to clip graph but not tooltip */}
             <div className="absolute inset-0 overflow-hidden rounded-xl">
                <svg 
                    ref={svgRef}
                    width="100%" height="100%" 
                    className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onMouseDown={handleSvgMouseDown}
                    onMouseMove={handleSvgMouseMove}
                    onMouseUp={handleSvgMouseUp}
                    onMouseLeave={handleSvgMouseUp}
                    onWheel={handleWheel}
                >
                    <defs>
                        <marker id="arrow-win" markerWidth="6" markerHeight="6" refX="24" refY="3" orient="auto">
                            <path d="M0,0 L0,6 L6,3 z" fill="#22c55e" />
                        </marker>
                        <marker id="arrow-lose" markerWidth="6" markerHeight="6" refX="24" refY="3" orient="auto">
                            <path d="M0,0 L0,6 L6,3 z" fill="#ef4444" />
                        </marker>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>
                    
                    <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
                        {/* 1. Draw Mesh Connections (Between Opponents) */}
                        {nodes.map((nodeA, i) => {
                            return nodes.map((nodeB, j) => {
                                if (i >= j) return null; // Avoid duplicate checks
                                
                                // Determine types
                                const typesA = (nodeA.opponentTypes || []).map(t => 
                                    t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
                                ) as PokemonType[];

                                const typesB = (nodeB.opponentTypes || []).map(t => 
                                    t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
                                ) as PokemonType[];

                                let multAtoB = 0;
                                typesA.forEach(atk => {
                                    typesB.forEach(def => multAtoB = Math.max(multAtoB, getEffectiveness(atk, def)));
                                });

                                let multBtoA = 0;
                                typesB.forEach(atk => {
                                    typesA.forEach(def => multBtoA = Math.max(multBtoA, getEffectiveness(atk, def)));
                                });

                                // Draw Line if significant interaction
                                if (multAtoB > 1 || multBtoA > 1) {
                                    const isStrong = multAtoB >= 2 || multBtoA >= 2;
                                    const isHovered = hoveredLink && (
                                        (hoveredLink.u === nodeA.id && hoveredLink.v === nodeB.id) ||
                                        (hoveredLink.u === nodeB.id && hoveredLink.v === nodeA.id)
                                    );

                                    return (
                                        <g key={`mesh-group-${i}-${j}`}>
                                            {/* Hit Area (Invisible thick line for easier hover) */}
                                            <line 
                                                x1={nodeA.x} y1={nodeA.y} x2={nodeB.x} y2={nodeB.y} 
                                                stroke="transparent" 
                                                strokeWidth="15" 
                                                className="cursor-pointer"
                                                onMouseEnter={() => setHoveredLink({ u: nodeA.id, v: nodeB.id })}
                                                onMouseLeave={() => setHoveredLink(null)}
                                            />
                                            {/* Visible Line */}
                                            <line 
                                                x1={nodeA.x} y1={nodeA.y} x2={nodeB.x} y2={nodeB.y} 
                                                stroke={isStrong ? "#a855f7" : "#cbd5e1"} 
                                                strokeWidth={isHovered ? 2.5 : (isStrong ? 1.5 : 0.5)} 
                                                strokeOpacity={isHovered ? 1 : (isStrong ? 0.4 : 0.2)} 
                                                strokeDasharray={isStrong ? "3,3" : "0"}
                                                className="pointer-events-none transition-all duration-200"
                                            />
                                        </g>
                                    );
                                }
                                return null;
                            });
                        })}

                        {/* 2. Draw Main Connections (Center to Nodes) */}
                        {nodes.map((node, i) => {
                            const color = node.result === 'win' ? '#22c55e' : node.result === 'lose' ? '#ef4444' : '#eab308';
                            const marker = node.result === 'win' ? 'url(#arrow-win)' : node.result === 'lose' ? 'url(#arrow-lose)' : '';

                            return (
                                <line 
                                    key={`link-${i}`}
                                    x1={centerNodePos.x} y1={centerNodePos.y} 
                                    x2={node.x} y2={node.y} 
                                    stroke={color} 
                                    strokeWidth="1.5" 
                                    strokeOpacity="0.6"
                                    markerEnd={marker}
                                />
                            );
                        })}
                        
                        {/* 3. Center Node (Fixed) */}
                        <g transform={`translate(${centerNodePos.x}, ${centerNodePos.y})`}>
                            <polygon 
                                points="-25,-43 25,-43 50,0 25,43 -25,43 -50,0" 
                                fill="#0f172a" 
                                stroke="#00f3ff" 
                                strokeWidth="3" 
                                filter="url(#glow)"
                            />
                            <image 
                                href={getPokemonSpriteUrl(data!.nameEn)} 
                                x="-30" y="-30" width="60" height="60" 
                                style={{ pointerEvents: 'none' }}
                            />
                        </g>

                        {/* 4. Draggable Nodes */}
                        {nodes.map((node, i) => {
                            const resultColor = node.result === 'win' ? '#22c55e' : node.result === 'lose' ? '#ef4444' : '#eab308';
                            const opponentName = lang === 'zh' ? node.opponentZh : node.opponentEn;
                            
                            // Check if this node is part of the hovered link
                            const isLinked = hoveredLink && (hoveredLink.u === node.id || hoveredLink.v === node.id);

                            return (
                                <g 
                                    key={`node-g-${i}`} 
                                    transform={`translate(${node.x}, ${node.y})`}
                                    onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                                    onMouseEnter={() => setHoveredNode(node)}
                                    onMouseLeave={() => setHoveredNode(null)}
                                    className={`cursor-pointer transition-all duration-200 ${isLinked ? 'opacity-100 z-10' : 'hover:opacity-100'}`}
                                    style={{ opacity: (hoveredLink && !isLinked) ? 0.3 : 1 }}
                                >
                                    <circle 
                                        r={isLinked ? 25 : 22} 
                                        fill={isLinked ? "#334155" : "#1e293b"} 
                                        stroke={resultColor} 
                                        strokeWidth={node.isDragging || isLinked ? 3 : 1.5} 
                                        className="transition-all duration-200"
                                    />
                                    
                                    <image 
                                        href={getPokemonSpriteUrl(node.opponentEn)} 
                                        x="-20" y="-20" width="40" height="40" 
                                        style={{ pointerEvents: 'none' }}
                                        onError={(e) => {
                                            (e.target as SVGImageElement).href.baseVal = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png`;
                                        }}
                                    />

                                    {/* Text Label */}
                                    <foreignObject x="-40" y="24" width="80" height="20">
                                        <div className={`text-[9px] font-bold text-center bg-black/70 rounded text-white px-1 overflow-hidden text-ellipsis whitespace-nowrap`}>
                                            {opponentName}
                                        </div>
                                    </foreignObject>
                                </g>
                            );
                        })}
                    </g>
                </svg>
             </div>
          </div>
      );
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col md:flex-row gap-4">
            <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.enterPokemon}
            className="flex-1 bg-white dark:bg-za-panel/50 border border-gray-300 dark:border-white/20 rounded-lg px-6 py-4 text-xl text-slate-800 dark:text-white focus:outline-none focus:border-za-cyan transition-colors shadow-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <button
            onClick={() => handleAnalyze()}
            disabled={loading}
            className="bg-za-cyan text-black font-display font-bold px-8 py-4 rounded-lg hover:bg-cyan-300 transition-colors disabled:opacity-50 shadow-lg shadow-za-cyan/20"
            >
            {loading ? t.analyzingBtn : t.analyzeBtn}
            </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-500 text-red-700 dark:text-red-200 p-4 rounded-lg mb-8">
          {error}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
          {/* Main Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-za-panel/90 border border-gray-200 dark:border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-lg transition-colors">
               <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-za-cyan to-za-magenta"></div>
               
               <div className="flex flex-col md:flex-row gap-6">
                   <div className="flex-shrink-0 flex justify-center items-center">
                        <img 
                            src={getPokemonSpriteUrl(data.nameEn)}
                            alt={data.nameEn}
                            className="w-40 h-40 object-contain drop-shadow-2xl"
                            onError={(e) => {
                                const fallback = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png`;
                                if ((e.target as HTMLImageElement).src !== fallback) {
                                    (e.target as HTMLImageElement).src = fallback;
                                }
                            }}
                        />
                   </div>
                   <div className="flex-1">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-4xl font-display font-bold text-slate-800 dark:text-white mb-2">{getName()}</h2>
                                <div className="flex gap-2">
                                    {(data.types || []).map(type => <TypeBadge key={type} type={type} lang={lang} />)}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-slate-500 dark:text-gray-400 font-mono">{t.role}</div>
                                <div className="text-xl font-bold text-za-cyan">{getRole()}</div>
                                <div className="text-sm text-slate-500 dark:text-gray-400 font-mono mt-2">{t.tier}</div>
                                <div className="text-xl font-bold text-za-magenta">{data.tier}</div>
                            </div>
                        </div>
                        <p className="text-slate-600 dark:text-gray-300 leading-relaxed border-t border-gray-200 dark:border-white/10 pt-4">
                            {getSummary()}
                        </p>
                   </div>
               </div>
            </div>

            {/* Strategy Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-za-panel/50 border border-green-500/30 rounded-xl p-5 shadow-sm">
                <h3 className="text-green-600 dark:text-green-400 font-display mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    {t.beats}
                </h3>
                <ul className="space-y-2">
                  {getStrengths()?.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
                      <span className="text-green-500 font-mono">›</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-white dark:bg-za-panel/50 border border-red-500/30 rounded-xl p-5 shadow-sm">
                 <h3 className="text-red-500 dark:text-red-400 font-display mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    {t.losesTo}
                 </h3>
                 <ul className="space-y-2">
                  {getWeaknesses()?.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
                      <span className="text-red-500 font-mono">×</span> {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Coverage Types - Only show if valid data exists */}
              {getCoverage().length > 0 && (
                  <div className="bg-white dark:bg-za-panel/50 border border-yellow-500/30 rounded-xl p-5 shadow-sm">
                     <h3 className="text-yellow-600 dark:text-yellow-400 font-display mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        {t.coverage}
                     </h3>
                     <div className="flex flex-wrap gap-2">
                        {getCoverage().map((type, i) => (
                            <TypeBadge key={i} type={type} size="sm" lang={lang} />
                        ))}
                     </div>
                  </div>
              )}

               {/* Partners */}
               <div className="bg-white dark:bg-za-panel/50 border border-blue-500/30 rounded-xl p-5 shadow-sm">
                <h3 className="text-blue-500 dark:text-blue-400 font-display mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    {t.partners}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {getPartners()?.map((p, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-sm border border-blue-100 dark:border-blue-500/20">
                      {p}
                    </span>
                  ))}
                </div>
             </div>
            </div>

            {/* Battle Topology (Matchup Network) */}
            {data.matchupNetwork && data.matchupNetwork.length > 0 && (
                <div className="bg-white dark:bg-za-panel/50 border border-purple-500/30 rounded-xl p-5 shadow-sm transition-all duration-500">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-purple-600 dark:text-purple-400 font-display flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            {t.battleTopology}
                        </h3>
                        {/* Toggle Advanced View */}
                        <div className="flex items-center bg-gray-200 dark:bg-black/40 rounded-full p-1 border border-gray-300 dark:border-white/10">
                            <button 
                                onClick={() => setAdvancedTopology(false)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${!advancedTopology ? 'bg-white dark:bg-za-cyan text-slate-800 dark:text-black shadow-sm' : 'text-slate-500 dark:text-gray-400'}`}
                            >
                                {t.viewSimple}
                            </button>
                            <button 
                                onClick={() => setAdvancedTopology(true)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${advancedTopology ? 'bg-white dark:bg-za-cyan text-slate-800 dark:text-black shadow-sm' : 'text-slate-500 dark:text-gray-400'}`}
                            >
                                {t.viewAdvanced}
                            </button>
                        </div>
                    </div>

                    {advancedTopology ? (
                        // Force Directed Graph (SVG)
                        renderForceDirectedGraph()
                    ) : (
                        // Simple Grid View
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {data.matchupNetwork.map((node, index) => {
                                const resultColor = node.result === 'win' ? 'border-green-500/50 bg-green-500/10' : 
                                                    node.result === 'lose' ? 'border-red-500/50 bg-red-500/10' : 
                                                    'border-yellow-500/50 bg-yellow-500/10';
                                
                                const resultIcon = node.result === 'win' ? '✓' : node.result === 'lose' ? '✕' : '=';
                                const resultText = node.result === 'win' ? 'WIN' : node.result === 'lose' ? 'LOSE' : 'CHECK';
                                const opponentName = lang === 'zh' ? node.opponentZh : node.opponentEn;
                                const description = lang === 'zh' ? node.descriptionZh : node.descriptionEn;

                                return (
                                    <div key={index} className={`group relative p-3 rounded-lg border ${resultColor} transition-all hover:scale-105 cursor-help`}>
                                        <div className="flex flex-col items-center">
                                            <div className={`absolute top-2 right-2 text-xs font-bold px-1.5 rounded ${
                                                node.result === 'win' ? 'bg-green-500 text-white' : 
                                                node.result === 'lose' ? 'bg-red-500 text-white' : 
                                                'bg-yellow-500 text-black'
                                            }`}>
                                                {resultText}
                                            </div>
                                            <img 
                                                src={getPokemonSpriteUrl(node.opponentEn)} 
                                                alt={node.opponentEn}
                                                className="w-16 h-16 object-contain mb-2"
                                                onError={(e) => {
                                                    const fallback = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png`;
                                                    if ((e.target as HTMLImageElement).src !== fallback) {
                                                        (e.target as HTMLImageElement).src = fallback;
                                                    }
                                                }}
                                            />
                                            <span className="text-sm font-bold text-slate-700 dark:text-gray-200 text-center leading-tight">
                                                {opponentName}
                                            </span>
                                        </div>
                                        
                                        {/* Tooltip */}
                                        <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs p-3 rounded shadow-xl pointer-events-none transition-opacity z-50">
                                            <div className="font-bold mb-1 border-b border-white/20 pb-1">{opponentName} ({resultText})</div>
                                            {description}
                                            <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
          </div>

          {/* Stats Column */}
          <div className="bg-white dark:bg-za-panel border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-lg">
            <h3 className="text-xl font-display font-bold text-slate-800 dark:text-white mb-4 text-center">{t.baseStats}</h3>
            
            <div className="h-[300px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                  <PolarGrid stroke="#94a3b8" strokeOpacity={0.3} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 200]} tick={false} axisLine={false} />
                  
                  {/* Current Form */}
                  <Radar
                    name={t.currentForm}
                    dataKey="A"
                    stroke="#00f3ff"
                    strokeWidth={2}
                    fill="#00f3ff"
                    fillOpacity={0.4}
                  />

                  {/* Comparison Form (if exists) */}
                  {data.comparisonStats && (
                     <Radar
                        name={data.comparisonLabel || t.prevForm}
                        dataKey="B"
                        stroke="#ff00ff"
                        strokeWidth={2}
                        fill="#ff00ff"
                        fillOpacity={0.1}
                        strokeDasharray="4 4"
                    />
                  )}
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="space-y-3 mt-4">
              {chartData.map((stat) => (
                <div key={stat.subject} className="flex items-center text-sm">
                  <span className="w-16 font-bold text-slate-500 dark:text-gray-400 text-xs">{stat.subject}</span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden mx-2 relative">
                     {/* Comparison background bar */}
                     {data.comparisonStats && (
                        <div 
                            className="absolute top-0 left-0 h-full bg-za-magenta/30"
                            style={{ width: `${Math.min((stat.B / stat.fullMark) * 100, 100)}%` }}
                        ></div>
                     )}
                    {/* Main bar */}
                    <div 
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-za-cyan to-blue-500" 
                      style={{ width: `${Math.min((stat.A / stat.fullMark) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className="w-8 text-right font-mono font-bold text-slate-700 dark:text-white">{stat.A}</span>
                </div>
              ))}
              <div className="pt-3 mt-3 border-t border-gray-200 dark:border-white/10 flex justify-between items-center font-bold">
                 <span className="text-slate-500 dark:text-gray-400">TOTAL</span>
                 <span className="text-xl text-za-cyan font-display">
                    {Object.values(data.stats).reduce((a: number, b: number) => a + b, 0)}
                 </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
