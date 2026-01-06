/**
 * Type definitions for Doppio Coffee MCP
 */

export interface UserPreferences {
  preparation?: "filter" | "espresso" | "omni";
  coffee_type?: "robusta" | "arabica" | "blend" | "decaf";
  default_size?: "small" | "medium" | "large";
  email?: string;
  shipping_address?: ShippingAddress;
}

export interface ShippingAddress {
  name: string;
  street: string;
  city: string;
  zip: string;
}

export interface CoffeeVariant {
  id: string;
  size: "small" | "medium" | "large";
  weight: number;
  price: number;
  currency: string;
  available: boolean;
}

export interface Coffee {
  id: string;
  name: string;
  description: string;
  preparation: ("filter" | "espresso" | "omni")[];
  coffee_type: string;
  origin: string;
  region: string | null;
  altitude: string | null;
  altitude_min: number | null;
  altitude_max: number | null;
  processing: string | null;
  flavor_notes: string[];
  roast_level: string | null;
  farm: string | null;
  variety: string | null;
  harvest_period: string | null;
  cupping_score: number | null;
  acidity: number | null;      // 1-5 scale
  bitterness: number | null;   // 1-5 scale
  body: string | null;
  crema: string | null;
  story: string | null;
  price_min: number | null;
  variants: CoffeeVariant[];
}

export interface OrderItem {
  coffee_id: string;
  variant_id?: string;
  quantity: number;
  size?: "small" | "medium" | "large";
}

export interface CheckoutResponse {
  checkout_id: string;
  checkout_url: string;
  subtotal: {
    amount: number;
    currency: string;
  };
  total: {
    amount: number;
    currency: string;
  };
  discount: {
    code: string;
    amount: number;
  } | null;
  items: {
    title: string;
    quantity: number;
    price: number;
  }[];
}

export interface Config {
  apiUrl: string;
  apiKey: string;
}
