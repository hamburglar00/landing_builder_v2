import {
  hasTrackingIngestReceipt,
  markTrackEventDelivered,
  scheduleTrackEventRetry,
  type TrackQueueItem,
} from "./queue";
import { deliverToUpstream } from "./upstream";

type DeliveryDependencies = {
  receipt: typeof hasTrackingIngestReceipt;
  deliver: typeof deliverToUpstream;
  finish: typeof markTrackEventDelivered;
  retry: typeof scheduleTrackEventRetry;
};

/** Receipt is ingestion by Builder, not advertising acceptance/attribution by Meta. */
export async function deliverClaimedTrackEvent(item: TrackQueueItem, dependencies: DeliveryDependencies = {
  receipt: hasTrackingIngestReceipt,
  deliver: deliverToUpstream,
  finish: markTrackEventDelivered,
  retry: scheduleTrackEventRetry,
}): Promise<"delivered" | "acknowledged" | "retry" | "lease_lost"> {
  const receipt = await dependencies.receipt(item);
  if (receipt === true) {
    return await dependencies.finish(item.id, item.lease_token) ? "acknowledged" : "lease_lost";
  }
  if (receipt === null) {
    return await dependencies.retry({ id: item.id, leaseToken: item.lease_token,
      reason: "tracking_receipt_lookup_unavailable", upstreamStatus: null }) ? "retry" : "lease_lost";
  }
  const result = await dependencies.deliver(item.post_url, item.payload, 2);
  if (result.ok) {
    return await dependencies.finish(item.id, item.lease_token) ? "delivered" : "lease_lost";
  }
  return await dependencies.retry({ id: item.id, leaseToken: item.lease_token,
    reason: result.details, upstreamStatus: result.upstreamStatus }) ? "retry" : "lease_lost";
}
