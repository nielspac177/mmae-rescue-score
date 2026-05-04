/* Embedded multivariable logistic-regression coefficients
   from build_score_v2.py (statsmodels Logit on internal cohort, n=214). */

const COEF = {
  m1: {
    const: -4.720016,
    age_pts: 0.481464,
    sdh_vol_ge100: 0.921087,
    anticoag: 0.693355,
    no_focal_deficit: 1.418642,
    plt_lt150: 0.634404,
    antiplatelet: 0.649806,
    ant_post: 0.797708,
  },
  m2: {
    const: -3.788562,
    age_pts: 0.482667,
    sdh_vol_ge100: 0.892951,
    anticoag: 0.638992,
    no_focal_deficit: 1.388916,
  },
};

// Observed rate per integer score (Wilson lookup from cohort n=214)
const OBS = {
  m1: {
    0: { n: 1,  ev: 0,  rate: 0.000, lo: 0.000, hi: 0.793 },
    1: { n: 11, ev: 1,  rate: 0.091, lo: 0.016, hi: 0.378 },
    2: { n: 38, ev: 3,  rate: 0.079, lo: 0.027, hi: 0.208 },
    3: { n: 56, ev: 4,  rate: 0.071, lo: 0.028, hi: 0.170 },
    4: { n: 59, ev: 7,  rate: 0.119, lo: 0.059, hi: 0.225 },
    5: { n: 38, ev: 16, rate: 0.421, lo: 0.279, hi: 0.578 },
    6: { n: 8,  ev: 3,  rate: 0.375, lo: 0.137, hi: 0.694 },
    7: { n: 3,  ev: 2,  rate: 0.667, lo: 0.208, hi: 0.939 },
    8: { n: 0,  ev: 0,  rate: null,  lo: null,  hi: null  },
  },
  m2: {
    0: { n: 6,  ev: 1,  rate: 0.167, lo: 0.030, hi: 0.564 },
    1: { n: 35, ev: 1,  rate: 0.029, lo: 0.005, hi: 0.145 },
    2: { n: 74, ev: 9,  rate: 0.122, lo: 0.065, hi: 0.215 },
    3: { n: 69, ev: 14, rate: 0.203, lo: 0.125, hi: 0.312 },
    4: { n: 27, ev: 9,  rate: 0.333, lo: 0.186, hi: 0.522 },
    5: { n: 3,  ev: 2,  rate: 0.667, lo: 0.208, hi: 0.939 },
  },
};

const INPUTS_M1 = [
  "sdh_vol_ge100", "anticoag", "no_focal_deficit",
  "plt_lt150", "antiplatelet", "ant_post"
];
const INPUTS_M2 = [
  "sdh_vol_ge100", "anticoag", "no_focal_deficit"
];

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function compute() {
  const model = document.querySelector('input[name="model"]:checked').value;
  const c = COEF[model];
  const inputs = (model === "m1") ? INPUTS_M1 : INPUTS_M2;

  const age = parseInt(document.getElementById("age").value, 10);
  let total = age;
  let z = c.const + c.age_pts * age;

  for (const k of inputs) {
    const v = document.getElementById(k).checked ? 1 : 0;
    z += (c[k] || 0) * v;
    total += v;
  }

  const prob = sigmoid(z);
  const max = (model === "m1") ? 8 : 5;

  document.getElementById("total_pts").textContent = total;
  document.getElementById("max_pts").textContent = max;
  document.getElementById("prob_pct").textContent = (prob * 100).toFixed(1) + "%";
  document.getElementById("prob_fill").style.width =
    Math.min(100, Math.max(2, prob * 100)) + "%";

  // Risk band
  const band = document.getElementById("risk_band");
  let cls = "low", txt = "Low risk";
  if (model === "m1") {
    if (total >= 5)      { cls = "high";   txt = "High risk (Model 1 score ≥ 5)"; }
    else if (total >= 3) { cls = "medium"; txt = "Intermediate risk"; }
  } else {
    if (total >= 4)      { cls = "high";   txt = "High risk (Model 2 score ≥ 4)"; }
    else if (total >= 2) { cls = "medium"; txt = "Intermediate risk"; }
  }
  band.className = "band " + cls;
  band.textContent = txt;

  // Observed lookup
  const obs = OBS[model][total];
  const obsEl = document.getElementById("obs_rate");
  if (obs && obs.n > 0 && obs.rate !== null) {
    obsEl.innerHTML = `<b>${obs.ev}/${obs.n}</b> (${(obs.rate * 100).toFixed(1)}%) ` +
      `· Wilson 95% CI ${(obs.lo * 100).toFixed(1)}–${(obs.hi * 100).toFixed(1)}%`;
  } else {
    obsEl.textContent = "No patients in this score stratum (extrapolated by model only).";
  }

  // Action box
  const action = document.getElementById("action_text");
  if (cls === "high") {
    action.innerHTML = `<b>Tight surveillance.</b> Consider early post-procedural CT (24–72 h), close clinical re-assessment, and a low threshold for surgical rescue. Document reasoning for stand-alone embolization vs adjunctive surgery.`;
  } else if (cls === "medium") {
    action.innerHTML = `<b>Standard surveillance + interval imaging.</b> Repeat CT at 2–4 weeks and at the discretion of the team. No specific intensification, but flag if score includes anticoagulation or large baseline volume.`;
  } else {
    action.innerHTML = `<b>Standard post-embolization care.</b> Routine clinical follow-up. The probability of rescue is in the range of the lowest-risk cohort decile.`;
  }
}

function reset() {
  ["sdh_vol_ge100", "anticoag", "no_focal_deficit",
   "plt_lt150", "antiplatelet", "ant_post"].forEach(id => {
    document.getElementById(id).checked = false;
  });
  document.getElementById("age").value = "1";
  document.querySelector('input[name="model"][value="m1"]').checked = true;
  compute();
}

// Wire up
document.addEventListener("DOMContentLoaded", () => {
  const inputs = document.querySelectorAll(
    '#calculator input, #calculator select');
  inputs.forEach(el => {
    el.addEventListener("change", compute);
    el.addEventListener("input", compute);
  });
  document.getElementById("reset").addEventListener("click", (e) => {
    e.preventDefault(); reset();
  });
  document.getElementById("year").textContent = new Date().getFullYear();
  compute();
});
