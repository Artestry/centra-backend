export interface DiscoveryApplicationEvent {
  createdAt: Date;
}

export interface DiscoveryApplication {
  id: string;
  company: string;
  role: string;
  locationType: string;
  status: string;
  salary: number | null;
  jobDescription: string | null;
  notes: string | null;
  matchScore: number | null;
  createdAt: Date;
  updatedAt: Date;
  events: DiscoveryApplicationEvent[];
}

export interface DiscoverySections {
  topMatches: DiscoveryApplication[];
  recentlyAdded: DiscoveryApplication[];
  remoteRoles: DiscoveryApplication[];
  needsAttention: DiscoveryApplication[];
}

function textCompletenessScore(item: DiscoveryApplication): number {
  let score = 0;
  if (item.salary) score += 1;
  if (item.jobDescription?.trim()) score += 1;
  if (item.notes?.trim()) score += 1;
  return score;
}

function recencyScore(value: Date): number {
  return value.getTime() / 1_000_000_000_000;
}

function discoveryScore(item: DiscoveryApplication): number {
  return (
    (item.matchScore ?? 0) * 100 +
    recencyScore(item.createdAt) +
    textCompletenessScore(item)
  );
}

function latestActivityAt(item: DiscoveryApplication): Date {
  const latestEvent = item.events.reduce<Date | null>((latest, event) => {
    if (!latest || event.createdAt.getTime() > latest.getTime()) {
      return event.createdAt;
    }
    return latest;
  }, null);

  if (!latestEvent) {
    return item.updatedAt;
  }

  return latestEvent.getTime() > item.updatedAt.getTime()
    ? latestEvent
    : item.updatedAt;
}

export function sortApplicationsForDiscovery(
  items: DiscoveryApplication[],
): DiscoveryApplication[] {
  return [...items].sort((a, b) => discoveryScore(b) - discoveryScore(a));
}

export function isNeedsAttention(
  item: DiscoveryApplication,
  now = new Date(),
): boolean {
  if (item.status !== "SAVED") return false;
  const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
  return now.getTime() - latestActivityAt(item).getTime() >= tenDaysMs;
}

export function buildDiscoverySections(
  items: DiscoveryApplication[],
  now = new Date(),
): DiscoverySections {
  return {
    topMatches: sortApplicationsForDiscovery(items).slice(0, 6),
    recentlyAdded: [...items]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 6),
    remoteRoles: items
      .filter((item) => item.locationType === "REMOTE")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 6),
    needsAttention: items
      .filter((item) => isNeedsAttention(item, now))
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
      .slice(0, 6),
  };
}
