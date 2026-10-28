export function el(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  return node;
}
let noticeTimer;
export function notice(message, error = false) {
  const node = document.querySelector('#notice');
  node.textContent = message;
  node.className = error ? 'error' : '';
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { node.textContent = ''; }, error ? 15000 : 6000);
}
export function button(parent, label, action, kind = '') {
  const node = el('button', label, { type: 'button', class: kind });
  node.addEventListener('click', async () => {
    node.disabled = true;
    try { await action(); } catch (error) { notice(error.message || 'Request failed.', true); }
    finally { node.disabled = false; }
  });
  parent.append(node);
  return node;
}
export function card(parent, title) {
  const node = el('section', null, { class: 'card' });
  if (title) node.append(el('h2', title));
  parent.append(node);
  return node;
}
export function field(parent, key, label, type = 'text', value = '', options = {}) {
  const wrap = el('label', label, { class: type === 'checkbox' ? 'check' : '' });
  const node = el(type === 'textarea' ? 'textarea' : 'input', null, { name: key, ...options });
  if (type !== 'textarea') node.type = type;
  if (type === 'checkbox') { node.checked = Boolean(value); wrap.prepend(node); }
  else { node.value = value ?? ''; wrap.append(node); }
  parent.append(wrap);
  return node;
}
export function select(parent, key, label, choices, value) {
  const wrap = el('label', label);
  const node = el('select', null, { name: key });
  for (const item of choices) {
    const [id, text] = Array.isArray(item) ? item : [item, item];
    const option = el('option', text, { value: id });
    node.append(option);
  }
  if (value !== undefined) node.value = value;
  wrap.append(node); parent.append(wrap); return node;
}
export function form(parent, specs, label, action) {
  const node = el('form');
  const inputs = {};
  for (const [key, title, type = 'text', value = '', options = {}] of specs) {
    inputs[key] = field(node, key, title, type, value, options);
  }
  const submit = el('button', label, { type: 'submit', class: 'primary' });
  const status = el('p', '', { role: 'status' });
  node.append(submit, status);
  node.addEventListener('submit', async event => {
    event.preventDefault();
    if (!node.reportValidity()) return;
    submit.disabled = true; status.textContent = '';
    const values = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.type === 'checkbox' ? input.checked : input.value]));
    try { await action(values, inputs); status.className = 'success'; status.textContent = 'Saved.'; }
    catch (error) { status.className = 'error'; status.textContent = error.message || 'Request failed.'; }
    finally { submit.disabled = false; }
  });
  parent.append(node);
  return { node, inputs, submit, status };
}
export function table(parent, rows, columns) {
  if (!rows?.length) { parent.append(el('p', 'No items to show.', { class: 'empty' })); return; }
  const wrap = el('div', null, { class: 'table-wrap' });
  const node = el('table'); const head = el('tr');
  for (const [title] of columns) head.append(el('th', title, { scope: 'col' }));
  const thead = el('thead'); thead.append(head); node.append(thead);
  const body = el('tbody');
  for (const row of rows) {
    const tr = el('tr');
    for (const [, render] of columns) {
      const td = el('td'); const value = typeof render === 'function' ? render(row, td) : row[render];
      if (value !== undefined && value !== null) td.append(value instanceof Node ? value : document.createTextNode(format(value)));
      tr.append(td);
    }
    body.append(tr);
  }
  node.append(body); wrap.append(node); parent.append(wrap);
}
export function format(value) { return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '—'); }
export function details(parent, title, value) {
  const node = el('details'); node.append(el('summary', title), el('pre', format(value))); parent.append(node); return node;
}
export function facts(parent, values) {
  const list = el('dl');
  for (const [label, value] of values) list.append(el('dt', label), el('dd', format(value)));
  parent.append(list);
}
export function bytes(value) {
  if (!Number.isFinite(Number(value))) return '—';
  const n = Number(value); const unit = Math.max(0, Math.min(4, Math.floor(Math.log2(Math.max(1, n)) / 10)));
  return `${(n / 1024 ** unit).toFixed(unit ? 1 : 0)} ${['B', 'KiB', 'MiB', 'GiB', 'TiB'][unit]}`;
}
