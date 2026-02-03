import { describe, test, expect } from "bun:test";
import { markdownToText } from "../src/tools/file-generation/pdf";
import {
  generateFlowchartCode,
  generateSequenceCode,
  generateClassCode,
  generateStateCode,
  generateGanttCode,
  generateMindmapCode,
} from "../src/tools/file-generation/diagrams";

// Note: markdownToText is not exported, so we'll test the module structure
describe("PDF Generation", () => {
  describe("module exports", () => {
    test("should export generatePDF function", async () => {
      const pdf = await import("../src/tools/file-generation/pdf");
      expect(typeof pdf.generatePDF).toBe("function");
    });

    test("should export generatePDFFromMarkdown function", async () => {
      const pdf = await import("../src/tools/file-generation/pdf");
      expect(typeof pdf.generatePDFFromMarkdown).toBe("function");
    });

    test("should export generatePDFFromHTML function", async () => {
      const pdf = await import("../src/tools/file-generation/pdf");
      expect(typeof pdf.generatePDFFromHTML).toBe("function");
    });
  });
});

describe("Spreadsheet Generation", () => {
  describe("module exports", () => {
    test("should export generateCSV function", async () => {
      const spreadsheet = await import("../src/tools/file-generation/spreadsheet");
      expect(typeof spreadsheet.generateCSV).toBe("function");
    });

    test("should export generateExcel function", async () => {
      const spreadsheet = await import("../src/tools/file-generation/spreadsheet");
      expect(typeof spreadsheet.generateExcel).toBe("function");
    });

    test("should export generateSpreadsheet function", async () => {
      const spreadsheet = await import("../src/tools/file-generation/spreadsheet");
      expect(typeof spreadsheet.generateSpreadsheet).toBe("function");
    });
  });
});

describe("Chart Generation", () => {
  describe("module exports", () => {
    test("should export generateChart function", async () => {
      const charts = await import("../src/tools/file-generation/charts");
      expect(typeof charts.generateChart).toBe("function");
    });

    test("should export quickChart function", async () => {
      const charts = await import("../src/tools/file-generation/charts");
      expect(typeof charts.quickChart).toBe("function");
    });
  });
});

describe("Diagram Generation", () => {
  describe("generateFlowchartCode", () => {
    test("should generate valid flowchart syntax", () => {
      const nodes = [
        { id: "A", label: "Start" },
        { id: "B", label: "Process" },
        { id: "C", label: "End" },
      ];
      const edges = [
        { from: "A", to: "B" },
        { from: "B", to: "C" },
      ];

      const code = generateFlowchartCode(nodes, edges);

      expect(code).toContain("flowchart");
      expect(code).toContain("A[Start]");
      expect(code).toContain("B[Process]");
      expect(code).toContain("C[End]");
      expect(code).toContain("A --> B");
      expect(code).toContain("B --> C");
    });

    test("should handle different directions", () => {
      const nodes = [{ id: "A", label: "Node" }];
      const edges: { from: string; to: string }[] = [];

      const tbCode = generateFlowchartCode(nodes, edges, "TB");
      expect(tbCode).toContain("flowchart TB");

      const lrCode = generateFlowchartCode(nodes, edges, "LR");
      expect(lrCode).toContain("flowchart LR");
    });

    test("should handle different node shapes", () => {
      const nodes = [
        { id: "A", label: "Box", shape: "box" as const },
        { id: "B", label: "Round", shape: "round" as const },
        { id: "C", label: "Diamond", shape: "diamond" as const },
        { id: "D", label: "Circle", shape: "circle" as const },
        { id: "E", label: "Stadium", shape: "stadium" as const },
      ];

      const code = generateFlowchartCode(nodes, []);

      expect(code).toContain("A[Box]");
      expect(code).toContain("B(Round)");
      expect(code).toContain("C{Diamond}");
      expect(code).toContain("D((Circle))");
      expect(code).toContain("E([Stadium])");
    });

    test("should handle edge labels and styles", () => {
      const nodes = [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
      ];
      const edges = [
        { from: "A", to: "B", label: "yes", style: "solid" as const },
      ];

      const code = generateFlowchartCode(nodes, edges);
      expect(code).toContain("yes");
    });
  });

  describe("generateSequenceCode", () => {
    test("should generate valid sequence diagram", () => {
      const participants = ["Client", "Server"];
      const messages = [
        { from: "Client", to: "Server", message: "Request" },
        { from: "Server", to: "Client", message: "Response" },
      ];

      const code = generateSequenceCode(participants, messages);

      expect(code).toContain("sequenceDiagram");
      expect(code).toContain("participant Client");
      expect(code).toContain("participant Server");
      expect(code).toContain("Request");
      expect(code).toContain("Response");
    });

    test("should include title when provided", () => {
      const code = generateSequenceCode(["A"], [], "My Diagram");
      expect(code).toContain("title My Diagram");
    });
  });

  describe("generateClassCode", () => {
    test("should generate valid class diagram", () => {
      const classes = [
        {
          name: "Animal",
          attributes: ["+name: string", "+age: int"],
          methods: ["+speak(): void"],
        },
        {
          name: "Dog",
          attributes: ["+breed: string"],
          methods: ["+bark(): void"],
        },
      ];
      const relations = [
        { from: "Dog", to: "Animal", type: "inheritance" as const },
      ];

      const code = generateClassCode(classes, relations);

      expect(code).toContain("classDiagram");
      expect(code).toContain("class Animal");
      expect(code).toContain("+name: string");
      expect(code).toContain("+speak(): void");
      expect(code).toContain("Dog <|-- Animal");
    });
  });

  describe("generateStateCode", () => {
    test("should generate valid state diagram", () => {
      const states = ["Idle", "Running", "Stopped"];
      const transitions = [
        { from: "Idle", to: "Running", trigger: "start" },
        { from: "Running", to: "Stopped", trigger: "stop" },
      ];

      const code = generateStateCode(states, transitions, "Idle", ["Stopped"]);

      expect(code).toContain("stateDiagram-v2");
      expect(code).toContain("[*] --> Idle");
      expect(code).toContain("Idle --> Running : start");
      expect(code).toContain("Stopped --> [*]");
    });
  });

  describe("generateGanttCode", () => {
    test("should generate valid gantt chart", () => {
      const tasks = [
        { name: "Design", start: "2024-01-01", duration: "5d", section: "Phase 1" },
        { name: "Develop", start: "2024-01-06", duration: "10d", section: "Phase 2" },
      ];

      const code = generateGanttCode("Project Timeline", tasks);

      expect(code).toContain("gantt");
      expect(code).toContain("title Project Timeline");
      expect(code).toContain("section Phase 1");
      expect(code).toContain("Design");
      expect(code).toContain("section Phase 2");
      expect(code).toContain("Develop");
    });
  });

  describe("generateMindmapCode", () => {
    test("should generate valid mindmap", () => {
      const root = {
        text: "Main Topic",
        children: [
          { text: "Branch 1", children: [{ text: "Leaf 1" }] },
          { text: "Branch 2" },
        ],
      };

      const code = generateMindmapCode(root);

      expect(code).toContain("mindmap");
      expect(code).toContain("root((Main Topic))");
      expect(code).toContain("Branch 1");
      expect(code).toContain("Leaf 1");
      expect(code).toContain("Branch 2");
    });
  });

  describe("module exports", () => {
    test("should export generateDiagram function", async () => {
      const diagrams = await import("../src/tools/file-generation/diagrams");
      expect(typeof diagrams.generateDiagram).toBe("function");
    });

    test("should export generateStructuredDiagram function", async () => {
      const diagrams = await import("../src/tools/file-generation/diagrams");
      expect(typeof diagrams.generateStructuredDiagram).toBe("function");
    });
  });
});
