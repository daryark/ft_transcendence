import type { Configs } from "../types/config.types";

export async function getConfigs(): Promise<Configs> {
    const response = await fetch("/api/configs");

    if (!response.ok) {
        throw new Error("Failed to load configs");
    }

    return response.json();
}