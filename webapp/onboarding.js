/**
 * Onboarding — 2 шага, показ один раз
 * localStorage: onboarding_done
 * Автоскрытие через 5 секунд
 * Fix: Also check for Telegram context — skip onboarding outside Telegram
 */
(function() {
  'use strict';

  // Don't show onboarding if already completed
  if (localStorage.getItem('onboarding_done')) return;

  // Don't show onboarding outside Telegram — the app won't work anyway
  var tg = window.Telegram && window.Telegram.WebApp;
  if (!tg || !tg.initDataUnsafe || !tg.initDataUnsafe.user) return;

  var steps = [
    {
      icon: '\ud83c\udfb5',
      title: '\u0417\u0430\u0433\u0440\u0443\u0437\u0438 \u043c\u0443\u0437\u044b\u043a\u0443',
      text: '\u041d\u0430\u0436\u043c\u0438 \u00ab\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0442\u0440\u0435\u043a\u00bb \u0438\u043b\u0438 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439 \u043f\u043e\u0438\u0441\u043a, \u0447\u0442\u043e\u0431\u044b \u043d\u0430\u0439\u0442\u0438 \u0438 \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0442\u0440\u0435\u043a\u0438 \u0432 \u0441\u0432\u043e\u044e \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0443.'
    },
    {
      icon: '\ud83d\udc46',
      title: '\u0423\u043f\u0440\u0430\u0432\u043b\u044f\u0439 \u0436\u0435\u0441\u0442\u0430\u043c\u0438',
      text: '\u0421\u0432\u0430\u0439\u043f \u0432\u043f\u0440\u0430\u0432\u043e \u2014 \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0432 \u043e\u0447\u0435\u0440\u0435\u0434\u044c. \u0421\u0432\u0430\u0439\u043f \u0432\u043b\u0435\u0432\u043e \u2014 \u0443\u0434\u0430\u043b\u0438\u0442\u044c. \u0422\u0430\u043f \u043d\u0430 \u043c\u0438\u043d\u0438-\u043f\u043b\u0435\u0435\u0440 \u2014 \u0440\u0430\u0441\u043a\u0440\u044b\u0442\u044c \u043f\u043b\u0435\u0435\u0440.'
    }
  ];

  var currentStep = 0;
  var autoHideTimer = null;

  // С\u043e\u0437\u0434\u0430\u043d\u0438\u0435 DOM
  var overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', '\u041e\u043d\u0431\u043e\u0440\u0434\u0438\u043d\u0433');

  function render() {
    var step = steps[currentStep];
    var isLast = currentStep === steps.length - 1;

    overlay.innerHTML =
      '<div class="onboarding-card">' +
      '<div class="onboarding-icon">' + step.icon + '</div>' +
      '<div class="onboarding-title">' + step.title + '</div>' +
      '<div class="onboarding-text">' + step.text + '</div>' +
      '<div class="onboarding-dots">' +
      steps.map(function(_, i) {
        return '<div class="onboarding-dot' +
          (i === currentStep ? ' active' : '') + '"></div>';
      }).join('') +
      '</div>' +
      '<button class="onboarding-btn" id="onboardingBtn">' +
      (isLast ? '\u041f\u043e\u043d\u044f\u0442\u043d\u043e' : '\u0414\u0430\u043b\u044c\u0448\u0435') +
      '</button></div>';

    document.getElementById('onboardingBtn').addEventListener('click', next);
  }

  function next() {
    clearTimeout(autoHideTimer);
    if (currentStep < steps.length - 1) {
      currentStep++;
      render();
      startAutoHide();
    } else {
      close();
    }
  }

  function close() {
    clearTimeout(autoHideTimer);
    overlay.classList.remove('visible');
    localStorage.setItem('onboarding_done', '1');
    setTimeout(function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 400);
  }

  function startAutoHide() {
    clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(function() {
      if (currentStep < steps.length - 1) {
        next();
      } else {
        close();
      }
    }, 5000);
  }

  // И\u043d\u0438\u0446\u0438\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f
  document.body.appendChild(overlay);
  render();
  requestAnimationFrame(function() {
    overlay.classList.add('visible');
  });
  startAutoHide();

  // \u041a\u043b\u0438\u043a \u043d\u0430 overlay \u0437\u0430\u043a\u0440\u044b\u0432\u0430\u0435\u0442
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) close();
  });

  window.Onboarding = { close: close };
})();
