import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Panel, ReactFlowInstance, SelectionMode, Viewport, getViewportForBounds } from 'reactflow';
import { shallow } from 'zustand/shallow';
import { FlowEdge } from '../../edges/FlowEdge';
import { ProcessNode } from '../../nodes/ProcessNode';
import { useAppStore } from '../../store/useAppStore';
import { SimulationPanel } from '../simulation/SimulationPanel';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const VIEWPORT_POSITION_EPSILON = 0.5;
const VIEWPORT_ZOOM_EPSILON = 0.001;
const RESIZE_APPLY_DELAY_MS = 120;
const isDev = import.meta.env.DEV;

const nodeTypes = { processNode: ProcessNode };
const edgeTypes = { flowEdge: FlowEdge };

const sameViewport = (a: Viewport, b: Viewport) => (
  Math.abs(a.x - b.x) < VIEWPORT_POSITION_EPSILON
  && Math.abs(a.y - b.y) < VIEWPORT_POSITION_EPSILON
  && Math.abs(a.zoom - b.zoom) < VIEWPORT_ZOOM_EPSILON
);

const debugLog = (scope: string, message: string, payload?: unknown) => {
  if (!isDev) return;
  if (payload === undefined) console.debug(`[perf:${scope}] ${message}`);
  else console.debug(`[perf:${scope}] ${message}`, payload);
};

const CanvasEditorComponent = () => {
  const {
    nodes: projectNodes,
    edges: projectEdges,
    view,
    selectedNodeId,
    issues,
    pathSelection,
    showProblematicOnly,
    hoveredEdgeId,
    edgeLabelMode,
    viewportNonce,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    selectEdge,
    setViewportState,
    tickSimulation,
    hoverEdge,
  } = useAppStore((state) => ({
    nodes: state.project.nodes,
    edges: state.project.edges,
    view: state.project.view,
    selectedNodeId: state.selectedNodeId,
    issues: state.issues,
    pathSelection: state.pathSelection,
    showProblematicOnly: state.showProblematicOnly,
    hoveredEdgeId: state.hoveredEdgeId,
    edgeLabelMode: state.edgeLabelMode,
    viewportNonce: state.viewportNonce,
    onNodesChange: state.onNodesChange,
    onEdgesChange: state.onEdgesChange,
    onConnect: state.onConnect,
    selectNode: state.selectNode,
    selectEdge: state.selectEdge,
    setViewportState: state.setViewport,
    tickSimulation: state.tickSimulation,
    hoverEdge: state.hoverEdge,
  }), shallow);
  const frameRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const shellRef = useRef<HTMLDivElement>(null);
  const suppressMoveEndRef = useRef(false);
  const appliedViewportNonceRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const latestViewRef = useRef(view);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    latestViewRef.current = view;
  }, [view]);

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current != null) tickSimulation((time - lastTimeRef.current) / 1000);
    lastTimeRef.current = time;
    frameRef.current = requestAnimationFrame(animate);
  }, [tickSimulation]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [animate]);

  const problemNodeIds = useMemo(() => new Set(issues.flatMap((issue) => issue.nodeIds ?? [])), [issues]);
  const problemEdgeIds = useMemo(() => new Set(issues.flatMap((issue) => issue.edgeIds ?? [])), [issues]);

  const nodes = useMemo(() => projectNodes.map((node) => ({
    ...node,
    hidden: showProblematicOnly ? !problemNodeIds.has(node.id) : false,
    style: {
      opacity: pathSelection.upstream.length || pathSelection.downstream.length
        ? (pathSelection.upstream.includes(node.id) || pathSelection.downstream.includes(node.id) || node.id === selectedNodeId ? 1 : 0.22)
        : 1,
    },
  })), [pathSelection.downstream, pathSelection.upstream, problemNodeIds, projectNodes, selectedNodeId, showProblematicOnly]);

  const edges = useMemo(() => projectEdges.map((edge) => ({
    ...edge,
    hidden: showProblematicOnly ? !problemEdgeIds.has(edge.id) : false,
    data: { ...edge.data, selectedPath: pathSelection.edges.includes(edge.id), hovered: hoveredEdgeId === edge.id, labelMode: edgeLabelMode },
    style: { opacity: pathSelection.edges.length ? (pathSelection.edges.includes(edge.id) ? 1 : 0.16) : 1 },
  })), [edgeLabelMode, hoveredEdgeId, pathSelection.edges, problemEdgeIds, projectEdges, showProblematicOnly]);

  const buildCuratedViewport = useCallback((): Viewport | null => {
    if (!shellRef.current) return null;
    const width = shellRef.current.clientWidth;
    const height = shellRef.current.clientHeight;
    if (!width || !height) return null;

    const metadata = latestViewRef.current.metadata;
    const minZoom = clamp(metadata.minZoom ?? metadata.defaultZoom * 0.88, 0.2, 2);
    const maxZoom = clamp(metadata.maxZoom ?? metadata.defaultZoom * 1.08, minZoom, 2);
    const focusBounds = metadata.focusBounds ?? (() => {
      const xs = projectNodes.map((node) => node.position.x);
      const ys = projectNodes.map((node) => node.position.y);
      const minX = Math.min(...xs, metadata.center.x - 120);
      const minY = Math.min(...ys, metadata.center.y - 120);
      const maxX = Math.max(...xs, metadata.center.x + 120);
      const maxY = Math.max(...ys, metadata.center.y + 120);
      return { x: minX, y: minY, width: Math.max(220, maxX - minX + 220), height: Math.max(180, maxY - minY + 180) };
    })();

    const fitted = getViewportForBounds(focusBounds, width, height, minZoom, maxZoom, metadata.preferredPadding);
    const zoom = clamp(fitted.zoom, minZoom, maxZoom);
    return {
      x: width / 2 - metadata.center.x * zoom,
      y: height / 2 - metadata.center.y * zoom,
      zoom,
    };
  }, [projectNodes]);

  const applyViewport = useCallback(async (mode: 'restore' | 'curated', reason: string) => {
    if (!flow) return;
    const targetViewport = mode === 'restore' ? latestViewRef.current.viewport : buildCuratedViewport();
    if (!targetViewport) return;

    const currentViewport = flow.getViewport();
    if (sameViewport(currentViewport, targetViewport)) {
      debugLog('viewport', `${reason}: skipped unchanged ${mode} viewport`, targetViewport);
      return;
    }

    suppressMoveEndRef.current = true;
    debugLog('viewport', `${reason}: applying ${mode} viewport`, { currentViewport, targetViewport });
    await flow.setViewport(targetViewport, { duration: 0 });
    if (mode === 'curated') setViewportState(targetViewport, { manual: false });
  }, [buildCuratedViewport, flow, setViewportState]);

  useEffect(() => {
    if (!flow) return;
    if (appliedViewportNonceRef.current === viewportNonce) return;
    appliedViewportNonceRef.current = viewportNonce;
    debugLog('startup', `viewport nonce ${viewportNonce} received`);
    void applyViewport(view.hasManualViewport ? 'restore' : 'curated', 'initial-load');
  }, [applyViewport, flow, view.hasManualViewport, viewportNonce]);

  useEffect(() => {
    if (!shellRef.current || !flow || latestViewRef.current.hasManualViewport) return;
    const observer = new ResizeObserver(() => {
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(() => {
        debugLog('viewport', 'container resize scheduled curated viewport');
        void applyViewport('curated', 'resize');
      }, RESIZE_APPLY_DELAY_MS);
    });
    observer.observe(shellRef.current);
    return () => {
      observer.disconnect();
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
    };
  }, [applyViewport, flow, view.hasManualViewport]);

  return (
    <div className="canvas-shell" ref={shellRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => {
          debugLog('startup', 'react-flow initialized');
          setFlow(instance);
        }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => selectNode(node.id)}
        onEdgeClick={(_, edge) => selectEdge(edge.id)}
        onEdgeMouseEnter={(_, edge) => hoverEdge(edge.id)}
        onEdgeMouseLeave={() => hoverEdge(undefined)}
        onPaneClick={() => { selectNode(undefined); selectEdge(undefined); hoverEdge(undefined); }}
        defaultViewport={view.viewport}
        onMoveEnd={(_, viewport) => {
          if (suppressMoveEndRef.current) {
            suppressMoveEndRef.current = false;
            return;
          }
          if (sameViewport(latestViewRef.current.viewport, viewport) && latestViewRef.current.hasManualViewport) return;
          debugLog('viewport', 'move end -> persist manual viewport', viewport);
          setViewportState(viewport, { manual: true });
        }}
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.45}
        maxZoom={1.3}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
      >
        <Background color="rgba(93,117,145,0.18)" gap={24} size={1.2} />
        <MiniMap pannable zoomable className="minimap" maskColor="rgba(8,12,18,0.78)" />
        <Controls showInteractive={false} />
        <Panel position="bottom-center"><SimulationPanel /></Panel>
      </ReactFlow>
    </div>
  );
};

export const CanvasEditor = memo(CanvasEditorComponent);
