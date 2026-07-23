-- FOR-288: per-vendor RFQ messaging. Scope quote messaging to a single
-- QuoteResponse (contextId = quote_responses.id) so competing vendors on the
-- same RFQ never share a thread. Postgres 12+ allows ADD VALUE outside a txn;
-- the new value is only referenced by later migrations/queries, never here.
ALTER TYPE "MessageContextType" ADD VALUE IF NOT EXISTS 'QUOTE_RESPONSE';
