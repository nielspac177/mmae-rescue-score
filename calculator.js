/* MMAE Rescue Risk Calculator — primary + sensitivity engine.
   Primary models (M1, M2): knowledge-driven, focal_deficit excluded.
   Sensitivity (M3, M4, focal-deficit variants of M1-3): see Methods. */

const COEF = {
  // PRIMARY — focal-removed
  m1: {
    const: -3.434271,
    age_pts: 0.418726,
    sdh_vol_ge100: 0.853519,
    anticoag: 0.584327,
    plt_lt150: 0.697111,
    antiplatelet: 0.658241,
    ant_post: 0.731793,
  },
  m2: {
    const: -2.545444,
    age_pts: 0.430814,
    sdh_vol_ge100: 0.843656,
    anticoag: 0.489845,
  },
  m3: {
    const: -2.977894,
    age_pts_socr: 0.695501,
    sdh_vol_ge100: 0.664904,
    plt_lt150: 0.759507,
    antiplatelet: 0.479805,
  },
  // SENSITIVITY — focal_deficit re-included
  m1_focal: {
    const: -3.345952, age_pts: 0.444190, sdh_vol_ge100: 0.889811,
    anticoag: 0.568381, focal_deficit: -0.223156, plt_lt150: 0.689316,
    antiplatelet: 0.647507, ant_post: 0.760086,
  },
  m2_focal: {
    const: -2.480543, age_pts: 0.447238, sdh_vol_ge100: 0.864143,
    anticoag: 0.490257, focal_deficit: -0.152347,
  },
  m3_focal: {
    const: -2.907133, age_pts_socr: 0.705349, sdh_vol_ge100: 0.683163,
    plt_lt150: 0.757450, antiplatelet: 0.481896, focal_deficit: -0.144948,
  },
  // SENSITIVITY — Model 4 (data-driven, lasso, natural class balance)
  m4: {
    const: -3.309271,
    age: 0.032509,
    plt: -0.005356,
    hypertension: -0.573460,
    antiplatelet: 0.523803,
    sdh_vol_ge100: 0.759327,
  },
};

// Variables (excluding age, which is always present)
const VARS = {
  m1: ["sdh_vol_ge100", "anticoag", "plt_lt150", "antiplatelet", "ant_post"],
  m2: ["sdh_vol_ge100", "anticoag"],
  m3: ["sdh_vol_ge100", "plt_lt150", "antiplatelet"],
  m1_focal: ["sdh_vol_ge100", "anticoag", "focal_deficit", "plt_lt150",
              "antiplatelet", "ant_post"],
  m2_focal: ["sdh_vol_ge100", "anticoag", "focal_deficit"],
  m3_focal: ["sdh_vol_ge100", "plt_lt150", "antiplatelet", "focal_deficit"],
  m4: ["sdh_vol_ge100", "antiplatelet", "hypertension", "plt_lt150"],
};

const MAX_PTS = { m1: 7, m2: 4, m3: 5, m1_focal: 8, m2_focal: 5,
                  m3_focal: 6, m4: null };

// Recommended integer cutoffs (primary)
const CUTOFF = { m1: 4, m2: 3, m3: 3, m1_focal: 5, m2_focal: 3,
                  m3_focal: 4, m4: null };

// Score → observed rate (PRIMARY ONLY shown in lookup; sensitivity uses model)
const OBS = {
  m1: {
    0: { n: 8,  ev: 0,  rate: 0.000, lo: 0.000, hi: 0.324 },
    1: { n: 29, ev: 4,  rate: 0.138, lo: 0.055, hi: 0.306 },
    2: { n: 50, ev: 3,  rate: 0.060, lo: 0.021, hi: 0.162 },
    3: { n: 64, ev: 6,  rate: 0.094, lo: 0.044, hi: 0.190 },
    4: { n: 47, ev: 18, rate: 0.383, lo: 0.258, hi: 0.526 },
    5: { n: 13, ev: 3,  rate: 0.231, lo: 0.082, hi: 0.503 },
    6: { n: 3,  ev: 2,  rate: 0.667, lo: 0.208, hi: 0.939 },
    7: { n: 0,  ev: 0,  rate: null,  lo: null,  hi: null  },
  },
  m2: {
    0: { n: 29, ev: 2,  rate: 0.069, lo: 0.019, hi: 0.220 },
    1: { n: 61, ev: 8,  rate: 0.131, lo: 0.068, hi: 0.238 },
    2: { n: 83, ev: 13, rate: 0.157, lo: 0.094, hi: 0.250 },
    3: { n: 36, ev: 11, rate: 0.306, lo: 0.180, hi: 0.469 },
    4: { n: 5,  ev: 2,  rate: 0.400, lo: 0.118, hi: 0.769 },
  },
  m3: {
    0: { n: 22, ev: 3,  rate: 0.136, lo: 0.047, hi: 0.333 },
    1: { n: 64, ev: 4,  rate: 0.063, lo: 0.025, hi: 0.150 },
    2: { n: 70, ev: 7,  rate: 0.100, lo: 0.049, hi: 0.192 },
    3: { n: 40, ev: 17, rate: 0.425, lo: 0.285, hi: 0.578 },
    4: { n: 17, ev: 4,  rate: 0.235, lo: 0.096, hi: 0.473 },
    5: { n: 1,  ev: 1,  rate: 1.000, lo: 0.207, hi: 1.000 },
  },
};

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function getModel() {
  let base = document.querySelector('input[name="model"]:checked').value;
  const focalToggle = document.getElementById("focal_sens");
  if (base !== "m4" && focalToggle && focalToggle.checked) {
    return base + "_focal";
  }
  return base;
}

function setVarVisibility(model) {
  const all = ["anticoag", "antiplatelet", "plt_lt150", "ant_post",
               "focal_deficit", "hypertension"];
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
  if (procFieldset)
    procFieldset.style.display = (model === "m1" || model === "m1_focal") ? "" : "none";
  const hint = document.getElementById("age_hint");
  if (hint) hint.style.display = (model === "m3" || model === "m3_focal") ? "" : "none";
  // Focal sensitivity toggle is only meaningful for M1/M2/M3 (knowledge-driven)
  const focalRow = document.getElementById("focal_sens_row");
  if (focalRow) focalRow.style.display = (model === "m4") ? "none" : "";
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
    const ageRaw = age === 0 ? 55 : (age === 1 ? 72 : 85);
    z += c.age * ageRaw;
    const pltLt = document.getElementById("plt_lt150").checked;
    z += c.plt * (pltLt ? 130 : 200);
  } else {
    total = age;
    if (model.startsWith("m3")) {
      z += (c.age_pts_socr || 0) * age;
    } else {
      z += (c.age_pts || 0) * age;
    }
  }

  for (const k of inputs) {
    const el = document.getElementById(k);
    if (!el) continue;
    const v = el.checked ? 1 : 0;
    if (model === "m4" && k === "plt_lt150") continue;
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
    if (prob >= 0.30) { cls = "high"; txt = "High predicted risk (≥30%)"; }
    else if (prob >= 0.15) { cls = "medium"; txt = "Intermediate predicted risk"; }
    else { cls = "low"; txt = "Low predicted risk (<15%)"; }
  } else {
    const cut = CUTOFF[model];
    const intermediate =
      (model === "m1" || model === "m1_focal") ? 2 :
      (model === "m2" || model === "m2_focal") ? 1 :
      (model === "m3" || model === "m3_focal") ? 1 : 1;
    if (total >= cut) { cls = "high"; txt = `High risk · score ≥ ${cut}`; }
    else if (total >= intermediate) { cls = "medium"; txt = "Intermediate risk"; }
  }
  band.className = "band " + cls;
  band.querySelector(".band-text").textContent = txt;

  const obsEl = document.getElementById("obs_rate");
  // Only primary models show the empirical lookup; sensitivity models
  // report the model probability only.
  const primary = ["m1", "m2", "m3"].includes(model);
  if (!primary || model === "m4") {
    obsEl.innerHTML = (model === "m4")
      ? "Continuous (logistic) model — score-stratum lookup not applicable."
      : "Sensitivity model (focal-deficit included). Lookup uses primary score; reported probability is the model output.";
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
   "ant_post", "hypertension"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  document.getElementById("age").value = "1";
  const fs = document.getElementById("focal_sens");
  if (fs) fs.checked = false;
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
