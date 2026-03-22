import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Panel, ReactFlowInstance, SelectionMode, Viewport, getViewportForBounds } from 'reactflow';
import { ProcessNode } from '../../nodes/ProcessNode';
import { FlowEdge } from '../../edges/FlowEdge';
import { useAppStore } from '../../store/useAppStore';
import { SimulationPanel } from '../simulation/SimulationPanel';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const CanvasEditor = () => {
  const project = useAppStore((state) => state.project);
  const onNodesChange = useAppStore((state) => state.onNodesChange);
  const onEdgesChange = useAppStore((state) => state.onEdgesChange);
  const onConnect = useAppStore((state) => state.onConnect);
  const selectNode = useAppStore((state) => state.selectNode);
  const selectEdge = useAppStore((state) => state.selectEdge);
  const setViewportState = useAppStore((state) => state.setViewport);
  const tickSimulation = useAppStore((state) => state.tickSimulation);
  const pathSelection = useAppStore((state) => state.pathSelection);
  const showProblematicOnly = useAppStore((state) => state.showProblematicOnly);
  const hoveredEdgeId = useAppStore((state) => state.hoveredEdgeId);
  const edgeLabelMode = useAppStore((state) => state.edgeLabelMode);
  const hoverEdge = useAppStore((state) => state.hoverEdge);
  const issues = useAppStore((state) => state.issues);
  const frameRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const shellRef = useRef<HTMLDivElement>(null);
  const suppressMoveEndRef = useRef(false);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);

  const nodeTypes = useMemo(() => ({ processNode: ProcessNode }), []);
  const edgeTypes = useMemo(() => ({ flowEdge: FlowEdge }), []);

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current != null) tickSimulation((time - lastTimeRef.current) / 1000);
    lastTimeRef.current = time;
    frameRef.current = requestAnimationFrame(animate);
  }, [tickSimulation]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [animate]);

  const problemNodeIds = new Set(issues.flatMap((issue) => issue.nodeIds ?? []));
  const problemEdgeIds = new Set(issues.flatMap((issue) => issue.edgeIds ?? []));

  const nodes = project.nodes.map((node) => ({ ...node, hidden: showProblematicOnly ? !problemNodeIds.has(node.id) : false, style: { opacity: pathSelection.upstream.length || pathSelection.downstream.length ? (pathSelection.upstream.includes(node.id) || pathSelection.downstream.includes(node.id) || node.id === useAppStore.getState().selectedNodeId ? 1 : 0.22) : 1 } }));
  const edges = project.edges.map((edge) => ({ ...edge, hidden: showProblematicOnly ? !problemEdgeIds.has(edge.id) : false, data: { ...edge.data, selectedPath: pathSelection.edges.includes(edge.id), hovered: hoveredEdgeId === edge.id, labelMode: edgeLabelMode }, style: { opacity: pathSelection.edges.length ? (pathSelection.edges.includes(edge.id) ? 1 : 0.16) : 1 } }));

  const applyIntentionalViewport = useCallback(async (mode: 'restore' | 'curated') => {
    if (!flow || !shellRef.current) return;

    const width = shellRef.current.clientWidth;
    const height = shellRef.current.clientHeight;
    if (!width || !height) return;

    suppressMoveEndRef.current = true;

    if (mode === 'restore') {
      await flow.setViewport(project.view.viewport, { duration: 0 });
      return;
    }

    const metadata = project.view.metadata;
    const minZoom = clamp(metadata.minZoom ?? metadata.defaultZoom * 0.88, 0.2, 2);
    const maxZoom = clamp(metadata.maxZoom ?? metadata.defaultZoom * 1.08, minZoom, 2);
    const focusBounds = metadata.focusBounds ?? (() => {
      const xs = project.nodes.map((node) => node.position.x);
      const ys = project.nodes.map((node) => node.position.y);
      const maxX = Math.max(...xs, metadata.center.x + 120);
      const maxY = Math.max(...ys, metadata.center.y + 120);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(220, maxX - Math.min(...xs) + 220), height: Math.max(180, maxY - Math.min(...ys) + 180) };
    })();

    const fitted = getViewportForBounds(
      focusBounds,
      width,
      height,
      minZoom,
      maxZoom,
      metadata.preferredPadding,
    );
    const zoom = clamp(fitted.zoom, minZoom, maxZoom);
    const viewport: Viewport = {
      x: width / 2 - metadata.center.x * zoom,
      y: height / 2 - metadata.center.y * zoom,
      zoom,
    };

    await flow.setViewport(viewport, { duration: 0 });
    setViewportState(viewport, { manual: false });
  }, [flow, project, setViewportState]);

  useEffect(() => {
    void applyIntentionalViewport(project.view.hasManualViewport ? 'restore' : 'curated');
  }, [applyIntentionalViewport, project.id, project.view.hasManualViewport, project.view.metadata, project.view.viewport]);

  useEffect(() => {
    if (!shellRef.current || project.view.hasManualViewport) return;
    const observer = new ResizeObserver(() => { void applyIntentionalViewport('curated'); });
    observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, [applyIntentionalViewport, project.view.hasManualViewport]);

  return (
    <div className="canvas-shell" ref={shellRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={setFlow}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => selectNode(node.id)}
        onEdgeClick={(_, edge) => selectEdge(edge.id)}
        onEdgeMouseEnter={(_, edge) => hoverEdge(edge.id)}
        onEdgeMouseLeave={() => hoverEdge(undefined)}
        onPaneClick={() => { selectNode(undefined); selectEdge(undefined); hoverEdge(undefined); }}
        defaultViewport={project.view.viewport}
        onMoveEnd={(_, viewport) => {
          if (suppressMoveEndRef.current) {
            suppressMoveEndRef.current = false;
            return;
          }
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
