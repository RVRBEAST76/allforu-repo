const els = {
  month: document.getElementById("month-label"),
  total: document.getElementById("total-amount"),
  target: document.getElementById("target-amount"),
  percent: document.getElementById("percent"),
  count: document.getElementById("supporter-count"),
  updated: document.getElementById("updated-at"),
  fill: document.getElementById("progress-fill"),
  progress: document.getElementById("progress"),
  badge: document.getElementById("goal-badge"),
  badgeText: document.getElementById("goal-badge-text"),
  note: document.getElementById("goal-note"),
  card: document.querySelector(".goal-card"),
  supporters: document.getElementById("supporters"),
  error: document.getElementById("error"),
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const sourceLabels = {
  razorpay: "Razorpay",
  bmc: "Buy Me a Coffee",
  manual: "Manual",
};

let loading = false;
let refreshTimer = null;

function formatUsd(value) {
  const number = Number(value);
  return usdFormatter.format(Number.isFinite(number) ? number : 0);
}

function setBadge(state, text) {
  els.badge.classList.remove("is-reached", "is-offline");
  if (state === "reached") els.badge.classList.add("is-reached");
  if (state === "offline") els.badge.classList.add("is-offline");
  els.badgeText.textContent = text;
}

function initials(name) {
  const value = String(name || "Supporter").trim();
  const parts = value.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]).join("");
  return (letters || "S").toUpperCase();
}

function sourceLabel(source) {
  return sourceLabels[source] || "Support";
}

function contributionDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderSupporters(items) {
  const list = Array.isArray(items) ? items.slice(0, 8) : [];
  els.supporters.replaceChildren();

  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No contributions yet this month. Be the first.";
    els.supporters.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  list.forEach((item) => {
    const row = document.createElement("div");
    row.className = "supporter";

    const avatar = document.createElement("span");
    avatar.className = "supporter__avatar";
    avatar.textContent = initials(item.name);
    avatar.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    body.className = "supporter__body";

    const name = document.createElement("strong");
    name.className = "supporter__name";
    name.textContent = item.name || "Supporter";

    const meta = document.createElement("span");
    meta.className = "supporter__meta";
    const date = contributionDate(item.createdAt);
    meta.textContent = [sourceLabel(item.source), date].filter(Boolean).join(" · ");

    body.append(name, meta);

    if (item.message) {
      const message = document.createElement("p");
      message.className = "supporter__message";
      message.textContent = item.message;
      body.append(message);
    }

    const amount = document.createElement("span");
    amount.className = "supporter__amount";
    amount.textContent = item.amountDisplay || "";

    row.append(avatar, body, amount);
    fragment.append(row);
  });

  els.supporters.append(fragment);
}

function render(data) {
  const target = Number(data.targetGoalUsd) || 100;
  const total = Number(data.totalUsd) || 0;
  const percent = Math.max(0, Math.round(Number(data.percent) || (total / target) * 100));
  const cappedPercent = Math.min(100, percent);
  const remaining = Math.max(0, target - total);

  els.month.textContent = data.monthLabel || "This month";
  els.total.textContent = formatUsd(total);
  els.target.textContent = `/ ${formatUsd(target)}`;
  els.percent.textContent = `${percent}%`;
  els.count.textContent = `${Number(data.supporterCount) || 0} ${
    Number(data.supporterCount) === 1 ? "support" : "supports"
  }`;

  els.fill.style.width = `${cappedPercent}%`;
  els.progress.setAttribute("aria-valuenow", String(cappedPercent));
  els.progress.setAttribute("aria-valuetext", `${percent}% of the monthly goal`);

  if (data.updatedAt) {
    const updated = new Date(data.updatedAt);
    if (!Number.isNaN(updated.getTime())) {
      els.updated.textContent = `Updated ${updated.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
  }

  if (data.goalReached) {
    els.card.classList.add("is-reached");
    setBadge("reached", "Goal reached");
    els.note.textContent =
      "Goal reached — thank you! Extra support still helps with next month's costs.";
  } else {
    els.card.classList.remove("is-reached");
    setBadge("live", "Live");
    els.note.textContent = total > 0
      ? `${formatUsd(remaining)} to go this month. Every contribution helps.`
      : "Every contribution goes toward keeping AllForU online and maintained.";
  }

  renderSupporters(data.contributions);
  els.error.hidden = true;
}

async function loadStats() {
  if (loading) return;
  loading = true;
  els.supporters.setAttribute("aria-busy", "true");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("/api/stats", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    render(data);
  } catch (error) {
    console.error("support stats", error);
    setBadge("offline", "Reconnecting");
    els.error.hidden = false;
  } finally {
    clearTimeout(timeout);
    els.supporters.removeAttribute("aria-busy");
    loading = false;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(loadStats, 30000);
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadStats();
});

loadStats();
