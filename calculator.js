/* MMAE Rescue Risk Calculator — three-model engine.
   All coefficients derived on the same n=214 cohort (statsmodels Logit). */

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
  m3: {
    const: -4.239461,
    age_pts: 0.799662,
    sdh_vol_ge100: 0.715860,
    plt_lt150: 0.721245,
    antiplatelet: 0.508644,
    no_focal_deficit: 1.392244,
  },
};

// Variables active in each model
const VARS = {
  m1: ["sdh_vol_ge100", "anticoag", "no_focal_deficit",
       "plt_lt150", "antiplatelet", "ant_post"],
  m2: ["sdh_vol_ge100", "anticoag", "no_focal_deficit"],
  m3: ["sdh_vol_ge100", "plt_lt150", "antiplatelet", "no_focal_deficit"],
};

const MAX_PTS = { m1: 8, m2: 5, m3: 6 };

// Observed rate per integer score per model
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
  m3: {
    0: { n: 5,  ev: 1,  rate: 0.200, lo: 0.036, hi: 0.624 },
    1: { n: 34, ev: 3,  rate: 0.088, lo: 0.030, hi: 0.230 },
    2: { n: 63, ev: 4,  rate: 0.063, lo: 0.025, hi: 0.152 },
    3: { n: 66, ev: 7,  rate: 0.106, lo: 0.052, hi: 0.203 },
    4: { n: 34, ev: 16, rate: 0.471, lo: 0.315, hi: 0.633 },
    5: { n: 11, ev: 4,  rate: 0.364, lo: 0.152, hi: 0.646 },
    6: { n: 1,  ev: 1,  rate: 1.000, lo: 0.207, hi: 1.000 },
  },
};

// Cutoffs and risk band thresholds (integer score)
const CUTOFF = { m1: 5, m2: 4, m3: 4 };

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function getModel() {
  return document.querySelector('input[name="model"]:checked').value;
}

function getAgePts(model) {
  // Model 3 (SOCR) uses age cutoff at >85 instead of >80,
  // but the dropdown in the form is the standard 0/1/2 (<65 / 65–80 / >80).
  // The point value is identical in this UI because the user is selecting
  // the SOCR age category implicitly. We keep the same select but rename
  // the labels via the hint text.
  return parseInt(document.getElementById("age").value, 10);
}

function setVarVisibility(model) {
  // Show/hide checkboxes that aren't in the active model
  const all = ["anticoag", "antiplatelet", "plt_lt150", "ant_post"];
  const active = new Set(VARS[model]);
  for (const id of all) {
    const el = document.getElementById(id);
    const wrapper = el.closest("label.check");
    if (!wrapper) continue;
    if (active.has(id)) {
      wrapper.style.display = "";
    } else {
      wrapper.style.display = "none";
      el.checked = false;
    }
  }
  // Hide procedural-plan fieldset entirely if no procedural variable in model
  const procFieldset = document.querySelector("fieldset.m1-only");
  if (procFieldset) {
    procFieldset.style.display = (model === "m1") ? "" : "none";
  }
  // Hint about Model 3 age cutoff
  const hint = document.getElementById("age_hint");
  if (hint) hint.style.display = (model === "m3") ? "" : "none";
}

function compute() {
  const model = getModel();
  setVarVisibility(model);

  const c = COEF[model];
  const inputs = VARS[model];

  const age = getAgePts(model);
  let total = age;
  let z = c.const + c.age_pts * age;

  for (const k of inputs) {
    const v = document.getElementById(k).checked ? 1 : 0;
    z += (c[k] || 0) * v;
    total += v;
  }

  const prob = sigmoid(z);
  const max = MAX_PTS[model];

  document.getElementById("total_pts").textContent = total;
  document.getElementById("max_pts").textContent = max;
  document.getElementById("prob_pct").textContent = (prob * 100).toFixed(1) + "%";
  document.getElementById("prob_fill").style.width =
    Math.min(100, Math.max(2, prob * 100)) + "%";

  // Risk band
  const band = document.getElementById("risk_band");
  const cut = CUTOFF[model];
  let cls = "low", txt = "Low risk";
  const intermediate = (model === "m1") ? 3 : 2;
  if (total >= cut) {
    cls = "high";
    txt = `High risk · score ≥ ${cut}`;
  } else if (total >= intermediate) {
    cls = "medium";
    txt = "Intermediate risk";
  }
  band.className = "band " + cls;
  band.querySelector(".band-text").textContent = txt;

  // Observed lookup
  const obs = OBS[model][total];
  const obsEl = document.getElementById("obs_rate");
  if (obs && obs.n > 0 && obs.rate !== null) {
    obsEl.innerHTML = `<b>${obs.ev} / ${obs.n}</b> patients (${(obs.rate * 100).toFixed(1)}%) ` +
      `· Wilson 95% CI ${(obs.lo * 100).toFixed(1)}–${(obs.hi * 100).toFixed(1)}%`;
  } else if (obs && obs.n === 0) {
    obsEl.textContent = "No patients in this score stratum (extrapolated by model only).";
  } else {
    obsEl.textContent = "—";
  }

  // Action box
  const action = document.getElementById("action_text");
  if (cls === "high") {
    action.innerHTML = `<b>Tighter post-procedural surveillance.</b> Consider early CT (24–72 h), close clinical re-assessment, and a low threshold for surgical rescue.`;
  } else if (cls === "medium") {
    action.innerHTML = `<b>Standard surveillance plus interval imaging.</b> Repeat CT at 2–4 weeks at the discretion of the team.`;
  } else {
    action.innerHTML = `<b>Standard post-embolization care.</b> Routine clinical follow-up; rescue risk in the lowest cohort decile.`;
  }
}

function reset() {
  ["sdh_vol_ge100", "anticoag", "no_focal_deficit",
   "plt_lt150", "antiplatelet", "ant_post"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  document.getElementById("age").value = "1";
  document.querySelector('input[name="model"][value="m1"]').checked = true;
  compute();
}

document.addEventListener("DOMContentLoaded", () => {
  const inputs = document.querySelectorAll(
    '#calculator input, #calculator select, .model-toggle input');
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
