/**
 * API client for Doppio Coffee backend
 */

import type { Coffee, CheckoutResponse, Config, OrderItem } from "./types.js";

export class DoppioAPI {
  private apiUrl: string;
  private apiKey: string;

  constructor(config: Config) {
    this.apiUrl = config.apiUrl.replace(/\/$/, ""); // Remove trailing slash
    this.apiKey = config.apiKey;
  }

  /**
   * Fetch wrapper with authentication
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(
        `API Error: ${response.status} - ${errorData.error || response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * List coffees with optional filters
   */
  async listCoffees(filters?: {
    preparation?: string;
    coffee_type?: string;
    size?: string;
  }): Promise<Coffee[]> {
    const result = await this.request<{ coffees: Coffee[] }>("/api/coffees", {
      method: "POST",
      body: JSON.stringify(filters || {}),
    });
    return result.coffees;
  }

  /**
   * Get single coffee detail
   */
  async getCoffee(coffeeId: string): Promise<Coffee> {
    const result = await this.request<{ coffee: Coffee }>("/api/coffee", {
      method: "POST",
      body: JSON.stringify({ coffee_id: coffeeId }),
    });
    return result.coffee;
  }

  /**
   * Create checkout session
   */
  async createCheckout(
    items: { variant_id: string; quantity: number }[],
    email?: string
  ): Promise<CheckoutResponse> {
    return this.request<CheckoutResponse>("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ items, email }),
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request<{ status: string }>("/api/health");
      return true;
    } catch {
      return false;
    }
  }
}
