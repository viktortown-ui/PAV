import { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Panel, SelectionMode } from 'reactflow';
import { ProcessNode } from '../../nodes/ProcessNode';
import { FlowEdge } from '../../edges/FlowEdge';
import { useAppStore } from '../../store/useAppStore';
import { SimulationPanel } from '../simulation/SimulationPanel';

export const CanvasEditor = () => {
  const project = useAppStore((state) => state.project);
  const onNodesChange = useAppStore((state) => state.onNodesChange);
  const onEdgesChange = useAppStore((state) => state.onEdgesChange);
  const onConnect = useAppStore((state) => state.onConnect);
  const selectNode = useAppStore((state) => state.selectNode);
  const selectEdge = useAppStore((state) => state.selectEdge);
  const setViewport = useAppStore((state) => state.setViewport);
  const tickSimulation = useAppStore((state) => state.tickSimulation);
  const pathSelection = useAppStore((state) => state.pathSelection);
  const showProblematicOnly = useAppStore((state) => state.showProblematicOnly);
  const issues = useAppStore((state) => state.issues);
  const frameRef = useRef<number>();
  const lastTimeRef = useRef<number>();

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
  const edges = project.edges.map((edge) => ({ ...edge, hidden: showProblematicOnly ? !problemEdgeIds.has(edge.id) : false, data: { ...edge.data, selectedPath: pathSelection.edges.includes(edge.id) }, style: { opacity: pathSelection.edges.length ? (pathSelection.edges.includes(edge.id) ? 1 : 0.16) : 1 } }));

  return (
    <div className="canvas-shell">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => selectNode(node.id)}
        onEdgeClick={(_, edge) => selectEdge(edge.id)}
        onPaneClick={() => { selectNode(undefined); selectEdge(undefined); }}
        defaultViewport={project.viewport}
        onMoveEnd={(_, viewport) => setViewport(viewport)}
        snapToGrid
        snapGrid={[20, 20]}
        fitView
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
