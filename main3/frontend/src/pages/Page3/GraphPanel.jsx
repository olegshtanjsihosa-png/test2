import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { evaluate } from 'mathjs';

const COLORS = {
  primary: "#2563eb",
  danger: "#ef4444",
  success: "#16a34a",
  warning: "#f59e0b",
  muted: "#64748b",
};

const BASIS_COLORS = {
  L0: "#2563eb",
  L1: "#ef4444",
  L2: "#10b981",
  P: "#000000",
};

function normalizeExpression(expression) {
  return String(expression || "")
    .replace(/\*\*/g, "^")
    .replace(/,/g, ".")
    .replace(/^.*?=/, "")
    .trim();
}

function drawLine(g, points, xScale, yScale, graph, highlightBasis) {
  const lineGen = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y))
    .curve(d3.curveMonotoneX);

  const color = BASIS_COLORS[graph.function?.name] || COLORS.primary;
  const opacity = highlightBasis && graph.function?.name !== highlightBasis ? 0.3 : 1;
  const strokeWidth = highlightBasis && graph.function?.name === highlightBasis ? 3 : 2;

  g.append("path")
    .datum(points)
    .attr("fill", "none")
    .attr("stroke", color)
    .attr("stroke-width", strokeWidth)
    .attr("opacity", opacity)
    .attr("d", lineGen);
}

function FunctionGraph({ graph, variables, highlightBasis, onHoverPoint }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;
    if (!graph || !graph.has_graph) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    if (width === 0 || height === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const margin = { top: 30, right: 30, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const graphPoints = graph.points || [];
    let allX = graphPoints.map(p => Number(p.x)).filter(Number.isFinite);
    let allY = graphPoints.map(p => Number(p.y)).filter(Number.isFinite);

    const xMin = Math.floor(Math.min(...allX, 0) - 1);
    const xMax = Math.ceil(Math.max(...allX, 10) + 1);
    const functionExpression = graph.function?.expression
      ? normalizeExpression(graph.function.expression)
      : null;

    if (functionExpression && variables) {
      const previewStep = (xMax - xMin) / 120;
      for (let x = xMin; x <= xMax; x += previewStep) {
        try {
          const y = evaluate(functionExpression, { ...variables, x });
          if (Number.isFinite(y)) {
            allY.push(y);
          }
        } catch {
          continue;
        }
      }
    }

    const yMin = Math.floor(Math.min(...allY, -1) - 1);
    const yMax = Math.ceil(Math.max(...allY, 4) + 1);

    const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);

    const xTicks = d3.range(xMin, xMax + 1, 1);
    const yTicks = d3.range(yMin, yMax + 1, 1);
    const gridColor = "#e2e8f0";
    
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickValues(xTicks).tickSize(-innerHeight))
      .attr("color", gridColor);
    
    g.append("g")
      .call(d3.axisLeft(yScale).tickValues(yTicks).tickSize(-innerWidth))
      .attr("color", gridColor);
    
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickValues(xTicks))
      .attr("color", "#64748b")
      .attr("stroke-width", 1.5);
    
    g.append("g")
      .call(d3.axisLeft(yScale).tickValues(yTicks))
      .attr("color", "#64748b")
      .attr("stroke-width", 1.5);

    if (functionExpression && variables) {
      const points = [];
      const step = (xMax - xMin) / 500;

      for (let x = xMin; x <= xMax; x += step) {
        try {
          const y = evaluate(functionExpression, { ...variables, x });
          const isInBounds = Number.isFinite(y) && y >= yMin && y <= yMax;

          if (isInBounds) {
            points.push({ x, y });
          } else {
            if (points.length > 1) {
              drawLine(g, points, xScale, yScale, graph, highlightBasis);
            }
            points.length = 0;
          }
        } catch {
          if (points.length > 1) {
            drawLine(g, points, xScale, yScale, graph, highlightBasis);
          }
          points.length = 0;
        }
      }

      if (points.length > 1) {
        drawLine(g, points, xScale, yScale, graph, highlightBasis);
      }
    }

    if (graph.points) {
      graph.points.forEach(point => {
        const x = xScale(point.x);
        const y = yScale(point.y);

        if (x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight) {
          const circle = g.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 8)
            .attr("fill", COLORS.danger)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .style("cursor", "pointer");

          if (onHoverPoint) {
            circle.on("mouseenter", () => onHoverPoint(point))
              .on("mouseleave", () => onHoverPoint(null));
          }

          if (point.label) {
            g.append("text")
              .attr("x", x + 10)
              .attr("y", y - 5)
              .text(point.label)
              .attr("font-size", "12px")
              .attr("fill", COLORS.muted);
          }
        }
      });
    }
  }, [graph, variables, highlightBasis, onHoverPoint]);

  if (!graph || !graph.has_graph) return null;

  return (
    <div ref={containerRef} className="w-full h-full bg-white">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}

export default function GraphPanel({ graph, variables, highlightBasis, onHoverPoint }) {
  return (
    <div className="relative h-full w-full rounded-lg border border-gray-200 bg-white overflow-hidden">
      <FunctionGraph 
        graph={graph} 
        variables={variables} 
        highlightBasis={highlightBasis} 
        onHoverPoint={onHoverPoint} 
      />
    </div>
  );
}
