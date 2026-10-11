(function () {
  function getContainer() {
    let c = document.getElementById('toastContainer');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toastContainer';
      c.className = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  function iconFor(tipo) {
    if (tipo === 'success') return '\u2713';
    if (tipo === 'error') return '\u2715';
    if (tipo === 'warning') return '!';
    return 'i';
  }

  window.toast = function (mensaje, tipo, duracion) {
    tipo = tipo || 'info';
    const container = getContainer();
    const el = document.createElement('div');
    el.className = 'toast toast-' + tipo;
    el.innerHTML = '<span class="toast-icon">' + iconFor(tipo) + '</span><span class="toast-msg"></span>';
    el.querySelector('.toast-msg').textContent = mensaje;
    el.addEventListener('click', () => remove(el));
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const t = setTimeout(() => remove(el), duracion || 3200);
    el._timer = t;
    return el;
  };

  function remove(el) {
    if (!el || !el.parentNode) return;
    clearTimeout(el._timer);
    el.classList.remove('show');
    setTimeout(() => el.remove(), 260);
  }

  window.toastSuccess = m => window.toast(m, 'success');
  window.toastError = m => window.toast(m, 'error');
  window.toastWarning = m => window.toast(m, 'warning');
  window.toastInfo = m => window.toast(m, 'info');
})();
