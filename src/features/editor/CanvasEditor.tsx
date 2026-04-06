import { memo, useCallback, useEffect, useMemo, useRef, useState, WheelEvent as ReactWheelEvent, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import ReactFlow, { Background, ReactFlowInstance, SelectionMode, Viewport, getViewportForBounds } from 'reactflow';
import { createPortal } from 'react-dom';
import { shallow } from 'zustand/shallow';
import { FlowEdge } from '../../ui/edges/FlowEdge';
import { ProcessNode } from '../../ui/nodes/ProcessNode';
import { SchematicNode } from '../../ui/nodes/SchematicNode';
import { SchematicEdge } from '../../ui/edges/SchematicEdge';
import { useAppStore } from '../../store/useAppStore';
import { instrumentCallsite } from '../../utils/instrumentation';
import { LocalActionPanel } from './LocalActionPanel';
import { SoapEdge, SoapNode } from '../../domain/schemas/types';
import { buildSchematicLayout, buildSchematicLayoutElk, shouldUseElkLayout } from './schematicLayout';
import { OverlayRect, clampOverlayToShell } from './overlayPositioning';
import { buildEdgeContextActions, buildNodeContextActions } from '../simulation/contextActionController';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const VIEWPORT_POSITION_EPSILON = 0.5;
const VIEWPORT_ZOOM_EPSILON = 0.001;
const isDev = import.meta.env.DEV;

const simulationNodeTypes = { processNode: ProcessNode };
const simulationEdgeTypes = { flowEdge: FlowEdge };
const schematicNodeTypes = { processNode: SchematicNode };
const schematicEdgeTypes = { flowEdge: SchematicEdge };
const EDGE_ANCHOR_OFFSET = 26;
const CONTEXT_MENU_SAFE_PADDING = 10;
export type CanvasTool = 'select' | 'connect' | 'measure-pressure' | 'measure-temperature' | 'measure-flow' | 'measure-probe';
type MarkerAnchor = { worldX: number; worldY: number; anchorText: string };
type ContextTarget = { kind: 'node'; nodeId: string } | { kind: 'edge'; edgeId: string } | { kind: 'canvas' };
type ContextMenuState = { x: number; y: number; target: ContextTarget };
type ContextMenuItem = { id: string; label: string; onClick: () => void; disabled?: boolean; tone?: 'danger'; note?: string; secondary?: boolean };

const sameViewport = (a: Viewport, b: Viewport) => (
  Math.abs(a.x - b.x) < VIEWPORT_POSITION_EPSILON
  && Math.abs(a.y - b.y) < VIEWPORT_POSITION_EPSILON
  && Math.abs(a.zoom - b.zoom) < VIEWPORT_ZOOM_EPSILON
);

const canDragNodes = (presentationMode: 'schematic' | 'simulation', activeTool: CanvasTool) => presentationMode === 'simulation' && activeTool === 'select';

const debugLog = (scope: string, message: string, payload?: unknown) => {
  if (!isDev) return;
  if (payload === undefined) console.debug(`[perf:${scope}] ${message}`);
  else console.debug(`[perf:${scope}] ${message}`, payload);
};

const CanvasEditorComponent = ({ focusMode = false, activeTool = 'select', gridEnabled = true }: { focusMode?: boolean; activeTool?: CanvasTool; gridEnabled?: boolean }) => {
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
    selectMeasurementPoint,
    addMeasurementPoint,
    executeNodeAction,
    executeEdgeAction,
    updateNodeField,
    updateEdgeField,
    openLibraryPicker,
    setInspectorTab,
    setViewportState,
    measurementPoints,
    selectedMeasurementPointId,
    tickSimulation,
    hoverEdge,
    setSchematicAutoNodePositions,
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
    selectMeasurementPoint: state.selectMeasurementPoint,
    addMeasurementPoint: state.addMeasurementPoint,
    executeNodeAction: state.executeNodeAction,
    executeEdgeAction: state.executeEdgeAction,
    updateNodeField: state.updateNodeField,
    updateEdgeField: state.updateEdgeField,
    openLibraryPicker: state.openLibraryPicker,
    setInspectorTab: state.setInspectorTab,
    setViewportState: state.setViewport,
    measurementPoints: state.project.measurementPoints,
    selectedMeasurementPointId: state.selectedMeasurementPointId,
    tickSimulation: state.tickSimulation,
    hoverEdge: state.hoverEdge,
    setSchematicAutoNodePositions: state.setSchematicAutoNodePositions,
  }), shallow);
  const frameRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const shellRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const suppressMoveEndRef = useRef(false);
  const appliedViewportNonceRef = useRef<number | null>(null);
  const latestViewRef = useRef(view);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [isViewportLocked, setIsViewportLocked] = useState(false);
  const [liveViewport, setLiveViewport] = useState<Viewport>(view.viewport);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>();
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number }>();
  const [menuOverlayRect, setMenuOverlayRect] = useState<{ x: number; y: number; width: number; height: number }>();
  const [legendOpen, setLegendOpen] = useState(false);

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
    data: { ...edge.data, selectedPath: pathSelection.edges.includes(edge.id), hovered: hoveredEdgeId === edge.id, labelMode: edgeLabelMode, overlayCollision: menuOverlayRect },
    style: { opacity: pathSelection.edges.length ? (pathSelection.edges.includes(edge.id) ? 1 : 0.16) : 1 },
  })), [edgeLabelMode, hoveredEdgeId, menuOverlayRect, pathSelection.edges, problemEdgeIds, projectEdges, showProblematicOnly]);
  const lightweightSchematicLayout = useMemo(() => (
    view.presentationMode === 'schematic'
      ? buildSchematicLayout(nodes, edges)
      : undefined
  ), [edges, nodes, view.presentationMode]);
  const [schematicLayout, setSchematicLayout] = useState(lightweightSchematicLayout);

  useEffect(() => {
    setSchematicLayout(lightweightSchematicLayout);
    if (!lightweightSchematicLayout) return;
    if (!shouldUseElkLayout()) return;
    let cancelled = false;
    void buildSchematicLayoutElk(nodes, edges).then((elkLayout) => {
      if (cancelled) return;
      setSchematicLayout(elkLayout);
      setSchematicAutoNodePositions(elkLayout.autoPositions);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [edges, lightweightSchematicLayout, nodes, setSchematicAutoNodePositions]);
  const renderedNodes = useMemo(() => (
    schematicLayout
      ? nodes.map((node) => ({ ...node, position: schematicLayout.positions[node.id] ?? node.position }))
      : nodes
  ), [nodes, schematicLayout]);
  const rendererNodeTypes = view.presentationMode === 'schematic' ? schematicNodeTypes : simulationNodeTypes;
  const rendererEdgeTypes = view.presentationMode === 'schematic' ? schematicEdgeTypes : simulationEdgeTypes;
  const selectedNode = useMemo(() => projectNodes.find((node) => node.id === selectedNodeId), [projectNodes, selectedNodeId]);
  const selectedEdge = useMemo(() => projectEdges.find((edge) => edge.id === selectedEdgeId), [projectEdges, selectedEdgeId]);
  const selectedMeasurementPoint = useMemo(() => measurementPoints.find((point) => point.id === selectedMeasurementPointId), [measurementPoints, selectedMeasurementPointId]);
  const getNodeVisualSize = useCallback((className: string) => {
    if (className === 'major') return { width: 230, height: 122 };
    if (className === 'valve' || className === 'instrument' || className === 'topology') return { width: 138, height: 86 };
    if (className === 'terminal') return { width: 150, height: 88 };
    return { width: 180, height: 98 };
  }, []);
  const getFlowRectForNode = useCallback((node: SoapNode): OverlayRect => {
    const size = getNodeVisualSize(node.data.className);
    return { x: node.position.x, y: node.position.y, width: size.width, height: size.height };
  }, [getNodeVisualSize]);
  const contextTargetNode = useMemo(() => {
    const target = contextMenu?.target;
    if (!target || target.kind !== 'node') return undefined;
    return projectNodes.find((node) => node.id === target.nodeId);
  }, [contextMenu, projectNodes]);
  const declutterRects = useMemo<OverlayRect[]>(() => {
    const rects: OverlayRect[] = [];
    if (menuOverlayRect) rects.push(menuOverlayRect);
    if (selectedNode) rects.push(getFlowRectForNode(selectedNode));
    if (contextTargetNode && contextTargetNode.id !== selectedNode?.id) rects.push(getFlowRectForNode(contextTargetNode));
    return rects;
  }, [contextTargetNode, getFlowRectForNode, menuOverlayRect, selectedNode]);
  const renderedEdges = useMemo(() => (
    schematicLayout
      ? edges.map((edge) => ({ ...edge, data: { ...edge.data, schematicRoute: schematicLayout.routes[edge.id], declutterRects } }))
      : edges.map((edge) => ({ ...edge, data: { ...edge.data, declutterRects } }))
  ), [declutterRects, edges, schematicLayout]);
  const measurementToolType = activeTool === 'measure-pressure'
    ? 'pressure'
    : activeTool === 'measure-temperature'
      ? 'temperature'
      : activeTool === 'measure-flow'
        ? 'flow'
        : activeTool === 'measure-probe'
          ? 'probe'
          : undefined;

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

  const resolveMarkerAnchor = useCallback((pointId: string): MarkerAnchor | undefined => {
    const point = measurementPoints.find((item) => item.id === pointId);
    if (!point) return undefined;
    if (point.anchor.kind === 'node' && point.anchor.nodeId) {
      const node = projectNodes.find((item) => item.id === point.anchor.nodeId);
      if (!node) return undefined;
      const nodeSize = getNodeVisualSize(node.data.className);
      return {
        worldX: node.position.x + nodeSize.width / 2 + (point.anchor.offsetX ?? 0),
        worldY: node.position.y + nodeSize.height / 2 + (point.anchor.offsetY ?? 0),
        anchorText: node.data.shortName || node.data.visibleName,
      };
    }
    if (point.anchor.kind === 'edge' && point.anchor.edgeId) {
      const edge = projectEdges.find((item) => item.id === point.anchor.edgeId);
      if (!edge) return undefined;
      const source = projectNodes.find((item) => item.id === edge.source);
      const target = projectNodes.find((item) => item.id === edge.target);
      if (!source || !target) return undefined;
      const sourceSize = getNodeVisualSize(source.data.className);
      const targetSize = getNodeVisualSize(target.data.className);
      const sourceX = source.position.x + sourceSize.width / 2;
      const sourceY = source.position.y + sourceSize.height / 2;
      const targetX = target.position.x + targetSize.width / 2;
      const targetY = target.position.y + targetSize.height / 2;
      const ratio = point.anchor.ratio ?? 0.5;
      return {
        worldX: sourceX + (targetX - sourceX) * ratio + (point.anchor.offsetX ?? 0),
        worldY: sourceY + (targetY - sourceY) * ratio + (point.anchor.offsetY ?? 0),
        anchorText: `${source.data.shortName} → ${target.data.shortName}`,
      };
    }
    return {
      worldX: (point.anchor.x ?? 0) + (point.anchor.offsetX ?? 0),
      worldY: (point.anchor.y ?? 0) + (point.anchor.offsetY ?? 0),
      anchorText: 'Координата схемы',
    };
  }, [getNodeVisualSize, measurementPoints, projectEdges, projectNodes]);

  const measurementPanelAnchor = useMemo(() => {
    if (!selectedMeasurementPoint || !shellRef.current) return undefined;
    const anchor = resolveMarkerAnchor(selectedMeasurementPoint.id);
    if (!anchor) return undefined;
    return {
      x: anchor.worldX * liveViewport.zoom + liveViewport.x,
      y: anchor.worldY * liveViewport.zoom + liveViewport.y,
      viewportWidth: shellRef.current.clientWidth,
      viewportHeight: shellRef.current.clientHeight,
    };
  }, [liveViewport.x, liveViewport.y, liveViewport.zoom, resolveMarkerAnchor, selectedMeasurementPoint]);

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

  const handleResetZoom = useCallback(async () => {
    if (!flow) return;
    const metadata = view.metadata;
    await flow.setViewport({ x: liveViewport.x, y: liveViewport.y, zoom: metadata.defaultZoom }, { duration: 180 });
  }, [flow, liveViewport.x, liveViewport.y, view.metadata]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(undefined);
    setMenuPosition(undefined);
    setMenuOverlayRect(undefined);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (contextMenuRef.current?.contains(target)) return;
      closeContextMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu();
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [closeContextMenu, contextMenu]);

  useEffect(() => {
    if (!contextMenu || !contextMenuRef.current || !shellRef.current) return;
    const menuRect = contextMenuRef.current.getBoundingClientRect();
    const shellRect = shellRef.current.getBoundingClientRect();
    const simulationDockHeightRaw = getComputedStyle(document.documentElement).getPropertyValue('--simulation-dock-visible-height').trim();
    const simulationDockHeight = Number.parseFloat(simulationDockHeightRaw || '0') || 0;
    const { left, top } = clampOverlayToShell(
      contextMenu,
      { width: menuRect.width, height: menuRect.height },
      shellRect,
      { padding: CONTEXT_MENU_SAFE_PADDING, bottomReserved: simulationDockHeight },
    );
    setMenuPosition({ left, top });

    if (!flow) {
      setMenuOverlayRect(undefined);
      return;
    }
    const topLeft = flow.screenToFlowPosition({ x: left, y: top });
    const bottomRight = flow.screenToFlowPosition({ x: left + menuRect.width, y: top + menuRect.height });
    setMenuOverlayRect({ x: topLeft.x, y: topLeft.y, width: Math.max(1, bottomRight.x - topLeft.x), height: Math.max(1, bottomRight.y - topLeft.y) });
  }, [contextMenu, flow]);

  const nodeById = useMemo(() => new Map(projectNodes.map((node) => [node.id, node])), [projectNodes]);
  const edgeById = useMemo(() => new Map(projectEdges.map((edge) => [edge.id, edge])), [projectEdges]);

  const withNodeSelection = useCallback((nodeId: string, callback: () => void) => {
    selectNode(nodeId);
    callback();
    closeContextMenu();
  }, [closeContextMenu, selectNode]);

  const withEdgeSelection = useCallback((edgeId: string, callback: () => void) => {
    selectEdge(edgeId);
    callback();
    closeContextMenu();
  }, [closeContextMenu, selectEdge]);

  const nodeMenuItems = useCallback((node: SoapNode): ContextMenuItem[] => {
    const connectedEdge = projectEdges.find((edge) => edge.source === node.id || edge.target === node.id);
    const sourceEdge = projectEdges.find((edge) => edge.target === node.id);
    const targetEdge = projectEdges.find((edge) => edge.source === node.id);
    const actions = buildNodeContextActions(node, Boolean(sourceEdge), Boolean(targetEdge));
    return actions.slice(0, 6).map((action) => ({
      id: action.id,
      label: action.label,
      disabled: action.disabled,
      secondary: action.secondary,
      onClick: () => withNodeSelection(node.id, () => {
        if (action.id === 'start') executeNodeAction(node.id, 'pump:start');
        else if (action.id === 'stop') executeNodeAction(node.id, 'pump:stop');
        else if (action.id === 'open') executeNodeAction(node.id, 'valve:open');
        else if (action.id === 'close') executeNodeAction(node.id, 'valve:close');
        else if (action.id === 'auto') executeNodeAction(node.id, 'valve:auto');
        else if (action.id === 'manual') executeNodeAction(node.id, 'valve:manual');
        else if (action.id === 'clear-alarm') executeNodeAction(node.id, 'pump:clearAlarm');
        else if (action.id === 'jump-source' && sourceEdge) selectNode(sourceEdge.source);
        else if (action.id === 'jump-target' && targetEdge) selectNode(targetEdge.target);
        else if (action.id === 'trace') setInspectorTab('simulation');
        else if (action.id === 'diagnostics') setInspectorTab('alarms');
        else if (action.id === 'replace') setInspectorTab('actions');
        else if (action.id === 'isolate') updateNodeField(node.id, 'allowDischarge', false);
      }),
    }));
  }, [addMeasurementPoint, executeNodeAction, projectEdges, selectNode, setInspectorTab, updateNodeField, withNodeSelection]);

  const edgeMenuItems = useCallback((edge: SoapEdge): ContextMenuItem[] => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    return buildEdgeContextActions(edge).map((action) => ({
      id: action.id,
      label: action.label,
      disabled: action.disabled,
      onClick: () => withEdgeSelection(edge.id, () => {
        if (action.id === 'jump-source' && source) selectNode(source.id);
        else if (action.id === 'jump-target' && target) selectNode(target.id);
        else if (action.id === 'diagnostics') setInspectorTab('alarms');
        else if (action.id === 'trace') setInspectorTab('simulation');
        else if (action.id === 'clear-block') updateEdgeField(edge.id, 'blocked', false);
      }),
    }));
  }, [nodeById, selectNode, setInspectorTab, updateEdgeField, withEdgeSelection]);

  const canvasMenuItems = useMemo<ContextMenuItem[]>(() => [
    { id: 'fit', label: 'Вписать схему', onClick: () => { void handleFitToView(); closeContextMenu(); } },
    { id: 'reset-zoom', label: 'Сбросить масштаб', onClick: () => { void handleResetZoom(); closeContextMenu(); } },
    { id: 'add-element', label: 'Добавить элемент', onClick: () => { openLibraryPicker('global'); closeContextMenu(); } },
    {
      id: 'add-point',
      label: 'Поставить контрольную точку',
      onClick: () => {
        if (!flow || !contextMenu) return;
        const position = flow.screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y });
        addMeasurementPoint('probe', { x: position.x, y: position.y });
        closeContextMenu();
      },
    },
    { id: 'open-library', label: 'Открыть библиотеку', onClick: () => { openLibraryPicker('global'); closeContextMenu(); } },
  ], [addMeasurementPoint, closeContextMenu, contextMenu, flow, handleFitToView, handleResetZoom, openLibraryPicker]);

  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return [];
    if (contextMenu.target.kind === 'node') {
      const node = nodeById.get(contextMenu.target.nodeId);
      return node ? nodeMenuItems(node) : [];
    }
    if (contextMenu.target.kind === 'edge') {
      const edge = edgeById.get(contextMenu.target.edgeId);
      return edge ? edgeMenuItems(edge) : [];
    }
    return canvasMenuItems;
  }, [canvasMenuItems, contextMenu, edgeById, edgeMenuItems, nodeById, nodeMenuItems]);

  return (
    <div className={`canvas-shell sim-${simulationStatus} ${focusMode ? 'is-focus-mode' : ''}`} ref={shellRef}>
      <ReactFlow
        panOnDrag={!isViewportLocked && activeTool === 'select'}
        zoomOnScroll={!isViewportLocked}
        zoomOnPinch={!isViewportLocked}
        zoomOnDoubleClick={!isViewportLocked}
        panOnScroll={!isViewportLocked}
        nodesDraggable={canDragNodes(view.presentationMode, activeTool)}
        elementsSelectable={activeTool === 'select'}
        nodesConnectable={activeTool === 'connect'}
        selectionOnDrag={activeTool === 'select'}
        nodes={renderedNodes}
        edges={renderedEdges}
        nodeTypes={rendererNodeTypes}
        edgeTypes={rendererEdgeTypes}
        onInit={(instance) => {
          debugLog('startup', 'react-flow initialized');
          setFlow(instance);
        }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => {
          closeContextMenu();
          if (measurementToolType) {
            addMeasurementPoint(measurementToolType, { nodeId: node.id });
            return;
          }
          selectNode(node.id);
        }}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          selectNode(node.id);
          setContextMenu({ x: event.clientX, y: event.clientY, target: { kind: 'node', nodeId: node.id } });
        }}
        onEdgeClick={(_, edge) => {
          closeContextMenu();
          if (measurementToolType) {
            addMeasurementPoint(measurementToolType, { edgeId: edge.id, ratio: 0.5 });
            return;
          }
          selectEdge(edge.id);
        }}
        onEdgeContextMenu={(event, edge) => {
          event.preventDefault();
          selectEdge(edge.id);
          setContextMenu({ x: event.clientX, y: event.clientY, target: { kind: 'edge', edgeId: edge.id } });
        }}
        onEdgeMouseEnter={(_, edge) => hoverEdge(edge.id)}
        onEdgeMouseLeave={() => hoverEdge(undefined)}
        onPaneClick={(event) => {
          closeContextMenu();
          if (measurementToolType) {
            const position = flow?.screenToFlowPosition({ x: event.clientX, y: event.clientY });
            addMeasurementPoint(measurementToolType, { x: position?.x ?? 0, y: position?.y ?? 0 });
            return;
          }
          selectNode(undefined);
          selectEdge(undefined);
          selectMeasurementPoint(undefined);
          hoverEdge(undefined);
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({ x: event.clientX, y: event.clientY, target: { kind: 'canvas' } });
        }}
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
      {view.presentationMode === 'schematic' ? <details className="schematic-legend" open={legendOpen} onToggle={(e) => setLegendOpen((e.target as HTMLDetailsElement).open)}>
        <summary>Легенда схемы</summary>
        <div>
          <span>◯ Аппарат/ёмкость</span>
          <span>▶ Насос</span>
          <span>▭ Теплообмен/нагрев</span>
          <span>◇ Арматура</span>
          <span>◌ КИП</span>
          <span>Подписи: secondary скрываются при коллизиях</span>
        </div>
      </details> : null}
      <div className="measurement-layer" aria-label="Точки измерения">
        {measurementPoints.filter((point) => point.visible).map((point) => {
          const anchor = resolveMarkerAnchor(point.id);
          if (!anchor) return null;
          const left = anchor.worldX * liveViewport.zoom + liveViewport.x;
          const top = anchor.worldY * liveViewport.zoom + liveViewport.y;
          const glyph = point.type === 'pressure' ? 'P' : point.type === 'temperature' ? 'T' : point.type === 'flow' ? 'Q' : 'К';
          const typeClass = `type-${point.type}`;
          return (
            <button
              key={point.id}
              type="button"
              className={`measurement-marker ${typeClass} ${selectedMeasurementPointId === point.id ? 'is-selected' : ''} ${view.presentationMode === 'simulation' && point.enabled ? 'is-live' : ''} ${point.enabled ? '' : 'is-disabled'}`}
              style={{ left, top }}
              onClick={() => selectMeasurementPoint(point.id)}
              disabled={!point.enabled}
              title={`${point.shortTag}: ${anchor.anchorText}${point.enabled ? '' : ' (отключена)'}`}
            >
              <span>{glyph}</span>
            </button>
          );
        })}
      </div>
      <LocalActionPanel selectedNode={view.presentationMode === 'simulation' ? undefined : selectedNode} selectedEdge={view.presentationMode === 'simulation' ? undefined : selectedEdge} selectedMeasurementPoint={selectedMeasurementPoint} anchor={selectedMeasurementPoint ? measurementPanelAnchor : localPanelAnchor} presentationMode={view.presentationMode} />
      {contextMenu ? createPortal((
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: menuPosition?.left ?? contextMenu.x, top: menuPosition?.top ?? contextMenu.y }}
          role="menu"
          aria-label="Контекстные действия"
        >
          {contextMenuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`context-menu__item ${item.tone === 'danger' ? 'is-danger' : ''} ${item.secondary ? 'is-secondary' : ''}`}
              disabled={item.disabled}
              title={item.note}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </div>
      ), document.body) : null}
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

export { canDragNodes };
export const CanvasEditor = memo(CanvasEditorComponent);
