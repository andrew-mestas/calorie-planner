
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

  // General Dirichlet sampler: each slot has its own positive alpha parameter.
  // Passing the same alpha repeatedly gives the symmetric distribution.
  function dirichletAllocation(alphas, target) {
    const samples = alphas.map(alpha => gammaSample(alpha));
    const sampleSum = samples.reduce((sum, value) => sum + value, 0);
    return samples.map(value => (value / sampleSum) * target);
  }

  const $ = id => document.getElementById(id);
  let chart;
  let currentValues = [];
  let currentAlphas = [];

  function syncAlphaInputs() {
    const length = Math.max(1, Math.min(100, Math.floor(Number($("length").value) || 1)));
    const previous = [...document.querySelectorAll(".slot-alpha")].map(input => input.value);
    $("alphaInputs").innerHTML = "";
    for (let i = 0; i < length; i++) {
      const wrapper = document.createElement("div");
      wrapper.className = "alpha-item";
      const label = document.createElement("label");
      label.textContent = `Slot ${i + 1} · α`;
      label.htmlFor = `alpha-${i}`;
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0.01";
      input.max = "1000";
      input.step = "0.1";
      input.value = previous[i] || "1";
      input.className = "slot-alpha";
      input.id = `alpha-${i}`;
      input.setAttribute("aria-label", `Alpha for slot ${i + 1}`);
      wrapper.append(label, input);
      $("alphaInputs").append(wrapper);
    }
  }

  function updateAlphaMode() {
    const asymmetric = $("alphaMode").value === "asymmetric";
    $("symmetricAlpha").hidden = asymmetric;
    $("asymmetricAlpha").hidden = !asymmetric;
  }

  function formatNumber(value, precision) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    });
  }

  function roundedValuesThatPreserveTotal(values, target, precision) {
    const scale = 10 ** precision;
    const targetUnits = Math.round(target * scale);
    const units = values.map(value => Math.round(value * scale));
    const difference = targetUnits - units.reduce((a, b) => a + b, 0);
    units[units.length - 1] += difference;
    return units.map(value => value / scale);
  }

  function renderChart(values, alphas, target) {
    const ctx = $("allocationChart");
    const labels = values.map((_, i) => `Slot ${i + 1}`);
    const alphaSum = alphas.reduce((a, b) => a + b, 0);
    const expected = alphas.map(alpha => target * alpha / alphaSum);

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          type: "bar",
          label: "Random allocation",
          data: values,
          backgroundColor: "rgba(43, 157, 108, 0.72)",
          hoverBackgroundColor: "#116744",
          borderRadius: 7,
          borderSkipped: false,
          maxBarThickness: 54
        }, {
          type: "line",
          label: "Expected allocation",
          data: expected,
          borderColor: "#e09b35",
          backgroundColor: "#e09b35",
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: context => ` ${context.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: document.documentElement.dataset.theme === "dark" ? "#a3b1a9" : "#66736d" }
          },
          y: {
            beginAtZero: true,
            grid: { color: document.documentElement.dataset.theme === "dark" ? "#34443c" : "#edf1ee" },
            ticks: {
              color: "#66736d",
              callback: value => Number(value).toLocaleString()
            }
          }
        }
      }
    });
  }

  function generate() {
    $("error").textContent = "";
    const length = Number($("length").value);
    const target = Number($("target").value);
    const alphaMode = $("alphaMode").value;
    const alphas = alphaMode === "asymmetric"
      ? [...document.querySelectorAll(".slot-alpha")].map(input => Number(input.value))
      : Array(length).fill(Number($("alpha").value));
    const precision = Number($("precision").value);

    if (!Number.isInteger(length) || length < 1 || length > 100) {
      $("error").textContent = "Array length must be a whole number from 1 to 100.";
      return;
    }
    if (!Number.isFinite(target) || target < 0) {
      $("error").textContent = "Total amount must be a finite number greater than or equal to zero.";
      return;
    }
    if (alphas.length !== length || alphas.some(alpha => !Number.isFinite(alpha) || alpha <= 0 || alpha > 1000)) {
      $("error").textContent = "Every alpha must be greater than zero and no more than 1000.";
      return;
    }
    if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
      $("error").textContent = "Decimal places must be a whole number from 0 to 6.";
      return;
    }

    try {
      currentAlphas = alphas;
      currentValues = dirichletAllocation(alphas, target);
      const displayValues = roundedValuesThatPreserveTotal(currentValues, target, precision);
      const displayedSum = displayValues.reduce((a, b) => a + b, 0);

      $("sum").textContent = formatNumber(displayedSum, precision);
      $("targetStat").textContent = target.toLocaleString();
      $("mean").textContent = formatNumber(target / length, precision);
      $("array").textContent = `[${displayValues.map(v => v.toFixed(precision)).join(", ")}]`;
      renderChart(currentValues, currentAlphas, target);
    } catch (error) {
      $("error").textContent = error.message || "Could not generate allocation.";
    }
  }

  $("generate").addEventListener("click", generate);
  $("alphaMode").addEventListener("change", () => { updateAlphaMode(); generate(); });
  $("length").addEventListener("change", () => {
    syncAlphaInputs();
    if ($("alphaMode").value === "asymmetric") generate();
  });
  $("alphaInputs").addEventListener("change", event => {
    if (event.target.classList.contains("slot-alpha") && $("alphaMode").value === "asymmetric") generate();
  });
  $("copy").addEventListener("click", async () => {
    if (!currentValues.length) return;
    const precision = Number($("precision").value);
    const target = Number($("target").value);
    const displayValues = roundedValuesThatPreserveTotal(currentValues, target, precision);
    const text = `[${displayValues.map(v => v.toFixed(precision)).join(", ")}]`;
    try {
      await navigator.clipboard.writeText(text);
      $("copy").textContent = "Copied!";
      setTimeout(() => $("copy").textContent = "Copy array", 1300);
    } catch {
      $("error").textContent = "Clipboard access is unavailable in this browser. Select and copy the array above.";
    }
  });

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
    if (!chart) return;
    const textColor = next === "dark" ? "#a3b1a9" : "#66736d";
    const gridColor = next === "dark" ? "#34443c" : "#edf1ee";
    chart.options.scales.x.ticks.color = textColor;
    chart.options.scales.y.ticks.color = textColor;
    chart.options.scales.y.grid.color = gridColor;
    chart.update();
  });
  syncAlphaInputs();
  updateAlphaMode();
  generate();
