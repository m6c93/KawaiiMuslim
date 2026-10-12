// Deliberate release gate: the destructive draft is NOT approved for activation.
// Keep false until durable serialization/recovery and disposable-account tests pass.
// No request flag or environment variable may override this gate.
export function immediateDeletionAvailable() { return false; }
