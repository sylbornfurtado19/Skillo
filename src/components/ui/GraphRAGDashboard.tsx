'use client';

import React, { useState } from 'react';
import type {
  GraphRAGAnalysisResult,
  GraphRAGNode,
  GraphRAGCommunitySummary,
  GraphRAGLevel,
} from '@/types/index';
import Card from './Card';
import Badge from './Badge';
import Button from './Button';
import PrerequisiteChainViewer from './PrerequisiteChainViewer';
import {
  FaProjectDiagram,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaTimes,
  FaInfoCircle,
  FaLayerGroup,
  FaChartBar,
} from 'react-icons/fa';

export interface GraphRAGDashboardProps {
  graphRAGData?: GraphRAGAnalysisResult;
  className?: string;
}

export default function GraphRAGDashboard({
  graphRAGData,
  className = '',
}: GraphRAGDashboardProps) {
  const [selectedNode, setSelectedNode] = useState<GraphRAGNode | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<GraphRAGCommunitySummary | null>(null);
  const [activeLevelFilter, setActiveLevelFilter] = useState<GraphRAGLevel | 'ALL'>('ALL');

  // Fallback default sample data if graphRAGData is unpopulated
  const defaultGraphData: GraphRAGAnalysisResult = {
    overallDomainCoverage: 82,
    extractedEntityCount: 18,
    synthesizedSummary:
      'Candidate displays high alignment across Core Backend Systems and API Frameworks. Identified prerequisite gap in Distributed Cache Mutex Protocols.',
    candidateGraph: {
      entities: [],
      nodes: [
        {
          id: 'n_0_backend',
          name: 'Backend Systems Architecture',
          level: 0,
          status: 'VERIFIED',
          communityId: 'c_backend',
          communityName: 'Backend Core',
          description: 'Macro domain governing server-side architecture, data pipelines, and distributed APIs.',
          prerequisites: ['System Architecture'],
          downstreamImpacts: ['High-Availability APIs'],
        },
        {
          id: 'n_1_databases',
          name: 'Distributed Databases & Caching',
          level: 1,
          status: 'PARTIAL',
          communityId: 'c_databases',
          communityName: 'Data Infrastructure',
          description: 'Core pillar managing persistence engines, storage indexing, and memory caches.',
          prerequisites: ['Backend Systems Architecture'],
          downstreamImpacts: ['Sub-Millisecond Query Response'],
        },
        {
          id: 'n_2_redis',
          name: 'Redis In-Memory Data Store',
          level: 2,
          status: 'VERIFIED',
          communityId: 'c_databases',
          communityName: 'Data Infrastructure',
          description: 'Leaf utility for cache-aside caching, session keys, and pub-sub channels.',
          prerequisites: ['Distributed Databases & Caching'],
          downstreamImpacts: ['Session Management'],
        },
        {
          id: 'n_2_redlock',
          name: 'Redis Mutex & Redlock Algorithm',
          level: 2,
          status: 'MISSING',
          communityId: 'c_databases',
          communityName: 'Data Infrastructure',
          description: 'Critical protocol for multi-node concurrency locks and atomic mutation safety.',
          prerequisites: ['Redis In-Memory Data Store'],
          downstreamImpacts: ['Distributed Cache Consistency'],
        },
        {
          id: 'n_1_frameworks',
          name: 'Next.js & React 19 Frameworks',
          level: 1,
          status: 'VERIFIED',
          communityId: 'c_frontend',
          communityName: 'Full-Stack Web',
          description: 'Core pillar handling server components, server actions, and client state.',
          prerequisites: ['TypeScript Fundamentals'],
          downstreamImpacts: ['Production Web Applications'],
        },
        {
          id: 'n_2_ts',
          name: 'TypeScript Strict Type System',
          level: 2,
          status: 'VERIFIED',
          communityId: 'c_frontend',
          communityName: 'Full-Stack Web',
          description: 'Leaf utility ensuring static type verification across component interfaces.',
          prerequisites: ['JavaScript ESNext'],
          downstreamImpacts: ['Zero-Type-Error Builds'],
        },
      ],
      relationships: [
        { sourceId: 'n_0_backend', targetId: 'n_1_databases', relationshipType: 'REQUIRES', strength: 0.9, weight: 0.9, description: 'Backend requires databases' },
        { sourceId: 'n_1_databases', targetId: 'n_2_redis', relationshipType: 'REQUIRES', strength: 0.85, weight: 0.85, description: 'Databases require Redis' },
        { sourceId: 'n_2_redis', targetId: 'n_2_redlock', relationshipType: 'BLOCKS', strength: 0.95, weight: 0.95, description: 'Redis blocks Redlock gap' },
      ],
      communities: [
        {
          communityId: 'c_backend',
          name: 'Backend Core',
          level: 0,
          summary: 'High-level macro domain covering server engineering and cloud microservices.',
          entityCount: 6,
          coveragePercentage: 90,
        },
        {
          communityId: 'c_databases',
          name: 'Data Infrastructure',
          level: 1,
          summary: 'Sub-domain cluster governing database indexing, caching strategies, and concurrency locks.',
          entityCount: 7,
          coveragePercentage: 72,
        },
        {
          communityId: 'c_frontend',
          name: 'Full-Stack Web',
          level: 1,
          summary: 'Sub-domain cluster governing Next.js 16 App Router, React 19, and TypeScript interfaces.',
          entityCount: 5,
          coveragePercentage: 100,
        },
      ],
    },
    missingPrerequisiteChains: [
      {
        id: 'gap_1',
        missingFoundation: 'Distributed Locks & Mutex protocols',
        blockedCapability: 'Concurrent Cache Mutation Safety',
        downstreamImpact: 'High-Concurrency Distributed Data Consistency',
        severity: 'CRITICAL',
        remediationPath: [
          'Study Redis Redlock algorithm and lock TTL auto-renewal.',
          'Implement idempotency keys for mutative server endpoint handlers.',
          'Design split-brain network failure handling tests.',
        ],
      },
    ],
  };

  const data = graphRAGData || defaultGraphData;
  const { candidateGraph, overallDomainCoverage, missingPrerequisiteChains } = data;

  const filteredNodes =
    activeLevelFilter === 'ALL'
      ? candidateGraph.nodes
      : candidateGraph.nodes.filter((node) => node.level === activeLevelFilter);

  const getStatusBadge = (status: 'VERIFIED' | 'MISSING' | 'PARTIAL') => {
    switch (status) {
      case 'VERIFIED':
        return (
          <Badge variant="success" size="sm" className="flex items-center gap-1">
            <FaCheckCircle size={9} /> VERIFIED
          </Badge>
        );
      case 'MISSING':
        return (
          <Badge variant="danger" size="sm" className="flex items-center gap-1">
            <FaTimesCircle size={9} /> MISSING
          </Badge>
        );
      case 'PARTIAL':
        return (
          <Badge variant="warning" size="sm" className="flex items-center gap-1">
            <FaExclamationTriangle size={9} /> PARTIAL
          </Badge>
        );
    }
  };

  const getLevelLabel = (level: GraphRAGLevel) => {
    switch (level) {
      case 0:
        return 'Macro Domain (Level 0)';
      case 1:
        return 'Core Pillar (Level 1)';
      case 2:
        return 'Leaf Utility (Level 2)';
    }
  };

  return (
    <div className={`space-y-6 text-left ${className}`}>
      {/* 1. Header Bar & Overall Domain Coverage Percentage Gauge */}
      <div className="bg-[#0B0F17]/90 border border-white/10 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-lg shrink-0">
            <FaProjectDiagram />
          </div>
          <div>
            <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
              Hierarchical Skill Dependency Graph (GraphRAG)
            </h3>
            <p className="text-[11px] text-gray-400">
              Entity-Relationship Traversal &bull; {data.extractedEntityCount} Technical Competencies Extracted
            </p>
          </div>
        </div>

        {/* Overall Domain Coverage Meter */}
        <div className="flex items-center gap-4 bg-white/2 px-4 py-2 rounded-xl border border-white/5 w-full sm:w-auto justify-between sm:justify-end">
          <div className="space-y-0.5">
            <span className="text-[9px] text-gray-400 font-mono uppercase tracking-wider block">
              Domain Alignment Index
            </span>
            <span className="text-sm font-heading font-bold text-white">
              Overall Domain Coverage
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  overallDomainCoverage >= 85
                    ? 'bg-emerald-400'
                    : overallDomainCoverage >= 70
                    ? 'bg-accent'
                    : 'bg-yellow-400'
                }`}
                style={{ width: `${overallDomainCoverage}%` }}
              />
            </div>
            <span className="text-base font-bold text-emerald-400 font-mono">
              {overallDomainCoverage}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Hierarchical Knowledge Graph visualizer */}
      <Card variant="glass" className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <FaLayerGroup className="text-primary text-sm" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              3-Tier Community Hierarchy Matrix
            </h4>
          </div>

          {/* Tier Level Filter Controls */}
          <div className="flex items-center gap-1 bg-[#030712] p-1 rounded-xl border border-white/5 text-[10px] font-mono">
            {(['ALL', 0, 1, 2] as const).map((lvl) => (
              <button
                key={String(lvl)}
                type="button"
                onClick={() => setActiveLevelFilter(lvl)}
                className={`px-2.5 py-1 rounded-lg uppercase tracking-wider transition cursor-pointer ${
                  activeLevelFilter === lvl
                    ? 'bg-primary text-white font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {lvl === 'ALL' ? 'All Tiers' : `L${lvl}`}
              </button>
            ))}
          </div>
        </div>

        {/* 3-Tier Node Grid Rendering */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredNodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;

            return (
              <div
                key={node.id}
                onClick={() => {
                  setSelectedNode(node);
                  const comm = candidateGraph.communities.find((c) => c.communityId === node.communityId);
                  if (comm) setSelectedCommunity(comm);
                }}
                className={`p-4 rounded-xl transition duration-200 cursor-pointer space-y-2 text-left relative ${
                  node.status === 'VERIFIED'
                    ? 'bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40'
                    : node.status === 'MISSING'
                    ? 'bg-red-500/10 border-2 border-red-500/40 hover:border-red-500/60 shadow-lg shadow-red-500/5'
                    : 'bg-yellow-500/5 border border-yellow-500/20 hover:border-yellow-500/40'
                } ${isSelected ? 'ring-2 ring-primary shadow-xl' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[9px] text-gray-400 font-mono uppercase tracking-wider">
                    {getLevelLabel(node.level)}
                  </span>
                  {getStatusBadge(node.status)}
                </div>

                <h5 className="text-xs font-bold text-white font-heading">{node.name}</h5>

                <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">
                  {node.description}
                </p>

                <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[9px] font-mono text-gray-500">
                  <span>Community: {node.communityName}</span>
                  <span className="text-primary hover:underline">Inspect Chain &rarr;</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Node & Community Detail Sidebar Drawer Overlay */}
        {selectedNode && (
          <div className="mt-4 p-4 rounded-xl bg-[#030712]/95 border border-primary/30 space-y-3 relative text-left font-mono">
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white p-1 cursor-pointer"
            >
              <FaTimes />
            </button>

            <div className="flex items-center gap-2">
              <FaInfoCircle className="text-primary text-sm" />
              <h5 className="text-xs font-bold text-white uppercase font-heading">
                Community Entity Inspector: {selectedNode.name}
              </h5>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5 bg-white/2 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Entity Description</span>
                <p className="text-gray-300 text-[11px] leading-relaxed">{selectedNode.description}</p>
                <div className="pt-2">
                  <span className="text-[9px] text-primary block">Prerequisite Dependencies:</span>
                  <span className="text-white text-[10px]">{selectedNode.prerequisites?.join(', ') || 'None'}</span>
                </div>
              </div>

              {selectedCommunity && (
                <div className="space-y-1.5 bg-white/2 p-3 rounded-lg border border-white/5">
                  <span className="text-[10px] text-accent uppercase font-bold block">
                    Community Summary ({selectedCommunity.name})
                  </span>
                  <p className="text-gray-300 text-[11px] leading-relaxed">{selectedCommunity.summary}</p>
                  <div className="flex justify-between items-center text-[10px] pt-2">
                    <span className="text-gray-400">Entities in cluster: {selectedCommunity.entityCount}</span>
                    <span className="text-emerald-400 font-bold">Coverage: {selectedCommunity.coveragePercentage}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* 3. Prerequisite Skill Gap Analysis Stepped Cards */}
      <PrerequisiteChainViewer chains={missingPrerequisiteChains} />
    </div>
  );
}
