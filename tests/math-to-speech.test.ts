import { describe, test, expect } from "bun:test";
import { latexToSpeech } from "../src/tools/rendering/math-renderer";

describe("Math-to-Speech Conversion", () => {
  describe("latexToSpeech", () => {
    test("should convert simple fractions", () => {
      expect(latexToSpeech("\\frac{a}{b}")).toContain("a divided by b");
    });

    test("should convert numeric fractions", () => {
      expect(latexToSpeech("\\frac{1}{2}")).toContain("1 divided by 2");
    });

    test("should convert square roots", () => {
      expect(latexToSpeech("\\sqrt{16}")).toContain("the square root of 16");
    });

    test("should convert nth roots", () => {
      expect(latexToSpeech("\\sqrt[3]{27}")).toContain("the 3th root of 27");
    });

    test("should convert x squared", () => {
      expect(latexToSpeech("x^2")).toContain("x squared");
    });

    test("should convert x cubed", () => {
      expect(latexToSpeech("x^3")).toContain("x cubed");
    });

    test("should convert arbitrary powers", () => {
      expect(latexToSpeech("x^{10}")).toContain("x to the power of 10");
    });

    test("should convert subscripts", () => {
      const result = latexToSpeech("x_i");
      expect(result).toContain("x sub i");
    });

    test("should convert Greek letters", () => {
      expect(latexToSpeech("\\alpha")).toBe("alpha");
      expect(latexToSpeech("\\beta")).toBe("beta");
      expect(latexToSpeech("\\pi")).toBe("pi");
      expect(latexToSpeech("\\theta")).toBe("theta");
      expect(latexToSpeech("\\omega")).toBe("omega");
    });

    test("should convert summation", () => {
      const result = latexToSpeech("\\sum_{i=1}^{n}");
      expect(result).toContain("the sum from");
      expect(result).toContain("to");
    });

    test("should convert simple sum notation", () => {
      const result = latexToSpeech("\\sum");
      expect(result).toContain("the sum of");
    });

    test("should convert integral", () => {
      const result = latexToSpeech("\\int_{0}^{1}");
      expect(result).toContain("the integral from");
    });

    test("should convert limits", () => {
      const result = latexToSpeech("\\lim_{x \\rightarrow 0}");
      expect(result).toContain("the limit as");
    });

    test("should convert operators", () => {
      expect(latexToSpeech("\\times")).toBe("times");
      expect(latexToSpeech("\\div")).toBe("divided by");
      expect(latexToSpeech("\\pm")).toBe("plus or minus");
    });

    test("should convert relations", () => {
      expect(latexToSpeech("\\leq")).toBe("less than or equal to");
      expect(latexToSpeech("\\geq")).toBe("greater than or equal to");
      expect(latexToSpeech("\\neq")).toBe("not equal to");
      expect(latexToSpeech("\\approx")).toBe("approximately equal to");
    });

    test("should convert set theory symbols", () => {
      expect(latexToSpeech("\\in")).toBe("in");
      expect(latexToSpeech("\\emptyset")).toBe("the empty set");
      expect(latexToSpeech("\\forall")).toBe("for all");
      expect(latexToSpeech("\\exists")).toBe("there exists");
    });

    test("should convert infinity", () => {
      expect(latexToSpeech("\\infty")).toBe("infinity");
    });

    test("should convert trig functions", () => {
      expect(latexToSpeech("\\sin")).toBe("sine");
      expect(latexToSpeech("\\cos")).toBe("cosine");
      expect(latexToSpeech("\\tan")).toBe("tangent");
    });

    test("should convert basic arithmetic operators", () => {
      const result = latexToSpeech("a + b");
      expect(result).toContain("plus");
    });

    test("should handle complex expression", () => {
      const result = latexToSpeech("\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}");
      expect(result).toContain("divided by");
      expect(result).toContain("square root");
    });

    test("should handle empty input", () => {
      expect(latexToSpeech("")).toBe("");
    });

    test("should handle plain text passthrough", () => {
      expect(latexToSpeech("hello")).toBe("hello");
    });
  });
});
