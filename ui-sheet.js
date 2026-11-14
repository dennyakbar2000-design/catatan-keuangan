// Bottom sheets (<dialog>) tied to browser history so Back closes them, plus a small toast.
let open = null; // the sheet that owns our pushed history entry

export function openSheet(dlg) {
  if (open === dlg) return;
  if (open) open.close(); // swap sheets, reuse the same history entry
  else history.pushState({ sheet: true }, '');
  open = dlg;
  dlg.showModal();
}

export function closeSheet() {
  if (open) history.back(); // popstate does the actual close
}

window.addEventListener('popstate', () => {
  const dlg = open;
  open = null;
  dlg?.close();
});

export function initSheet(dlg) {
  // Esc / dialog.close() from elsewhere: drop the history entry we pushed.
  dlg.addEventListener('close', () => {
    if (open !== dlg) return;
    open = null;
    history.back();
  });
  // Tap on the backdrop: the click lands on the <dialog> itself, outside .sheet-body.
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) closeSheet();
  });
}

let toastTimer;
export function toast(text, isError = false) {
  const t = document.getElementById('toast');
  // As a popover the toast joins the top layer, so it shows above an open modal sheet.
  const pop = typeof t.showPopover === 'function';
  t.textContent = text;
  t.classList.toggle('error', isError);
  t.hidden = false;
  if (pop) {
    if (t.matches(':popover-open')) t.hidePopover();
    t.showPopover();
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.hidden = true;
    if (pop) t.hidePopover();
  }, isError ? 6000 : 2000);
}
