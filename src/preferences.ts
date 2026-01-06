/**
 * User preferences management
 *
 * Preferences are stored in:
 * 1. Local JSON file (~/.doppio-coffee/preferences.json) - primary
 * 2. In-memory fallback if file operations fail
 */

import { readFile, writeFile, mkdir, access } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import type { UserPreferences } from "./types.js";

const CONFIG_DIR = join(homedir(), ".doppio-coffee");
const PREFERENCES_FILE = join(CONFIG_DIR, "preferences.json");

// In-memory fallback
let memoryPreferences: UserPreferences = {};

/**
 * Get user preferences from file or memory
 */
export async function getPreferences(): Promise<UserPreferences> {
  try {
    await access(PREFERENCES_FILE);
    const data = await readFile(PREFERENCES_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return memoryPreferences;
  }
}

/**
 * Save user preferences to file (with memory fallback)
 */
export async function savePreferences(
  prefs: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getPreferences();
  const updated = { ...current, ...prefs };

  try {
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(PREFERENCES_FILE, JSON.stringify(updated, null, 2));
  } catch {
    // Fallback to memory if file write fails
    memoryPreferences = updated;
  }

  return updated;
}

/**
 * Clear all preferences
 */
export async function clearPreferences(): Promise<void> {
  memoryPreferences = {};
  try {
    await writeFile(PREFERENCES_FILE, "{}");
  } catch {
    // Ignore file errors
  }
}

/**
 * Get the path to preferences file (for user reference)
 */
export function getPreferencesPath(): string {
  return PREFERENCES_FILE;
}
