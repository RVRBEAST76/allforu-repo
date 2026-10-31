import {
  corsPreflight,
  getMonth,
  getTarget,
  json,
  monthLabel,
} from "../_lib/utils.js";

export async function onRequestGet({ env }) {
  if (!env?.DB) {
    return json({ error: "Database is not configured." }, 503);
  }

  const month = getMonth();
  const targetGoalUsd = getTarget(env);

  try {
    const aggregate = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount_usd), 0) AS total, COUNT(*) AS count
       FROM payments
       WHERE month = ? AND refunded_at IS NULL`,
    )
      .bind(month)
      .first();

    const rows = await env.DB.prepare(
      `SELECT source, amount_display, donor_name, message, created_at
       FROM payments
       WHERE month = ? AND refunded_at IS NULL
       ORDER BY created_at DESC
       LIMIT 20`,
    )
      .bind(month)
      .all();

    const totalUsd = Math.round(Number(aggregate?.total || 0) * 100) / 100;
    const supporterCount = Number(aggregate?.count || 0);
    const percent = Math.round((totalUsd / targetGoalUsd) * 100);

    const contributions = (rows?.results || []).map((row) => ({
      name: row.donor_name || "Supporter",
      message: row.message || "",
      source: row.source || "manual",
      amountDisplay: row.amount_display || "",
      createdAt: row.created_at,
    }));

    return json({
      month,
      monthLabel: monthLabel(month),
      targetGoalUsd,
      totalUsd,
      percent,
      supporterCount,
      goalReached: totalUsd >= targetGoalUsd,
      contributions,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("stats failed", error);
    return json({ error: "Unable to load support stats." }, 500);
  }
}

export function onRequestOptions() {
  return corsPreflight();
}
