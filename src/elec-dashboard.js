/**
 * 国家电网电费卡片 + 日用电柱状趋势图
 * 两个自定义卡片：custom:elec-summary-card / custom:elec-chart-card
 * 通过 localStorage 共享当前选中户号，实现联动。
 */

const ACCOUNT_KEY = "elec-account";
const ACCOUNT_EVENT = "elec-account-changed";

// 概览卡片的 Tab（年/月/日）与下方趋势图的视图粒度联动
const PERIOD_KEY = "elec-period";
const PERIOD_EVENT = "elec-period-changed";
function getPeriod() {
  try { return localStorage.getItem(PERIOD_KEY); } catch (e) { return null; }
}
function setPeriod(p) {
  try { localStorage.setItem(PERIOD_KEY, p); } catch (e) { /* ignore */ }
  window.dispatchEvent(new CustomEvent(PERIOD_EVENT, { detail: p }));
}

const BASE_CSS = `
:host{display:block;width:100%}
.wrap{
  --elec-bg:var(--ha-card-background, var(--card-background-color, #1e1e1e));
  --elec-text:var(--primary-text-color, #e6e6e6);
  --elec-muted:var(--secondary-text-color, #9a9a9a);
  --elec-panel:var(--secondary-background-color, #2f2f2f);
  --elec-accent:#18a37d;
  --elec-on-accent:#ffffff;
  --elec-orange:#e08a1e;
  --elec-purple:#8f5ce0;
  --elec-blue:#3b7bff;
  box-sizing:border-box;background:var(--elec-bg);border-radius:24px;padding:20px;
  width:100%;min-width:0;
  color:var(--elec-text);font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  font-size:15px;line-height:1.4;
}
.wrap *{box-sizing:border-box}
.hd{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.brand{display:flex;gap:12px;align-items:flex-start;min-width:0}
.bolt{width:36px;height:36px;background:var(--elec-orange);border-radius:9px;display:flex;
  align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.name{font-size:20px;font-weight:700;line-height:1.2;white-space:nowrap}
.pills{display:flex;gap:5px;margin-top:7px;flex-wrap:nowrap}
.pill{font-size:12px;line-height:1.5;padding:3px 9px;border-radius:10px;
  background:rgba(128,128,128,.18);color:var(--elec-muted);cursor:pointer;white-space:nowrap;
  -webkit-tap-highlight-color:transparent;transition:background .15s,color .15s;user-select:none}
.pill.on{background:var(--elec-accent);color:var(--elec-on-accent);font-weight:700}
.right{position:relative;text-align:right;min-width:132px;padding-left:8px}
.money{font-size:38px;font-weight:800;color:var(--elec-accent);line-height:1;white-space:nowrap}
.unit{font-size:18px;font-weight:600;margin-left:2px}
.cap{color:var(--elec-muted);font-size:13px;margin-top:6px}
.info{margin-top:14px;line-height:1.9}
.lab{font-size:15px;color:var(--elec-muted)}
.no{color:var(--elec-blue);font-weight:700;font-size:17px;white-space:nowrap}
.date{font-size:14px;color:var(--elec-muted)}
.stats{display:flex;margin-top:14px}
.stat{flex:1;text-align:center}
.num{font-size:32px;font-weight:700;line-height:1.1}
.sub{font-size:14px;color:var(--elec-muted);margin-top:2px}
.tabs{display:flex;gap:8px;margin-top:14px}
.tab{flex:1;text-align:center;padding:11px 0;border-radius:13px;background:rgba(128,128,128,.18);
  color:var(--elec-muted);font-size:15px;cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:background .15s,color .15s;user-select:none}
.tab.on{background:var(--elec-accent);color:var(--elec-on-accent);font-weight:700}
.panel{background:var(--elec-panel);border-radius:16px;padding:12px;margin-top:14px}
.bubble{background:linear-gradient(90deg,#f7b733,#fc8d3a);color:#fff;font-weight:700;font-size:13px;
  border-radius:18px;padding:8px 12px;text-align:center}
.steps{position:relative;display:flex;margin-top:12px}
.step{flex:1;text-align:center;padding:7px 0;font-size:14px;font-weight:700;color:#fff}
.marker{position:absolute;top:0;transform:translateX(-50%);width:4px;height:100%;
  background:#e02020;border-radius:2px;z-index:3;pointer-events:none}
.prices{display:flex;gap:6px;margin-top:8px}
.price{flex:1;background:rgba(128,128,128,.12);border-radius:12px;text-align:center;
  padding:9px 3px;font-size:12px;color:var(--elec-muted)}
.price b{display:block;color:var(--elec-accent);font-size:15px;margin-top:4px;font-weight:700}
`;

/* ---------------- 工具 ---------------- */

function getAccount(config) {
  const list = config.accounts || [];
  let key = null;
  try { key = localStorage.getItem(ACCOUNT_KEY); } catch (e) { /* ignore */ }
  if (!key || !list.some((a) => a.key === key)) key = list[0]?.key ?? null;
  return key;
}

function setAccount(key) {
  try { localStorage.setItem(ACCOUNT_KEY, key); } catch (e) { /* ignore */ }
  window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT, { detail: key }));
}

const VERSION = "v1.1.0";

function accNumber(acc, hass) {
  // YAML 会把 no: 解析成布尔 false，这里兼容所有可能写法
  const keys = ["number", "no", "false", "account", "account_no", "acct", "meter", "户号", "户号/账号"];
  for (const k of keys) {
    const v = acc[k];
    if (v !== undefined && v !== null && v !== "" && v !== false) return String(v);
  }
  if (acc[false]) return String(acc[false]);
  // 兜底：用集成提供的 account_suffix 属性显示尾号
  const st = hass?.states?.[sensorOf(acc, "current_year_charge")];
  const suffix = st?.attributes?.account_suffix;
  if (suffix) return `尾号 ${suffix}`;
  return "未配置";
}

function sensorOf(acc, suffix) {
  if (acc.entities && acc.entities[suffix]) return acc.entities[suffix];
  return `sensor.${acc.key}_${suffix}`;
}

function num(hass, entity) {
  const s = hass.states[entity];
  if (!s) return null;
  const v = parseFloat(s.state);
  return Number.isFinite(v) ? v : null;
}

function fmt(v, digits = 0) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "--";
  return v.toFixed(digits).replace(/\.0$/, "");
}

function ladderOf(usage) {
  if (usage === null) return 1;
  if (usage > 4800) return 3;
  if (usage > 2520) return 2;
  return 1;
}

function markerPos(usage) {
  if (usage === null) return 0;
  let pct;
  if (usage <= 2520) pct = (usage / 2520) * 33.333;
  else if (usage <= 4800) pct = 33.333 + ((usage - 2520) / 2280) * 33.333;
  else pct = 66.667 + Math.min((usage - 4800) / 2000, 1) * 31.333;
  return Math.max(0, Math.min(98, Math.round(pct * 10) / 10));
}

/**
 * 按阶梯电价分段累加：把一天的用电量按跨档情况拆开计价
 * @param {number} cumBefore 该日之前的年累计用电量
 * @param {number} usage     该日用电量
 */
function tierCost(cumBefore, usage) {
  const tiers = [
    { limit: 2520, price: 0.538 },
    { limit: 4800, price: 0.588 },
    { limit: Infinity, price: 0.838 },
  ];
  let cost = 0;
  let pos = Math.max(0, cumBefore);
  let rest = usage;
  for (const t of tiers) {
    if (rest <= 0) break;
    if (pos >= t.limit) continue;
    const take = Math.min(rest, t.limit - pos);
    cost += take * t.price;
    pos += take;
    rest -= take;
  }
  return cost;
}

function lastUpdated(hass, entity) {
  const s = hass.states[entity];
  if (!s || !s.last_updated) return "--";
  const d = new Date(s.last_updated);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* ---------------- 卡片一：电费概览 ---------------- */

class ElecSummaryCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._tab = "year";
    this._onAccount = () => this._render();
    window.addEventListener(ACCOUNT_EVENT, this._onAccount);
  }

  disconnectedCallback() {
    window.removeEventListener(ACCOUNT_EVENT, this._onAccount);
  }

  setConfig(config) {
    if (!config.accounts || !config.accounts.length) {
      throw new Error("请配置 accounts 列表");
    }
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    const sig = this._signature();
    if (sig !== this._sig) {
      this._sig = sig;
      this._render();
    }
  }

  _signature() {
    if (!this._hass || !this._config) return "";
    const acc = this._config.accounts.find((a) => a.key === getAccount(this._config));
    if (!acc) return "";
    return [
      acc.key,
      this._tab,
      ...["current_year_charge", "current_year_usage", "current_month_usage",
        "previous_daily_usage", "previous_settled_month_usage", "previous_settled_month_charge"]
        .map((s) => this._hass.states[sensorOf(acc, s)]?.state ?? ""),
    ].join("|");
  }

  getCardSize() {
    return 6;
  }

  _render() {
    if (!this._hass || !this._config) return;
    // 同步趋势图视图粒度：点「月用电」→ 月度视图，其余 → 日用电视图
    const wantPeriod = this._tab === "month" ? "month" : "day";
    if (getPeriod() !== wantPeriod) setPeriod(wantPeriod);
    const hass = this._hass;
    const key = getAccount(this._config);
    const acc = this._config.accounts.find((a) => a.key === key) || this._config.accounts[0];

    const yearCharge = num(hass, sensorOf(acc, "current_year_charge"));
    const yearUsage = num(hass, sensorOf(acc, "current_year_usage"));
    const monthUsage = num(hass, sensorOf(acc, "current_month_usage"));
    const daily = num(hass, sensorOf(acc, "previous_daily_usage"));
    const pUsage = num(hass, sensorOf(acc, "previous_settled_month_usage"));
    const pCharge = num(hass, sensorOf(acc, "previous_settled_month_charge"));

    const ladder = ladderOf(yearUsage);
    const pos = markerPos(yearUsage);

    const views = {
      year: { value: `¥${fmt(yearCharge)}`, cap: "今年累计电费" },
      month: { value: `${fmt(monthUsage)}<span class="unit">度</span>`, cap: "本月累计用电(度)" },
      day: { value: `${fmt(daily)}<span class="unit">度</span>`, cap: "近日用电(度)" },
    };
    const cur = views[this._tab];

    const pills = this._config.accounts
      .map((a) => `<div class="pill${a.key === acc.key ? " on" : ""}" data-key="${a.key}">${a.name}</div>`)
      .join("");

    this.shadowRoot.innerHTML = `
      <style>${BASE_CSS}</style>
      <div class="wrap">
        <div class="hd">
          <div class="brand">
            <div class="bolt">⚡</div>
            <div>
              <div class="name">国家电网</div>
              <div class="pills">${pills}</div>
            </div>
          </div>
          <div class="right">
            <div class="money">${cur.value}</div>
            <div class="cap">${cur.cap}</div>
          </div>
        </div>

        <div class="info">
          <div><span class="lab">电费户号：</span><span class="no">${accNumber(acc, hass)}</span></div>
          <div class="date">数据日期：${lastUpdated(hass, sensorOf(acc, "current_year_charge"))}<span style="opacity:.45;font-size:11px;margin-left:6px">${VERSION}</span></div>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="num" style="color:var(--elec-orange)">${fmt(pUsage)}</div>
            <div class="sub">上月用电量(度)</div>
          </div>
          <div class="stat">
            <div class="num" style="color:var(--elec-purple)">${fmt(pCharge)}</div>
            <div class="sub">上月电费(元)</div>
          </div>
        </div>

        ${this._config.debug ? `<pre style="margin-top:8px;font-size:10px;line-height:1.5;opacity:.6;white-space:pre-wrap;word-break:break-all">${JSON.stringify(acc)}</pre>` : ""}

        <div class="tabs">
          <div class="tab${this._tab === "year" ? " on" : ""}" data-tab="year">年用电</div>
          <div class="tab${this._tab === "month" ? " on" : ""}" data-tab="month">月用电</div>
          <div class="tab${this._tab === "day" ? " on" : ""}" data-tab="day">日用电</div>
        </div>

        <div class="panel">
          <div class="bubble">${new Date().getFullYear()}年 当前处于 第${ladder}阶梯 ${fmt(yearUsage)}度 ${fmt(yearCharge)}元</div>
          <div class="steps">
            <div class="step" style="background:#35b06f;border-radius:9px 0 0 9px">第一阶梯</div>
            <div class="step" style="background:#e8b93e">第二阶梯</div>
            <div class="step" style="background:#f09a3e;border-radius:0 9px 9px 0">第三阶梯</div>
            <div class="marker" style="left:${pos}%"></div>
          </div>
          <div class="prices">
            <div class="price">0-2520度<b>0.5380元/度</b></div>
            <div class="price">2521-4800度<b>0.5880元/度</b></div>
            <div class="price">4801度以上<b>0.8380元/度</b></div>
          </div>
        </div>
      </div>`;

    this.shadowRoot.querySelectorAll(".pill").forEach((el) => {
      el.addEventListener("click", () => {
        setAccount(el.dataset.key);
        this._render();
      });
    });
    this.shadowRoot.querySelectorAll(".tab").forEach((el) => {
      el.addEventListener("click", () => {
        this._tab = el.dataset.tab;
        this._render();
      });
    });

    this._sig = this._signature();
  }
}

/* ---------------- 卡片二：日用电柱状图 ---------------- */

class ElecChartCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._month = null;
    this._selDay = null;
    this._detailDay = null;
    this._mode = getPeriod() === "month" ? "month" : "day";
    this._selMonth = null;
    this._detailMonth = null;
    this._onAccount = () => {
      this._month = null;
      this._selDay = null;
      this._detailDay = null;
      this._selMonth = null;
      this._detailMonth = null;
      this._render();
    };
    this._onPeriod = () => {
      this._mode = getPeriod() === "month" ? "month" : "day";
      this._month = null;
      this._selDay = null;
      this._detailDay = null;
      this._selMonth = null;
      this._detailMonth = null;
      this._render();
    };
    window.addEventListener(ACCOUNT_EVENT, this._onAccount);
    window.addEventListener(PERIOD_EVENT, this._onPeriod);
  }

  disconnectedCallback() {
    window.removeEventListener(ACCOUNT_EVENT, this._onAccount);
    window.removeEventListener(PERIOD_EVENT, this._onPeriod);
  }

  setConfig(config) {
    if (!config.accounts || !config.accounts.length) {
      throw new Error("请配置 accounts 列表");
    }
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    const sig = this._signature();
    if (sig !== this._sig) {
      this._sig = sig;
      this._render();
    }
  }

  _signature() {
    if (!this._hass || !this._config) return "";
    const acc = this._config.accounts.find((a) => a.key === getAccount(this._config));
    if (!acc) return "";
    const st = this._hass.states[sensorOf(acc, "previous_daily_usage")];
    const hist = st?.attributes?.daily_history;
    return `${acc.key}|${this._mode}|${this._month}|${this._selDay}|${this._selMonth}|${this._detailDay}|${this._detailMonth}|${st?.state ?? ""}|${Array.isArray(hist) ? hist.length : 0}`;
  }

  getCardSize() {
    return 4;
  }

  _dailyOf(acc) {
    const st = this._hass?.states[sensorOf(acc, "previous_daily_usage")];
    const hist = st?.attributes?.daily_history;
    return Array.isArray(hist) ? hist : [];
  }

  _render() {
    if (!this._hass || !this._config) return;
    const hass = this._hass;
    const key = getAccount(this._config);
    const acc = this._config.accounts.find((a) => a.key === key) || this._config.accounts[0];
    const hist = this._dailyOf(acc);

    // 月度视图：当年各月用电量
    if (this._mode === "month") { this._renderMonth(acc, hist); this._sig = this._signature(); return; }

    // 月份列表（从日数据里提取，倒序）
    const months = [...new Set(hist.map((r) => String(r.day).slice(0, 7)))].sort().reverse();
    if (!months.length) {
      this.shadowRoot.innerHTML = `
        <style>${BASE_CSS}</style>
        <div class="wrap">
          <div class="hd"><div class="name">${acc.name} 日用电趋势</div></div>
          <div class="panel" style="text-align:center;padding:24px 12px;color:var(--elec-muted)">
            暂无日用电数据<br><span style="font-size:12px">集成需要先完成一次数据更新</span>
          </div>
        </div>`;
      this._sig = this._signature();
      return;
    }
    if (!this._month || !months.includes(this._month)) this._month = months[0];

    const [yy, mm] = this._month.split("-").map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const byDay = {};
    const chargeByDay = {};
    const partsByDay = {};
    hist.forEach((r) => {
      const d = String(r.day);
      if (d.slice(0, 7) === this._month && r.usage !== null) {
        const dn = Number(d.slice(8, 10));
        byDay[dn] = Number(r.usage);
        if (r.charge !== null && r.charge !== undefined) chargeByDay[dn] = Number(r.charge);
        partsByDay[dn] = {
          tip: r.tip !== null && r.tip !== undefined ? Number(r.tip) : null,
          peak: r.peak !== null && r.peak !== undefined ? Number(r.peak) : null,
          flat: r.flat !== null && r.flat !== undefined ? Number(r.flat) : null,
          valley: r.valley !== null && r.valley !== undefined ? Number(r.valley) : null,
        };
      }
    });

    const values = [];
    for (let d = 1; d <= daysInMonth; d++) values.push({ day: d, v: byDay[d] ?? null });
    const known = values.filter((x) => x.v !== null);
    const total = known.reduce((s, x) => s + x.v, 0);
    const peak = known.length ? Math.max(...known.map((x) => x.v)) : 0;
    const maxY = peak > 0 ? Math.max(4, Math.ceil((peak * 1.12) / 4) * 4) : 8;

    // ---- HTML 柱状图（自适应宽度，文字不缩放） ----
    const H = 150; // 绘图区高度(px)
    const yTicks = [maxY, (maxY * 3) / 4, maxY / 2, maxY / 4, 0];

    const yAxis = yTicks
      .map((v) => `<span>${Math.round(v)}</span>`)
      .join("");

    const gridLines = [0, 25, 50, 75]
      .map((p) => `<div class="hline" style="top:${p}%"></div>`)
      .join("");

    const bars = values
      .map((item) => {
        if (item.v === null) return `<div class="bar empty"></div>`;
        const h = Math.max(2, (item.v / maxY) * H);
        const sel = this._selDay === item.day ? " sel" : "";
        return `<div class="bar${sel}" data-day="${item.day}" style="height:${h.toFixed(1)}px" title="${item.day}日 · ${fmt(item.v, 2)} 度"></div>`;
      })
      .join("");

    // 选中日详情
    const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    let dayInfo;
    if (this._selDay !== null && byDay[this._selDay] !== undefined) {
      const wd = WEEK[new Date(yy, mm - 1, this._selDay).getDay()];
      const chg = chargeByDay[this._selDay];
      const dayUsage = byDay[this._selDay];
      let chargeText = "";
      if (chg !== undefined) {
        chargeText = `<span class="d-sep">|</span>电费 <b>${fmt(chg, 2)}</b> 元`;
      } else if (this._config.estimateCharge !== false) {
        // 用年累计反推该日之前的累计量，再按阶梯分段计价
        const yearUsage = num(this._hass, sensorOf(acc, "current_year_usage"));
        let after = 0;
        if (yearUsage !== null) {
          hist.forEach((r) => {
            const d2 = String(r.day);
            if (d2.slice(0, 4) === String(yy) && r.usage !== null) {
              const dn2 = Number(d2.slice(8, 10));
              const mon2 = Number(d2.slice(5, 7));
              const passed = mon2 > mm || (mon2 === mm && dn2 > this._selDay);
              if (passed) after += Number(r.usage);
            }
          });
        }
        const cumBefore = yearUsage === null ? null : Math.max(0, yearUsage - after - dayUsage);
        const est = cumBefore === null
          ? dayUsage * (ladderOf(null) === 3 ? 0.838 : 0.588)
          : tierCost(cumBefore, dayUsage);
        chargeText = `<span class="d-sep">|</span>电费 <b>≈ ${fmt(est, 2)}</b> 元<span class="d-est">（估算）</span>`;
      }
      dayInfo = `<span class="d-date">${mm}月${this._selDay}日 ${wd}</span>
        <span class="d-sep">|</span>用电 <b>${fmt(dayUsage, 2)}</b> 度${chargeText}`;
    } else {
      dayInfo = `<span class="d-hint">点击柱子查看当天用电与分时段明细</span>`;
    }

    // 分时段明细（点击展开）
    let breakdown = "";
    if (this._detailDay !== null && this._detailDay === this._selDay) {
      const parts = partsByDay[this._selDay] || {};
      const order = [
        ["tip", "尖", "#e05e5e"],
        ["peak", "峰", "#e08a1e"],
        ["flat", "平", "#3b8fd9"],
        ["valley", "谷", "#35b06f"],
      ];
      const items = order.filter(([k]) => parts[k] !== null && parts[k] !== undefined && parts[k] > 0);
      if (items.length) {
        const sum = items.reduce((acc2, [k]) => acc2 + parts[k], 0);
        const segs = items
          .map(([k, , c]) => `<span style="flex:${parts[k]};background:${c}"></span>`)
          .join("");
        const legend = items
          .map(([k, label, c]) => `<span class="lg"><i style="background:${c}"></i>${label} <b>${fmt(parts[k], 2)}</b> 度</span>`)
          .join("");
        breakdown = `<div class="bd">
            <div class="bd-bar">${segs}</div>
            <div class="bd-legend">${legend}<span class="lg" style="opacity:.6">合计 ${fmt(sum, 2)} 度</span></div>
          </div>`;
      } else {
        breakdown = `<div class="bd-none">该日无分时（尖/峰/平/谷）数据</div>`;
      }
    }

    // 选中柱子上方的浮动标签
    let barTag = "";
    if (this._selDay !== null && byDay[this._selDay] !== undefined) {
      const idx = this._selDay - 1;
      const hSel = Math.max(2, (byDay[this._selDay] / maxY) * H);
      const leftPct = Math.min(88, Math.max(12, ((idx + 0.5) / daysInMonth) * 100));
      const topPx = Math.max(0, H - hSel - 22);
      barTag = `<div class="bartag" style="left:${leftPct.toFixed(1)}%;top:${topPx.toFixed(0)}px">${this._selDay}日 · ${fmt(byDay[this._selDay], 1)}度</div>`;
    }

    const tickDays = new Set([1, 5, 10, 15, 20, 25, daysInMonth]);
    const xAxis = values
      .map((item) => `<span>${tickDays.has(item.day) ? item.day : ""}</span>`)
      .join("");

    const options = months
      .map((m) => `<option value="${m}"${m === this._month ? " selected" : ""}>${m.replace("-", " 年 ")} 月</option>`)
      .join("");

    this.shadowRoot.innerHTML = `
      <style>${BASE_CSS}
        .selrow{display:flex;align-items:center;gap:8px;margin-top:12px;flex-wrap:wrap}
        select{appearance:none;-webkit-appearance:none;background:rgba(128,128,128,.18);color:var(--elec-text);
          border:none;border-radius:10px;padding:7px 26px 7px 10px;font-size:13px;
          font-family:inherit;cursor:pointer;
          background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);
          background-position:calc(100% - 14px) 14px,calc(100% - 9px) 14px;
          background-size:5px 5px,5px 5px;background-repeat:no-repeat}
        .kpi{font-size:13px;color:var(--elec-muted)}
        .kpi b{color:var(--elec-text);font-weight:700}
        .chart{display:flex;gap:6px;margin-top:14px;width:100%}
        .yaxis{display:flex;flex-direction:column;justify-content:space-between;height:${H}px;
          font-size:9px;line-height:1;color:var(--elec-muted);text-align:right;min-width:20px;flex-shrink:0}
        .plotwrap{flex:1;min-width:0}
        .plot{position:relative;height:${H}px;display:flex;align-items:flex-end;gap:2px}
        .hline{position:absolute;left:0;right:0;border-top:1px solid rgba(128,128,128,.18)}
        .bar{flex:1 1 0;min-width:0;background:var(--elec-accent);border-radius:3px 3px 0 0;opacity:.9}
        .bar.empty{visibility:hidden}
        .bar{cursor:pointer;transition:opacity .15s}
        .bar.sel{background:var(--elec-orange);opacity:1}
        .bartag{position:absolute;transform:translate(-50%,0);background:var(--elec-text);color:var(--elec-bg);
          font-size:11px;font-weight:700;line-height:1;padding:4px 7px;border-radius:7px;white-space:nowrap;
          z-index:4;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.25)}
        .dayinfo{margin-top:10px;font-size:13px;color:var(--elec-muted);line-height:1.5;min-height:20px}
        .dayinfo .d-date{color:var(--elec-text);font-weight:600}
        .dayinfo b{color:var(--elec-text);font-weight:700}
        .dayinfo .d-sep{opacity:.35;margin:0 6px}
        .dayinfo .d-hint{opacity:.55;font-size:12px}
        .dayinfo .d-est{opacity:.55;font-size:11px;margin-left:2px}
        .bd{margin-top:8px}
        .bd-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;gap:1px;background:rgba(128,128,128,.15)}
        .bd-bar span{display:block;height:100%}
        .bd-legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:7px;font-size:12px;color:var(--elec-muted)}
        .bd-legend .lg{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
        .bd-legend .lg i{width:7px;height:7px;border-radius:2px;display:inline-block}
        .bd-legend b{color:var(--elec-text)}
        .bd-none{margin-top:8px;font-size:12px;color:var(--elec-muted);opacity:.7}

        .xaxis{display:flex;gap:2px;margin-top:4px}
        .xaxis span{flex:1 1 0;min-width:0;text-align:center;font-size:9px;color:var(--elec-muted);overflow:hidden}
      </style>
      <div class="wrap">
        <div class="hd">
          <div>
            <div class="name">${acc.name} · 日用电</div>
            <div class="cap" style="margin-top:4px">${this._month} 每日用电量（度）</div>
          </div>
          <div class="right">
            <div class="money">${fmt(total)}<span class="unit">度</span></div>
            <div class="cap">本月累计</div>
          </div>
        </div>

        <div class="selrow">
          <select id="monthSel">${options}</select>
          <span class="kpi">峰值 <b>${fmt(peak, 1)}</b> 度 · 有数据 <b>${known.length}</b> 天</span>
        </div>

        <div class="chart">
          <div class="yaxis">${yAxis}</div>
          <div class="plotwrap">
            <div class="plot">${gridLines}${bars}${barTag}</div>
            <div class="xaxis">${xAxis}</div>
          </div>
        </div>
        <div class="dayinfo">${dayInfo}</div>
        ${breakdown}
      </div>`;

    const plot = this.shadowRoot.querySelector(".plot");

    plot.addEventListener("click", (e) => {
      const bar = e.target.closest && e.target.closest(".bar");
      if (!bar || bar.classList.contains("empty")) return;
      const day = Number(bar.dataset.day);
      if (this._selDay === day) {
        // 再点一次收起
        this._selDay = null;
        this._detailDay = null;
      } else {
        // 单击即选中并展开分时段
        this._selDay = day;
        this._detailDay = day;
      }
      this._render();
    });

    this.shadowRoot.getElementById("monthSel").addEventListener("change", (e) => {
      this._selDay = null;
      this._month = e.target.value;
      this._selDay = null;
      this._render();
    });

    this._sig = this._signature();
  }

  _renderMonth(acc, hist) {
    const hass = this._hass;
    const year = new Date().getFullYear();
    if (!hist || !hist.length) {
      this.shadowRoot.innerHTML = `
        <style>${BASE_CSS}</style>
        <div class="wrap">
          <div class="hd">
            <div>
              <div class="name">${acc.name} · 月用电</div>
              <div class="cap" style="margin-top:4px">${year}年 每月用电量（度）</div>
            </div>
          </div>
          <div class="panel" style="text-align:center;padding:24px 12px;color:var(--elec-muted)">
            暂无本年度用电数据<br><span style="font-size:12px">集成需要先完成一次数据更新</span>
          </div>
        </div>`;
      this._sig = this._signature();
      return;
    }
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    // 按 (年, 月) 聚合日数据，得到当年各月用电量
    const byMonth = {};
    hist.forEach((r) => {
      const d = String(r.day);
      if (d.slice(0, 4) === String(year) && r.usage !== null && r.usage !== undefined) {
        const mo = Number(d.slice(5, 7));
        if (!byMonth[mo]) {
          byMonth[mo] = { usage: 0, charge: 0, tip: 0, peak: 0, flat: 0, valley: 0, hasCharge: false, hasParts: false };
        }
        const x = byMonth[mo];
        x.usage += Number(r.usage);
        if (r.charge !== null && r.charge !== undefined) { x.charge += Number(r.charge); x.hasCharge = true; }
        ["tip", "peak", "flat", "valley"].forEach((k) => {
          if (r[k] !== null && r[k] !== undefined) { x[k] += Number(r[k]); x.hasParts = true; }
        });
      }
    });

    const yearUsage = num(hass, sensorOf(acc, "current_year_usage"));
    const values = months.map((m) => ({ month: m, v: byMonth[m] ? byMonth[m].usage : null }));
    const known = values.filter((x) => x.v !== null);
    const total = known.reduce((s, x) => s + x.v, 0);
    const peak = known.length ? Math.max(...known.map((x) => x.v)) : 0;
    const maxY = peak > 0 ? Math.max(20, Math.ceil((peak * 1.12) / 20) * 20) : 40;

    const H = 150; // 绘图区高度(px)
    const yTicks = [maxY, (maxY * 3) / 4, maxY / 2, maxY / 4, 0];
    const yAxis = yTicks.map((v) => `<span>${Math.round(v)}</span>`).join("");
    const gridLines = [0, 25, 50, 75].map((p) => `<div class="hline" style="top:${p}%"></div>`).join("");

    const bars = values.map((item) => {
      if (item.v === null) return `<div class="bar empty"></div>`;
      const h = Math.max(2, (item.v / maxY) * H);
      const sel = this._selMonth === item.month ? " sel" : "";
      return `<div class="bar${sel}" data-month="${item.month}" style="height:${h.toFixed(1)}px" title="${item.month}月 · ${fmt(item.v, 2)} 度"></div>`;
    }).join("");

    // 选中月详情
    let monthInfo;
    if (this._selMonth !== null && byMonth[this._selMonth]) {
      const x = byMonth[this._selMonth];
      const mo = this._selMonth;
      let chargeText = "";
      if (x.hasCharge) {
        chargeText = `<span class="d-sep">|</span>电费 <b>${fmt(x.charge, 2)}</b> 元`;
      } else if (this._config.estimateCharge !== false) {
        // 用年累计反推该月之前的累计量，再按阶梯分段计价
        let after = 0;
        for (let m2 = mo + 1; m2 <= 12; m2++) if (byMonth[m2]) after += byMonth[m2].usage;
        const cumBefore = yearUsage === null ? null : Math.max(0, yearUsage - after - x.usage);
        const est = cumBefore === null ? x.usage * 0.588 : tierCost(cumBefore, x.usage);
        chargeText = `<span class="d-sep">|</span>电费 <b>≈ ${fmt(est, 2)}</b> 元<span class="d-est">（估算）</span>`;
      }
      monthInfo = `<span class="d-date">${mo}月</span><span class="d-sep">|</span>用电 <b>${fmt(x.usage, 2)}</b> 度${chargeText}`;
    } else {
      monthInfo = `<span class="d-hint">点击柱子查看当月用电</span>`;
    }

    // 分时段明细（点击展开）
    let breakdown = "";
    if (this._detailMonth !== null && this._detailMonth === this._selMonth && byMonth[this._selMonth]) {
      const x = byMonth[this._selMonth];
      const order = [
        ["tip", "尖", "#e05e5e"],
        ["peak", "峰", "#e08a1e"],
        ["flat", "平", "#3b8fd9"],
        ["valley", "谷", "#35b06f"],
      ];
      const items = order.filter(([k]) => x[k] > 0);
      if (items.length) {
        const sum = items.reduce((a, [k]) => a + x[k], 0);
        const segs = items.map(([k, , c]) => `<span style="flex:${x[k]};background:${c}"></span>`).join("");
        const legend = items.map(([k, label, c]) => `<span class="lg"><i style="background:${c}"></i>${label} <b>${fmt(x[k], 2)}</b> 度</span>`).join("");
        breakdown = `<div class="bd">
            <div class="bd-bar">${segs}</div>
            <div class="bd-legend">${legend}<span class="lg" style="opacity:.6">合计 ${fmt(sum, 2)} 度</span></div>
          </div>`;
      } else {
        breakdown = `<div class="bd-none">该月无分时（尖/峰/平/谷）数据</div>`;
      }
    }

    // 选中柱子上方的浮动标签
    let barTag = "";
    if (this._selMonth !== null && byMonth[this._selMonth]) {
      const idx = this._selMonth - 1;
      const hSel = Math.max(2, (byMonth[this._selMonth].usage / maxY) * H);
      const leftPct = Math.min(92, Math.max(8, ((idx + 0.5) / 12) * 100));
      const topPx = Math.max(0, H - hSel - 22);
      barTag = `<div class="bartag" style="left:${leftPct.toFixed(1)}%;top:${topPx.toFixed(0)}px">${this._selMonth}月 · ${fmt(byMonth[this._selMonth].usage, 1)}度</div>`;
    }

    const xAxis = months.map((m) => `<span>${m}</span>`).join("");

    this.shadowRoot.innerHTML = `
      <style>${BASE_CSS}
        .selrow{display:flex;align-items:center;gap:8px;margin-top:12px;flex-wrap:wrap}
        .kpi{font-size:13px;color:var(--elec-muted)}
        .kpi b{color:var(--elec-text);font-weight:700}
        .chart{display:flex;gap:6px;margin-top:14px;width:100%}
        .yaxis{display:flex;flex-direction:column;justify-content:space-between;height:${H}px;
          font-size:9px;line-height:1;color:var(--elec-muted);text-align:right;min-width:20px;flex-shrink:0}
        .plotwrap{flex:1;min-width:0}
        .plot{position:relative;height:${H}px;display:flex;align-items:flex-end;gap:2px}
        .hline{position:absolute;left:0;right:0;border-top:1px solid rgba(128,128,128,.18)}
        .bar{flex:1 1 0;min-width:0;background:var(--elec-accent);border-radius:3px 3px 0 0;opacity:.9}
        .bar.empty{visibility:hidden}
        .bar{cursor:pointer;transition:opacity .15s}
        .bar.sel{background:var(--elec-orange);opacity:1}
        .bartag{position:absolute;transform:translate(-50%,0);background:var(--elec-text);color:var(--elec-bg);
          font-size:11px;font-weight:700;line-height:1;padding:4px 7px;border-radius:7px;white-space:nowrap;
          z-index:4;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.25)}
        .dayinfo{margin-top:10px;font-size:13px;color:var(--elec-muted);line-height:1.5;min-height:20px}
        .dayinfo .d-date{color:var(--elec-text);font-weight:600}
        .dayinfo b{color:var(--elec-text);font-weight:700}
        .dayinfo .d-sep{opacity:.35;margin:0 6px}
        .dayinfo .d-hint{opacity:.55;font-size:12px}
        .dayinfo .d-est{opacity:.55;font-size:11px;margin-left:2px}
        .bd{margin-top:8px}
        .bd-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;gap:1px;background:rgba(128,128,128,.15)}
        .bd-bar span{display:block;height:100%}
        .bd-legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:7px;font-size:12px;color:var(--elec-muted)}
        .bd-legend .lg{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
        .bd-legend .lg i{width:7px;height:7px;border-radius:2px;display:inline-block}
        .bd-legend b{color:var(--elec-text)}
        .bd-none{margin-top:8px;font-size:12px;color:var(--elec-muted);opacity:.7}
        .xaxis{display:flex;gap:2px;margin-top:4px}
        .xaxis span{flex:1 1 0;min-width:0;text-align:center;font-size:9px;color:var(--elec-muted);overflow:hidden}
      </style>
      <div class="wrap">
        <div class="hd">
          <div>
            <div class="name">${acc.name} · 月用电</div>
            <div class="cap" style="margin-top:4px">${year}年 每月用电量（度）</div>
          </div>
          <div class="right">
            <div class="money">${fmt(yearUsage)}<span class="unit">度</span></div>
            <div class="cap">本年累计</div>
          </div>
        </div>

        <div class="chart">
          <div class="yaxis">${yAxis}</div>
          <div class="plotwrap">
            <div class="plot">${gridLines}${bars}${barTag}</div>
            <div class="xaxis">${xAxis}</div>
          </div>
        </div>
        <div class="dayinfo">${monthInfo}</div>
        ${breakdown}
      </div>`;

    const plot = this.shadowRoot.querySelector(".plot");
    if (plot) {
      plot.addEventListener("click", (e) => {
        const bar = e.target.closest && e.target.closest(".bar");
        if (!bar || bar.classList.contains("empty")) return;
        const mo = Number(bar.dataset.month);
        if (this._selMonth === mo) {
          this._selMonth = null;
          this._detailMonth = null;
        } else {
          this._selMonth = mo;
          this._detailMonth = mo;
        }
        this._render();
      });
    }
  }
}

console.info("[elec-dashboard] " + VERSION + " loaded");
customElements.define("elec-summary-card", ElecSummaryCard);
customElements.define("elec-chart-card", ElecChartCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "elec-summary-card",
  name: "国家电网电费概览",
  description: "多户号电费卡片，支持年/月/日切换",
});
window.customCards.push({
  type: "elec-chart-card",
  name: "国家电网用电柱状图",
  description: "日用电 / 月用电柱状趋势图：跟随概览卡片的户号与年/月/日联动，点击柱子查看明细",
});
