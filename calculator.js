/* MMAE Rescue Risk Calculator — four-model engine.
   M1, M2, M3 are integer scores derived on the same n=214 cohort.
   M4 is a data-driven model (lasso-selected 7 continuous/binary
   predictors), provided as a sensitivity benchmark — see Methods. */

const COEF = {
  m1: {
    const: -3.345952,
    age_pts: 0.444190,
    sdh_vol_ge100: 0.889811,
    anticoag: 0.568381,
    focal_deficit: -0.223156,
    plt_lt150: 0.689316,
    antiplatelet: 0.647507,
    ant_post: 0.760086,
  },
  m2: {
    const: -2.480543,
    age_pts: 0.447238,
    sdh_vol_ge100: 0.864143,
    anticoag: 0.490257,
    focal_deficit: -0.152347,
  },
  m3: {
    const: -2.907133,
    age_pts_socr: 0.705349,
    sdh_vol_ge100: 0.683163,
    plt_lt150: 0.757450,
    antiplatelet: 0.481896,
    focal_deficit: -0.144948,
  },
  m4: {
    const: -3.309271,
    age: 0.032509,
    plt: -0.005356,
    hypertension: -0.573460,
    antiplatelet: 0.523803,
    gait: -0.655575,
    ant_post: 0.593859,
    sdh_vol_ge100: 0.759327,
  },
};

// Variables active per model (excluding age, which is always present)
const VARS = {
  m1: ["sdh_vol_ge100", "anticoag", "focal_deficit", "plt_lt150",
       "antiplatelet", "ant_post"],
  m2: ["sdh_vol_ge100", "anticoag", "focal_deficit"],
  m3: ["sdh_vol_ge100", "plt_lt150", "antiplatelet", "focal_deficit"],
  m4: ["sdh_vol_ge100", "antiplatelet", "ant_post", "hypertension",
       "gait", "plt_lt150"],  // plt_lt150 used as proxy in checkbox UI
};

const MAX_PTS = { m1: 8, m2: 5, m3: 6, m4: null };  // M4 is continuous → no max

// Observed rate per integer score per model (Wilson 95% CI from cohort n=214)
const OBS = {
  m1: {
    0: { n: 6,  ev: 0,  rate: 0.000, lo: 0.000, hi: 0.390 },
    1: { n: 20, ev: 3,  rate: 0.150, lo: 0.052, hi: 0.360 },
    2: { n: 31, ev: 3,  rate: 0.097, lo: 0.033, hi: 0.249 },
    3: { n: 53, ev: 3,  rate: 0.057, lo: 0.019, hi: 0.154 },
    4: { n: 54, ev: 8,  rate: 0.148, lo: 0.077, hi: 0.266 },
    5: { n: 39, ev: 16, rate: 0.410, lo: 0.271, hi: 0.566 },
    6: { n: 9,  ev: 2,  rate: 0.222, lo: 0.063, hi: 0.547 },
    7: { n: 2,  ev: 1,  rate: 0.500, lo: 0.095, hi: 0.905 },
    8: { n: 0,  ev: 0,  rate: null,  lo: null,  hi: null  },
  },
  m2: {
    0: { n: 17, ev: 1,  rate: 0.059, lo: 0.010, hi: 0.270 },
    1: { n: 39, ev: 6,  rate: 0.154, lo: 0.072, hi: 0.297 },
    2: { n: 63, ev: 6,  rate: 0.095, lo: 0.044, hi: 0.193 },
    3: { n: 67, ev: 15, rate: 0.224, lo: 0.141, hi: 0.337 },
    4: { n: 23, ev: 6,  rate: 0.261, lo: 0.125, hi: 0.465 },
    5: { n: 5,  ev: 2,  rate: 0.400, lo: 0.118, hi: 0.769 },
  },
  m3: {
    0: { n: 13, ev: 2,  rate: 0.154, lo: 0.043, hi: 0.422 },
    1: { n: 36, ev: 4,  rate: 0.111, lo: 0.044, hi: 0.253 },
    2: { n: 67, ev: 4,  rate: 0.060, lo: 0.023, hi: 0.144 },
    3: { n: 50, ev: 8,  rate: 0.160, lo: 0.083, hi: 0.285 },
    4: { n: 35, ev: 14, rate: 0.400, lo: 0.256, hi: 0.564 },
    5: { n: 13, ev: 4,  rate: 0.308, lo: 0.127, hi: 0.576 },
    6: { n: 0,  ev: 0,  rate: null,  lo: null,  hi: null  },
  },
};

// Recommended cutoffs (integer score)
const CUTOFF = { m1: 5, m2: 3, m3: 4, m4: null };

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function getModel() {
  return document.querySelector('input[name="model"]:checked').value;
}

function setVarVisibility(model) {
  const all = ["anticoag", "antiplatelet", "plt_lt150", "ant_post",
               "focal_deficit", "hypertension", "gait"];
  const active = new Set(VARS[model]);
  for (const id of all) {
    const el = document.getElementById(id);
    if (!el) continue;
    const wrapper = el.closest("label.check");
    if (!wrapper) continue;
    if (active.has(id)) {
      wrapper.style.display = "";
    } else {
      wrapper.style.display = "none";
      el.checked = false;
    }
  }
  const procFieldset = document.querySelector("fieldset.m1-only");
  if (procFieldset) procFieldset.style.display = (model === "m1") ? "" : "none";
  const hint = document.getElementById("age_hint");
  if (hint) hint.style.display = (model === "m3") ? "" : "none";
}

function compute() {
  const model = getModel();
  setVarVisibility(model);

  const c = COEF[model];
  const inputs = VARS[model];

  const age = parseInt(document.getElementById("age").value, 10);
  let total = 0;
  let z = c.const;

  if (model === "m4") {
    // Continuous age (use midpoints of categories): <65→55, 65-80→72, >80→85
    const ageRaw = age === 0 ? 55 : (age === 1 ? 72 : 85);
    z += c.age * ageRaw;
    // platelets: assume 200 if not <150, 130 if checked <150
    const pltLt = document.getElementById("plt_lt150").checked;
    z += c.plt * (pltLt ? 130 : 200);
  } else {
    total = age;
    if (model === "m3") {
      z += (c.age_pts_socr || 0) * age;
    } else {
      z += (c.age_pts || 0) * age;
    }
  }

  for (const k of inputs) {
    const el = document.getElementById(k);
    if (!el) continue;
    const v = el.checked ? 1 : 0;
    if (model === "m4" && k === "plt_lt150") continue;  // already handled
    z += (c[k] || 0) * v;
    if (model !== "m4") total += v;
  }

  const prob = sigmoid(z);
  const max = MAX_PTS[model];

  document.getElementById("total_pts").textContent =
    (model === "m4") ? "—" : total;
  document.getElementById("max_pts").textContent =
    (max == null) ? "—" : max;
  document.getElementById("prob_pct").textContent = (prob * 100).toFixed(1) + "%";
  document.getElementById("prob_fill").style.width =
    Math.min(100, Math.max(2, prob * 100)) + "%";

  const band = document.getElementById("risk_band");
  let cls = "low", txt = "Low risk";

  if (model === "m4") {
    // M4 risk bands by predicted probability tertile
    if (prob >= 0.30) { cls = "high"; txt = "High predicted risk (≥30%)"; }
    else if (prob >= 0.15) { cls = "medium"; txt = "Intermediate predicted risk"; }
    else { cls = "low"; txt = "Low predicted risk (<15%)"; }
  } else {
    const cut = CUTOFF[model];
    const intermediate = (model === "m1") ? 3 : (model === "m2" ? 1 : 3);
    if (total >= cut) { cls = "high"; txt = `High risk · score ≥ ${cut}`; }
    else if (total >= intermediate) { cls = "medium"; txt = "Intermediate risk"; }
  }
  band.className = "band " + cls;
  band.querySelector(".band-text").textContent = txt;

  const obsEl = document.getElementById("obs_rate");
  if (model === "m4") {
    obsEl.innerHTML = "Continuous (logistic) model — score-stratum lookup not applicable. " +
                       "Reported probability is the model's direct output.";
  } else {
    const obs = (OBS[model] || {})[total];
    if (obs && obs.n > 0 && obs.rate !== null) {
      obsEl.innerHTML = `<b>${obs.ev} / ${obs.n}</b> patients (${(obs.rate * 100).toFixed(1)}%) ` +
        `· Wilson 95% CI ${(obs.lo * 100).toFixed(1)}–${(obs.hi * 100).toFixed(1)}%`;
    } else {
      obsEl.textContent = "No patients in this score stratum (extrapolated by model only).";
    }
  }

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
  ["sdh_vol_ge100", "anticoag", "focal_deficit", "plt_lt150", "antiplatelet",
   "ant_post", "hypertension", "gait"].forEach(id => {
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
