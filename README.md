# MMA Embolization Rescue Risk Score — site

This folder is the static GitHub Pages site for the MMA embolization rescue risk score.

## What's inside

| File | What it is |
|---|---|
| `index.html` | Landing page with the live calculator |
| `styles.css` | Stylesheet (JAMA Neurology palette) |
| `calculator.js` | Pure-JS calculator logic and observed-rate lookup |
| `figures/` | Figures 1–6 (PNG) used on the page |
| `bedside_card.pdf` | Printable 1-page bedside card |


## How to deploy on GitHub Pages

1. Create a new repository on GitHub (e.g. `mmae-rescue-score`).
2. From the project root (one level above this `docs/` folder):
   ```bash
   git init
   git add .
   git commit -m "Initial commit — MMAE rescue score site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/mmae-rescue-score.git
   git push -u origin main
   ```
3. On GitHub, go to **Settings → Pages**:
   - Source: "Deploy from a branch"
   - Branch: `main` / folder: `/docs`
4. Click **Save**. The site will be live at
   `https://<your-username>.github.io/mmae-rescue-score/` within a minute.

### Custom domain (optional)
Add a `CNAME` file in `docs/` containing your domain, e.g. `mmae-score.org`,
and configure DNS at your registrar (CNAME record to `<your-username>.github.io`).

## Local preview
```bash
cd docs
python3 -m http.server 8000
# open http://localhost:8000
```

## Updating the calculator

The logistic-regression coefficients in `calculator.js` come from
`build_score_v2.py` running on the internal cohort (n = 214). To refresh:

```python
import pandas as pd
m1 = pd.read_csv("v2/m1_logit_coefs.csv")
print(dict(zip(m1.variable, m1.coef)))
```
Paste the result into the `COEF.m1` (and `COEF.m2`) blocks in `calculator.js`.

## Caveats

- Internal validation only; external validation pending.
- Pre-procedural use, not for acute SDH triage.
- Calculator uses logistic regression on score components (not just integer score points)
  — so two patients with the same total can get slightly different probabilities if
  their underlying inputs differ. The integer total + observed lookup table is also shown.
