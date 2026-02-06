/* ============================================================
   OpenSentinel Landing Page - Interactions
   ============================================================ */

// --- Scroll animations ---
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );

  document.querySelectorAll("[data-animate]").forEach((el) => {
    observer.observe(el);
  });
}

// --- Mobile nav toggle ---
function initMobileNav() {
  const toggle = document.getElementById("nav-toggle");
  const links = document.getElementById("nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", () => {
      links.classList.toggle("active");
      toggle.classList.toggle("active");
    });

    // Close on link click
    links.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        links.classList.remove("active");
        toggle.classList.remove("active");
      });
    });
  }
}

// --- Nav background on scroll ---
function initNavScroll() {
  const nav = document.getElementById("nav");
  if (!nav) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 20) {
      nav.style.borderBottomColor = "rgba(255,255,255,0.08)";
    } else {
      nav.style.borderBottomColor = "rgba(255,255,255,0.06)";
    }
  });
}

// --- Copy install command ---
function copyInstall(btn) {
  const command = "npm install opensentinel";
  navigator.clipboard.writeText(command).then(() => {
    btn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 8l3 3 5-5" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    setTimeout(() => {
      btn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M3 11V3a2 2 0 012-2h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    }, 2000);
  });
}

// --- Terminal typing animation ---
function initTerminal() {
  const commandEl = document.getElementById("typed-command");
  const outputEl = document.getElementById("terminal-output");
  const cursorEl = document.querySelector(".terminal-cursor");

  if (!commandEl || !outputEl) return;

  const sequences = [
    {
      command: "npx opensentinel",
      output: [
        '<span class="t-green">  OpenSentinel v2.0.0</span>',
        '<span class="t-dim">  ────────────────────────────────────</span>',
        '<span class="t-cyan">  &#x2713;</span> Claude Brain connected',
        '<span class="t-cyan">  &#x2713;</span> PostgreSQL + pgvector ready',
        '<span class="t-cyan">  &#x2713;</span> Redis queue running',
        '<span class="t-cyan">  &#x2713;</span> Telegram bot online',
        '<span class="t-cyan">  &#x2713;</span> Discord bot online',
        '<span class="t-cyan">  &#x2713;</span> Web dashboard on :8030',
        '<span class="t-cyan">  &#x2713;</span> 4 sub-agents ready',
        '<span class="t-cyan">  &#x2713;</span> 30 tools loaded',
        "",
        '<span class="t-green">  Ready.</span> <span class="t-dim">Listening on all channels...</span>',
      ],
    },
    {
      command: 'import { chat } from "opensentinel"',
      output: [
        '<span class="t-dim">  // Use as a library in your own app</span>',
        "",
        '<span class="t-white">  const response = await chat([</span>',
        '<span class="t-white">    { role: "user", content: "Analyze Q4 sales" }</span>',
        '<span class="t-white">  ]);</span>',
        "",
        '<span class="t-green">  &#x2713;</span> Research Agent: gathering data...',
        '<span class="t-green">  &#x2713;</span> Analysis Agent: processing...',
        '<span class="t-green">  &#x2713;</span> Writing Agent: drafting report...',
        '<span class="t-cyan">  &#x2713;</span> Memory: stored 12 new facts',
        "",
        '<span class="t-green">  Done.</span> <span class="t-dim">Report saved to /output/q4-analysis.pdf</span>',
      ],
    },
  ];

  let seqIndex = 0;

  async function typeText(el, text, speed = 40) {
    for (let i = 0; i < text.length; i++) {
      el.textContent += text[i];
      await sleep(speed + Math.random() * 20);
    }
  }

  async function showOutput(lines) {
    for (const line of lines) {
      const div = document.createElement("div");
      div.innerHTML = line;
      outputEl.appendChild(div);
      await sleep(80);
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function runSequence() {
    const seq = sequences[seqIndex % sequences.length];

    // Clear
    commandEl.textContent = "";
    outputEl.innerHTML = "";
    if (cursorEl) cursorEl.style.display = "inline";

    // Type command
    await typeText(commandEl, seq.command);
    if (cursorEl) cursorEl.style.display = "none";
    await sleep(400);

    // Show output
    await showOutput(seq.output);

    // Wait then repeat
    await sleep(4000);
    seqIndex++;
    runSequence();
  }

  // Start after a short delay
  setTimeout(runSequence, 800);
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  initScrollAnimations();
  initMobileNav();
  initNavScroll();
  initTerminal();
});
