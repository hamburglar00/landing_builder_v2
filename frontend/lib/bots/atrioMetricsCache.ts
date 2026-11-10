import type { AtrioClient } from "@/lib/atrio/atrioDb";
import type { AdvisorDirectory } from "@/lib/atrio/managerDestinations";

type Client = Pick<AtrioClient, "id" | "user_id" | "atrio_id">;
type DirectoryResult = { advisors: AdvisorDirectory[]; directoryChanged?: boolean };
type Job = { controller: AbortController; promise: Promise<DirectoryResult> };

export const advisorMetricsKey = (client: Client) => JSON.stringify([client.user_id, client.id, client.atrio_id]);

/** One hook/session/workspace owns this cache. Only real Atrio responses enter it. */
export class AtrioMetricsCache {
  private values = new Map<string, { advisor: AdvisorDirectory | null; time: number }>();
  private jobs = new Map<string, Job>();
  private generation = 0;

  constructor(
    private fetchDirectory: (ids: string[], signal: AbortSignal) => Promise<DirectoryResult>,
    private now = () => Date.now(),
    private ttl = 5 * 60 * 1000,
  ) {}

  clear() {
    this.generation++;
    for (const job of new Set(this.jobs.values())) job.controller.abort();
    this.jobs.clear();
    this.values.clear();
  }

  snapshot(clients: Client[]) {
    const result = new Map<string, AdvisorDirectory | null>();
    for (const client of clients) {
      const key = advisorMetricsKey(client), cached = this.values.get(key);
      if (cached && this.now() - cached.time < this.ttl) result.set(key, cached.advisor);
    }
    return result;
  }

  async read(clients: Client[]) {
    if (clients.length > 100) throw Error("Atrio metric batches must contain at most 100 advisors.");
    if (new Set(clients.map(client => client.user_id)).size > 1) throw Error("Atrio metric batches must belong to one owner.");
    const unique = [...new Map(clients.map(client => [advisorMetricsKey(client), client])).values()];
    const fresh = this.snapshot(unique), missing: Client[] = [];
    const waiting = new Set<Job>();
    for (const client of unique) {
      const key = advisorMetricsKey(client);
      if (fresh.has(key)) continue;
      const existing = this.jobs.get(key);
      if (existing) waiting.add(existing);
      else missing.push(client);
    }
    if (missing.length) {
      const generation = this.generation, controller = new AbortController();
      const job = { controller } as Job;
      job.promise = Promise.resolve().then(async () => {
        try {
          const response = await this.fetchDirectory(missing.map(client => client.id), controller.signal);
          if (controller.signal.aborted || generation !== this.generation) throw new DOMException("Metrics invalidated", "AbortError");
          if (!Array.isArray(response.advisors)) throw Error("Invalid Atrio directory response.");
          for (const client of missing) {
            this.values.set(advisorMetricsKey(client), { advisor: response.advisors.find(advisor => advisor.id === client.atrio_id) ?? null, time: this.now() });
          }
          // Bound memory in large administrator workspaces; evicted entries can be read again on demand.
          while (this.values.size > 500) this.values.delete(this.values.keys().next().value!);
          return response;
        } finally {
          for (const client of missing) {
            const key = advisorMetricsKey(client);
            if (this.jobs.get(key) === job) this.jobs.delete(key);
          }
        }
      });
      for (const client of missing) this.jobs.set(advisorMetricsKey(client), job);
      waiting.add(job);
    }
    const responses = await Promise.all([...waiting].map(job => job.promise));
    return { advisors: this.snapshot(unique), directoryChanged: responses.some(response => response.directoryChanged === true) };
  }
}
