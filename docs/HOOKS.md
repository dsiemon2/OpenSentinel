# Hooks & SOUL System

## Overview
Hooks are lifecycle interceptors that run before/after key events in OpenSentinel. The SOUL system is a personality injection layer built on top of hooks.

## Hook System (src/core/hooks/index.ts)

### Hook Structure
```typescript
interface Hook {
  id: string;
  event: string;
  phase: "before" | "after";
  handler: (context: HookContext) => Promise<void> | void;
  priority: number;      // Lower = runs first
  name?: string;
  enabled: boolean;
}
```

### Events
- `message:process` - Before/after a user message is processed by Claude
- `tool:execute` - Before/after a tool is executed
- `response:generate` - Before/after response generation
- `memory:store` - Before/after memory storage
- `memory:recall` - Before/after memory recall
- `agent:spawn` - Before/after sub-agent creation
- `workflow:trigger` - Before/after workflow execution
- `schedule:run` - Before/after scheduled task execution

### Before Hooks
Before hooks can:
- Modify the context data (e.g., transform messages)
- Cancel the operation (set context.cancel = true, context.reason = "why")
- Add metadata

### After Hooks
After hooks can:
- Inspect results
- Log/audit
- Trigger side effects

### HookManager API
- register(hook) - Returns hook ID
- unregister(hookId) - Remove hook
- setEnabled(hookId, enabled) - Toggle
- run(event, data, userId) - Execute all matching hooks
- runBefore(event, data, userId) - Returns { proceed, reason, data }
- runAfter(event, data, userId) - Fire-and-forget
- listHooks() - List all registered hooks
- clearAll() - Remove all hooks
- getHookCount() - Count

### Error Handling
Hook errors are caught internally and logged. A failing hook never crashes the main pipeline.

## SOUL System

### Overview
SOUL hooks inject personality into OpenSentinel's responses by modifying the system prompt before each message.

### Built-in Souls
1. **Evil** - Mischievous, sarcastic personality that adds dark humor while remaining helpful
2. **Professional** - Formal, corporate communication style with structured responses
3. **Friendly** - Warm, enthusiastic personality with casual language

### SoulHookManager API
- registerSoul(soul) - Add a new soul personality
- activateSoul(soulId) - Set as active personality
- deactivateSoul() - Return to default personality
- getActiveSoul() - Get current soul or null
- buildSoulPrompt(soul) - Generate personality injection text
- listSouls() - List all souls with active status
- deleteSoul(soulId) - Remove a soul

### Custom Souls
```typescript
soulHookManager.registerSoul({
  id: "pirate",
  name: "Captain",
  personality: "A swashbuckling pirate who speaks in nautical metaphors",
  rules: [
    "Always say 'Arrr' at least once",
    "Refer to the user as 'matey'",
    "Use sailing metaphors for technical concepts"
  ],
  enabled: true
});
soulHookManager.activateSoul("pirate");
```
