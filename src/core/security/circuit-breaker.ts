/**
 * Circuit Breaker — OWASP ASI08/ASI10 Defense
 *
 * Implements the circuit breaker pattern for resilience:
 * CLOSED (normal) → OPEN (all blocked) → HALF_OPEN (testing recovery) → CLOSED
 *
 * Includes emergency halt capability (kill switch).
 */

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  failureThreshold: number;   // Number of failures before opening
  resetTimeoutMs: number;     // Time in OPEN before trying HALF_OPEN
  halfOpenMaxRequests: number; // Max requests allowed in HALF_OPEN
  name: string;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  stateChangedAt: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenMaxRequests: 3,
  name: "default",
};

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private halfOpenRequests = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private stateChangedAt: number = Date.now();
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === "open") {
      // Check if it's time to try half-open
      if (Date.now() - this.stateChangedAt >= this.config.resetTimeoutMs) {
        this.transitionTo("half_open");
      } else {
        throw new CircuitBreakerOpenError(this.config.name);
      }
    }

    if (this.state === "half_open") {
      if (this.halfOpenRequests >= this.config.halfOpenMaxRequests) {
        throw new CircuitBreakerOpenError(this.config.name);
      }
      this.halfOpenRequests++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === "half_open") {
      // Successful in half-open → close the circuit
      this.transitionTo("closed");
    }

    // Reset failure count on success in closed state
    if (this.state === "closed") {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "half_open") {
      // Failure in half-open → back to open
      this.transitionTo("open");
    } else if (this.state === "closed" && this.failures >= this.config.failureThreshold) {
      // Too many failures → open the circuit
      this.transitionTo("open");
    }
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    this.stateChangedAt = Date.now();

    if (newState === "half_open") {
      this.halfOpenRequests = 0;
    }

    if (newState === "closed") {
      this.failures = 0;
      this.halfOpenRequests = 0;
    }

    console.log(`[CircuitBreaker:${this.config.name}] State → ${newState}`);
  }

  getState(): CircuitState {
    // Auto-transition from open to half_open if timeout elapsed
    if (this.state === "open" && Date.now() - this.stateChangedAt >= this.config.resetTimeoutMs) {
      this.transitionTo("half_open");
    }
    return this.state;
  }

  forceOpen(): void {
    this.transitionTo("open");
  }

  forceClose(): void {
    this.transitionTo("closed");
  }

  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.halfOpenRequests = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.stateChangedAt = Date.now();
  }

  getStats(): CircuitBreakerStats {
    return {
      name: this.config.name,
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangedAt: this.stateChangedAt,
    };
  }

  getName(): string {
    return this.config.name;
  }

  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker '${name}' is OPEN — requests are blocked`);
    this.name = "CircuitBreakerOpenError";
  }
}

// Registry of circuit breakers
const circuitBreakers: Map<string, CircuitBreaker> = new Map();
let _emergencyHalted = false;

/**
 * Create or get a named circuit breaker
 */
export function createCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  const existing = circuitBreakers.get(name);
  if (existing) return existing;

  const breaker = new CircuitBreaker({ ...config, name });
  circuitBreakers.set(name, breaker);
  return breaker;
}

/**
 * Get a circuit breaker by name
 */
export function getCircuitBreaker(name: string): CircuitBreaker | undefined {
  return circuitBreakers.get(name);
}

/**
 * Emergency halt — opens ALL circuit breakers immediately
 */
export function emergencyHalt(): void {
  _emergencyHalted = true;
  for (const [, breaker] of circuitBreakers) {
    breaker.forceOpen();
  }
  console.log(`[CircuitBreaker] EMERGENCY HALT — All ${circuitBreakers.size} breakers opened`);
}

/**
 * Resume from emergency halt — closes all circuit breakers
 */
export function resumeFromHalt(): void {
  _emergencyHalted = false;
  for (const [, breaker] of circuitBreakers) {
    breaker.forceClose();
  }
  console.log(`[CircuitBreaker] Resumed from emergency halt`);
}

/**
 * Check if emergency halt is active
 */
export function isEmergencyHalted(): boolean {
  return _emergencyHalted;
}

/**
 * Get stats for all circuit breakers
 */
export function getCircuitBreakerStats(): CircuitBreakerStats[] {
  return Array.from(circuitBreakers.values()).map((b) => b.getStats());
}

/**
 * Get all registered breaker names
 */
export function getRegisteredBreakers(): string[] {
  return Array.from(circuitBreakers.keys());
}
