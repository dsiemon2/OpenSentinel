/**
 * Approval Workflow Engine
 * Ported from GoGreenSourcingAI - generalized for OpenSentinel
 *
 * Multi-step approval chains with configurable rules:
 * - Submit entities for approval based on rules
 * - Route to appropriate approvers
 * - Process approval/rejection decisions
 * - Track approval status and history
 */

export interface ApprovalRule {
  id: string;
  entityType: string;
  conditionField: string;
  conditionOp: "gte" | "lte" | "eq" | "gt" | "lt" | "neq";
  conditionValue: number;
  approverRole: string;
  stepOrder: number;
  isActive: boolean;
}

export interface ApprovalRequest {
  id: string;
  entityType: string;
  entityId: string;
  stepOrder: number;
  requesterId: string;
  approverId: string;
  status: "pending" | "approved" | "rejected";
  comments?: string;
  decidedAt?: Date;
  createdAt: Date;
}

export interface ApprovalSubmission {
  entityType: string;
  entityId: string;
  requesterId: string;
  entityData?: Record<string, unknown>;
}

// In-memory stores
const approvalRules = new Map<string, ApprovalRule>();
const approvalRequests = new Map<string, ApprovalRequest>();
let ruleIdCounter = 0;
let requestIdCounter = 0;

// Callbacks
type ApproverResolver = (role: string) => Promise<string[]>;
type NotifyCallback = (userId: string, title: string, message: string, link?: string) => Promise<void>;
type StatusUpdateCallback = (entityType: string, entityId: string, status: string) => Promise<void>;

let resolveApprovers: ApproverResolver = async () => [];
let notifyUser: NotifyCallback = async () => {};
let updateEntityStatus: StatusUpdateCallback = async () => {};

/**
 * Configure the approval engine callbacks
 */
export function configureApprovalEngine(config: {
  resolveApprovers?: ApproverResolver;
  notifyUser?: NotifyCallback;
  updateEntityStatus?: StatusUpdateCallback;
}): void {
  if (config.resolveApprovers) resolveApprovers = config.resolveApprovers;
  if (config.notifyUser) notifyUser = config.notifyUser;
  if (config.updateEntityStatus) updateEntityStatus = config.updateEntityStatus;
}

/**
 * Add an approval rule
 */
export function addApprovalRule(
  rule: Omit<ApprovalRule, "id">
): ApprovalRule {
  const id = `arule_${++ruleIdCounter}`;
  const created = { ...rule, id };
  approvalRules.set(id, created);
  return created;
}

/**
 * Remove an approval rule
 */
export function removeApprovalRule(id: string): boolean {
  return approvalRules.delete(id);
}

/**
 * List approval rules
 */
export function listApprovalRules(entityType?: string): ApprovalRule[] {
  const all = Array.from(approvalRules.values());
  if (entityType) return all.filter((r) => r.entityType === entityType && r.isActive);
  return all.filter((r) => r.isActive);
}

/**
 * Evaluate a condition
 */
function evaluateApprovalCondition(
  op: ApprovalRule["conditionOp"],
  actual: number,
  expected: number
): boolean {
  switch (op) {
    case "gte": return actual >= expected;
    case "lte": return actual <= expected;
    case "eq": return actual === expected;
    case "gt": return actual > expected;
    case "lt": return actual < expected;
    case "neq": return actual !== expected;
    default: return false;
  }
}

/**
 * Submit an entity for approval
 */
export async function submitForApproval(
  submission: ApprovalSubmission
): Promise<{ submitted: boolean; reason?: string; requestIds?: string[] }> {
  const rules = listApprovalRules(submission.entityType).sort(
    (a, b) => a.stepOrder - b.stepOrder
  );

  if (rules.length === 0) {
    return { submitted: false, reason: "No approval rules configured" };
  }

  const matchingRules = rules.filter((rule) => {
    const fieldValue = Number(
      submission.entityData?.[rule.conditionField] ?? 0
    );
    return evaluateApprovalCondition(rule.conditionOp, fieldValue, rule.conditionValue);
  });

  if (matchingRules.length === 0) {
    return { submitted: false, reason: "No rules matched" };
  }

  const requestIds: string[] = [];

  for (const rule of matchingRules) {
    const approvers = await resolveApprovers(rule.approverRole);
    const validApprovers = approvers.filter(
      (a) => a !== submission.requesterId
    );

    for (const approverId of validApprovers) {
      const id = `areq_${++requestIdCounter}`;
      const request: ApprovalRequest = {
        id,
        entityType: submission.entityType,
        entityId: submission.entityId,
        stepOrder: rule.stepOrder,
        requesterId: submission.requesterId,
        approverId,
        status: "pending",
        createdAt: new Date(),
      };
      approvalRequests.set(id, request);
      requestIds.push(id);

      const title = submission.entityData?.title || submission.entityId;
      await notifyUser(
        approverId,
        "Approval Required",
        `A ${submission.entityType.replace(/_/g, " ")} "${title}" requires your approval`
      );
    }
  }

  return { submitted: true, requestIds };
}

/**
 * Process an approval decision
 */
export async function processApproval(
  requestId: string,
  decision: "approved" | "rejected",
  comments: string | undefined,
  userId: string
): Promise<{
  decision: string;
  allDecided: boolean;
  anyRejected: boolean;
}> {
  const request = approvalRequests.get(requestId);
  if (!request) throw new Error("Approval request not found");
  if (request.approverId !== userId) throw new Error("Not authorized");
  if (request.status !== "pending") throw new Error("Already processed");

  request.status = decision;
  request.comments = comments;
  request.decidedAt = new Date();

  // Check all approvals for this entity
  const allForEntity = Array.from(approvalRequests.values()).filter(
    (r) =>
      r.entityType === request.entityType && r.entityId === request.entityId
  );

  const allDecided = allForEntity.every((r) => r.status !== "pending");
  const anyRejected = allForEntity.some((r) => r.status === "rejected");

  if (allDecided || anyRejected) {
    const newStatus = anyRejected ? "rejected" : "approved";
    await updateEntityStatus(request.entityType, request.entityId, newStatus);

    await notifyUser(
      request.requesterId,
      anyRejected ? "Approval Rejected" : "Approval Granted",
      anyRejected
        ? `Your ${request.entityType.replace(/_/g, " ")} was rejected${comments ? `: "${comments}"` : ""}`
        : `Your ${request.entityType.replace(/_/g, " ")} has been approved`
    );
  }

  return { decision, allDecided, anyRejected };
}

/**
 * Get pending approvals for a user
 */
export function getPendingApprovals(userId: string): ApprovalRequest[] {
  return Array.from(approvalRequests.values()).filter(
    (r) => r.approverId === userId && r.status === "pending"
  );
}

/**
 * Get approval history for an entity
 */
export function getApprovalHistory(
  entityType: string,
  entityId: string
): ApprovalRequest[] {
  return Array.from(approvalRequests.values())
    .filter((r) => r.entityType === entityType && r.entityId === entityId)
    .sort((a, b) => a.stepOrder - b.stepOrder);
}
