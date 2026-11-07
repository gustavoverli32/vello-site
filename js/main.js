/* Vello Solutions — comportamento do site (JavaScript puro, sem dependências). */

const VELLO_CONFIG = {
  companyName: "Vello Solutions",
  contactEmail: "",      // ex.: "contato@vellosolutions.com.br" — vazio esconde os links de e-mail
  whatsappNumber: "",    // ex.: "5522999999999" — vazio desativa os links de WhatsApp
  linkedinUrl: "",
  formEndpoint: "https://qjdvrqlcblkynheitkuk.supabase.co/functions/v1/vello-leads/intake",
  webhookUrl: "",        // opcional: n8n / Make / Zapier
  analyticsId: "vello-first-party",       // opcional: só com isso preenchido o aviso de cookies aparece
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function track(eventName, data = {}) {
  if (!VELLO_CONFIG.analyticsId) return;
  let consent = null;
  try { consent = localStorage.getItem("vello_cookie_consent"); } catch (e) { /* storage indisponível */ }
  if (consent !== "accepted") return;
  if (eventName === "submit_contact_form") window.dispatchEvent(new Event("vello:conversion"));
}

function waLink(message) {
  if (!VELLO_CONFIG.whatsappNumber) return null;
  return "https://wa.me/" + VELLO_CONFIG.whatsappNumber + "?text=" + encodeURIComponent(message);
}

document.addEventListener("DOMContentLoaded", () => {
  initHeader();
  initNav();
  initReveal();
  initHeroCanvas();
  initConsole();
  initAudit();
  initFaq();
  initForm();
  initContactLinks();
  initCookies();
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
});

/* ---------------------------------------------------------------------- */
/* Header: fundo ao rolar e recolhimento ao descer                         */
/* ---------------------------------------------------------------------- */
function initHeader() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const bar = document.querySelector(".utility-bar");
  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    const offset = bar ? bar.offsetHeight : 0;
    const past = y > offset;
    header.classList.toggle("is-fixed", past);
    header.classList.toggle("is-scrolled", y > offset + 8);
    const navOpen = document.body.classList.contains("nav-open");
    if (!navOpen && y > 600 && y > lastY + 4) header.classList.add("is-hidden");
    else if (y < lastY - 4 || y < 600) header.classList.remove("is-hidden");
    lastY = y;
    ticking = false;
  };
  update();
  window.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
}

/* ---------------------------------------------------------------------- */
/* Menu mobile                                                             */
/* ---------------------------------------------------------------------- */
function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.getElementById("nav-links");
  if (!toggle || !links) return;
  const setOpen = (open) => {
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  };
  toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("nav-open")));
  links.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  window.matchMedia("(min-width: 961px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });
}

/* ---------------------------------------------------------------------- */
/* Revelação ao rolar, com escalonamento automático em grupos              */
/* ---------------------------------------------------------------------- */
function initReveal() {
  document.querySelectorAll("[data-reveal-group]").forEach((group) => {
    group.querySelectorAll(":scope > [data-reveal]").forEach((el, i) => el.style.setProperty("--i", i));
  });
  const targets = document.querySelectorAll("[data-reveal], [data-observe], [data-split]");
  if (!("IntersectionObserver" in window) || prefersReducedMotion) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      entry.target.dispatchEvent(new CustomEvent("reveal"));
      io.unobserve(entry.target);
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  targets.forEach((el) => io.observe(el));
}

/* ---------------------------------------------------------------------- */
/* Hero: fluxos de dados em canvas (linhas e pulsos que convergem)        */
/* ---------------------------------------------------------------------- */
function initHeroCanvas() {
  document.querySelectorAll("canvas.atmos").forEach((canvas) => initAtmos(canvas));
}

/* Campo atmosférico: partículas que sobem como brasas ("fire") ou
   derivam devagar ("forest"), com linhas finas de dados cruzando a cena. */
function initAtmos(canvas) {
  if (!canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const mode = canvas.dataset.mode || "fire";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const palette = mode === "forest"
    ? ["111, 211, 165", "243, 240, 234", "255, 140, 90"]
    : ["255, 91, 31", "255, 166, 77", "255, 214, 170"];
  let w = 0, h = 0, parts = [], streams = [], running = true, raf = null, t = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const spawn = (initial) => ({
    x: rand(0, w),
    y: initial ? rand(0, h) : h + rand(0, 40),
    r: Math.random() < 0.08 ? rand(1.8, 3) : rand(0.5, 1.6),
    vy: mode === "forest" ? rand(0.08, 0.3) : rand(0.25, 1.1),
    sway: rand(0.2, 1.2),
    phase: rand(0, Math.PI * 2),
    c: palette[Math.floor(Math.random() * palette.length)],
    life: rand(0.5, 1),
  });
  const spawnStream = () => ({ y: rand(h * 0.15, h * 0.95), x: -200, len: rand(80, 260), v: rand(2, 5), a: rand(0.15, 0.4) });

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    w = rect.width; h = rect.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(160, (w * h) / 9000));
    parts = Array.from({ length: count }, () => spawn(true));
    streams = [];
  };

  const frame = () => {
    t += 1;
    ctx.clearRect(0, 0, w, h);
    // linhas de dados
    if (!prefersReducedMotion && Math.random() < 0.025 && streams.length < 5) streams.push(spawnStream());
    streams = streams.filter((s) => s.x - s.len < w);
    streams.forEach((s) => {
      s.x += s.v;
      const g = ctx.createLinearGradient(s.x - s.len, s.y, s.x, s.y);
      g.addColorStop(0, `rgba(${palette[1]}, 0)`);
      g.addColorStop(1, `rgba(${palette[1]}, ${s.a})`);
      ctx.strokeStyle = g; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s.x - s.len, s.y); ctx.lineTo(s.x, s.y); ctx.stroke();
    });
    // partículas
    ctx.globalCompositeOperation = "lighter";
    parts.forEach((p, i) => {
      if (!prefersReducedMotion) {
        p.y -= p.vy;
        p.x += Math.sin(t * 0.01 * p.sway + p.phase) * 0.35;
      }
      const fade = Math.max(0, Math.min(1, p.y / h)) * p.life; // apaga ao subir
      const flicker = 0.75 + Math.sin(t * 0.05 + p.phase) * 0.25;
      const a = fade * flicker;
      if (p.r > 1.7) {
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        glow.addColorStop(0, `rgba(${p.c}, ${0.5 * a})`);
        glow.addColorStop(1, `rgba(${p.c}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = `rgba(${p.c}, ${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      if (p.y < -10) parts[i] = spawn(false);
    });
    ctx.globalCompositeOperation = "source-over";
    if (running && !prefersReducedMotion) raf = requestAnimationFrame(frame);
  };

  resize();
  frame();
  let timer;
  window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(() => { resize(); if (prefersReducedMotion) frame(); }, 150); });
  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) { running = true; raf = requestAnimationFrame(frame); }
      if (!entry.isIntersecting) { running = false; cancelAnimationFrame(raf); }
    }).observe(canvas);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!running && !prefersReducedMotion) { running = true; raf = requestAnimationFrame(frame); }
  });
}

/* ---------------------------------------------------------------------- */
/* Hero: console de conciliação bancária em execução                       */
/* ---------------------------------------------------------------------- */
function initConsole() {
  const consoleEl = document.querySelector("[data-console]");
  if (!consoleEl) return;
  const rows = Array.from(consoleEl.querySelectorAll(".console-row"));
  const matchedEl = consoleEl.querySelector("[data-stat='matched']");
  const flaggedEl = consoleEl.querySelector("[data-stat='flagged']");
  const timeEl = consoleEl.querySelector("[data-stat='time']");
  const bar = consoleEl.querySelector(".console-progress > i");
  const baseMatched = 1284;

  const setStatus = (row, kind) => {
    const s = row.querySelector(".status");
    s.className = "status status--" + kind;
    s.textContent = kind === "ok" ? "Conciliado" : kind === "warn" ? "Revisão humana" : "Na fila";
  };

  if (prefersReducedMotion) {
    rows.forEach((r) => setStatus(r, r.dataset.result === "warn" ? "warn" : "ok"));
    if (bar) bar.style.width = "100%";
    return;
  }

  let cycle = 0;
  const run = () => {
    rows.forEach((r) => setStatus(r, "pending"));
    if (bar) bar.style.width = "0%";
    let matched = baseMatched + cycle * rows.length, flagged = 0;
    rows.forEach((row, i) => {
      setTimeout(() => {
        row.classList.remove("is-scanning");
        void row.offsetWidth;
        row.classList.add("is-scanning");
        setTimeout(() => {
          const warn = row.dataset.result === "warn";
          setStatus(row, warn ? "warn" : "ok");
          warn ? flagged++ : matched++;
          if (matchedEl) matchedEl.textContent = matched.toLocaleString("pt-BR");
          if (flaggedEl) flaggedEl.textContent = String(flagged);
          if (timeEl) timeEl.textContent = (1.2 + i * 0.4).toFixed(1).replace(".", ",") + " s";
          if (bar) bar.style.width = ((i + 1) / rows.length) * 100 + "%";
        }, 650);
      }, 900 + i * 950);
    });
    cycle++;
    setTimeout(run, 900 + rows.length * 950 + 3200);
  };
  run();
}

/* ---------------------------------------------------------------------- */
/* Trilha de auditoria: linhas aparecem quando o bloco entra na tela       */
/* ---------------------------------------------------------------------- */
function initAudit() {
  const audit = document.querySelector("[data-audit]");
  if (!audit) return;
  const lines = audit.querySelectorAll(".audit-line");
  const play = () => lines.forEach((line, i) => setTimeout(() => line.classList.add("is-in"), prefersReducedMotion ? 0 : i * 420));
  if (audit.classList.contains("is-visible")) play();
  else audit.addEventListener("reveal", play, { once: true });
}

/* ---------------------------------------------------------------------- */
/* FAQ                                                                     */
/* ---------------------------------------------------------------------- */
function initFaq() {
  document.querySelectorAll(".faq-q").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const open = !item.classList.contains("is-open");
      item.parentElement.querySelectorAll(".faq-item.is-open").forEach((o) => {
        o.classList.remove("is-open");
        o.querySelector(".faq-q").setAttribute("aria-expanded", "false");
      });
      item.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      if (open) track("faq_open", { question: btn.textContent.trim() });
    });
  });
}

/* ---------------------------------------------------------------------- */
/* Formulário de diagnóstico                                               */
/* ---------------------------------------------------------------------- */
function initForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const startedAt = Date.now();
  const success = document.getElementById("form-success");
  const fallback = document.getElementById("form-fallback");
  const submitBtn = form.querySelector("[type='submit']");
  let submissionId = crypto.randomUUID();
  let sending = false;
  const clean = (v) => String(v || "").replace(/[<>]/g, "").trim();

  const setError = (name, msg) => {
    const field = form.querySelector(`[name="${name}"]`);
    const wrap = field && field.closest(".field, .check");
    const err = document.getElementById(`err-${name}`);
    if (err) err.textContent = msg || "";
    if (wrap) wrap.classList.toggle("has-error", Boolean(msg));
    if (field) field.setAttribute("aria-invalid", msg ? "true" : "false");
  };

  const validate = () => {
    const errors = {};
    const v = (n) => clean(form.elements[n] && form.elements[n].value);
    if (!v("nome")) errors.nome = "Informe seu nome.";
    if (!v("empresa")) errors.empresa = "Informe o nome da empresa.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("email"))) errors.email = "Informe um e-mail válido.";
    if (v("telefone").replace(/\D/g, "").length < 10) errors.telefone = "Informe um telefone com DDD.";
    if (!form.elements.consent.checked) errors.consent = "É necessário concordar com a Política de Privacidade.";
    ["nome", "empresa", "email", "telefone", "consent"].forEach((n) => setError(n, errors[n]));
    return errors;
  };

  form.querySelectorAll("input, select, textarea").forEach((el) => {
    el.addEventListener("blur", () => { if (el.getAttribute("aria-invalid") === "true") validate(); });
  });

  const show = (el) => {
    form.hidden = true;
    if (el) { el.hidden = false; el.focus({ preventScroll: true }); el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" }); }
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    if (form.elements.hp_check && form.elements.hp_check.value) return; // bot
    const errors = validate();
    const first = Object.keys(errors)[0];
    if (first) { form.elements[first].focus(); return; }
    if (Date.now() - startedAt < 2500) return;

    const data = Object.fromEntries(new FormData(form));
    data.submission_id = submissionId;
    data.consent = form.elements.consent.checked;
    const params = new URLSearchParams(location.search);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(key => { if(params.has(key)) data[key] = params.get(key); });
    sending = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";
    setError("consent", "");
    try {
      const response = await fetch(VELLO_CONFIG.formEndpoint, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
      const result = await response.json();
      if (!response.ok || !result.ok) {
        if (result.fields) Object.entries(result.fields).forEach(([name,message]) => setError(name,message));
        throw new Error(result.error || "Não foi possível enviar agora. Tente novamente em instantes.");
      }
      track("submit_contact_form");
      form.reset();
      submissionId = crypto.randomUUID();
      show(success);
    } catch (error) {
      setError("consent", error.name === "TimeoutError" || error.name === "TypeError" ? "Não foi possível confirmar o envio. Seus dados continuam preenchidos; tente novamente." : error.message);
    } finally {
      sending = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Solicitar diagnóstico";
    }
  });
}

/* Links de e-mail / WhatsApp só aparecem quando configurados */
function initContactLinks() {
  const hide = (el) => { const li = el.closest("li"); (li || el).hidden = true; };
  document.querySelectorAll("[data-email]").forEach((el) => {
    if (!VELLO_CONFIG.contactEmail) { hide(el); return; }
    el.href = "mailto:" + VELLO_CONFIG.contactEmail;
    if (!el.dataset.keepText) el.textContent = VELLO_CONFIG.contactEmail;
  });
  document.querySelectorAll("[data-wa]").forEach((el) => {
    const link = waLink(el.dataset.wa || "Olá, Vello Solutions. Gostaria de conversar sobre automação de processos.");
    if (!link) { hide(el); return; }
    el.href = link; el.target = "_blank"; el.rel = "noopener";
  });
  document.querySelectorAll("[data-linkedin]").forEach((el) => {
    if (!VELLO_CONFIG.linkedinUrl) { hide(el); return; }
    el.href = VELLO_CONFIG.linkedinUrl; el.target = "_blank"; el.rel = "noopener";
  });
}

/* ---------------------------------------------------------------------- */
/* Aviso de cookies (só existe se houver ferramenta de análise)           */
/* ---------------------------------------------------------------------- */
function initCookies() {
  import('./analytics.js?v=20261107').catch(() => {});
}
