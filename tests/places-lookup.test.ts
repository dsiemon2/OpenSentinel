import { describe, test, expect } from "bun:test";
import {
  searchPlaces,
  reverseGeocode,
  findNearby,
  getDirections,
  type PlaceResult,
  type DirectionsResult,
} from "../src/tools/places-lookup";

describe("Places Lookup", () => {
  describe("exports", () => {
    test("should export searchPlaces function", () => {
      expect(typeof searchPlaces).toBe("function");
    });

    test("should export reverseGeocode function", () => {
      expect(typeof reverseGeocode).toBe("function");
    });

    test("should export findNearby function", () => {
      expect(typeof findNearby).toBe("function");
    });

    test("should export getDirections function", () => {
      expect(typeof getDirections).toBe("function");
    });
  });

  describe("searchPlaces", () => {
    test("should return empty array for empty query", async () => {
      const results = await searchPlaces("");
      expect(results).toEqual([]);
    });

    test("should return empty array for whitespace query", async () => {
      const results = await searchPlaces("   ");
      expect(results).toEqual([]);
    });
  });

  describe("reverseGeocode", () => {
    test("should reject invalid latitude", async () => {
      expect(reverseGeocode(91, 0)).rejects.toThrow("Invalid coordinates");
    });

    test("should reject invalid longitude", async () => {
      expect(reverseGeocode(0, 181)).rejects.toThrow("Invalid coordinates");
    });

    test("should reject NaN coordinates", async () => {
      expect(reverseGeocode(NaN, 0)).rejects.toThrow("Invalid coordinates");
    });
  });

  describe("findNearby", () => {
    test("should reject invalid coordinates", async () => {
      expect(findNearby(-91, 0)).rejects.toThrow("Invalid coordinates");
    });

    test("should reject invalid longitude", async () => {
      expect(findNearby(0, 200)).rejects.toThrow("Invalid coordinates");
    });
  });

  describe("getDirections", () => {
    test("should reject invalid origin coordinates", async () => {
      expect(getDirections(91, 0, 48.8, 2.3)).rejects.toThrow("Invalid coordinates");
    });

    test("should reject invalid destination coordinates", async () => {
      expect(getDirections(48.8, 2.3, -91, 0)).rejects.toThrow("Invalid coordinates");
    });
  });

  describe("PlaceResult interface", () => {
    test("should have all required fields", () => {
      const place: PlaceResult = {
        name: "Eiffel Tower",
        displayName: "Eiffel Tower, Paris, France",
        lat: 48.8584,
        lon: 2.2945,
        type: "attraction",
        category: "tourism",
        address: { city: "Paris", country: "France" },
        osmId: "w5013364",
      };

      expect(place.name).toBe("Eiffel Tower");
      expect(place.lat).toBeCloseTo(48.8584, 3);
      expect(place.lon).toBeCloseTo(2.2945, 3);
      expect(place.address.city).toBe("Paris");
    });

    test("should support optional distance field", () => {
      const place: PlaceResult = {
        name: "Cafe",
        displayName: "Cafe Paris",
        lat: 48.85,
        lon: 2.29,
        type: "cafe",
        category: "amenity",
        address: {},
        osmId: "n123",
        distance: 250,
      };

      expect(place.distance).toBe(250);
    });
  });

  describe("DirectionsResult interface", () => {
    test("should have all required fields", () => {
      const directions: DirectionsResult = {
        distance: 5000,
        duration: 600,
        distanceText: "5.0km",
        durationText: "10min",
        steps: [
          { instruction: "turn right", distance: 100, duration: 30, name: "Main St" },
        ],
      };

      expect(directions.distance).toBe(5000);
      expect(directions.duration).toBe(600);
      expect(directions.steps).toHaveLength(1);
      expect(directions.steps[0].name).toBe("Main St");
    });
  });
});
