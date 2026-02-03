/**
 * Agent Collaboration Module
 *
 * Provides inter-agent communication, shared context management,
 * and task coordination for multi-agent workflows.
 */

// Agent Messenger - Inter-agent communication
export {
  AgentMessenger,
  MessageQueue,
  messageQueue,
  createMessenger,
  type MessageType,
  type MessagePriority,
  type AgentMessage as CollaborationMessage,
  type MessagePayload,
  type MessageMetadata,
  type MessageHandler,
  type MessageFilter,
} from "./agent-messenger";

// Shared Context - Shared memory between agents
export {
  SharedContext,
  ContextManager,
  contextManager,
  getOrCreateContext,
  type ContextType,
  type SharedContextEntry,
  type ContextFilter,
  type ContextSnapshot,
} from "./shared-context";

// Task Coordinator - Task delegation and orchestration
export {
  TaskCoordinator,
  createWorkflow,
  runWorkflow,
  WORKFLOW_TEMPLATES,
  type TaskStatus,
  type TaskPriority,
  type CoordinatedTask,
  type TaskMetadata,
  type WorkflowDefinition,
  type TaskDefinition,
  type WorkflowStrategy,
  type WorkflowStatus,
} from "./task-coordinator";

// Convenience types for collaboration setup
export interface CollaborationConfig {
  contextId?: string;
  enableMessaging?: boolean;
  enableSharedContext?: boolean;
  maxAgents?: number;
}

export interface CollaborationSession {
  contextId: string;
  sharedContext: import("./shared-context").SharedContext;
  messengers: Map<string, import("./agent-messenger").AgentMessenger>;
  coordinator?: import("./task-coordinator").TaskCoordinator;
}

/**
 * Create a collaboration session for multiple agents
 */
export async function createCollaborationSession(
  userId: string,
  config: CollaborationConfig = {}
): Promise<CollaborationSession> {
  const { getOrCreateContext } = await import("./shared-context");

  const contextId = config.contextId || `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const sharedContext = getOrCreateContext(contextId, userId);

  return {
    contextId,
    sharedContext,
    messengers: new Map(),
  };
}

/**
 * Quick start a multi-agent workflow
 */
export async function startMultiAgentWorkflow(
  userId: string,
  workflow: import("./task-coordinator").WorkflowDefinition
): Promise<{
  coordinator: import("./task-coordinator").TaskCoordinator;
  session: CollaborationSession;
}> {
  const { TaskCoordinator } = await import("./task-coordinator");
  const { getOrCreateContext } = await import("./shared-context");

  const contextId = `workflow:${workflow.id}`;
  const sharedContext = getOrCreateContext(contextId, userId);

  const coordinator = new TaskCoordinator(workflow.id, userId);
  await coordinator.initialize(workflow);

  const session: CollaborationSession = {
    contextId,
    sharedContext,
    messengers: new Map(),
    coordinator,
  };

  // Start the workflow asynchronously
  coordinator.start().catch((error) => {
    console.error("[Collaboration] Workflow error:", error);
  });

  return { coordinator, session };
}

/**
 * Clean up a collaboration session
 */
export async function cleanupCollaborationSession(
  session: CollaborationSession
): Promise<void> {
  // Disconnect all messengers
  const messengerArray = Array.from(session.messengers.values());
  for (const messenger of messengerArray) {
    await messenger.disconnect();
  }
  session.messengers.clear();

  // Cancel coordinator if running
  if (session.coordinator) {
    const status = session.coordinator.getStatus();
    if (status.status === "running") {
      await session.coordinator.cancel();
    }
  }

  // Disconnect shared context
  await session.sharedContext.disconnect();
}

export default {
  createCollaborationSession,
  startMultiAgentWorkflow,
  cleanupCollaborationSession,
};
