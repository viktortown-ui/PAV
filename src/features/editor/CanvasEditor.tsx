import { memo, useCallback, useEffect, useMemo, useRef, useState, WheelEvent as ReactWheelEvent, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import ReactFlow, { Background, MiniMap, ReactFlowInstance, SelectionMode, Viewport, getViewportForBounds } from 'reactflow';
import { shallow } from 'zustand/shallow';
import { FlowEdge } from '../../ui/edges/FlowEdge';
import { ProcessNode } from '../../ui/nodes/ProcessNode';
import { useAppStore } from '../../store/useAppStore';
import { instrumentCallsite } from '../../utils/instrumentation';

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

const CanvasEditorComponent = ({ focusMode = false }: { focusMode?: boolean }) => {
  const setEdgeLabelMode = useAppStore((state) => state.setEdgeLabelMode);
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
  const resizeTimerRef = useRef<number | null>(null);
  const latestViewRef = useRef(view);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [isMinimapVisible, setIsMinimapVisible] = useState(true);
  const [isViewportLocked, setIsViewportLocked] = useState(false);

  useEffect(() => {
    latestViewRef.current = view;
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

  const handleReturnToDiagram = useCallback(async () => {
    await applyViewport(view.hasManualViewport ? 'restore' : 'curated', 'return-to-diagram');
  }, [applyViewport, view.hasManualViewport]);

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
    <div className={`canvas-shell sim-${simulationStatus} ${focusMode ? 'is-focus-mode' : ''}`} ref={shellRef}>
      <ReactFlow
        panOnDrag={!isViewportLocked}
        zoomOnScroll={!isViewportLocked}
        zoomOnPinch={!isViewportLocked}
        zoomOnDoubleClick={!isViewportLocked}
        panOnScroll={!isViewportLocked}
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
      </ReactFlow>
      {!focusMode ? (
        <div className="canvas-navigation-cluster" aria-label="Навигация по схеме" onWheel={stopCanvasViewportPropagation} onPointerDown={stopCanvasViewportPropagation} onMouseDown={stopCanvasViewportPropagation}>
          <section className="navigation-stack-shell">
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
            <div className="minimap-card" aria-label="Навигатор">
              <div className="minimap-card__header">
                <div>
                  <div className="minimap-card__title">Навигатор</div>
                  <div className="minimap-card__caption">Обзор схемы и быстрый переход</div>
                </div>
                <button
                  type="button"
                  className="minimap-card__toggle"
                  title={isMinimapVisible ? 'Скрыть навигатор' : 'Показать навигатор'}
                  aria-label={isMinimapVisible ? 'Скрыть навигатор' : 'Показать навигатор'}
                  onClick={() => setIsMinimapVisible((current) => !current)}
                >
                  {isMinimapVisible ? 'Скрыть' : 'Показать'}
                </button>
              </div>
              {isMinimapVisible ? (
                <>
                  <MiniMap
                    pannable
                    zoomable
                    className="minimap-card__map"
                    maskColor="rgba(5,10,16,0.74)"
                    style={{ backgroundColor: 'transparent' }}
                    nodeColor="#7fb3ff"
                    nodeStrokeColor="#d9e8ff"
                  />
                  <div className="minimap-card__footer">
                    <button type="button" className="minimap-card__action" title="Вернуться к схеме" aria-label="Вернуться к схеме" onClick={() => void handleReturnToDiagram()}>К схеме</button>
                    <button type="button" className="minimap-card__action minimap-card__action--secondary" title="Вписать всю схему" aria-label="Вписать всю схему" onClick={() => void handleFitToView()}>Вписать</button>
                    <button type="button" className="minimap-card__action minimap-card__action--secondary minimap-card__action--ghost" title={edgeLabelMode === 'hidden' ? 'Показать подписи линий' : 'Скрыть подписи линий'} onClick={() => setEdgeLabelMode(edgeLabelMode === 'hidden' ? 'selected' : 'hidden')}>{edgeLabelMode === 'hidden' ? 'Показать подписи' : 'Скрыть подписи'}</button>
                  </div>
                </>
              ) : (
                <div className="minimap-card__collapsed">Навигатор скрыт. Откройте его, чтобы видеть положение схемы.</div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export const CanvasEditor = memo(CanvasEditorComponent);
