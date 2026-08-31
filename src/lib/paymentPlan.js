/**
 * Progress invoicing: turning a contract total into a schedule of stages.
 *
 * -- The one thing that must never happen ----------------------------------
 *
 * The stage amounts must add up to the contract total. Exactly. Every time.
 *
 * That is harder than it sounds, because a plan is written in percentages and
 * billed in money. 30/40/30 of $12,000.01 rounds to 3600.00 + 4800.00 +
 * 3600.00 = 12000.00, and the contractor is a cent short with no idea why.
 * Under-billing a cent is trivial; being unable to explain an invoice to a
 * client is not, and a plan whose parts do not equal its whole is exactly the
 * kind of thing a client notices and a contractor cannot defend.
 *
 * So the last stage absorbs the rounding. It is the only stage whose amount is
 * not computed from its percentage -- it is the remainder. Deliberate, and the
 * reason `amount` is stored on each stage rather than recomputed on every
 * read: recomputation is where the three-way disagreement creeps back in.
 *
 * -- Why stages become ordinary invoices ------------------------------------
 *
 * Releasing a stage produces a normal Invoice. Nothing downstream needs to
 * know a plan exists: the public link, Stripe checkout, overdue status, batch
 * send and the reminder queue all work because there is nothing special to
 * work around. The plan records which invoice a stage produced, so the two can
 * be shown together, and that is the whole of the coupling.
 */

/** Two decimal places, without the float dust `0.1 + 0.2` leaves behind. */
function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** The default a contractor is offered: deposit, work, completion. */
export const DEFAULT_STAGES = [
  { label: "Deposit", percent: 30 },
  { label: "Work in progress", percent: 40 },
  { label: "On completion", percent: 30 },
];

/**
 * Whether a set of percentages can be billed.
 *
 * Percentages must total 100. Not "about 100" -- a plan that bills 95% leaves
 * money uninvoiced and nothing else in the product would ever notice.
 *
 * @returns {{ ok: boolean, total: number, reason?: string }}
 */
export function validateStages(stages) {
  if (!Array.isArray(stages) || stages.length === 0) {
    return { ok: false, total: 0, reason: "Add at least one stage." };
  }
  if (stages.some((s) => !String(s?.label || "").trim())) {
    return { ok: false, total: 0, reason: "Every stage needs a name." };
  }
  if (stages.some((s) => !(Number(s?.percent) > 0))) {
    return { ok: false, total: 0, reason: "Every stage needs a percentage above zero." };
  }
  // Summed in whole hundredths so 33.33 + 33.33 + 33.34 is exactly 100 rather
  // than 99.99999999999999.
  const total = stages.reduce((sum, s) => sum + Math.round(Number(s.percent) * 100), 0) / 100;
  if (total !== 100) {
    return {
      ok: false,
      total,
      reason: `Stages add up to ${total}%, not 100%.`,
    };
  }
  return { ok: true, total };
}

/**
 * Build the stages of a plan, with money attached.
 *
 * The last stage is the remainder rather than its own percentage of the total,
 * so the parts always sum to the whole. See the note at the top of this file.
 */
export function buildStages(totalAmount, stages) {
  const total = money(totalAmount);
  const out = [];
  let allocated = 0;

  stages.forEach((stage, i) => {
    const isLast = i === stages.length - 1;
    const amount = isLast
      ? money(total - allocated)
      : money((total * (Number(stage.percent) || 0)) / 100);
    allocated = money(allocated + amount);
    out.push({
      id: stage.id || `stg_${i + 1}_${Math.random().toString(36).slice(2, 8)}`,
      label: String(stage.label || "").trim(),
      percent: Number(stage.percent) || 0,
      amount,
      due_date: stage.due_date || null,
      invoice_id: stage.invoice_id || null,
      released_at: stage.released_at || null,
    });
  });

  return out;
}

/** Money already turned into an invoice, whether or not it has been paid. */
export function releasedTotal(stages = []) {
  return money(
    stages.filter((s) => s.released_at).reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
  );
}

/** Money still to be billed. */
export function remainingTotal(plan) {
  return money((Number(plan?.total_amount) || 0) - releasedTotal(plan?.stages || []));
}

/**
 * The next stage that may be released.
 *
 * Strictly in order. A contractor cannot bill "on completion" before the
 * deposit, because the schedule IS the agreement with the client -- releasing
 * out of order bills for something the client has not agreed is due yet.
 *
 * @returns {object|null}
 */
export function nextReleasableStage(plan) {
  const stages = plan?.stages || [];
  return stages.find((s) => !s.released_at) || null;
}

/** True once every stage has produced an invoice. */
export function isPlanFullyBilled(plan) {
  const stages = plan?.stages || [];
  return stages.length > 0 && stages.every((s) => s.released_at);
}

/**
 * The prefill CreateInvoice expects for a released stage.
 *
 * One line item, described so the client can see where it sits in the plan --
 * "Deposit (30% of Kitchen remodel)" reads as part of an agreed schedule,
 * where a bare "Deposit" reads as a demand.
 *
 * @returns {object|null} null when there is nothing left to release.
 */
export function buildStagePrefill({ plan, stage, client = null }) {
  if (!plan || !stage) return null;

  const amount = money(stage.amount);
  const description = plan.title
    ? `${stage.label} (${stage.percent}% of ${plan.title})`
    : stage.label;

  const rate = Number(plan.tax_rate) || 0;
  const tax_amount = money((amount * rate) / 100);

  return {
    client_id: plan.client_id || client?.id || "",
    client_name: plan.client_name || client?.name || "",
    client_email: client?.email || "",
    client_phone: client?.phone || "",
    client_address: client?.address || "",
    items: [{ description, quantity: 1, rate: amount, amount }],
    subtotal: amount,
    tax_rate: rate,
    tax_amount,
    total: money(amount + tax_amount),
    status: "draft",
    due_date: stage.due_date || undefined,
    notes: plan.notes || "",
    // Read by CreateInvoice after a successful save, so the stage is marked
    // released only once the invoice actually exists.
    payment_plan_id: plan.id,
    plan_stage_id: stage.id,
    prefill_source: "plan",
  };
}

/**
 * Mark a stage released against the invoice it produced.
 *
 * Returns a NEW stages array rather than mutating, so a failed write cannot
 * leave the in-memory plan claiming an invoice that was never created.
 */
export function markStageReleased(stages, stageId, invoiceId) {
  return (stages || []).map((s) =>
    s.id === stageId
      ? { ...s, invoice_id: invoiceId, released_at: new Date().toISOString() }
      : s,
  );
}
