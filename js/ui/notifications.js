/**
 * notifications.js — Toast notification system
 */
const Notifications = (() => {
  const container = () => document.getElementById('toast-container');
  let toastCount = 0;

  const icons = {
    success: '✓',
    warning: '⚠',
    error: '✕',
    info: 'ℹ'
  };

  /**
   * Show a toast notification
   * @param {string} title
   * @param {string} message
   * @param {'success'|'warning'|'error'|'info'} type
   * @param {number} duration - ms before auto-dismiss (0 = no auto)
   */
  function show(title, message, type = 'info', duration = 4000) {
    const id = `toast-${++toastCount}`;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = id;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type]}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" aria-label="Dismiss notification" onclick="Notifications.dismiss('${id}')">✕</button>
    `;
    container().appendChild(toast);

    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }

    return id;
  }

  function dismiss(id) {
    const toast = document.getElementById(id);
    if (!toast) return;
    toast.classList.add('dismissing');
    setTimeout(() => toast.remove(), 300);
  }

  function success(title, message, duration) {
    return show(title, message, 'success', duration);
  }

  function warning(title, message, duration) {
    return show(title, message, 'warning', duration);
  }

  function error(title, message, duration) {
    return show(title, message, 'error', duration);
  }

  function info(title, message, duration) {
    return show(title, message, 'info', duration);
  }

  return { show, dismiss, success, warning, error, info };
})();
