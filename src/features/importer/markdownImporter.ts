// Legacy importer — kept as a stub for backward compatibility.
// The original markdown import functionality has been removed
// as part of the multi-user SaaS migration.

export function parseMarkdownTasks(): never[] {
  return [];
}

export function buildSeedDatabase() {
  return { users: [], sections: [], labels: [], tasks: [], activities: [] };
}