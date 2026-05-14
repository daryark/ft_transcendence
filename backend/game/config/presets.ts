// Re-export config utilities for backward compatibility
export { configBase, createConfig } from "./configBase";

// Additional utility functions for modifiers
export function applyModifiers(config: any, modifiers: any = {}) {
    const baseConfig = structuredClone(config);
    
    if (modifiers?.garbage?.volatile) {
        baseConfig.garbage.volatile = true;
    }
    
    if (modifiers?.garbage?.messy) {
        baseConfig.garbage.messiness = 100;
    }
    
    if (modifiers?.gravity?.sticky) {
        baseConfig.gravity.sticky = 1;
    }
    
    return baseConfig;
}
