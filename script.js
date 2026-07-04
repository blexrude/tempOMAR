/* Creative Wood Products — small progressive-enhancement helpers */
(function () {
  "use strict";

  // Current year in footer
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile nav toggle
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("nav-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    // Close menu when a link is tapped
    menu.addEventListener("click", function (e) {
      if (e.target.tagName === "A" && menu.classList.contains("open")) {
        menu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Contact form — client-side validation + friendly demo response.
  // Wire this to a real backend / form service (see README.md).
  var form = document.getElementById("quoteForm");
  var status = document.getElementById("formStatus");
  if (form && status) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (!name || !emailOk) {
        status.textContent = "Please enter your name and a valid email address.";
        status.className = "form-status err";
        return;
      }

      status.textContent =
        "Thanks, " + name + "! Your request was received (demo). We'll be in touch soon.";
      status.className = "form-status ok";
      form.reset();
    });
  }
})();
