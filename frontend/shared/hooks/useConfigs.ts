import { useEffect, useState } from "react";
import { getConfigs } from "../api/config.api";
import type { Configs } from "../types/config.types";

export function useConfigs() {
    const [configs, setConfigs] =
        useState<Configs | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const data = await getConfigs();

                setConfigs(data);
            } catch (err) {
                setError("Failed to load configs");
            } finally {
                setLoading(false);
            }
        }

        load();
    }, []);

    return {
        configs,
        setConfigs,
        loading,
        error
    };
}