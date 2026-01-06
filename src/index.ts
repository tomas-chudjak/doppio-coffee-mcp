#!/usr/bin/env node
/**
 * Doppio Coffee MCP Server
 *
 * A Model Context Protocol server for ordering coffee from Doppio.
 * Communicates with the secure backend API for Shopify operations.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { DoppioAPI } from "./api.js";
import {
  getPreferences,
  savePreferences,
  getPreferencesPath,
} from "./preferences.js";
import type { Coffee, OrderItem, UserPreferences } from "./types.js";

// Hardcoded configuration for public MCP server
const API_URL = "https://doppio-coffee-mcp.tomas-chudjak.workers.dev";
const API_KEY = "71ecc44e82cb51e7959325c7c79cde80070792b8aff568a5a361f01f720e7c9a";

const api = new DoppioAPI({ apiUrl: API_URL, apiKey: API_KEY });

// Create MCP server
const server = new Server(
  {
    name: "doppio-coffee-mcp",
    version: "1.0.0",
    description: `DOPPIO Coffee - MCP server for ordering freshly roasted coffee from DOPPIO roastery based in Zilina, Slovakia.

We offer freshly roasted specialty coffee crafted with passion and expertise.

Package sizes:
- small: 220g (330g for filter coffee - default)
- medium: 500g
- large: 1kg (1000g)

For any questions or issues, please contact us:
DOPPIO Coffee - www.kavadoppio.sk`,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ═══════════════════════════════════════════════════════
      // PREFERENCES
      // ═══════════════════════════════════════════════════════
      {
        name: "set_preferences",
        description: `Sets user's default coffee preferences. Use when user mentions:
- Brewing method preference (filter, espresso machine, or both)
- Preferred coffee type (robusta, arabica, blend, decaf)
- Default package size (small or large)
- Wants to save email or shipping address for orders
Examples: "I use a filter", "I prefer arabica", "Always order 1kg bags"`,
        inputSchema: {
          type: "object",
          properties: {
            preparation: {
              type: "string",
              enum: ["filter", "espresso", "omni"],
              description: "Brewing method: filter, espresso machine, or omni (both)",
            },
            coffee_type: {
              type: "string",
              enum: ["robusta", "arabica", "blend", "decaf"],
              description: "Preferred coffee type",
            },
            default_size: {
              type: "string",
              enum: ["small", "medium", "large"],
              description: "Default size: small (220g/330g), medium (500g), large (1kg)",
            },
            email: {
              type: "string",
              description: "Email for orders",
            },
            shipping_address: {
              type: "object",
              properties: {
                name: { type: "string" },
                street: { type: "string" },
                city: { type: "string" },
                zip: { type: "string" },
              },
              description: "Shipping address for orders",
            },
          },
        },
      },
      {
        name: "get_preferences",
        description: `Returns user's saved coffee preferences. Use when:
- User asks about their settings
- You need to apply preferences to filter coffees
- Before creating an order to get saved email/address`,
        inputSchema: {
          type: "object",
          properties: {},
        },
      },

      // ═══════════════════════════════════════════════════════
      // CATALOG
      // ═══════════════════════════════════════════════════════
      {
        name: "list_coffees",
        description: `Lists available coffee products with optional filtering.
Use when user:
- Asks about coffee, menu, prices, or what's available
- Says they're running out of coffee or need to order
- Wants recommendations
- Asks "what do you have?"

If no filters provided, applies user's saved preferences automatically.`,
        inputSchema: {
          type: "object",
          properties: {
            preparation: {
              type: "string",
              enum: ["filter", "espresso", "omni"],
              description: "Filter by brewing method",
            },
            coffee_type: {
              type: "string",
              enum: ["robusta", "arabica", "blend", "decaf"],
              description: "Filter by coffee type",
            },
            size: {
              type: "string",
              enum: ["small", "medium", "large"],
              description: "Filter by package size: small (220g/330g), medium (500g), large (1kg)",
            },
            origin: {
              type: "string",
              description: "Filter by country of origin (e.g., 'Brazil', 'Ethiopia', 'Rwanda')",
            },
            roast_level: {
              type: "string",
              description: "Filter by roast level (e.g., 'Light', 'Medium', 'Dark')",
            },
            price_max: {
              type: "number",
              description: "Maximum price in EUR (filters by cheapest variant)",
            },
            flavor: {
              type: "string",
              description: "Filter by flavor notes (e.g., 'chocolate', 'fruit', 'nuts')",
            },
            altitude_min: {
              type: "number",
              description: "Minimum altitude in meters (higher altitude = more complex flavors)",
            },
            acidity_min: {
              type: "number",
              minimum: 1,
              maximum: 5,
              description: "Minimum acidity level (1-5, higher = more acidic/bright)",
            },
            acidity_max: {
              type: "number",
              minimum: 1,
              maximum: 5,
              description: "Maximum acidity level (1-5, higher = more acidic/bright)",
            },
            bitterness_min: {
              type: "number",
              minimum: 1,
              maximum: 5,
              description: "Minimum bitterness level (1-5, higher = more bitter/intense)",
            },
            bitterness_max: {
              type: "number",
              minimum: 1,
              maximum: 5,
              description: "Maximum bitterness level (1-5, higher = more bitter/intense)",
            },
          },
        },
      },
      {
        name: "get_coffee_detail",
        description: `Gets detailed information about a specific coffee.
Use when user wants to know more about a particular coffee:
- Flavor profile, origin, processing method
- Available sizes and prices
- Whether it's suitable for their brewing method`,
        inputSchema: {
          type: "object",
          properties: {
            coffee_id: {
              type: "string",
              description: "The coffee ID from the catalog",
            },
          },
          required: ["coffee_id"],
        },
      },

      // ═══════════════════════════════════════════════════════
      // ORDER
      // ═══════════════════════════════════════════════════════
      {
        name: "create_order",
        description: `Creates an order with one or more coffees and returns checkout URL.
Use when user wants to buy/order/purchase coffee.
Accepts array of items for multi-product orders.
Returns a payment URL where user completes the purchase.

Examples: "order 2x Ethiopia", "buy one of each", "I'll take the Brazil"`,
        inputSchema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description: "List of coffees to order",
              items: {
                type: "object",
                properties: {
                  coffee_id: {
                    type: "string",
                    description: "Coffee ID from catalog",
                  },
                  quantity: {
                    type: "number",
                    description: "Number of bags (default: 1)",
                    minimum: 1,
                  },
                  size: {
                    type: "string",
                    enum: ["small", "medium", "large"],
                    description: "Package size: small (220g/330g), medium (500g), large (1kg)",
                  },
                },
                required: ["coffee_id"],
              },
              minItems: 1,
            },
            email: {
              type: "string",
              description: "Email for order (uses saved preference if not provided)",
            },
          },
          required: ["items"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ─────────────────────────────────────────────────────
      // PREFERENCES
      // ─────────────────────────────────────────────────────
      case "set_preferences": {
        const prefs = args as Partial<UserPreferences>;
        const updated = await savePreferences(prefs);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  preferences: updated,
                  saved_to: getPreferencesPath(),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_preferences": {
        const prefs = await getPreferences();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  preferences: prefs,
                  file_path: getPreferencesPath(),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // ─────────────────────────────────────────────────────
      // CATALOG
      // ─────────────────────────────────────────────────────
      case "list_coffees": {
        const filters = args as {
          preparation?: string;
          coffee_type?: string;
          size?: string;
        };

        // Apply user preferences if no filters specified
        if (!filters.preparation && !filters.coffee_type) {
          const prefs = await getPreferences();
          if (prefs.preparation) filters.preparation = prefs.preparation;
          if (prefs.coffee_type) filters.coffee_type = prefs.coffee_type;
        }

        const coffees = await api.listCoffees(filters);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: coffees.length,
                  filters_applied: filters,
                  coffees: coffees.map(formatCoffee),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_coffee_detail": {
        const { coffee_id } = args as { coffee_id: string };
        const coffee = await api.getCoffee(coffee_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(formatCoffeeDetail(coffee), null, 2),
            },
          ],
        };
      }

      // ─────────────────────────────────────────────────────
      // ORDER
      // ─────────────────────────────────────────────────────
      case "create_order": {
        const { items, email } = args as {
          items: OrderItem[];
          email?: string;
        };

        // Get preferences for defaults
        const prefs = await getPreferences();
        const orderEmail = email || prefs.email;

        // Resolve variant IDs for each item
        const checkoutItems: { variant_id: string; quantity: number }[] = [];

        for (const item of items) {
          const coffee = await api.getCoffee(item.coffee_id);
          const preferredSize = item.size || prefs.default_size || "small";

          // Find matching variant
          const variant = coffee.variants.find(
            (v) => v.size === preferredSize && v.available
          ) || coffee.variants.find((v) => v.available);

          if (!variant) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      error: `No available variant for ${coffee.name}`,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          checkoutItems.push({
            variant_id: variant.id,
            quantity: item.quantity || 1,
          });
        }

        const checkout = await api.createCheckout(checkoutItems, orderEmail);

        const response: Record<string, unknown> = {
          success: true,
          order: {
            items: checkout.items,
            subtotal: `${checkout.subtotal.amount} ${checkout.subtotal.currency}`,
            total: `${checkout.total.amount} ${checkout.total.currency}`,
          },
          checkout_url: checkout.checkout_url,
          message: "Complete payment at the checkout URL",
        };

        // Add discount info if applied
        if (checkout.discount) {
          response.discount = {
            code: checkout.discount.code,
            savings: `${checkout.discount.amount.toFixed(2)} ${checkout.total.currency}`,
          };
          response.message = `20% MCP discount applied! Complete payment at the checkout URL`;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          }),
        },
      ],
    };
  }
});

// Format coffee for list display
function formatCoffee(coffee: Coffee) {
  const prices = coffee.variants
    .filter((v) => v.available)
    .map((v) => `${v.weight}g: ${v.price}${v.currency}`)
    .join(", ");

  return {
    id: coffee.id,
    name: coffee.name,
    type: coffee.coffee_type,
    preparation: coffee.preparation.join("/"),
    origin: coffee.origin,
    region: coffee.region,
    roast_level: coffee.roast_level,
    flavor_notes: coffee.flavor_notes,
    prices,
  };
}

// Format coffee for detail display
function formatCoffeeDetail(coffee: Coffee) {
  return {
    id: coffee.id,
    name: coffee.name,
    description: coffee.description,
    type: coffee.coffee_type,
    preparation: coffee.preparation,
    origin: coffee.origin,
    region: coffee.region,
    altitude: coffee.altitude,
    processing: coffee.processing,
    flavor_notes: coffee.flavor_notes,
    roast_level: coffee.roast_level,
    farm: coffee.farm,
    variety: coffee.variety,
    harvest_period: coffee.harvest_period,
    cupping_score: coffee.cupping_score,
    acidity: coffee.acidity,
    body: coffee.body,
    crema: coffee.crema,
    story: coffee.story,
    variants: coffee.variants.map((v) => ({
      id: v.id,
      size: v.size,
      weight: `${v.weight}g`,
      price: `${v.price} ${v.currency}`,
      available: v.available,
    })),
  };
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Doppio Coffee MCP server running on stdio");
}

main().catch(console.error);
