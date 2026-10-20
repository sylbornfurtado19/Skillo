/**
 * tests/latsMultiIterationMCTS.test.ts
 *
 * Verification suite for B2: Real multi-iteration LATS with a persistent tree.
 * Tests:
 * 1. Running mean Q values average correctly across backpropagation passes.
 * 2. UCT selection picks unvisited nodes first (visitCount === 0).
 * 3. Tree visit counts sum correctly: for every internal node, visitCount === sum of children's visitCounts.
 * 4. Tree depth grows over two turns with persistent tree state.
 * 5. Consecutive follow-up API calls produce a tree of depth 2+ with visit counts that sum correctly.
 * 6. LATSTreeVisualizer displays depth, visit counts, and selected path breadcrumb.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LATSTreeNode, LATSTreeState } from '../src/types/index';



import {
  computeUCT,
  selectNode,
  backpropagate,
  recomputeTreeStats,
  getTreeMaxDepth,
  runLATSMCTS,
} from '../src/lib/services/latsEngine.server';
import { POST as followupHandler } from '../app/api/interview/followup/route';
import LATSTreeVisualizer from '../src/components/ui/LATSTreeVisualizer';

describe('B2: Real Multi-Iteration LATS with Persistent Tree', () => {
  describe('1. Q Values Average Correctly', () => {
    it('running mean Q updates correctly when backpropagating values', () => {
      // Create a small test tree: root -> child_0
      const child: LATSTreeNode = {
        id: 'child_0',
        parentId: 'root',
        actionType: 'DEEP_DIVE',
        questionText: 'Child question',
        rationale: 'Child rationale',
        prmScore: 0.8,
        qValue: 0.8,
        visitCount: 1,
        uctValue: 0,
        gapsDetected: [],
        isVisited: true,
        isSelectedTrajectory: true,
        children: [],
        prior: 1 / 3,
        depth: 1,
      };

      let root: LATSTreeNode = {
        id: 'root',
        parentId: null,
        actionType: 'DEEP_DIVE',
        questionText: 'Root question',
        rationale: 'Root rationale',
        prmScore: 0.8,
        qValue: 0.8,
        visitCount: 1,
        uctValue: 0,
        gapsDetected: [],
        isVisited: true,
        isSelectedTrajectory: true,
        children: [child],
        prior: 1.0,
        depth: 0,
      };

      // 1st backpropagation: new value = 0.6
      // New visit count = 2
      // Expected Q = (0.8 * 1 + 0.6) / 2 = 0.700
      root = backpropagate(root, 'child_0', 0.6);
      expect(root.children[0].visitCount).toBe(2);
      expect(root.children[0].qValue).toBeCloseTo(0.7, 3);
      expect(root.visitCount).toBe(2);
      expect(root.qValue).toBeCloseTo(0.7, 3);

      // 2nd backpropagation: new value = 0.9
      // New visit count = 3
      // Expected Q = (0.7 * 2 + 0.9) / 3 = 2.3 / 3 ≈ 0.767
      root = backpropagate(root, 'child_0', 0.9);
      expect(root.children[0].visitCount).toBe(3);
      expect(root.children[0].qValue).toBeCloseTo((0.8 + 0.6 + 0.9) / 3, 3);
      expect(root.visitCount).toBe(3);
      expect(root.qValue).toBeCloseTo((0.8 + 0.6 + 0.9) / 3, 3);
    });

    it('recomputeTreeStats computes exact weighted running mean across multi-branch tree', () => {
      const childA: LATSTreeNode = {
        id: 'cA',
        parentId: 'root',
        actionType: 'DEEP_DIVE',
        questionText: 'A',
        rationale: 'A',
        prmScore: 0.6,
        qValue: 0.6,
        visitCount: 2,
        uctValue: 0,
        gapsDetected: [],
        isVisited: true,
        isSelectedTrajectory: false,
        children: [],
        prior: 1 / 3,
      };

      const childB: LATSTreeNode = {
        id: 'cB',
        parentId: 'root',
        actionType: 'PIVOT',
        questionText: 'B',
        rationale: 'B',
        prmScore: 0.9,
        qValue: 0.9,
        visitCount: 4,
        uctValue: 0,
        gapsDetected: [],
        isVisited: true,
        isSelectedTrajectory: true,
        children: [],
        prior: 1 / 3,
      };

      const root: LATSTreeNode = {
        id: 'root',
        parentId: null,
        actionType: 'DEEP_DIVE',
        questionText: 'Root',
        rationale: 'Root',
        prmScore: 0.5,
        qValue: 0.5,
        visitCount: 1,
        uctValue: 0,
        gapsDetected: [],
        isVisited: true,
        isSelectedTrajectory: true,
        children: [childA, childB],
      };

      const computed = recomputeTreeStats(root, 1);
      // Total child visits = 2 + 4 = 6
      expect(computed.visitCount).toBe(6);
      // Weighted mean Q = (2 * 0.6 + 4 * 0.9) / 6 = (1.2 + 3.6) / 6 = 4.8 / 6 = 0.8
      expect(computed.qValue).toBeCloseTo(0.8, 3);
    });
  });

  describe('2. UCT Picks Unvisited Nodes First', () => {
    it('selectNode selects an unvisited node (visitCount === 0) over a visited node with high score', () => {
      const visitedChild: LATSTreeNode = {
        id: 'visited_child',
        parentId: 'root',
        actionType: 'DEEP_DIVE',
        questionText: 'Visited Question',
        rationale: 'High score child',
        prmScore: 0.95,
        qValue: 0.95,
        visitCount: 3,
        uctValue: 2.1,
        gapsDetected: [],
        isVisited: true,
        isSelectedTrajectory: false,
        children: [],
        prior: 1 / 3,
      };

      const unvisitedChild1: LATSTreeNode = {
        id: 'unvisited_child_1',
        parentId: 'root',
        actionType: 'PIVOT',
        questionText: 'Unvisited Question 1',
        rationale: 'Unvisited child 1',
        prmScore: 0.0,
        qValue: 0.0,
        visitCount: 0,
        uctValue: 0,
        gapsDetected: [],
        isVisited: false,
        isSelectedTrajectory: false,
        children: [],
        prior: 1 / 3,
      };

      const unvisitedChild2: LATSTreeNode = {
        id: 'unvisited_child_2',
        parentId: 'root',
        actionType: 'EDGE_CASE_CHALLENGE',
        questionText: 'Unvisited Question 2',
        rationale: 'Unvisited child 2',
        prmScore: 0.0,
        qValue: 0.0,
        visitCount: 0,
        uctValue: 0,
        gapsDetected: [],
        isVisited: false,
        isSelectedTrajectory: false,
        children: [],
        prior: 1 / 3,
      };

      const root: LATSTreeNode = {
        id: 'root',
        parentId: null,
        actionType: 'DEEP_DIVE',
        questionText: 'Root Question',
        rationale: 'Root',
        prmScore: 0.5,
        qValue: 0.5,
        visitCount: 4,
        uctValue: 0,
        gapsDetected: [],
        isVisited: true,
        isSelectedTrajectory: true,
        children: [visitedChild, unvisitedChild1, unvisitedChild2],
      };

      const selected = selectNode(root);
      expect(selected.visitCount).toBe(0);
      expect(selected.id).toMatch(/^unvisited_child/);
    });

    it('selectNode selects child with highest UCT once all children are visited', () => {
      const child1: LATSTreeNode = {
        id: 'c1',
        parentId: 'root',
        actionType: 'DEEP_DIVE',
        questionText: 'C1',
        rationale: 'C1',
        prmScore: 0.85,
        qValue: 0.85,
        visitCount: 1,
        uctValue: 0,
        gapsDetected: [],
        isVisited: true,
        isSelectedTrajectory: false,
        children: [],
        prior: 1 / 3,
      };

      const child2: LATSTreeNode = {
        id: 'c2',
        parentId: 'root',
        actionType: 'PIVOT',
        questionText: 'C2',
        rationale: 'C2',
        prmScore: 0.4,
        qValue: 0.4,
        visitCount: 1,
        uctValue: 0,
        gapsDetected: [],
        isVisited: true,
        isSelectedTrajectory: false,
        children: [],
        prior: 1 / 3,
      };

      const root: LATSTreeNode = {
        id: 'root',
        parentId: null,
        actionType: 'DEEP_DIVE',
        questionText: 'Root',
        rationale: 'Root',
        prmScore: 0.6,
        qValue: 0.6,
        visitCount: 2,
        uctValue: 0,
        gapsDetected: [],
        isVisited: true,
        isSelectedTrajectory: true,
        children: [child1, child2],
      };

      const selected = selectNode(root);
      expect(selected.id).toBe('c1');
    });
  });

  describe('3. Visit Counts Sum Correctly', () => {
    it('every internal node visitCount equals the sum of its children visitCounts', async () => {
      const state = await runLATSMCTS({
        sessionId: 'test_visit_sum',
        role: 'Senior Backend Engineer',
        currentQuestion: 'How would you architect a distributed lock?',
        candidateAnswer: 'Use Redis with Redlock algorithm or etcd with Raft leases.',
        priorGaps: [],
        maxRounds: 3,
      });

      function verifyVisitCountSum(node: LATSTreeNode) {
        if (node.children && node.children.length > 0) {
          const sumOfChildren = node.children.reduce((acc, c) => acc + c.visitCount, 0);
          expect(node.visitCount).toBe(sumOfChildren);
          node.children.forEach(verifyVisitCountSum);
        }
      }

      verifyVisitCountSum(state.rootNode);
    });
  });

  describe('4. Depth Grows Over Two Turns', () => {
    it('produces a tree of depth 2+ when persisting treeState across two consecutive turns', async () => {
      // ── Turn 1 ──
      const turn1State = await runLATSMCTS({
        sessionId: 'turn_continuity_session',
        role: 'Distributed Systems Engineer',
        currentQuestion: 'Explain consensus in Paxos vs Raft.',
        candidateAnswer: 'Paxos uses synod phases with prepare/accept, while Raft uses leader election and log replication.',
        priorGaps: [],
        maxRounds: 3,
      });

      const depthTurn1 = getTreeMaxDepth(turn1State.rootNode);
      expect(depthTurn1).toBeGreaterThanOrEqual(1);
      expect(turn1State.trajectoryHistory.length).toBeGreaterThanOrEqual(2);

      // Pick the selected follow-up question
      const followUpNode = turn1State.simulatedBranches.find((b) => b.isSelectedTrajectory)
        ?? turn1State.simulatedBranches[0];

      // ── Turn 2 ──
      const turn2State = await runLATSMCTS({
        sessionId: 'turn_continuity_session',
        role: 'Distributed Systems Engineer',
        currentQuestion: followUpNode.questionText,
        candidateAnswer: 'To handle split brain in Raft, term numbers and leader leases guarantee linearizability.',
        priorGaps: turn1State.currentGaps,
        previousTreeState: turn1State,
        maxRounds: 3,
      });

      const depthTurn2 = getTreeMaxDepth(turn2State.rootNode);

      // Depth must grow over two turns and reach depth 2+
      expect(depthTurn2).toBeGreaterThanOrEqual(2);
      expect(turn2State.trajectoryHistory.length).toBeGreaterThan(turn1State.trajectoryHistory.length);

      // Visit counts must sum correctly at all levels in turn 2
      function verifyVisitCountSum(node: LATSTreeNode) {
        if (node.children && node.children.length > 0) {
          const sumOfChildren = node.children.reduce((acc, c) => acc + c.visitCount, 0);
          expect(node.visitCount).toBe(sumOfChildren);
          node.children.forEach(verifyVisitCountSum);
        }
      }
      verifyVisitCountSum(turn2State.rootNode);
    });
  });

  describe('5. Two Consecutive Follow-Up API Calls (POST /api/interview/followup)', () => {
    it('produces a tree of depth 2+ with visit counts that sum correctly across consecutive HTTP calls', async () => {
      // ── Turn 1 Request ──
      const turn1Req = new Request('http://localhost:3000/api/interview/followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid_test_token',
        },
        body: JSON.stringify({
          question: 'How do you design an idempotency key mechanism for payment processing?',
          answerText: 'Store a unique UUID per transaction in Redis with a 24-hour TTL and atomic SETNX.',
          role: 'Backend Engineer',
          sessionId: 'session_api_turn_test',
        }),
      });

      const turn1Res = await followupHandler(turn1Req);
      expect(turn1Res.status).toBe(200);
      const turn1Data = await turn1Res.json();

      expect(turn1Data.needsFollowUp).toBe(true);
      expect(turn1Data.followUpQuestion).toBeDefined();
      expect(turn1Data.treeState).toBeDefined();
      expect(turn1Data.trajectoryDepth).toBeGreaterThanOrEqual(2);

      const treeStateTurn1: LATSTreeState = turn1Data.treeState;

      // ── Turn 2 Request with previousTreeState ──
      const turn2Req = new Request('http://localhost:3000/api/interview/followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid_test_token',
        },
        body: JSON.stringify({
          question: turn1Data.followUpQuestion,
          answerText: 'For database deduplication, use unique constraint on idempotency_key column with optimistic locking.',
          role: 'Backend Engineer',
          sessionId: 'session_api_turn_test',
          previousTreeState: treeStateTurn1,
        }),
      });

      const turn2Res = await followupHandler(turn2Req);
      expect(turn2Res.status).toBe(200);
      const turn2Data = await turn2Res.json();

      expect(turn2Data.needsFollowUp).toBe(true);
      expect(turn2Data.treeState).toBeDefined();
      expect(turn2Data.trajectoryDepth).toBeGreaterThan(turn1Data.trajectoryDepth);

      const treeStateTurn2: LATSTreeState = turn2Data.treeState;
      const depthTurn2 = getTreeMaxDepth(treeStateTurn2.rootNode);

      // Two consecutive followup calls produce a tree whose rootNode.visitCount and trajectoryHistory length grow
      expect(treeStateTurn2.rootNode.visitCount).toBeGreaterThan(treeStateTurn1.rootNode.visitCount);
      expect(treeStateTurn2.trajectoryHistory.length).toBeGreaterThan(treeStateTurn1.trajectoryHistory.length);
      expect(depthTurn2).toBeGreaterThanOrEqual(2);

      // Verify visit counts sum correctly
      function checkNodeVisits(node: LATSTreeNode) {
        if (node.children && node.children.length > 0) {
          const sum = node.children.reduce((s, c) => s + c.visitCount, 0);
          expect(node.visitCount).toBe(sum);
          node.children.forEach(checkNodeVisits);
        }
      }
      checkNodeVisits(treeStateTurn2.rootNode);
    });
  });

  describe('6. LATSTreeVisualizer Component UI', () => {
    it('renders depth, visit counts, and selected path breadcrumb in the visualizer HTML', async () => {
      const state = await runLATSMCTS({
        sessionId: 'ui_test_session',
        role: 'Staff Engineer',
        currentQuestion: 'How to scale Postgres to 100k writes per second?',
        candidateAnswer: 'Use connection pooling with PgBouncer, horizontal sharding via Citus, and write caching.',
        priorGaps: [],
        maxRounds: 3,
      });

      const html = renderToStaticMarkup(
        React.createElement(LATSTreeVisualizer, { treeState: state })
      );

      // Shows depth
      expect(html).toContain('Depth:');
      expect(html).toContain('Depth 0');

      // Shows visits
      expect(html).toContain('Visits:');

      // Shows selected path breadcrumb
      expect(html).toContain('selected-path-breadcrumb');
      expect(html).toContain('Selected Path');
    });
  });

  describe('7. Wall-Clock Budget Enforcement', () => {
    it('returns a valid result with at least one expansion and does not throw with wallClockBudgetMs ~0', async () => {
      const state = await runLATSMCTS({
        sessionId: 'zero_budget_session',
        role: 'Distributed Systems Engineer',
        currentQuestion: 'How does Raft handle leader partition split-brain?',
        candidateAnswer: 'Raft requires a majority quorum (N/2 + 1) to commit log entries, so a partitioned minority leader cannot commit.',
        priorGaps: [],
        wallClockBudgetMs: 0,
      });

      expect(state).toBeDefined();
      expect(state.rootNode).toBeDefined();
      expect(state.rootNode.children.length).toBe(3);
      expect(state.depth).toBeGreaterThanOrEqual(1);
      expect(state.simulatedBranches.length).toBe(3);
      expect(state.currentNodeId).toBeDefined();
    });
  });
});
