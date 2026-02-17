import { describe, test, expect } from "bun:test";
import {
  initializeTwoFactor,
  enableTwoFactor,
  completeTwoFactorSetup,
  verifyTwoFactorCode,
  getTwoFactorStatus,
  disableTwoFactor,
  regenerateRecoveryCodes,
  requiresTwoFactor,
  verifySensitiveOperation,
  cleanupExpiredSetups,
  type TwoFactorSecret,
  type TwoFactorStatus,
  type TwoFactorConfig,
  type SensitiveOperation,
} from "../src/core/security/two-factor-auth";

describe("Two-Factor Auth - DB-backed module", () => {
  describe("Module exports all expected functions", () => {
    test("exports initializeTwoFactor as a function", () => {
      expect(typeof initializeTwoFactor).toBe("function");
    });

    test("exports enableTwoFactor as a function", () => {
      expect(typeof enableTwoFactor).toBe("function");
    });

    test("exports completeTwoFactorSetup as a function", () => {
      expect(typeof completeTwoFactorSetup).toBe("function");
    });

    test("exports verifyTwoFactorCode as a function", () => {
      expect(typeof verifyTwoFactorCode).toBe("function");
    });

    test("exports getTwoFactorStatus as a function", () => {
      expect(typeof getTwoFactorStatus).toBe("function");
    });

    test("exports disableTwoFactor as a function", () => {
      expect(typeof disableTwoFactor).toBe("function");
    });

    test("exports regenerateRecoveryCodes as a function", () => {
      expect(typeof regenerateRecoveryCodes).toBe("function");
    });

    test("exports requiresTwoFactor as a function", () => {
      expect(typeof requiresTwoFactor).toBe("function");
    });

    test("exports verifySensitiveOperation as a function", () => {
      expect(typeof verifySensitiveOperation).toBe("function");
    });

    test("exports cleanupExpiredSetups as a function", () => {
      expect(typeof cleanupExpiredSetups).toBe("function");
    });
  });

  describe("requiresTwoFactor", () => {
    test("returns true for shell_execute", () => {
      expect(requiresTwoFactor("shell_execute")).toBe(true);
    });

    test("returns true for delete_account", () => {
      expect(requiresTwoFactor("delete_account")).toBe(true);
    });

    test("returns true for api_key_create", () => {
      expect(requiresTwoFactor("api_key_create")).toBe(true);
    });

    test("returns false for unknown operation", () => {
      expect(requiresTwoFactor("unknown_operation")).toBe(false);
    });
  });

  describe("cleanupExpiredSetups", () => {
    test("returns a number", () => {
      const result = cleanupExpiredSetups();
      expect(typeof result).toBe("number");
    });
  });

  describe("TwoFactorSecret interface shape", () => {
    test("initializeTwoFactor return type matches TwoFactorSecret (type-level check)", () => {
      // Type-level assertion: the function signature returns Promise<TwoFactorSecret>.
      // We verify by assigning to a correctly typed variable at compile time.
      const fn: (...args: any[]) => Promise<TwoFactorSecret> = initializeTwoFactor;
      expect(typeof fn).toBe("function");
    });
  });

  describe("Async function signatures", () => {
    test("getTwoFactorStatus is async (returns a Promise)", () => {
      // Calling with a dummy userId will hit the DB and reject, but the
      // return value is still a Promise — that is what we verify.
      const result = getTwoFactorStatus("nonexistent-user-id");
      expect(result).toBeInstanceOf(Promise);
      // Suppress unhandled rejection from the DB call
      result.catch(() => {});
    });

    test("initializeTwoFactor is async", () => {
      const result = initializeTwoFactor("nonexistent-user-id");
      expect(result).toBeInstanceOf(Promise);
      result.catch(() => {});
    });

    test("completeTwoFactorSetup is async", () => {
      const result = completeTwoFactorSetup("nonexistent-user-id", "FAKESECRET", "000000");
      expect(result).toBeInstanceOf(Promise);
      result.catch(() => {});
    });

    test("verifyTwoFactorCode is async", () => {
      const result = verifyTwoFactorCode("nonexistent-user-id", "000000");
      expect(result).toBeInstanceOf(Promise);
      result.catch(() => {});
    });

    test("disableTwoFactor is async", () => {
      const result = disableTwoFactor("nonexistent-user-id", "000000");
      expect(result).toBeInstanceOf(Promise);
      result.catch(() => {});
    });

    test("regenerateRecoveryCodes is async", () => {
      const result = regenerateRecoveryCodes("nonexistent-user-id", "000000");
      expect(result).toBeInstanceOf(Promise);
      result.catch(() => {});
    });
  });
});
