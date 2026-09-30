import type { Ctx } from '../context';
import { runBots } from './bot';
import { deliverDueProviderJobs } from './finance';
import { hasDueRideTimers, runRideTimers } from './rides';

/** One pass over everything time-driven. Called on an interval and by the dev clock. */
export function tick(ctx: Ctx) {
  const now = ctx.clock.now();
  if (hasDueRideTimers(ctx.store.state, now)) ctx.store.tx((s) => runRideTimers(s, now));
  deliverDueProviderJobs(ctx);
  runBots(ctx);
}
