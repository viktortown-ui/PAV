import { memo, useCallback, useEffect, useMemo, useRef, useState, WheelEvent as ReactWheelEvent, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import ReactFlow, { Background, ReactFlowInstance, SelectionMode, Viewport, getViewportForBounds } from 'reactflow';
import { shallow } from 'zustand/shallow';
import { FlowEdge } from '../../ui/edges/FlowEdge';
import { ProcessNode } from '../../ui/nodes/ProcessNode';
import { useAppStore } from '../../store/useAppStore';
import { instrumentCallsite } from '../../utils/instrumentation';
import { LocalActionPanel } from './LocalActionPanel';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const VIEWPORT_POSITION_EPSILON = 0.5;
const VIEWPORT_ZOOM_EPSILON = 0.001;
const isDev = import.meta.env.DEV;

const nodeTypes = { processNode: ProcessNode };
const edgeTypes = { flowEdge: FlowEdge };
const EDGE_ANCHOR_OFFSET = 26;

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

const CanvasEditorComponent = ({ focusMode = false, activeTool = 'select', gridEnabled = true }: { focusMode?: boolean; activeTool?: 'select' | 'connect'; gridEnabled?: boolean }) => {
  const edgeLabelMode = useAppStore((state) => state.edgeLabelMode);
  const {
    nodes: projectNodes,
    edges: projectEdges,
    view,
    selectedNodeId,
    selectedEdgeId,
    issues,
    pathSelection,
    showProblematicOnly,
    hoveredEdgeId,
    simulationStatus,
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
    selectedEdgeId: state.selectedEdgeId,
    issues: state.issues,
    pathSelection: state.pathSelection,
    showProblematicOnly: state.showProblematicOnly,
    hoveredEdgeId: state.hoveredEdgeId,
    simulationStatus: state.project.simulation.status ?? (state.project.simulation.running ? 'running' : 'idle'),
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
  const latestViewRef = useRef(view);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [isViewportLocked, setIsViewportLocked] = useState(false);
  const [liveViewport, setLiveViewport] = useState<Viewport>(view.viewport);

  useEffect(() => {
    latestViewRef.current = view;
    setLiveViewport(view.viewport);
  }, [view]);

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current != null) tickSimulation((time - lastTimeRef.current) / 1000);
    lastTimeRef.current = time;
    frameRef.current = requestAnimationFrame(animate);
  }, [tickSimulation]);

  useEffect(() => {
    if (simulationStatus !== 'running') {
      lastTimeRef.current = undefined;
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = undefined;
      }
      return;
    }
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = undefined;
      }
    };
  }, [animate, simulationStatus]);

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
  const selectedNode = useMemo(() => projectNodes.find((node) => node.id === selectedNodeId), [projectNodes, selectedNodeId]);
  const selectedEdge = useMemo(() => projectEdges.find((edge) => edge.id === selectedEdgeId), [projectEdges, selectedEdgeId]);

  const getNodeVisualSize = useCallback((className: string) => {
    if (className === 'major') return { width: 230, height: 122 };
    if (className === 'valve' || className === 'instrument' || className === 'topology') return { width: 138, height: 86 };
    if (className === 'terminal') return { width: 150, height: 88 };
    return { width: 180, height: 98 };
  }, []);

  const localPanelAnchor = useMemo(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;
    const viewportWidth = shell.clientWidth;
    const viewportHeight = shell.clientHeight;
    if (!viewportWidth || !viewportHeight) return undefined;

    if (selectedNode) {
      const nodeSize = getNodeVisualSize(selectedNode.data.className);
      const anchorX = selectedNode.position.x * liveViewport.zoom + liveViewport.x + nodeSize.width;
      const anchorY = selectedNode.position.y * liveViewport.zoom + liveViewport.y + nodeSize.height / 2;
      return { x: anchorX, y: anchorY, viewportWidth, viewportHeight };
    }

    if (selectedEdge) {
      const source = projectNodes.find((node) => node.id === selectedEdge.source);
      const target = projectNodes.find((node) => node.id === selectedEdge.target);
      if (!source || !target) return undefined;
      const sourceSize = getNodeVisualSize(source.data.className);
      const targetSize = getNodeVisualSize(target.data.className);
      const sourceCenterX = source.position.x + sourceSize.width / 2;
      const sourceCenterY = source.position.y + sourceSize.height / 2;
      const targetCenterX = target.position.x + targetSize.width / 2;
      const targetCenterY = target.position.y + targetSize.height / 2;
      const midX = (sourceCenterX + targetCenterX) / 2;
      const midY = (sourceCenterY + targetCenterY) / 2;
      return {
        x: midX * liveViewport.zoom + liveViewport.x,
        y: midY * liveViewport.zoom + liveViewport.y - EDGE_ANCHOR_OFFSET,
        viewportWidth,
        viewportHeight,
      };
    }

    return undefined;
  }, [getNodeVisualSize, liveViewport.x, liveViewport.y, liveViewport.zoom, projectNodes, selectedEdge, selectedNode]);

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
    instrumentCallsite('setViewport', {
      callsite: `CanvasEditor.applyViewport(${mode})`,
      when: mode === 'restore'
        ? `Runs after a project restore/import/template load nonce changes (${reason}).`
        : `Runs after a curated viewport request such as initial load or resize (${reason}).`,
      why: mode === 'restore'
        ? 'It replays the saved viewport so the restored project opens in the same place.'
        : 'It computes and applies the metadata-driven viewport that frames the template safely.',
      repeatable: mode === 'curated',
      guidance: mode === 'curated' ? 'throttle' : 'none',
      details: { currentViewport, targetViewport },
    });
    debugLog('viewport', `${reason}: applying ${mode} viewport`, { currentViewport, targetViewport });
    await flow.setViewport(targetViewport, { duration: 0 });
    if (mode === 'curated' && !sameViewport(latestViewRef.current.viewport, targetViewport)) {
      setViewportState(targetViewport, { manual: false });
    }
  }, [buildCuratedViewport, flow, setViewportState]);

  useEffect(() => {
    if (!flow) return;
    if (appliedViewportNonceRef.current === viewportNonce) return;
    appliedViewportNonceRef.current = viewportNonce;
    debugLog('startup', `viewport nonce ${viewportNonce} received`);
    void applyViewport(view.hasManualViewport ? 'restore' : 'curated', 'initial-load');
  }, [applyViewport, flow, view.hasManualViewport, viewportNonce]);


  const stopCanvasViewportPropagation = useCallback((event: ReactWheelEvent<HTMLElement> | ReactPointerEvent<HTMLElement> | ReactMouseEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  const handleFitToView = useCallback(async () => {
    if (!flow) return;
    await flow.fitView({ padding: 0.2, duration: 220 });
  }, [flow]);

  return (
    <div className={`canvas-shell sim-${simulationStatus} ${focusMode ? 'is-focus-mode' : ''}`} ref={shellRef}>
      <ReactFlow
        panOnDrag={!isViewportLocked && activeTool === 'select'}
        zoomOnScroll={!isViewportLocked}
        zoomOnPinch={!isViewportLocked}
        zoomOnDoubleClick={!isViewportLocked}
        panOnScroll={!isViewportLocked}
        nodesDraggable={activeTool === 'select'}
        elementsSelectable={activeTool === 'select'}
        nodesConnectable={activeTool === 'connect'}
        selectionOnDrag={activeTool === 'select'}
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
          setLiveViewport(viewport);
          if (suppressMoveEndRef.current) {
            suppressMoveEndRef.current = false;
            return;
          }
          if (sameViewport(latestViewRef.current.viewport, viewport) && latestViewRef.current.hasManualViewport) return;
          debugLog('viewport', 'move end -> persist manual viewport', viewport);
          setViewportState(viewport, { manual: true });
        }}
        onMove={(_, viewport) => setLiveViewport(viewport)}
        snapToGrid={gridEnabled}
        snapGrid={[20, 20]}
        minZoom={0.45}
        maxZoom={1.3}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
      >
        {gridEnabled ? <Background color="rgba(93,117,145,0.18)" gap={24} size={1.2} /> : null}
      </ReactFlow>
      <LocalActionPanel selectedNode={selectedNode} selectedEdge={selectedEdge} anchor={localPanelAnchor} presentationMode={view.presentationMode} />
      {!focusMode ? (
        <div className="canvas-navigation-cluster" aria-label="Управление видом" onWheel={stopCanvasViewportPropagation} onPointerDown={stopCanvasViewportPropagation} onMouseDown={stopCanvasViewportPropagation}>
          <div className="viewport-controls-card" aria-label="Управление видом">
            <div className="viewport-controls-card__title">Вид схемы</div>
            <div className="viewport-controls-stack">
              <button type="button" className="viewport-control-button" title="Увеличить" aria-label="Увеличить" onClick={() => void flow?.zoomIn({ duration: 180 })}>+</button>
              <button type="button" className="viewport-control-button" title="Уменьшить" aria-label="Уменьшить" onClick={() => void flow?.zoomOut({ duration: 180 })}>−</button>
              <button type="button" className="viewport-control-button viewport-control-button--fit" title="Вписать схему" aria-label="Вписать схему" onClick={() => void handleFitToView()}>⤢</button>
              <button
                type="button"
                className={`viewport-control-button ${isViewportLocked ? 'is-active' : ''}`}
                title={isViewportLocked ? 'Разблокировать перемещение' : 'Зафиксировать вид'}
                aria-label={isViewportLocked ? 'Разблокировать перемещение' : 'Зафиксировать вид'}
                onClick={() => setIsViewportLocked((current) => !current)}
              >
                {isViewportLocked ? '🔒' : '🔓'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const CanvasEditor = memo(CanvasEditorComponent);
