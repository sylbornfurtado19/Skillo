# Wiring audit (generated — do not hand-edit)

| metric | value |
|---|---|
| totalFiles | 173 |
| reachable | 173 |
| orphanFiles | 0 |
| deadExports | 0 |
| testOnlyExports | 85 |

## Orphan files (not reachable from any app/ entry)

| file | loc | tests reference it |
|---|---|---|


## Exports with no runtime consumer

| file | export | status |
|---|---|---|
| src/components/dashboard/OnboardingProgressWidget.tsx | calculateOnboardingProgress | TEST_ONLY |
| src/components/ui/IVPTelemetryTimeline.tsx | DEFAULT_EVENTS | TEST_ONLY |
| src/lib/ai/aiConfig.ts | DEFAULT_GROQ_MODEL | TEST_ONLY |
| src/lib/ai/aiConfig.ts | resolveAiProvider | TEST_ONLY |
| src/lib/ai/safeJsonParser.ts | extractJsonString | TEST_ONLY |
| src/lib/firebase/services/auth.firebase.ts | normalizeFirebaseUser | INTERNAL_ONLY |
| src/lib/schemas/diagramSchema.ts | systemDesignNodeTypeSchema | INTERNAL_ONLY |
| src/lib/schemas/diagramSchema.ts | systemDesignNodeSchema | INTERNAL_ONLY |
| src/lib/schemas/diagramSchema.ts | systemDesignEdgeSchema | INTERNAL_ONLY |
| src/lib/schemas/graphSchema.ts | ENTITY_ALIAS_MAP | TEST_ONLY |
| src/lib/schemas/graphSchema.ts | entityAliasMapSchema | INTERNAL_ONLY |
| src/lib/schemas/graphSchema.ts | validateEntityAliasMap | TEST_ONLY |
| src/lib/schemas/graphSchema.ts | GRAPH_RELATIONSHIP_TYPES | INTERNAL_ONLY |
| src/lib/server/authenticateRequest.ts | resolveAuthProvider | TEST_ONLY |
| src/lib/server/authenticateRequest.ts | extractBearerToken | TEST_ONLY |
| src/lib/server/sanitize.ts | PROMPT_INJECTION_PATTERNS | INTERNAL_ONLY |
| src/lib/server/supabaseAdmin.ts | getSupabaseAdmin | TEST_ONLY |
| src/lib/services/benchmarkRetrieval.server.ts | tokenize | TEST_ONLY |
| src/lib/services/benchmarkRetrieval.server.ts | resetBenchmarkCorpusCache | TEST_ONLY |
| src/lib/services/benchmarkRetrieval.server.ts | evaluateRetrievalRouting | TEST_ONLY |
| src/lib/services/benchmarkRetrieval.server.ts | loadBenchmarkCorpus | TEST_ONLY |
| src/lib/services/graphRAG.server.ts | entityExtractionSchema | INTERNAL_ONLY |
| src/lib/services/graphRAG.server.ts | relationshipExtractionSchema | TEST_ONLY |
| src/lib/services/graphRAG.server.ts | graphRAGOutputSchema | TEST_ONLY |
| src/lib/services/graphRAG.server.ts | executeLeidenHierarchicalClustering | TEST_ONLY |
| src/lib/services/graphRAG.server.ts | synthesizePrerequisiteGapChains | TEST_ONLY |
| src/lib/services/groundingVerifier.server.ts | normalizeForGrounding | TEST_ONLY |
| src/lib/services/groundingVerifier.server.ts | levenshteinDistance | TEST_ONLY |
| src/lib/services/groundingVerifier.server.ts | diceBigramSimilarity | TEST_ONLY |
| src/lib/services/groundingVerifier.server.ts | verifyQuoteInText | TEST_ONLY |
| src/lib/services/groundingVerifier.server.ts | verifyPassGrounding | TEST_ONLY |
| src/lib/services/interviewEvaluation.server.ts | groundedEvidenceEntrySchema | INTERNAL_ONLY |
| src/lib/services/interviewEvaluation.server.ts | criterionEvidenceSchema | INTERNAL_ONLY |
| src/lib/services/interviewEvaluation.server.ts | singlePassSchema | INTERNAL_ONLY |
| src/lib/services/interviewEvaluation.server.ts | semanticClusterItemSchema | INTERNAL_ONLY |
| src/lib/services/interviewEvaluation.server.ts | semanticClusterResponseSchema | INTERNAL_ONLY |
| src/lib/services/interviewEvaluation.server.ts | buildPassComparisonText | TEST_ONLY |
| src/lib/services/interviewEvaluation.server.ts | computeScoreVarianceClustering | TEST_ONLY |
| src/lib/services/interviewEvaluation.server.ts | computeSemanticEquivalenceAndEntropy | TEST_ONLY |
| src/lib/services/interviewEvaluation.server.ts | groupTelemetryByQuestion | TEST_ONLY |
| src/lib/services/ivpAffectEngine.ts | softArgmaxVA | TEST_ONLY |
| src/lib/services/ivpAffectEngine.ts | calculateComposureScore | TEST_ONLY |
| src/lib/services/ivpAffectEngine.ts | classifyDiscreteEmotion | TEST_ONLY |
| src/lib/services/ivpAffectEngine.ts | detectStressSpikes | TEST_ONLY |
| src/lib/services/ivpFeatureFlags.ts | DEFAULT_IVP_FEATURE_FLAGS | INTERNAL_ONLY |
| src/lib/services/ivpGazeEngine.ts | computeGazeVector | TEST_ONLY |
| src/lib/services/ivpGazeEngine.ts | processGazeFrame | INTERNAL_ONLY |
| src/lib/services/ivpGazeEngine.ts | detectDistractionEvents | TEST_ONLY |
| src/lib/services/ivpPoseEngine.ts | softArgmaxAngle | TEST_ONLY |
| src/lib/services/ivpPoseEngine.ts | analyzeGesturalEvents | TEST_ONLY |
| src/lib/services/ivpSignalCalculators.ts | DEFAULT_BLINK_CONFIG | INTERNAL_ONLY |
| src/lib/services/ivpSyncEngine.ts | calculateL2Distance | TEST_ONLY |
| src/lib/services/ivpSyncEngine.ts | evaluateSyncStatus | TEST_ONLY |
| src/lib/services/ivpSyncEngine.ts | detectSpoofingAlerts | TEST_ONLY |
| src/lib/services/latsEngine.server.ts | C_PUCT | TEST_ONLY |
| src/lib/services/latsEngine.server.ts | prmResponseSchema | INTERNAL_ONLY |
| src/lib/services/latsEngine.server.ts | branchExpansionSchema | INTERNAL_ONLY |
| src/lib/services/latsEngine.server.ts | latsTreeNodeSchema | INTERNAL_ONLY |
| src/lib/services/latsEngine.server.ts | computeUCT | TEST_ONLY |
| src/lib/services/latsEngine.server.ts | selectNode | TEST_ONLY |
| src/lib/services/latsEngine.server.ts | expandBranches | INTERNAL_ONLY |
| src/lib/services/latsEngine.server.ts | evaluatePRM | INTERNAL_ONLY |
| src/lib/services/latsEngine.server.ts | backpropagate | TEST_ONLY |
| src/lib/services/latsEngine.server.ts | attachChildrenToNode | INTERNAL_ONLY |
| src/lib/services/latsEngine.server.ts | getTreeMaxDepth | TEST_ONLY |
| src/lib/services/latsEngine.server.ts | recomputeTreeStats | TEST_ONLY |
| src/lib/services/onnxInferenceService.ts | preprocessFrameDetailed | INTERNAL_ONLY |
| src/lib/services/rateLimiter.server.ts | resetRateLimiterMemoryState | TEST_ONLY |
| src/lib/services/reflexionService.ts | verbalReflectionSchema | TEST_ONLY |
| src/lib/services/reflexionService.ts | generateVerbalSelfReflection | TEST_ONLY |
| src/lib/services/reflexionService.ts | persistSkillMemoryStore | TEST_ONLY |
| src/lib/services/resumeAnalysis.server.ts | resumeRewriteItemSchema | INTERNAL_ONLY |
| src/lib/services/resumeAnalysis.server.ts | computeImpactMetricsScore | TEST_ONLY |
| src/lib/services/resumeAnalysis.server.ts | computeExperienceRelevanceScore | TEST_ONLY |
| src/lib/services/resumeExtraction.server.ts | MAX_RESUME_FILE_SIZE | TEST_ONLY |
| src/lib/services/resumeExtraction.server.ts | MIN_RESUME_TEXT_CHARS | TEST_ONLY |
| src/lib/services/resumeExtraction.server.ts | MAX_RESUME_TEXT_CHARS | TEST_ONLY |
| src/lib/services/resumeExtraction.server.ts | detectFileType | TEST_ONLY |
| src/lib/services/resumeExtraction.server.ts | extractTextFromPdf | INTERNAL_ONLY |
| src/lib/services/resumeExtraction.server.ts | extractTextFromDocx | INTERNAL_ONLY |
| src/lib/services/resumeExtraction.server.ts | extractTextFromTxt | INTERNAL_ONLY |
| src/lib/services/simpoEngine.server.ts | DEFAULT_SIMPO_GAMMA | INTERNAL_ONLY |
| src/lib/services/simpoEngine.server.ts | benchmarkDeltaCardSchema | TEST_ONLY |
| src/lib/services/simpoEngine.server.ts | structuralDeltaSchema | INTERNAL_ONLY |
| src/lib/services/simpoEngine.server.ts | calculateLengthNormalizedReward | TEST_ONLY |
| src/lib/services/speechAnalytics.ts | tokenizeWords | TEST_ONLY |
| src/lib/services/speechAnalytics.ts | countFillerWords | TEST_ONLY |
| src/lib/services/speechAnalytics.ts | getFillerCounts | INTERNAL_ONLY |
| src/lib/services/speechAnalytics.ts | getPauseDurations | TEST_ONLY |
| src/lib/services/speechAnalytics.ts | calculateDeliveryScore | TEST_ONLY |
| src/lib/services/temporalMotion.ts | DEFAULT_MOTION_CONFIG | TEST_ONLY |
| src/lib/services/temporalMotion.ts | computeFrameMotionEnergy | TEST_ONLY |
| src/lib/services/temporalMotion.ts | fuseRestlessnessWithMotionEnergy | TEST_ONLY |
| src/lib/services/temporalSmoothing.ts | ScalarEMA | TEST_ONLY |
| src/lib/services/temporalSmoothing.ts | computeJitterMetric | TEST_ONLY |
| src/lib/services/temporalSmoothing.ts | computeJitterReduction | TEST_ONLY |
| src/lib/services/temporalSmoothing.ts | PRESET_REGIONAL_CONFIGS | TEST_ONLY |
| src/lib/services/temporalSmoothing.ts | LandmarkKinematicFilter | TEST_ONLY |
| src/lib/services/temporalSmoothing.ts | computeSimilarityTransform | TEST_ONLY |
| src/lib/services/temporalSmoothing.ts | computeRansacSimilarityTransform | TEST_ONLY |
| src/lib/services/visionPipeline.ts | mapNormalizedPointsToCanvas | TEST_ONLY |
| src/lib/services/visionPipeline.ts | procNormalizedToVideoNormalized | TEST_ONLY |
| src/lib/services/visionPipeline.ts | procToVideoCoord | TEST_ONLY |
| src/lib/services/visionPipeline.ts | videoToProcCoord | TEST_ONLY |
| src/lib/services/visionPipeline.ts | videoToProcX | TEST_ONLY |
| src/lib/services/visionPipeline.ts | videoToProcY | TEST_ONLY |
| src/lib/services/visionPipeline.ts | procToVideoNormalized | TEST_ONLY |
| src/lib/services/visionPipeline.ts | videoNormalizedToProc | TEST_ONLY |
| src/lib/utils/downsample.ts | downsampleEvenly | TEST_ONLY |
| src/lib/workers/visionWorker.ts | MEDIAPIPE_478_TO_CANONICAL_70 | TEST_ONLY |
| src/lib/workers/visionWorker.ts | tryInitModelWithBackoff | TEST_ONLY |
| src/lib/workers/visionWorker.ts | cancelPendingModelRetries | TEST_ONLY |
| src/lib/workers/visionWorker.ts | extractDenseLandmarksFromLearnedModel | TEST_ONLY |
| src/services/backendProvider.ts | getActiveBackendProvider | INTERNAL_ONLY |
| src/services/constants.ts | EvaluationRequestError | TEST_ONLY |
| src/services/constants.ts | PRESET_QUESTION_POOLS | INTERNAL_ONLY |
| src/views/Profile.tsx | loadPastReport | TEST_ONLY |
| src/views/Results.tsx | handleShareImage | INTERNAL_ONLY |
