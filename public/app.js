import { el, notice, button, card, field, select, form, table, details, facts, bytes, format } from './ui.js';

const root = document.querySelector('#app');
const ranks = { None: -1, User: 0, Viewer: 10, Contributor: 20, Editor: 30, Manager: 40, Admin: 50, SuperAdmin: 100 };
let user = null;
let passwordRequired = false;
let pageController = new AbortController();
let cleanups = [];
let expiryTimer;
let renderVersion = 0;
const allowed = role => user && (ranks[user.rol] ?? -1) >= ranks[role];
const encode = encodeURIComponent;

async function api(path, method = 'GET', body, options = {}) {
  const timeout = AbortSignal.timeout(options.timeout ?? 30000);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  const response = await fetch(path, {
    method, credentials: 'same-origin', cache: 'no-store', signal,
    headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    if (response.status === 401 && user) {
      user = null; clearTimeout(expiryTimer); void render();
    }
    const message = response.status === 401 ? 'Sign in again to continue.' : response.status === 403 ? 'Your account cannot perform this action, or a password update is required.' : text.slice(0, 700) || `Request failed (${response.status}).`;
    throw new Error(message);
  }
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}
async function change(path, method = 'POST', body) {
  const result = await api(path, method, body);
  if (result === false || result === 'false') throw new Error('The device did not complete this action. Refresh its status before trying again.');
  return result;
}
async function restoreSession() {
  const account = await api('/api/users/me');
  if (!account?.id || !account.username || !Number.isFinite(account.expires_at)) throw new Error('Invalid session response.');
  passwordRequired = account.must_change_password === true;
  user = { sub: String(account.id), eml: account.username, rol: account.role, exp: account.expires_at };
  clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => { user = null; void render(); notice('Session expired. Please sign in again.', true); }, Math.min(2147483647, Math.max(1, user.exp * 1000 - Date.now())));
}
function actionRow(parent) { const node = el('div', null, { class: 'actions' }); parent.append(node); return node; }
function link(parent, label, href) { const node = el('a', label, { href }); parent.append(node); return node; }
function requireRole(parent, role) {
  if (allowed(role)) return true;
  card(parent).append(el('p', `${role} access is required for these controls.`));
  return false;
}
function jsonEditor(parent, title, initial, save) {
  const section = card(parent, title);
  return form(section, [['json', 'Configuration', 'textarea', JSON.stringify(initial, null, 2), { rows: 18, spellcheck: 'false' }]], 'Save configuration', async values => {
    const parsed = JSON.parse(values.json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Enter a JSON object.');
    await save(parsed);
  });
}
async function infoCard(parent, title, path, method = 'GET') {
  const section = card(parent, title);
  const loading = el('p', 'Loading…', { class: 'muted' }); section.append(loading);
  try { const value = await api(path, method, undefined, { signal: pageController.signal }); loading.remove(); details(section, 'View details', value).open = true; return value; }
  catch (error) { loading.textContent = error.message; loading.className = 'error'; }
}

function loginView() {
  const panel = el('main', null, { class: 'login', id: 'content' }); root.append(panel);
  panel.append(el('div', '◈ Druid Garden OS', { class: 'brand' }), el('h1', 'Welcome to your garden'), el('p', 'Sign in to manage this device.', { class: 'muted' }));
  form(panel, [
    ['username', 'Username', 'text', '', { required: '', autocomplete: 'username' }],
    ['password', 'Password', 'password', '', { required: '', autocomplete: 'current-password' }],
  ], 'Sign in', async (values, inputs) => {
    await api('/auth/login', 'POST', values);
    inputs.password.value = '';
    await restoreSession();
    location.hash = passwordRequired ? '#account' : '#dashboard';
    await render();
  });
  panel.append(el('p', 'On a new device, sign in with the supplied credentials and set your own password.', { class: 'muted' }));
}
const routes = [
  ['dashboard', 'Overview', 'Viewer'], ['farmer', 'Farmer', 'Viewer'], ['devices', 'Device discovery', 'Viewer'],
  ['storage', 'Storage', 'Manager'], ['files', 'Files', 'Manager'], ['network', 'Network', 'Editor'],
  ['plugins', 'Plugins', 'Viewer'], ['leds', 'LED controls', 'Editor'], ['settings', 'Settings', 'Manager'], ['account', 'Account', 'User'],
];
async function render() {
  const version = ++renderVersion;
  pageController.abort(); pageController = new AbortController();
  cleanups.forEach(fn => fn()); cleanups = [];
  root.replaceChildren();
  if (!user) { loginView(); return; }
  let route = location.hash.slice(1).split('?')[0] || 'dashboard';
  if (passwordRequired) route = 'account';
  const selected = routes.find(item => item[0] === route);
  if (!selected || !allowed(selected[2])) route = 'account';
  const shell = el('div', null, { class: 'shell' });
  const sidebar = el('aside', null, { class: 'sidebar' });
  sidebar.append(el('div', '◈ Druid Garden OS', { class: 'brand' }));
  const nav = el('nav', null, { 'aria-label': 'Device navigation' });
  for (const [key, label, role] of routes) {
    if (!allowed(role) || (passwordRequired && key !== 'account')) continue;
    nav.append(el('a', label, { href: `#${key}`, ...(key === route ? { 'aria-current': 'page' } : {}) }));
  }
  sidebar.append(nav);
  const identity = el('div', null, { class: 'identity' });
  identity.append(el('span', user.eml), el('span', user.rol, { class: 'muted' }));
  button(identity, 'Sign out', async () => {
    await api('/auth/logout', 'POST'); user = null; clearTimeout(expiryTimer); await render();
  });
  sidebar.append(identity);
  const main = el('main', null, { class: 'workspace', id: 'content', tabindex: '-1' });
  const heading = el('header', null, { class: 'page-head' });
  const title = el('div'); title.append(el('div', 'Your garden · Your device', { class: 'eyebrow' }), el('h1', routes.find(item => item[0] === route)?.[1] || 'Account'));
  heading.append(title); button(heading, 'Refresh', render); main.append(heading);
  shell.append(sidebar, main); root.append(shell);
  document.title = `${routes.find(item => item[0] === route)?.[1] || 'Account'} · Druid Garden OS`;
  try { await views[route](main); }
  catch (error) { if (version === renderVersion && error.name !== 'AbortError') card(main).append(el('p', error.message, { class: 'error', role: 'alert' })); }
}

async function dashboard(parent) {
  const results = await Promise.allSettled(['info', 'cpu', 'memory'].map(name => api(`/api/system/${name}`, 'GET', undefined, { signal: pageController.signal })));
  const grid = el('div', null, { class: 'grid' }); parent.append(grid);
  const [system, cpu, memory] = results.map(result => result.status === 'fulfilled' ? result.value : null);
  if (system) { const section = card(grid, system.hostname || 'Device'); section.append(el('div', system.arch, { class: 'metric' })); facts(section, [['OS', system.os_version], ['Kernel', system.kernel], ['Uptime', `${Math.floor(system.uptime / 3600)}h ${Math.floor(system.uptime % 3600 / 60)}m`]]); }
  if (cpu) { const section = card(grid, 'CPU'); section.append(el('div', `${cpu.global_usage.toFixed(1)}%`, { class: 'metric' }), el('p', `${cpu.physical_count} cores · ${cpu.thread_count} threads`, { class: 'muted' })); const progress = el('progress', null, { max: 100, value: cpu.global_usage, 'aria-label': 'CPU utilization' }); section.append(progress); }
  if (memory) { const section = card(grid, 'Memory'); section.append(el('div', bytes(memory.used), { class: 'metric' }), el('p', `of ${bytes(memory.total)}`, { class: 'muted' }), el('progress', null, { max: Math.max(1, memory.total), value: memory.used, 'aria-label': 'Memory utilization' })); }
  results.forEach((result, index) => { if (result.status === 'rejected') card(grid, ['System', 'CPU', 'Memory'][index]).append(el('p', result.reason.message, { class: 'error' })); });
  await Promise.all([infoCard(parent, 'Farmer status', '/farmer/status'), infoCard(parent, 'Network interfaces', '/api/system/networks'), infoCard(parent, 'Graphics processors', '/api/system/gpus')]);
  if (system?.running_processes) table(card(parent, 'Processes'), system.running_processes, [['PID', 'pid'], ['Name', 'name'], ['CPU', row => `${row.cpu_usage.toFixed(1)}%`], ['Memory', row => bytes(row.memory_usage)]]);
}
async function account(parent) {
  if (passwordRequired) card(parent, 'Set your password').append(el('p', 'Change the initial password before using device controls.'));
  facts(card(parent, 'Signed in'), [['Username', user.eml], ['Role', user.rol], ['Session expires', new Date(user.exp * 1000).toLocaleString()]]);
  const passwordOptions = { required: '', minlength: 12, maxlength: 1024, autocomplete: 'new-password' };
  form(card(parent, 'Change password'), [
    ['old_password', 'Current password', 'password', '', { required: '', autocomplete: 'current-password' }],
    ['new_password', 'New password (at least 12 characters)', 'password', '', passwordOptions],
    ['confirm', 'Confirm new password', 'password', '', passwordOptions],
  ], 'Update password', async (values, inputs) => {
    if (values.new_password !== values.confirm) throw new Error('The new passwords do not match.');
    await change('/api/users/password', 'PUT', { username: user.eml, old_password: values.old_password, new_password: values.new_password });
    Object.values(inputs).forEach(input => { input.value = ''; });
    passwordRequired = false; user = null; clearTimeout(expiryTimer);
    await render(); notice('Password updated. All sessions were revoked. Sign in with your new password.');
  });
  if (!allowed('Admin') || passwordRequired) return;
  form(card(parent, 'Create a user'), [['username', 'Username', 'text', '', { required: '', maxlength: 128, autocomplete: 'off' }], ['password', 'Initial password (at least 12 characters)', 'password', '', passwordOptions]], 'Create user', async (values, inputs) => {
    await change('/api/users/register', 'POST', { username: values.username, password: Array.from(new TextEncoder().encode(values.password)) });
    inputs.password.value = ''; await render(); notice('User created. Assign a role below to grant device access.');
  });
  const accounts = await api('/api/users');
  const section = card(parent, 'Account access');
  section.append(el('p', 'Changing a role revokes that account’s sessions. None disables sign-in. The last SuperAdmin cannot be demoted.', { class: 'muted' }));
  table(section, accounts, [['Username', 'username'], ['Role', 'role'], ['Access', (account, cell) => {
    const superAdmin = user.rol === 'SuperAdmin';
    if (!superAdmin && (ranks[account.role] ?? -1) >= ranks[user.rol]) { cell.append(el('span', 'Requires SuperAdmin')); return; }
    const choices = Object.keys(ranks).filter(role => superAdmin || ranks[role] < ranks[user.rol]);
    const choice = select(cell, `role-${account.id}`, 'New role', choices, account.role);
    button(cell, 'Change role', async () => {
      if (choice.value === account.role) return;
      if (!confirm(`Change ${account.username} to ${choice.value}? Existing sessions will be revoked.`)) return;
      const changingSelf = String(account.id) === user.sub;
      await change(`/api/users/${encode(account.id)}/role`, 'PUT', { role: choice.value });
      if (changingSelf) { user = null; clearTimeout(expiryTimer); }
      await render(); notice(changingSelf ? 'Role changed. Sign in again.' : 'Role changed and sessions revoked.');
    });
  }]]);
}
async function writeConfig(key, value, category = 'system') {
  return api(`/config/${encode(key)}`, 'POST', { key, value: String(value), last_value: '', category, system: 0 });
}
async function devices(parent) {
  const healthCard = card(parent, 'Discovery health');
  const health = await api('/api/system/heartbeat/health');
  facts(healthCard, [['Device ID', health.device_id], ['OS version', health.firmware_version], ['Last heartbeat', health.last_success_unix ? new Date(health.last_success_unix * 1000).toLocaleString() : 'Not yet received'], ['Consecutive failures', health.consecutive_failures], ['Ownership confirmed', health.claimed === true ? 'Yes' : 'Not confirmed'], ['Device key status', health.token_status || 'Awaiting first heartbeat'], ['Telemetry recorded on last check-in', health.telemetry_recorded === true ? 'Yes' : 'No']]);
  healthCard.append(el('p', 'Pairing requires both your website device key and a private identity stored on this device. The public device ID cannot be used to claim it.', { class: 'muted' }));
  if (health.legacy_device_id) healthCard.append(el('p', `Identity upgraded from ${health.legacy_device_id}. The website migrates a legacy claim only with the same active device key.`, { class: 'muted' }));
  link(healthCard, 'Open druid.garden device manager ↗', 'https://druid.garden/device-scanner').setAttribute('rel', 'noopener noreferrer');
  if (!requireRole(parent, 'Manager')) return;
  const settings = await Promise.all(['heartbeat.name', 'heartbeat.enabled', 'heartbeat.control_enabled', 'heartbeat.telemetry_enabled'].map(key => api(`/config/${key}`)));
  const section = card(parent, 'Connect this device');
  section.append(el('p', 'Discovery shares your device name and local IP with druid.garden. Browsers using the same public IP can find it.'));
  section.append(el('p', 'Health history is optional and visible only to the claimed owner. It includes OS version, update channel, uptime, CPU, memory and disk usage, and farmer running state. It excludes file names, keys, and logs.', { class: 'muted' }));
  section.append(el('p', 'Cloud diagnostics requires a device key and discovery enabled. It lets your website account request status, farming statistics, and drive information. It cannot change settings or restart the device.', { class: 'muted' }));
  form(section, [['enabled', 'Enable discovery', 'checkbox', settings[1]?.value !== 'false'], ['control_enabled', 'Allow read-only cloud diagnostics (status, farming statistics, drives)', 'checkbox', settings[2]?.value === 'true'], ['telemetry_enabled', 'Save device health history on druid.garden (up to 7 days)', 'checkbox', settings[3]?.value === 'true'], ['name', 'Device name', 'text', settings[0]?.value || 'Druid Garden Device', { required: '', maxlength: 256 }], ['key', 'New device key (leave blank to keep current)', 'password', '', { maxlength: 256, autocomplete: 'new-password' }]], 'Save discovery settings', async (values, inputs) => {
    await writeConfig('heartbeat.name', values.name.trim()); await writeConfig('heartbeat.enabled', values.enabled); await writeConfig('heartbeat.control_enabled', values.control_enabled); await writeConfig('heartbeat.telemetry_enabled', values.telemetry_enabled);
    if (values.key.trim()) { await writeConfig('heartbeat.api_key', values.key.trim()); inputs.key.value = ''; }
    notice('Saved. Allow a few minutes for the next heartbeat.');
  });
  button(actionRow(section), 'Clear local device key', async () => {
    if (!confirm('Clear this device’s local key? Revoke the key on druid.garden to revoke website access.')) return;
    await writeConfig('heartbeat.device_token', ''); await writeConfig('heartbeat.api_key', ''); notice('Local device key cleared.');
  }, 'danger');
}
async function farmer(parent) {
  await infoCard(parent, 'Farmer status', '/farmer/status');
  const actions = actionRow(parent);
  if (allowed('Editor')) for (const action of ['start', 'stop', 'restart']) button(actions, `${action[0].toUpperCase()}${action.slice(1)} farmer`, async () => { if (action !== 'start' && !confirm(`${action} the farmer?`)) return; await change(`/farmer/${action}`, 'POST'); notice(`Farmer ${action} requested.`); await render(); });
  await Promise.all([infoCard(parent, 'Recent farming statistics', '/farmer/stats'), infoCard(parent, 'Farmer state', '/farmer/state')]);
  const logs = card(parent, 'Live farmer log');
  const logText = el('pre', 'Connect to begin streaming.'); const logActions = actionRow(logs); logs.append(logText);
  let socket;
  const close = () => { socket?.close(); socket = null; };
  cleanups.push(close);
  button(logActions, 'Connect', () => {
    close(); logText.textContent = 'Connecting…';
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/farmer/log_stream/Info`);
    socket.onopen = () => { logText.textContent = ''; };
    socket.onmessage = event => { if (typeof event.data !== 'string' || event.data.length > 65536) return; logText.textContent = `${logText.textContent}\n${event.data}`.slice(-65536); logText.scrollTop = logText.scrollHeight; };
    socket.onerror = () => { logText.textContent += '\nUnable to connect to the farmer log.'; };
    socket.onclose = () => { logText.textContent += '\nDisconnected.'; };
  });
  button(logActions, 'Disconnect', close);
  if (!allowed('Editor')) return;
  const configPanel = card(parent, 'Farmer configuration');
  configPanel.append(el('p', 'Configuration contains private farming keys. Open it only when needed.', { class: 'muted' }));
  button(configPanel, 'Load configuration', async () => {
    const config = await api('/farmer/config');
    jsonEditor(configPanel, 'Edit farmer configuration', config, values => change('/farmer/config', 'POST', values));
  });
  form(card(parent, 'Initialize from mnemonic'), [['mnemonic', 'Seed phrase', 'password', '', { required: '', autocomplete: 'off' }]], 'Generate and save configuration', async (values, inputs) => {
    if (!confirm('Generate and save farmer configuration using this seed phrase?')) return;
    await change('/farmer/config/mnemonic', 'POST', values); inputs.mnemonic.value = ''; notice('Farmer configuration saved.');
  });
  button(actionRow(parent), 'Import legacy drive configuration', async () => { if (!confirm('Scan mounted drives and import existing farmer configuration?')) return; await change('/farmer/config/scan', 'POST'); notice('Legacy configuration imported.'); });
}
async function storage(parent) {
  const disks = await api('/api/system/disks');
  for (const disk of disks) {
    const section = card(parent, disk.model || disk.name || disk.dev_path);
    facts(section, [['Device', disk.dev_path], ['Capacity', bytes(disk.total)], ['Used', bytes(disk.used)], ['Type', disk.disk_type]]);
    table(section, disk.partitions || [], [['Partition', 'device'], ['Filesystem', 'file_system'], ['Mounted at', 'mount_path'], ['Space', row => row.space_info ? `${bytes(row.space_info.used_space)} / ${bytes(row.space_info.total_space)}` : '—'], ['Actions', (row, td) => {
      const actions = actionRow(td);
      if (row.mount_path) button(actions, 'Unmount', async () => {
        if (!confirm(`Unmount ${row.mount_path}? Active file operations may be interrupted.`)) return;
        await change('/api/disks/unmount', 'POST', { mount_path: row.mount_path }); await render();
      }, 'danger');
      else button(actions, 'Mount', () => {
        const panel = card(parent, `Mount ${row.device}`);
        form(panel, [['mount_path', 'Mount directory', 'text', `/mnt/${row.uuid || String(row.device).split('/').pop()}`, { required: '' }], ['auto_mount', 'Mount automatically on startup', 'checkbox', false]], 'Mount partition', async values => {
          await change('/api/disks/mount', 'POST', { device_path: row.device, mount_path: values.mount_path, auto_mount: values.auto_mount }); await render();
        });
        panel.scrollIntoView({ block: 'nearest' });
      });
      if (row.uuid) button(actions, 'Disable auto-mount', async () => { await api(`/config/${encode(`auto-mount-${row.uuid}`)}`, 'DELETE'); notice('Auto-mount disabled.'); });
    }]]);
  }
  if (!disks.length) card(parent).append(el('p', 'No storage devices reported.'));
}
async function files(parent) {
  const section = card(parent, 'Browse files');
  section.append(el('p', 'File access uses your device account permissions. The current API supports UTF-8 text files.', { class: 'muted' }));
  const navigation = el('div', null, { class: 'inline-fields' }); section.append(navigation);
  const pathInput = field(navigation, 'directory', 'Directory', 'text', '/mnt');
  const listing = el('div'); section.append(listing);
  const editor = card(parent, 'Text file editor');
  const editorForm = form(editor, [['path', 'File path', 'text', '', { required: '' }], ['contents', 'Contents', 'textarea', '', { spellcheck: 'false', rows: 14 }]], 'Save existing file', async values => {
    if (!confirm(`Overwrite ${values.path}?`)) return;
    await change('/api/files/file/save', 'PUT', { path: values.path, contents: Array.from(new TextEncoder().encode(values.contents)) });
    await load();
  });
  const fileActions = actionRow(editor);
  button(fileActions, 'Create new file', async () => {
    if (!editorForm.node.reportValidity()) return;
    const path = editorForm.inputs.path.value;
    if (!confirm(`Create ${path}?`)) return;
    await change('/api/files/file/create', 'POST', { path, contents: Array.from(new TextEncoder().encode(editorForm.inputs.contents.value)) }); await load(); notice('File created.');
  });
  async function readFile(path, download) {
    const file = await api('/api/files/file', 'POST', { path });
    if (download) {
      const url = URL.createObjectURL(new Blob([file.contents], { type: 'application/octet-stream' }));
      const anchor = el('a', 'Download', { href: url, download: path.split('/').pop() || 'download.txt' }); document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else { editorForm.inputs.path.value = path; editorForm.inputs.contents.value = file.contents; editor.scrollIntoView({ block: 'nearest' }); }
  }
  async function load() {
    const rows = await api('/api/files/list', 'POST', { path: pathInput.value });
    listing.replaceChildren();
    table(listing, rows, [['Name', row => String(row.path).split('/').pop() || '/'], ['Type', 'entry_type'], ['Size', row => bytes(row.size)], ['Actions', (row, td) => {
      const actions = actionRow(td);
      if (row.entry_type === 'Directory') button(actions, 'Open', async () => { pathInput.value = row.path; await load(); });
      else if (row.entry_type === 'File') { button(actions, 'Edit', () => readFile(row.path, false)); button(actions, 'Download', () => readFile(row.path, true)); }
      button(actions, 'Rename', async () => { const to = prompt('New absolute path', row.path); if (!to || to === row.path) return; await change('/api/files/rename', 'POST', { from: row.path, to }); await load(); });
      button(actions, 'Delete', async () => { if (!confirm(`Permanently delete ${row.path}? Directories and their contents will be removed.`)) return; await change('/api/files/remove', 'DELETE', { path: row.path }); await load(); }, 'danger');
    }]]);
  }
  button(navigation, 'Open directory', load);
  button(navigation, 'Parent directory', async () => { pathInput.value = pathInput.value.replace(/\/+$/, '').split('/').slice(0, -1).join('/') || '/'; await load(); });
  button(actionRow(section), 'New directory', async () => { const path = prompt('New directory path', `${pathInput.value.replace(/\/$/, '')}/`); if (!path) return; await change('/api/files/directory', 'POST', { path }); await load(); });
  await load();
}
async function network(parent) {
  await infoCard(parent, 'Interfaces', '/api/system/networks');
  const wifi = card(parent, 'Wi-Fi');
  const connect = form(wifi, [['ssid', 'Network name', 'text', '', { required: '' }], ['password', 'Wi-Fi password (blank for open network)', 'password', '', { autocomplete: 'new-password' }]], 'Connect', async (values, inputs) => {
    if (!confirm('Change the device Wi-Fi connection? This browser may lose its connection.')) return;
    await change('/system/wifi/connect', 'POST', { ssid: values.ssid, password: values.password || null }); inputs.password.value = ''; notice('Wi-Fi connection requested.');
  });
  const results = el('div'); wifi.append(results);
  button(actionRow(wifi), 'Scan networks', async () => {
    const networks = await api('/system/wifi/scan', 'POST'); results.replaceChildren();
    table(results, networks, [['Network', 'ssid'], ['Signal', row => `${row.strength}%`], ['', (row, td) => { button(td, 'Select', () => { connect.inputs.ssid.value = row.ssid; connect.inputs.password.focus(); }); }]]);
  });
  const hotspot = card(parent, 'Setup hotspot');
  const active = await api('/system/hotspot/active', 'POST'); hotspot.append(el('p', active ? 'Hotspot is active.' : 'Hotspot is stopped.', { class: 'badge' }));
  form(hotspot, [['ssid', 'Hotspot name', 'text', 'DG_OS_SETUP', { required: '' }], ['password', 'Hotspot password', 'password', '', { required: '', minlength: 8, autocomplete: 'new-password' }], ['device', 'Wireless interface (optional)', 'text', '']], 'Start hotspot', async (values, inputs) => {
    if (!confirm('Start the hotspot? Existing wireless connections may disconnect.')) return;
    await change('/system/hotspot/start', 'POST', { ssid: values.ssid, password: values.password, device: values.device || null }); inputs.password.value = ''; notice('Hotspot started.');
  });
  const actions = actionRow(hotspot);
  for (const [action, label] of [['stop', 'Stop hotspot'], ['restart', 'Restart hotspot'], ['clean', 'Remove saved hotspots']]) button(actions, label, async () => { if (!confirm(`${label}? Your connection may disconnect.`)) return; await change(`/system/hotspot/${action}`, 'POST'); notice(`${label} completed.`); });
  button(actionRow(parent), 'Check internet connection', async () => { const online = await api('/system/is_online', 'POST'); notice(online ? 'Device has internet access.' : 'Device could not reach the internet.', !online); });
}
async function leds(parent) {
  const section = card(parent, 'Light settings');
  const brightness = await api('/led/brightness');
  const lighting = form(section, [['brightness', 'Brightness (0–255)', 'number', brightness, { min: 0, max: 255, required: '' }], ['color', 'Color', 'color', '#65b87a'], ['pulse', 'Pulse interval in microseconds (0 for solid)', 'number', 0, { min: 0, max: Number.MAX_SAFE_INTEGER, required: '' }]], 'Apply lighting', async values => {
    const rgb = { r: parseInt(values.color.slice(1, 3), 16), g: parseInt(values.color.slice(3, 5), 16), b: parseInt(values.color.slice(5, 7), 16) };
    await change(`/led/brightness/${Number(values.brightness)}`, 'POST');
    await change('/led/color', 'POST', Number(values.pulse) > 0 ? { Pulse: [rgb, Number(values.pulse)] } : { Solid: rgb });
  });
  button(actionRow(section), 'Turn lights off', async () => { await change('/led/color', 'POST', { Solid: { r: 0, g: 0, b: 0 } }); lighting.inputs.color.value = '#000000'; });
  const pins = card(parent, 'GPIO pins');
  const pinForm = form(pins, [['pin', 'Pin number', 'number', '', { min: 0, max: 4294967295, required: '' }]], 'Assign pin', async values => { await change('/led/pin', 'POST', { pin: Number(values.pin), color: color.value }); });
  const color = select(pinForm.node, 'color', 'Channel', ['Red', 'Green', 'Blue']); pinForm.node.insertBefore(color.parentElement, pinForm.submit);
  button(actionRow(pins), 'Read pin value', async () => { if (!pinForm.inputs.pin.reportValidity()) return; const value = await api(`/led/pin/${Number(pinForm.inputs.pin.value)}`); notice(`Pin value: ${value}`); });
  button(actionRow(pins), 'Clear all pin assignments', async () => { if (!confirm('Clear all LED pin assignments?')) return; await change('/led/pin', 'DELETE'); notice('Pin assignments cleared.'); }, 'danger');
}
async function settings(parent) {
  const updates = card(parent, 'OS updates');
  updates.append(el('p', 'Check the release stream before scheduling an update. The device may restart during installation.', { class: 'muted' }));
  const updateResult = el('div'); updates.append(updateResult); let updateAvailable = false;
  const controls = actionRow(updates);
  button(controls, 'Check for updates', async () => { const result = await api('/system/updates'); updateResult.replaceChildren(); facts(updateResult, [['Installed', result.local_version], ['Available', result.remote_version], ['Update available', result.has_update]]); updateAvailable = result.has_update; apply.disabled = !updateAvailable; });
  const apply = button(controls, 'Apply update', async () => { if (!updateAvailable || !confirm('Apply the OS update? Services may stop and the device may restart.')) return; await change('/system/updates', 'POST'); notice('Update service started.'); }); apply.disabled = true;
  const configs = await api('/config');
  const section = card(parent, 'Device settings');
  section.append(el('p', 'System values are managed by the device. Secret values are hidden until you choose to edit them.', { class: 'muted' }));
  const area = el('div'); section.append(area);
  table(area, configs.filter(row => row.key !== 'farmer_config'), [['Setting', 'key'], ['Category', 'category'], ['Value', row => /token|key|password|secret/i.test(row.key) ? '••••••••' : row.value], ['Actions', (row, td) => {
    if (row.key === 'heartbeat.device_id') return;
    const actions = actionRow(td);
    button(actions, 'Edit', () => {
      const edit = card(parent, row.key);
      form(edit, [['value', 'Value', /token|password|secret|api_key/i.test(row.key) ? 'password' : 'textarea', /token|password|secret|api_key/i.test(row.key) ? '' : row.value, { autocomplete: 'off' }]], 'Save setting', async values => { await writeConfig(row.key, values.value, row.category); notice('Setting saved.'); await render(); }); edit.scrollIntoView({ block: 'nearest' });
    });
    button(actions, 'Delete', async () => { if (!confirm(`Delete setting ${row.key}?`)) return; await change(`/config/${encode(row.key)}`, 'DELETE'); await render(); }, 'danger');
  }]]);
  form(card(parent, 'Add a setting'), [['key', 'Key', 'text', '', { required: '' }], ['value', 'Value', 'textarea'], ['category', 'Category', 'text', 'preferences', { required: '' }]], 'Create setting', async values => { await writeConfig(values.key, values.value, values.category); await render(); });
}
async function plugins(parent) {
  const installed = await api('/api/plugins');
  const section = card(parent, 'Installed plugins');
  table(section, installed, [['Plugin', row => row.label || row.name], ['Version', 'version'], ['Type', 'plugin_type'], ['Actions', (row, td) => {
    const actions = actionRow(td);
    button(actions, 'Status', async () => { const state = await api(`/api/plugins/${encode(row.name)}/status`); notice(`Running: ${state.running}; expected running: ${state.should_be_running}`); });
    if (allowed('Editor')) {
      for (const action of ['start', 'stop']) button(actions, action === 'start' ? 'Start' : 'Stop', async () => { await change(`/api/plugins/${encode(row.name)}/${action}`, 'POST'); notice(`Plugin ${action} completed.`); });
      button(actions, 'Environment', () => pluginEnvironment(parent, row));
    }
    if (allowed('Manager')) {
      button(actions, 'Edit / update', () => { jsonEditor(parent, `Update ${row.name}`, row, values => change('/api/plugins', 'PUT', values)); });
      button(actions, 'Uninstall', async () => { if (!confirm(`Uninstall ${row.label || row.name}?`)) return; await change(`/api/plugins/${encode(row.name)}`, 'DELETE'); await render(); }, 'danger');
    }
  }]]);
  const store = card(parent, 'Plugin catalog'); const list = el('div'); store.append(list);
  const load = async refresh => {
    const rows = await api(refresh ? '/api/plugins/refresh' : '/api/plugins/available', 'POST'); list.replaceChildren();
    table(list, rows, [['Plugin', 'name'], ['Version', 'version'], ['Source', 'repo'], ['Actions', (row, td) => {
      if (!allowed('Manager')) return;
      button(td, 'Review installation', () => { jsonEditor(parent, `Install ${row.name}`, { name: row.name, label: row.name, enabled: 1, plugin_type: ({ docker: 'Docker', file: 'File', rustproject: 'RustProject', builtin: 'BuiltIn' })[row.p_type.toLowerCase()] || row.p_type, repo: row.repo, tag: row.tag, version: row.version, source: row.source, run_command: null }, async values => { if (!confirm(`Install ${values.name} from ${values.repo}? Plugins execute on this device.`)) return; await change('/api/plugins', 'POST', values); notice('Plugin installed.'); }); });
    }]]);
  };
  button(actionRow(store), 'Refresh catalog', () => load(true)); await load(false);
  if (allowed('Manager')) jsonEditor(parent, 'Install custom plugin', { name: '', label: '', enabled: 1, plugin_type: 'Docker', repo: '', tag: '', version: '', source: '', run_command: null }, async values => { if (!confirm(`Install ${values.name}?`)) return; await change('/api/plugins', 'POST', values); notice('Plugin installed.'); });
}
async function pluginEnvironment(parent, plugin) {
  const section = card(parent, `${plugin.label || plugin.name} environment`);
  const rows = await api(`/api/plugins/${encode(plugin.name)}/env`);
  table(section, rows, [['Key', 'key'], ['Value', () => '••••••••'], ['Actions', (row, td) => { button(td, 'Delete', async () => { if (!confirm(`Delete environment variable ${row.key}?`)) return; await change(`/api/plugins/${encode(plugin.name)}/env/${encode(row.key)}`, 'DELETE'); notice('Environment variable deleted.'); }); }]]);
  form(section, [['key', 'Variable name', 'text', '', { required: '' }], ['value', 'Value', 'password', '', { autocomplete: 'off' }]], 'Save variable', async (values, inputs) => {
    if (plugin.id == null) throw new Error('This plugin has no persistent ID.');
    const existing = rows.find(row => row.key === values.key);
    // time::OffsetDateTime's human-readable wire representation.
    const now = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00:00');
    await api(`/api/plugins/${encode(plugin.name)}/env`, 'POST', { plugin_id: plugin.id, key: values.key, value: values.value, added: existing?.added || now, updated: now }); inputs.value.value = ''; notice('Environment variable saved. Restart the plugin to apply it.');
  });
  section.scrollIntoView({ block: 'nearest' });
}

const views = { dashboard, account, devices, farmer, storage, files, network, leds, settings, plugins };
window.addEventListener('hashchange', () => { void render(); });
try { await restoreSession(); } catch { user = null; }
await render();
