/**
 * Example Weather Plugin
 *
 * Demonstrates how to create a Moltbot plugin with:
 * - Tool registration
 * - Storage usage
 * - HTTP requests
 * - Event subscriptions
 */

import type {
  Plugin,
  PluginAPI,
  PluginManifest,
  PluginToolContext,
  PluginToolResult,
} from "../../src/core/plugins";

interface WeatherData {
  location: string;
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
  timestamp: Date;
}

interface WeatherCache {
  [location: string]: {
    data: WeatherData;
    cachedAt: number;
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export default function createPlugin(manifest: PluginManifest): Plugin {
  let api: PluginAPI;

  return {
    async onLoad(pluginApi: PluginAPI) {
      api = pluginApi;
      api.logger.info("Weather plugin loading...");

      // Register the get_weather tool
      api.registerTool({
        name: "get_weather",
        description:
          "Get current weather information for a location. Returns temperature, conditions, humidity, and wind speed.",
        inputSchema: {
          type: "object" as const,
          properties: {
            location: {
              type: "string",
              description:
                "The city or location to get weather for (e.g., 'New York', 'London, UK')",
            },
            units: {
              type: "string",
              enum: ["celsius", "fahrenheit"],
              description: "Temperature units (default: celsius)",
            },
          },
          required: ["location"],
        },
        handler: async (
          input: Record<string, unknown>,
          context: PluginToolContext
        ): Promise<PluginToolResult> => {
          try {
            const location = input.location as string;
            const units = (input.units as string) || "celsius";

            // Check cache first
            const cached = await getCachedWeather(location);
            if (cached) {
              api.logger.debug(`Cache hit for ${location}`);
              return formatWeatherResult(cached, units);
            }

            // Fetch fresh data (simulated for this example)
            const weather = await fetchWeather(location);

            // Cache the result
            await cacheWeather(location, weather);

            return formatWeatherResult(weather, units);
          } catch (error) {
            return {
              success: false,
              result: null,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      });

      // Register the weather_forecast tool
      api.registerTool({
        name: "weather_forecast",
        description:
          "Get a 5-day weather forecast for a location. Returns daily high/low temperatures and conditions.",
        inputSchema: {
          type: "object" as const,
          properties: {
            location: {
              type: "string",
              description: "The city or location to get forecast for",
            },
            days: {
              type: "number",
              description: "Number of days to forecast (1-7, default: 5)",
            },
          },
          required: ["location"],
        },
        handler: async (
          input: Record<string, unknown>,
          _context: PluginToolContext
        ): Promise<PluginToolResult> => {
          try {
            const location = input.location as string;
            const days = Math.min(Math.max((input.days as number) || 5, 1), 7);

            const forecast = await fetchForecast(location, days);

            return {
              success: true,
              result: {
                location,
                days,
                forecast,
              },
            };
          } catch (error) {
            return {
              success: false,
              result: null,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      });

      // Subscribe to message events to detect weather-related queries
      api.events.on("message:received", async (event) => {
        const message = event.data as { content?: string };
        if (message.content?.toLowerCase().includes("weather")) {
          api.logger.debug("Detected weather-related message");
        }
      });

      api.logger.info("Weather plugin loaded successfully");
    },

    async onUnload() {
      api.logger.info("Weather plugin unloading...");
      // Cleanup is handled automatically by the sandbox
    },

    async onDisable() {
      api.logger.info("Weather plugin disabled");
    },

    async onEnable() {
      api.logger.info("Weather plugin enabled");
    },
  };

  // Helper functions

  async function getCachedWeather(
    location: string
  ): Promise<WeatherData | null> {
    const cache = await api.storage.get<WeatherCache>("weather_cache");
    if (!cache) return null;

    const entry = cache[location.toLowerCase()];
    if (!entry) return null;

    // Check if cache is expired
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      return null;
    }

    return entry.data;
  }

  async function cacheWeather(
    location: string,
    data: WeatherData
  ): Promise<void> {
    const cache =
      (await api.storage.get<WeatherCache>("weather_cache")) || {};

    cache[location.toLowerCase()] = {
      data,
      cachedAt: Date.now(),
    };

    await api.storage.set("weather_cache", cache);
  }

  async function fetchWeather(location: string): Promise<WeatherData> {
    // In a real plugin, you would make an API call here
    // For this example, we'll simulate weather data
    api.logger.debug(`Fetching weather for ${location}`);

    // Simulate API latency
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Generate simulated weather data based on location hash
    const hash = location.split("").reduce((a, b) => {
      return ((a << 5) - a + b.charCodeAt(0)) | 0;
    }, 0);

    const conditions = [
      "Sunny",
      "Partly Cloudy",
      "Cloudy",
      "Rainy",
      "Stormy",
      "Foggy",
      "Snowy",
    ];

    return {
      location,
      temperature: 15 + (Math.abs(hash) % 20), // 15-35 C
      conditions: conditions[Math.abs(hash) % conditions.length],
      humidity: 40 + (Math.abs(hash) % 50), // 40-90%
      windSpeed: 5 + (Math.abs(hash) % 25), // 5-30 km/h
      timestamp: new Date(),
    };
  }

  async function fetchForecast(
    location: string,
    days: number
  ): Promise<
    Array<{
      date: string;
      high: number;
      low: number;
      conditions: string;
    }>
  > {
    api.logger.debug(`Fetching ${days}-day forecast for ${location}`);

    // Simulate API latency
    await new Promise((resolve) => setTimeout(resolve, 100));

    const conditions = [
      "Sunny",
      "Partly Cloudy",
      "Cloudy",
      "Rainy",
      "Stormy",
    ];

    const forecast = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const hash =
        location.split("").reduce((a, b) => {
          return ((a << 5) - a + b.charCodeAt(0)) | 0;
        }, 0) + i;

      forecast.push({
        date: date.toISOString().split("T")[0],
        high: 18 + (Math.abs(hash) % 15), // 18-33 C
        low: 8 + (Math.abs(hash) % 10), // 8-18 C
        conditions: conditions[Math.abs(hash) % conditions.length],
      });
    }

    return forecast;
  }

  function formatWeatherResult(
    weather: WeatherData,
    units: string
  ): PluginToolResult {
    let temperature = weather.temperature;
    let tempUnit = "C";

    if (units === "fahrenheit") {
      temperature = Math.round((temperature * 9) / 5 + 32);
      tempUnit = "F";
    }

    return {
      success: true,
      result: {
        location: weather.location,
        temperature: `${temperature}${tempUnit}`,
        conditions: weather.conditions,
        humidity: `${weather.humidity}%`,
        windSpeed: `${weather.windSpeed} km/h`,
        lastUpdated: weather.timestamp.toISOString(),
      },
    };
  }
}
