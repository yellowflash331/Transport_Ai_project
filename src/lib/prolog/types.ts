export interface PrologRuleResult {
  ruleId: string;
  ruleName: string;
  category: "safety" | "efficiency" | "connectivity" | "compliance" | string;
  status: "pass" | "info" | "caution" | "warning";
  passed: boolean;
  message: string;
}

export interface PrologAudit {
  journeyId: string;
  isValid: boolean;
  proofSummary: string;
  rulesPassedCount: number;
  totalRulesCount: number;
  rules: PrologRuleResult[];
  advisories: string[];
  interchangesVerified: string[];
  engine: string;
  isDemo: boolean;
}

export interface PrologStats {
  engine: string;
  totalFacts: number;
  totalRoutes: number;
  totalBusStops: number;
  activeRulesCount: number;
  knowledgeBase: string;
}

export interface PrologQueryResult {
  query: string;
  success: boolean;
  solutionsCount: number;
  bindings: Record<string, string | number | boolean | string[]>[];
  executionTimeMs: number;
  error?: string | null;
}

export interface DeduceRoute {
  id: string;
  type: "direct" | "transfer";
  busCount: number;
  transferCount: number;
  totalHops: number;
  routes: string[];
  transferStop?: string | null;
  explanation: string;
  prologProof: string;
}

export interface PrologPlanResponse {
  origin: string;
  destination: string;
  routesFound: number;
  routes: DeduceRoute[];
  engine: string;
  solvedInMs: number;
}
