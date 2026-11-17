
  // Box–Muller transform: sample from a standard normal distribution.
  function randomNormal() {
    let u1 = 0;
    while (u1 === 0) u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // Marsaglia–Tsang gamma sampler, parameterized by shape alpha and scale 1.
  function gammaSample(alpha) {
    if (!(alpha > 0)) throw new Error("Alpha must be greater than zero.");

    if (alpha < 1) {
      let u = 0;
      while (u === 0) u = Math.random();
      return gammaSample(alpha + 1) * Math.pow(u, 1 / alpha);
    }

    const d = alpha - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    for (;;) {
      const x = randomNormal();
      const base = 1 + c * x;
      if (base <= 0) continue;

      const v = base * base * base;
      const u = Math.random();

      if (
        u < 1 - 0.0331 * x * x * x * x ||
        Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))
      ) {
        return d * v;
      }
    }
  }

  const $ = id => document.getElementById(id);

  // Calorie planner: use Dirichlet proportions, then enforce a hard BMR cap
  // by redistributing any excess across days that still have available capacity.
  let calorieChart;

  function cappedAllocation(weights, total, cap) {
    const n = weights.length;
    if (total > n * cap + 1e-8) {
      throw new Error("This weekly target is not feasible: the weekly budget exceeds 7 × estimated TDEE.");
    }
    const result = Array(n).fill(0);
    let remaining = total;
    let active = weights.map((_, i) => i);

    while (active.length && remaining > 1e-8) {
      const weightSum = active.reduce((sum, i) => sum + weights[i], 0);
      let cappedAny = false;

      for (const i of [...active]) {
        const proposed = remaining * weights[i] / weightSum;
        if (proposed > cap) {
          result[i] = cap;
          remaining -= cap;
          active = active.filter(index => index !== i);
          cappedAny = true;
        }
      }

      if (!cappedAny) {
        const sum = active.reduce((s, i) => s + weights[i], 0);
        for (const i of active) result[i] = remaining * weights[i] / sum;
        remaining = 0;
      }
    }
    return result;
  }

  function generateCaloriePlan() {
    const goal = Number($("dailyGoal").value);
    const bmr = Number($("bmrInput").value);
    const multiplier = Number($("activityLevel").value);
    const alpha = Number($("calorieAlpha").value);
    const mode = $("calorieMode").value;
    $("calorieError").textContent = "";

    if (!Number.isFinite(goal) || goal <= 0 || !Number.isFinite(bmr) || bmr <= 0) {
      $("calorieError").textContent = "Enter valid positive values for the daily goal and BMR.";
      return;
    }
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      $("calorieError").textContent = "Choose a valid activity multiplier.";
      return;
    }
    if (mode === "random" && (!Number.isFinite(alpha) || alpha <= 0 || alpha > 100)) {
      $("calorieError").textContent = "Variation alpha must be greater than 0 and no more than 100.";
      return;
    }

    const weeklyBudget = goal * 7;
    const tdee = bmr * multiplier;
    if (weeklyBudget > tdee * 7 + 1e-8) {
      $("calorieError").textContent = `Not feasible: the weekly budget (${weeklyBudget.toLocaleString()} kcal) is greater than the maximum allowed (${(tdee * 7).toLocaleString()} kcal at your estimated TDEE cap). Lower the daily goal or increase the BMR value if it was entered incorrectly.`;
      $("calorieStatus").className = "status warning";
      $("calorieStatus").textContent = "No valid seven-day allocation exists with the current inputs.";
      return;
    }

    try {
      const weights = mode === "balanced"
        ? Array(7).fill(1)
        : Array.from({length: 7}, () => gammaSample(alpha));
      const allocations = cappedAllocation(weights, weeklyBudget, tdee);
      // Round to whole calories while preserving the weekly total and TDEE ceiling.
      const targetUnits = Math.round(weeklyBudget);
      const rounded = allocations.map(v => Math.floor(v));
      let unitsLeft = targetUnits - rounded.reduce((a,b) => a+b, 0);
      const order = allocations.map((v,i) => ({i, fraction:v-Math.floor(v)}))
        .sort((a,b) => b.fraction-a.fraction);
      for (const item of order) {
        if (unitsLeft <= 0) break;
        if (rounded[item.i] + 1 <= Math.floor(tdee)) {
          rounded[item.i] += 1;
          unitsLeft -= 1;
        }
      }
      // If the TDEE ceiling has fractional calories, use decimal allocations instead.
      const finalValues = unitsLeft > 0 ? allocations : rounded;
      const total = finalValues.reduce((a,b) => a+b, 0);
      const averageDeficit = tdee - goal;
      const maxValue = Math.max(...finalValues);

      $("weeklyBudget").textContent = Math.round(weeklyBudget).toLocaleString() + " kcal";
      $("tdeeValue").textContent = Math.round(tdee).toLocaleString() + " kcal";
      $("dailyDeficit").textContent = Math.round(averageDeficit).toLocaleString() + " kcal";
      $("maxAllocation").textContent = Math.round(maxValue).toLocaleString() + " kcal";
      $("weeklyTotal").textContent = Math.round(total).toLocaleString() + " kcal";

      const dayNames = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
      $("calorieRows").innerHTML = "";
      dayNames.forEach((day, i) => {
        const value = finalValues[i];
        const tr = document.createElement("tr");
        if (value > tdee + 1e-7) tr.className = "over-cap";
        const cells = [
          day,
          `${Math.round(value).toLocaleString()} kcal`,
          `${value-goal >= 0 ? "+" : ""}${Math.round(value-goal).toLocaleString()} kcal`,
          `${Math.round(tdee-value).toLocaleString()} kcal`
        ];
        cells.forEach(text => {
          const td = document.createElement("td");
          td.textContent = text;
          tr.append(td);
        });
        $("calorieRows").append(tr);
      });

      const ctx = $("calorieChart");
      if (calorieChart) calorieChart.destroy();
      calorieChart = new Chart(ctx, {
        data: {
          labels: dayNames,
          datasets: [
            {
              type: "bar",
              label: "Daily allocation",
              data: finalValues,
              backgroundColor: "rgba(43,157,108,.75)",
              borderRadius: 7,
              borderSkipped: false
            },
            {
              type: "line",
              label: "Estimated TDEE ceiling",
              data: Array(7).fill(tdee),
              borderColor: "#c94b43",
              pointRadius: 0,
              borderWidth: 2,
              borderDash: [6,4]
            },
            {
              type: "line",
              label: "Daily average goal",
              data: Array(7).fill(goal),
              borderColor: "#e09b35",
              pointRadius: 0,
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive:true,
          maintainAspectRatio:false,
          plugins:{legend:{position:"bottom",labels:{color:document.documentElement.dataset.theme === "dark" ? "#a3b1a9" : "#66736d"}}},
          scales:{
            x:{grid:{display:false},ticks:{color:document.documentElement.dataset.theme === "dark" ? "#a3b1a9" : "#66736d"}},
            y:{beginAtZero:true,grid:{color:document.documentElement.dataset.theme === "dark" ? "#34443c" : "#edf1ee"},ticks:{color:document.documentElement.dataset.theme === "dark" ? "#a3b1a9" : "#66736d"}}
          }
        }
      });

      const belowTdee = averageDeficit > 0;
      $("calorieStatus").className = "status";
      $("calorieStatus").textContent =
        `Valid plan: all seven days are at or below your estimated TDEE ceiling. ` +
        `Estimated TDEE is ${Math.round(tdee).toLocaleString()} kcal/day; ` +
        (belowTdee
          ? `your average goal is about ${Math.round(averageDeficit).toLocaleString()} kcal/day below estimated maintenance.`
          : `your average goal is not below estimated maintenance using this activity multiplier.`);
    } catch (error) {
      $("calorieError").textContent = error.message || "Unable to generate the weekly plan.";
    }
  }

  const themeToggle = $("themeToggle");
  const savedTheme = localStorage.getItem("dirichlet-app-theme");
  if (savedTheme === "dark") document.documentElement.dataset.theme = "dark";
  function refreshThemeButton() {
    const isDark = document.documentElement.dataset.theme === "dark";
    themeToggle.textContent = isDark ? "☀ Light mode" : "☾ Dark mode";
    themeToggle.setAttribute("aria-pressed", String(isDark));
  }
  refreshThemeButton();
  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("dirichlet-app-theme", next);
    refreshThemeButton();
    const palette = next === "dark"
      ? { text: "#a3b1a9", grid: "#34443c" }
      : { text: "#66736d", grid: "#edf1ee" };
    [calorieChart].forEach(instance => {
      if (!instance) return;
      instance.options.scales.x.ticks.color = palette.text;
      instance.options.scales.y.ticks.color = palette.text;
      instance.options.scales.y.grid.color = palette.grid;
      if (instance.options.plugins?.legend?.labels) {
        instance.options.plugins.legend.labels.color = palette.text;
      }
      instance.update();
    });
  });

  // Only page-tab buttons participate in page switching. The theme toggle
  // shares the navigation bar but must not clear the selected page.
  document.querySelectorAll(".page-nav button[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".page-nav button[data-page]").forEach(item => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-current", item === button ? "page" : "false");
      });
      document.querySelectorAll(".page").forEach(page => {
        page.classList.toggle("active", page.id === button.dataset.page);
      });
    });
  });
  $("generateCalories").addEventListener("click", generateCaloriePlan);
  $("calorieMode").addEventListener("change", () => {
    $("calorieAlphaField").hidden = $("calorieMode").value === "balanced";
  });
  ["dailyGoal","bmrInput","activityLevel","calorieAlpha"].forEach(id => {
    $(id).addEventListener("change", generateCaloriePlan);
  });

  generateCaloriePlan();
