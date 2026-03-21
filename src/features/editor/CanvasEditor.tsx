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
  const setViewport = useAppStore((state) => state.setViewport);
  const tickSimulation = useAppStore((state) => state.tickSimulation);
  const frameRef = useRef<number>();
  const lastTimeRef = useRef<number>();

  const nodeTypes = useMemo(() => ({ processNode: ProcessNode }), []);
  const edgeTypes = useMemo(() => ({ flowEdge: FlowEdge }), []);

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current != null) {
      tickSimulation((time - lastTimeRef.current) / 1000);
    }
    lastTimeRef.current = time;
    frameRef.current = requestAnimationFrame(animate);
  }, [tickSimulation]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [animate]);

  return (
    <div className="canvas-shell">
      <ReactFlow
        nodes={project.nodes}
        edges={project.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(undefined)}
        defaultViewport={project.viewport}
        onMoveEnd={(_, viewport) => setViewport(viewport)}
        snapToGrid
        snapGrid={[20, 20]}
        fitView
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
      >
        <Background color="#233247" gap={20} />
        <MiniMap pannable zoomable className="minimap" />
        <Controls />
        <Panel position="bottom-center"><SimulationPanel /></Panel>
      </ReactFlow>
    </div>
  );
};
