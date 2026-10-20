"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { 
  Camera, 
  ZoomIn, 
  ZoomOut, 
  Crosshair, 
  Eye, 
  Layers, 
  AlertTriangle, 
  Compass, 
  Sparkles
} from "lucide-react";

interface DroneCameraViewProps {
  dronePosition?: { x: number; y: number; z: number };
  headingDeg?: number;
  pitchDeg?: number;
  batteryPct?: number;
  speedMps?: number;
  isSimulated?: boolean;
  linkQuality?: number;
  activeHazards?: Array<{
    sensor_type: string;
    severity: string;
    raw_value: number;
    details?: string;
    associated_object_id?: string;
  }>;
  visibleObjects?: Array<{
    object_class: string;
    object_id?: string;
    label?: string;
    confidence: number;
    bbox_x_min: number;
    bbox_y_min: number;
    bbox_x_max: number;
    bbox_y_max: number;
    drone_distance_m?: number;
    vision_provider?: string;
  }>;
  fusionResult?: {
    associated_object_id?: string | null;
    fusion_status?: string;
    confidence?: number;
  } | null;
  onSnapshot?: (dataUrl: string, metadata: any) => void;
  className?: string;
}

export default function DroneCameraView({
  dronePosition = { x: 2.0, y: 2.0, z: 1.8 },
  headingDeg = 0,
  pitchDeg = -15,
  batteryPct = 95.0,
  speedMps = 0.0,
  isSimulated = true,
  linkQuality = 98.0,
  activeHazards = [],
  visibleObjects = [],
  fusionResult = null,
  onSnapshot,
  className = "",
}: DroneCameraViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [showHud, setShowHud] = useState<boolean>(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [cameraPitchOffset, setCameraPitchOffset] = useState<number>(0);
  const [snapshotFlash, setSnapshotFlash] = useState<boolean>(false);

  // Initialize Three.js 3D Industrial Workshop Scene
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.035);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 50);
    cameraRef.current = camera;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    canvasRef.current = renderer.domElement;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 3. Lighting (Industrial High-Bay Lights)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xe0f2fe, 1.2);
    dirLight1.position.set(10, 15, 10);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const blueHangarLight = new THREE.PointLight(0x0284c7, 2.5, 25);
    blueHangarLight.position.set(10, 8, 7.5);
    scene.add(blueHangarLight);

    const amberLight = new THREE.PointLight(0xf59e0b, 1.8, 15);
    amberLight.position.set(10, 4, 3);
    scene.add(amberLight);

    // 4. Workshop Floor (20m x 15m)
    // Note in ThreeJS: X = workshop X, Z = workshop Y, Y = vertical height
    const floorGeo = new THREE.PlaneGeometry(24, 18);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(10, 0, 7.5);
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor Grid Lines
    const grid = new THREE.GridHelper(24, 24, 0x06b6d4, 0x334155);
    grid.position.set(10, 0.01, 7.5);
    scene.add(grid);

    // Workshop Safety Corridor Striping
    const walkwayGeo = new THREE.PlaneGeometry(20, 1.2);
    const walkwayMat = new THREE.MeshBasicMaterial({ color: 0x0369a1, transparent: true, opacity: 0.25 });
    const walkway = new THREE.Mesh(walkwayGeo, walkwayMat);
    walkway.rotation.x = -Math.PI / 2;
    walkway.position.set(10, 0.02, 6.0);
    scene.add(walkway);

    // 5. Overhead Piping Network
    // Gas Distribution Line (Yellow, height = 1.8m)
    const pipeMatGas = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.5, roughness: 0.3 });
    const gasPipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 16, 16), pipeMatGas);
    gasPipe1.rotation.z = Math.PI / 2;
    gasPipe1.position.set(10, 1.8, 3.0);
    scene.add(gasPipe1);

    const gasPipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 10, 16), pipeMatGas);
    gasPipe2.rotation.x = Math.PI / 2;
    gasPipe2.position.set(14, 1.8, 7.5);
    scene.add(gasPipe2);

    // Water Cooling Pipe (Green, height = 2.2m)
    const pipeMatWater = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.6, roughness: 0.3 });
    const waterPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 18, 16), pipeMatWater);
    waterPipe.rotation.z = Math.PI / 2;
    waterPipe.position.set(10, 2.2, 12.0);
    scene.add(waterPipe);

    // 6. Pipe Joints & Flanges (J-01 to J-06)
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8, roughness: 0.2 });
    const jointCoords = [
      { id: "J-01", x: 6.0, z: 2.5, y: 1.8 },
      { id: "J-02", x: 10.0, z: 3.0, y: 1.8 },
      { id: "J-03", x: 14.0, z: 4.0, y: 1.8 },
      { id: "J-04", x: 16.0, z: 12.0, y: 1.8 },
      { id: "J-05", x: 11.0, z: 12.0, y: 1.8 },
      { id: "J-06", x: 7.0, z: 10.0, y: 1.6 },
    ];
    jointCoords.forEach((j) => {
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16), jointMat);
      flange.position.set(j.x, j.y, j.z);
      scene.add(flange);

      const boltRing = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.03, 8, 16), jointMat);
      boltRing.rotation.x = Math.PI / 2;
      boltRing.position.set(j.x, j.y, j.z);
      scene.add(boltRing);
    });

    // 7. Isolation Valves (V-01 to V-04)
    const valveMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.4, roughness: 0.4 });
    const valveCoords = [
      { id: "V-01", x: 6.0, z: 2.5, y: 1.2 },
      { id: "V-02", x: 14.0, z: 4.0, y: 1.2 },
      { id: "V-03", x: 11.0, z: 12.0, y: 1.2 },
      { id: "V-04", x: 2.0, z: 4.0, y: 1.2 },
    ];
    valveCoords.forEach((v) => {
      // Valve body & handwheel
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 12), valveMat);
      stem.position.set(v.x, v.y, v.z);
      scene.add(stem);

      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 16), valveMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(v.x, v.y + 0.25, v.z);
      scene.add(wheel);
    });

    // 8. Machinery (PUMP-01, PUMP-02)
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });
    const pump1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), pumpMat);
    pump1.position.set(10.0, 0.45, 8.0);
    scene.add(pump1);

    const motor1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), pumpMat);
    motor1.rotation.z = Math.PI / 2;
    motor1.position.set(10.0, 0.55, 8.0);
    scene.add(motor1);

    const pump2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), pumpMat);
    pump2.position.set(15.0, 0.45, 9.0);
    scene.add(pump2);

    // 9. Electrical Control Panels (PANEL-E01, PANEL-E02)
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.2 });
    const panel1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.3), panelMat);
    panel1.position.set(2.0, 0.9, 8.0);
    scene.add(panel1);

    const panel2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.3), panelMat);
    panel2.position.set(18.0, 0.9, 6.0);
    scene.add(panel2);

    // Indicator LEDs on panels
    const ledGreen = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    ledGreen.position.set(2.0, 1.4, 7.84);
    scene.add(ledGreen);

    // 10. Workshop Safety Barriers / Cabinets
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.4, roughness: 0.5 });
    const cab1 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 0.8), cabinetMat);
    cab1.position.set(8.0, 0.8, 5.5);
    scene.add(cab1);

    const cab2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.8), cabinetMat);
    cab2.position.set(13.0, 0.8, 6.0);
    scene.add(cab2);

    // Render loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Synchronize Camera Position, Heading, Pitch & Zoom with Drone Telemetry
  useEffect(() => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current;

    // Coordinate mapping: ThreeJS X = workshop X, ThreeJS Z = workshop Y, ThreeJS Y = drone altitude Z
    camera.position.set(dronePosition.x, dronePosition.z, dronePosition.y);

    // Drone heading: 0 deg = East (+X in workshop), 90 deg = South (+Y in workshop / +Z in ThreeJS)
    const yawRad = THREE.MathUtils.degToRad(-headingDeg + 90);
    const totalPitch = pitchDeg + cameraPitchOffset;
    const pitchRad = THREE.MathUtils.degToRad(totalPitch);

    // Calculate look target vector
    const forwardX = Math.cos(yawRad) * Math.cos(pitchRad);
    const forwardY = Math.sin(pitchRad);
    const forwardZ = Math.sin(yawRad) * Math.cos(pitchRad);

    const lookTarget = new THREE.Vector3(
      camera.position.x + forwardX * 5.0,
      camera.position.y + forwardY * 5.0,
      camera.position.z + forwardZ * 5.0
    );
    camera.lookAt(lookTarget);

    // Apply Zoom level to FOV
    camera.fov = 70.0 / zoomLevel;
    camera.updateProjectionMatrix();
  }, [dronePosition, headingDeg, pitchDeg, cameraPitchOffset, zoomLevel]);

  // Capture Snapshot Handler
  const handleTakeSnapshot = () => {
    if (!canvasRef.current) return;
    setSnapshotFlash(true);
    setTimeout(() => setSnapshotFlash(false), 200);

    const dataUrl = canvasRef.current.toDataURL("image/png");
    if (onSnapshot) {
      onSnapshot(dataUrl, {
        dronePosition,
        headingDeg,
        pitchDeg: pitchDeg + cameraPitchOffset,
        visibleObjects,
        activeHazards,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const isHazardActive = activeHazards.some((h) => h.severity === "critical" || h.severity === "suspected");
  const primaryHazard = activeHazards[0];

  return (
    <div className={`relative w-full rounded-xl border border-industrial-800 bg-industrial-950 overflow-hidden shadow-2xl flex flex-col ${className}`}>
      {/* Camera Top Status Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-industrial-800 bg-industrial-900/90 text-xs font-mono backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <span className="text-tech-cyan font-bold flex items-center gap-1.5 uppercase tracking-wider">
            <Camera className="w-4 h-4 text-tech-cyan animate-pulse" />
            DRONE CAM 01 &bull; 1080P 30FPS
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isSimulated ? "bg-amber-950/80 text-tech-amber border border-tech-amber/30" : "bg-emerald-950 text-tech-green border border-tech-green/30"}`}>
            {isSimulated ? "SIMULATED SCENE" : "HARDWARE RTSP"}
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-slate-300">
            FOV: <span className="text-tech-cyan font-bold">{Math.round(70 / zoomLevel)}&deg;</span> | PITCH:{" "}
            <span className="text-tech-cyan font-bold">{pitchDeg + cameraPitchOffset}&deg;</span>
          </span>
          <span className="text-slate-300 hidden sm:inline">
            LINK: <span className="text-tech-green font-bold">{linkQuality}%</span>
          </span>
          <span className="text-slate-300 hidden sm:inline">
            ZOOM: <span className="text-tech-cyan font-bold">{zoomLevel.toFixed(1)}x</span>
          </span>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative w-full aspect-video min-h-[380px] bg-slate-950 overflow-hidden flex items-center justify-center">
        {/* 3D WebGL Canvas Mount */}
        <div ref={mountRef} className="absolute inset-0 w-full h-full" />

        {/* Snapshot Shutter Flash Effect */}
        {snapshotFlash && <div className="absolute inset-0 bg-white/70 pointer-events-none z-50 animate-fade-out" />}

        {/* Tactical HUD Overlay */}
        {showHud && (
          <div className="absolute inset-0 pointer-events-none z-10 p-4 flex flex-col justify-between">
            {/* Top Compass Heading Tape */}
            <div className="w-full flex justify-center">
              <div className="flex items-center gap-2 px-3 py-1 rounded bg-industrial-950/70 border border-tech-cyan/30 text-[11px] font-mono text-tech-cyan backdrop-blur">
                <Compass className="w-3.5 h-3.5 text-tech-cyan" />
                <span>HDG: <strong>{Math.round(headingDeg)}&deg;</strong></span>
                <span className="text-slate-500">|</span>
                <span>ALT: <strong>{dronePosition.z.toFixed(2)}m AGL</strong></span>
                <span className="text-slate-500">|</span>
                <span>SPD: <strong>{speedMps.toFixed(1)}m/s</strong></span>
              </div>
            </div>

            {/* Center Reticle / Pitch Crosshair */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-32 h-32 flex items-center justify-center">
                {/* Crosshair Center */}
                <Crosshair className="w-8 h-8 text-tech-cyan/60 stroke-[1.5]" />
                
                {/* Corner Pitch Brackets */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-tech-cyan/40" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-tech-cyan/40" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-tech-cyan/40" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-tech-cyan/40" />

                {/* Pitch Ladder Marks */}
                <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 text-[9px] font-mono text-tech-cyan/50">
                  <span>+10</span>
                  <span>---</span>
                  <span>-10</span>
                </div>
              </div>
            </div>

            {/* Bottom HUD Telemetry Strip */}
            <div className="w-full flex items-end justify-between text-xs font-mono">
              <div className="bg-industrial-950/80 border border-industrial-800 p-2 rounded backdrop-blur flex flex-col gap-1 text-[11px]">
                <div className="text-slate-300">
                  POS: <span className="text-tech-cyan">X: {dronePosition.x.toFixed(1)}m | Y: {dronePosition.y.toFixed(1)}m</span>
                </div>
                <div className="text-slate-300">
                  BATT: <span className={`${batteryPct < 25 ? "text-tech-red" : "text-tech-green"} font-bold`}>{batteryPct.toFixed(1)}%</span>
                </div>
              </div>

              {/* Sensor & Vision Fusion Status Pill */}
              {fusionResult && fusionResult.associated_object_id && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/85 border border-emerald-500/50 text-emerald-400 font-mono text-[11px] backdrop-blur shadow-lg animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>FUSED ASSET: <strong>{fusionResult.associated_object_id}</strong> ({Math.round((fusionResult.confidence || 0.8) * 100)}% CONF)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Computer Vision 2D Bounding Boxes Overlay */}
        {showBoundingBoxes && (
          <div className="absolute inset-0 pointer-events-none z-15">
            {visibleObjects.map((obj, idx) => {
              const left = `${obj.bbox_x_min * 100}%`;
              const top = `${obj.bbox_y_min * 100}%`;
              const width = `${(obj.bbox_x_max - obj.bbox_x_min) * 100}%`;
              const height = `${(obj.bbox_y_max - obj.bbox_y_min) * 100}%`;

              const isCorrelated = fusionResult?.associated_object_id === obj.object_id;
              const boxBorder = isCorrelated 
                ? "border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]" 
                : obj.object_class === "pipe_joint"
                ? "border-tech-cyan/80" 
                : "border-tech-amber/70";

              const badgeBg = isCorrelated ? "bg-emerald-600 text-white" : "bg-industrial-900/90 text-tech-cyan border border-tech-cyan/40";

              return (
                <div
                  key={`${obj.object_id || obj.object_class}-${idx}`}
                  style={{ left, top, width, height }}
                  className={`absolute border-2 rounded ${boxBorder} transition-all duration-200 pointer-events-auto group`}
                >
                  {/* Detection Label Badge */}
                  <div className={`absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap shadow ${badgeBg}`}>
                    {obj.object_id || obj.object_class.toUpperCase()} &bull; {Math.round(obj.confidence * 100)}%
                    {obj.drone_distance_m && <span className="text-slate-200 font-normal ml-1">({obj.drone_distance_m.toFixed(1)}m)</span>}
                  </div>

                  {/* Corner Targets */}
                  <div className="absolute -top-1 -left-1 w-2 h-2 bg-tech-cyan" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-tech-cyan" />
                  <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-tech-cyan" />
                  <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-tech-cyan" />
                </div>
              );
            })}
          </div>
        )}

        {/* Active Hazard Warning Banner (if present in scene) */}
        {isHazardActive && primaryHazard && (
          <div className="absolute top-4 left-4 right-4 z-20 pointer-events-none flex justify-center">
            <div className={`px-4 py-2 rounded-lg font-mono text-xs flex items-center gap-2.5 shadow-2xl backdrop-blur border ${primaryHazard.severity === "critical" ? "bg-red-950/90 border-red-500/80 text-red-200" : "bg-amber-950/90 border-amber-500/80 text-amber-200"}`}>
              <AlertTriangle className="w-4 h-4 animate-bounce text-red-400" />
              <span>
                <strong>{primaryHazard.severity.toUpperCase()} HAZARD DETECTED:</strong> {primaryHazard.sensor_type} ({primaryHazard.raw_value.toFixed(1)})
                {primaryHazard.associated_object_id && (
                  <span className="underline ml-1 font-bold">@ {primaryHazard.associated_object_id}</span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Camera Control Footer Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-industrial-900 border-t border-industrial-800 text-xs font-mono z-20">
        {/* Left: View & HUD Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHud(!showHud)}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${showHud ? "bg-tech-cyan/20 text-tech-cyan border border-tech-cyan/40" : "bg-industrial-800 text-slate-400"}`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>HUD</span>
          </button>

          <button
            onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${showBoundingBoxes ? "bg-tech-cyan/20 text-tech-cyan border border-tech-cyan/40" : "bg-industrial-800 text-slate-400"}`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>CV LABELS ({visibleObjects.length})</span>
          </button>

          <button
            onClick={handleTakeSnapshot}
            className="px-3 py-1 rounded bg-industrial-800 hover:bg-tech-cyan/20 text-slate-200 hover:text-tech-cyan border border-slate-700 hover:border-tech-cyan/40 flex items-center gap-1.5 transition-all"
          >
            <Camera className="w-3.5 h-3.5 text-tech-cyan" />
            <span>CAPTURE EVIDENCE</span>
          </button>
        </div>

        {/* Right: Tilt & Zoom Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span>TILT:</span>
            <button
              onClick={() => setCameraPitchOffset((p) => Math.min(30, p + 5))}
              className="px-1.5 py-0.5 rounded bg-industrial-800 text-slate-200 hover:text-white"
            >
              &uarr;
            </button>
            <button
              onClick={() => setCameraPitchOffset((p) => Math.max(-30, p - 5))}
              className="px-1.5 py-0.5 rounded bg-industrial-800 text-slate-200 hover:text-white"
            >
              &darr;
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <span>ZOOM:</span>
            <button
              onClick={() => setZoomLevel((z) => Math.max(1.0, z - 0.25))}
              className="px-1.5 py-0.5 rounded bg-industrial-800 text-slate-200 hover:text-white"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="w-8 text-center text-tech-cyan">{zoomLevel.toFixed(1)}x</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(3.0, z + 0.25))}
              className="px-1.5 py-0.5 rounded bg-industrial-800 text-slate-200 hover:text-white"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
