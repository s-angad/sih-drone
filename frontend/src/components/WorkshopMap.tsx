"use client";

import React, { useState, useRef } from "react";
import { Compass } from "lucide-react";

interface WorkshopMapProps {
  layout?: {
    workshop_name?: string;
    dimensions?: { width: number; length: number; height: number };
    pipes?: any[];
    valves?: any[];
    joints?: any[];
    workstations?: any[];
    obstacles?: any[];
  };
  dronePosition?: { x: number; y: number; z: number };
  headingDeg?: number;
  trajectory?: Array<{ x: number; y: number; z: number }>;
  hazards?: Array<{
    id: string;
    position_x?: number;
    position_y?: number;
    position?: { x: number; y: number; z: number };
    severity: string;
    sensor_type: string;
    details?: string;
  }>;
  groundTruthFaults?: Array<{
    fault_id?: string;
    fault_type: string;
    x: number;
    y: number;
    z: number;
    radius_meters?: number;
    description?: string;
  }>; // Only shown in Replay / Instructor mode!
  onMapClick?: (coords: { x: number; y: number }) => void;
  selectedCoords?: { x: number; y: number } | null;
  interactive?: boolean;
}

export default function WorkshopMap({
  layout,
  dronePosition = { x: 2.0, y: 2.0, z: 1.5 },
  headingDeg = 0,
  trajectory = [],
  hazards = [],
  groundTruthFaults = [],
  onMapClick,
  selectedCoords = null,
  interactive = true,
}: WorkshopMapProps) {
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const widthMeters = layout?.dimensions?.width || 20.0;
  const lengthMeters = layout?.dimensions?.length || 15.0;

  // SVG viewBox scale: 0 to 1000 width, 0 to 750 height (50 SVG units per meter)
  const svgWidth = 1000;
  const svgHeight = 750;
  const scaleX = svgWidth / widthMeters;
  const scaleY = svgHeight / lengthMeters;

  const toSvgX = (x: number) => Math.max(0, Math.min(svgWidth, x * scaleX));
  const toSvgY = (y: number) => Math.max(0, Math.min(svgHeight, y * scaleY));

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !svgRef.current || !onMapClick) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const realX = round((clickX / rect.width) * widthMeters, 2);
    const realY = round((clickY / rect.height) * lengthMeters, 2);

    onMapClick({ x: realX, y: realY });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const moveX = e.clientX - rect.left;
    const moveY = e.clientY - rect.top;
    const realX = round((moveX / rect.width) * widthMeters, 1);
    const realY = round((moveY / rect.height) * lengthMeters, 1);
    setHoverCoords({ x: realX, y: realY });
  };

  const round = (val: number, decimals: number) => {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  };

  // Trajectory SVG polyline string
  const polylinePoints = trajectory
    .map((pt) => `${toSvgX(pt.x)},${toSvgY(pt.y)}`)
    .join(" ");

  return (
    <div className="relative w-full rounded-xl border border-industrial-800 bg-industrial-950 overflow-hidden shadow-2xl flex flex-col">
      {/* Top Map Status Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-industrial-800 bg-industrial-900/80 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-tech-cyan font-bold tracking-wider flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-tech-cyan animate-pulse" />
            BAY 4 FLOORPLAN (20m x 15m)
          </span>
          <span className="text-slate-400 hidden sm:inline">
            GRID: 2.0m RESOLUTION
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          {hoverCoords && (
            <span className="text-slate-300">
              CURSOR: X: <span className="text-tech-cyan font-semibold">{hoverCoords.x}m</span> | Y:{" "}
              <span className="text-tech-cyan font-semibold">{hoverCoords.y}m</span>
            </span>
          )}
          <span className="text-slate-400">
            DRONE: X: <span className="text-tech-green">{round(dronePosition.x, 2)}m</span> | Y:{" "}
            <span className="text-tech-green">{round(dronePosition.y, 2)}m</span> | ALT:{" "}
            <span className="text-tech-cyan">{round(dronePosition.z, 2)}m</span>
          </span>
        </div>
      </div>

      {/* Main SVG Workshop Canvas */}
      <div className="relative w-full aspect-[4/3] bg-[#070b14] select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className={`w-full h-full ${interactive ? "cursor-crosshair" : "cursor-default"}`}
          onClick={handleSvgClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverCoords(null)}
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="minorGrid" width="25" height="25" patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#131b2c" strokeWidth="0.8" />
            </pattern>
            <pattern id="majorGrid" width="100" height="100" patternUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="url(#minorGrid)" />
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#1c2842" strokeWidth="1.5" />
            </pattern>

            {/* Drone Scan Radar Pulse Gradient */}
            <radialGradient id="dronePulse" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>

            {/* Hazard Pulse Gradients */}
            <radialGradient id="critPulse" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.5" />
              <stop offset="80%" stopColor="#ef4444" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="warnPulse" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
              <stop offset="80%" stopColor="#f59e0b" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Grid */}
          <rect width={svgWidth} height={svgHeight} fill="url(#majorGrid)" />

          {/* Workshop Outer Walls */}
          <rect
            x="20"
            y="20"
            width={svgWidth - 40}
            height={svgHeight - 40}
            fill="none"
            stroke="#2a3b5c"
            strokeWidth="3"
            strokeDasharray="6 4"
          />

          {/* Workstations Zones */}
          {layout?.workstations?.map((ws: any) => {
            const wx = toSvgX(ws.position.x);
            const wy = toSvgY(ws.position.y);
            const wdx = ws.size?.dx ? ws.size.dx * scaleX : 90;
            const wdy = ws.size?.dy ? ws.size.dy * scaleY : 70;
            return (
              <g
                key={ws.id}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEntity(ws);
                }}
              >
                <rect
                  x={wx - wdx / 2}
                  y={wy - wdy / 2}
                  width={wdx}
                  height={wdy}
                  fill="#141d2f"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  rx="6"
                  className="group-hover:stroke-tech-cyan transition-all"
                />
                <text
                  x={wx}
                  y={wy - 6}
                  fill="#94a3b8"
                  fontSize="11"
                  textAnchor="middle"
                  fontFamily="monospace"
                  className="group-hover:fill-tech-cyan"
                >
                  {ws.name}
                </text>
                <text
                  x={wx}
                  y={wy + 12}
                  fill="#64748b"
                  fontSize="9"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  [{ws.id}]
                </text>
              </g>
            );
          })}

          {/* Pipes Lines */}
          {layout?.pipes?.map((pipe: any) => {
            const x1 = toSvgX(pipe.from.x);
            const y1 = toSvgY(pipe.from.y);
            const x2 = toSvgX(pipe.to.x);
            const y2 = toSvgY(pipe.to.y);

            let strokeColor = "#38bdf8"; // water/default
            if (pipe.type === "gas_manifold" || pipe.type === "gas_branch") {
              strokeColor = "#eab308"; // yellow for gas
            } else if (pipe.type === "steam_line") {
              strokeColor = "#f97316"; // orange for high-temp steam
            }

            return (
              <g
                key={pipe.id}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEntity(pipe);
                }}
              >
                {/* Glow/Hit area */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeColor}
                  strokeWidth="12"
                  strokeOpacity="0.15"
                />
                {/* Actual Pipe */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeColor}
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                {/* Pipe Label */}
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 8}
                  fill={strokeColor}
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="bg-black/50"
                >
                  {pipe.name} ({pipe.diameter_in}&quot;)
                </text>
              </g>
            );
          })}

          {/* Flange Joints */}
          {layout?.joints?.map((joint: any) => {
            const jx = toSvgX(joint.position.x);
            const jy = toSvgY(joint.position.y);
            return (
              <g
                key={joint.id}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEntity(joint);
                }}
              >
                <circle cx={jx} cy={jy} r="7" fill="#1e293b" stroke="#eab308" strokeWidth="2" />
                <circle cx={jx} cy={jy} r="2.5" fill="#facc15" />
                <text
                  x={jx}
                  y={jy + 16}
                  fill="#cbd5e1"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {joint.id}
                </text>
              </g>
            );
          })}

          {/* Valves */}
          {layout?.valves?.map((valve: any) => {
            const vx = toSvgX(valve.position.x);
            const vy = toSvgY(valve.position.y);
            return (
              <g
                key={valve.id}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEntity(valve);
                }}
              >
                <polygon
                  points={`${vx - 9},${vy - 7} ${vx + 9},${vy + 7} ${vx - 9},${vy + 7} ${vx + 9},${vy - 7}`}
                  fill="#0284c7"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <circle cx={vx} cy={vy - 10} r="4" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                <text
                  x={vx}
                  y={vy + 18}
                  fill="#38bdf8"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {valve.name}
                </text>
              </g>
            );
          })}

          {/* Obstacles (Columns / Gantries) */}
          {layout?.obstacles?.map((ob: any) => {
            const ox = toSvgX(ob.position.x);
            const oy = toSvgY(ob.position.y);
            const rad = (ob.radius || 0.5) * scaleX;
            return (
              <g key={ob.id}>
                <circle cx={ox} cy={oy} r={rad} fill="#1e2230" stroke="#475569" strokeWidth="1.5" />
                <text
                  x={ox}
                  y={oy + 4}
                  fill="#64748b"
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {ob.name}
                </text>
              </g>
            );
          })}

          {/* Trainee Drone Flight Trajectory Trail */}
          {trajectory.length > 1 && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.5"
              strokeDasharray="4 3"
              strokeOpacity="0.75"
            />
          )}

          {/* Real-Time Hazard Alert Markers */}
          {hazards.map((h, idx) => {
            const hx = toSvgX(h.position_x ?? h.position?.x ?? 0);
            const hy = toSvgY(h.position_y ?? h.position?.y ?? 0);
            const isCrit = h.severity === "critical";

            return (
              <g key={h.id || idx} className="cursor-pointer">
                <circle
                  cx={hx}
                  cy={hy}
                  r="28"
                  fill={isCrit ? "url(#critPulse)" : "url(#warnPulse)"}
                  className="pulse-hazard"
                />
                <circle
                  cx={hx}
                  cy={hy}
                  r="9"
                  fill={isCrit ? "#ef4444" : "#f59e0b"}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <text
                  x={hx}
                  y={hy - 14}
                  fill={isCrit ? "#fca5a5" : "#fde68a"}
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {isCrit ? "CRIT ANOMALY" : "SUSPECTED"}
                </text>
              </g>
            );
          })}

          {/* Ground-Truth Fault Centers (Revealed ONLY in Replay / Instructor mode!) */}
          {groundTruthFaults.map((gt, i) => {
            const gx = toSvgX(gt.x);
            const gy = toSvgY(gt.y);
            const gRadius = (gt.radius_meters || 2.0) * scaleX;
            return (
              <g key={gt.fault_id || i}>
                <circle
                  cx={gx}
                  cy={gy}
                  r={gRadius}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  opacity="0.85"
                />
                <circle cx={gx} cy={gy} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                <text
                  x={gx}
                  y={gy + 20}
                  fill="#10b981"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  GROUND TRUTH: {gt.fault_type}
                </text>
              </g>
            );
          })}

          {/* User Selected Pinpoint Coordinates (Crosshairs) */}
          {selectedCoords && (
            <g>
              <line
                x1={toSvgX(selectedCoords.x) - 18}
                y1={toSvgY(selectedCoords.y)}
                x2={toSvgX(selectedCoords.x) + 18}
                y2={toSvgY(selectedCoords.y)}
                stroke="#06b6d4"
                strokeWidth="2"
              />
              <line
                x1={toSvgX(selectedCoords.x)}
                y1={toSvgY(selectedCoords.y) - 18}
                x2={toSvgX(selectedCoords.x)}
                y2={toSvgY(selectedCoords.y) + 18}
                stroke="#06b6d4"
                strokeWidth="2"
              />
              <circle
                cx={toSvgX(selectedCoords.x)}
                cy={toSvgY(selectedCoords.y)}
                r="12"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              <text
                x={toSvgX(selectedCoords.x) + 16}
                y={toSvgY(selectedCoords.y) - 10}
                fill="#06b6d4"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                TARGET ({selectedCoords.x}m, {selectedCoords.y}m)
              </text>
            </g>
          )}

          {/* Animated Active Drone Position Marker */}
          {dronePosition && (
            <g
              transform={`translate(${toSvgX(dronePosition.x)}, ${toSvgY(dronePosition.y)}) rotate(${headingDeg})`}
              className="transition-all duration-300"
            >
              {/* Radar Hover Pulse Field */}
              <circle r="45" fill="url(#dronePulse)" />

              {/* Drone Body Frame (Cross arm quadcopter) */}
              <line x1="-14" y1="-14" x2="14" y2="14" stroke="#e2e8f0" strokeWidth="3" />
              <line x1="-14" y1="14" x2="14" y2="-14" stroke="#e2e8f0" strokeWidth="3" />

              {/* 4 Rotors */}
              <circle cx="-14" cy="-14" r="5" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
              <circle cx="14" cy="-14" r="5" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
              <circle cx="-14" cy="14" r="5" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
              <circle cx="14" cy="14" r="5" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />

              {/* Center Fuselage Hub */}
              <circle cx="0" cy="0" r="7" fill="#0f172a" stroke="#06b6d4" strokeWidth="2.5" />
              <circle cx="0" cy="0" r="3" fill="#06b6d4" />

              {/* Forward Heading Pointer (Aligned with +X East = 0 deg) */}
              <polygon points="16,0 8,-4 8,4" fill="#10b981" />
            </g>
          )}
        </svg>

        {/* Selected Map Feature Drawer */}
        {selectedEntity && (
          <div className="absolute bottom-3 left-3 bg-industrial-900/95 border border-tech-cyan/40 p-3 rounded-lg text-xs max-w-sm backdrop-blur shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-1">
              <span className="font-bold text-tech-cyan font-mono uppercase">
                {selectedEntity.name || selectedEntity.id}
              </span>
              <button
                onClick={() => setSelectedEntity(null)}
                className="text-slate-400 hover:text-white font-mono"
              >
                [X]
              </button>
            </div>
            <p className="text-slate-300 text-[11px] mb-1">
              Type: <span className="font-mono text-slate-100">{selectedEntity.type || "Industrial Asset"}</span>
            </p>
            {selectedEntity.position && (
              <p className="text-slate-400 font-mono text-[10px]">
                Coordinates: ({selectedEntity.position.x}m, {selectedEntity.position.y}m, {selectedEntity.position.z}m)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Map Footer Controls / Legend */}
      <div className="p-3 bg-industrial-900 border-t border-industrial-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-tech-cyan" /> Drone Position
          </span>
          <span className="flex items-center gap-1.5 text-yellow-400">
            <span className="w-4 h-1 bg-yellow-400 rounded" /> Combustible Gas Pipe
          </span>
          <span className="flex items-center gap-1.5 text-orange-400">
            <span className="w-4 h-1 bg-orange-400 rounded" /> Steam Line
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" /> Hazard Exceedance
          </span>
        </div>

        {interactive && (
          <div className="text-[11px] text-slate-400 font-mono italic">
            Click map to pinpoint target coords for reinspection or diagnosis
          </div>
        )}
      </div>
    </div>
  );
}
