(() => {
  const loginForm = document.getElementById('adminLogin');
  const adminKeyInput = document.getElementById('adminKey');
  const adminStatus = document.getElementById('adminStatus');
  const dashboard = document.getElementById('dashboard');
  const tbody = document.getElementById('responseBody');
  const emptyState = document.getElementById('emptyState');
  const searchText = document.getElementById('searchText');
  const companyFilter = document.getElementById('companyFilter');
  const refreshBtn = document.getElementById('refreshBtn');
  const csvBtn = document.getElementById('csvBtn');
  const warning = document.getElementById('configWarning');

  const url = window.APP_CONFIG?.WEB_APP_URL || '';
  const configured = /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url);
  if (!configured) warning.classList.add('show');

  let rows = [];
  let currentKey = '';

  function showStatus(type, message) {
    adminStatus.className = `status show ${type}`;
    adminStatus.textContent = message;
  }

  function hideStatus() {
    adminStatus.className = 'status';
    adminStatus.textContent = '';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function splitMultiValue(value) {
    return String(value || '').split(/\s*\/\s*/).map(v => v.trim()).filter(Boolean);
  }

  function renderMultiValue(value, emptyValue = '-') {
    const items = splitMultiValue(value);
    if (!items.length) return escapeHtml(emptyValue);
    return `<span class="multi-value">${items.map(escapeHtml).join('<br>')}</span>`;
  }

  // Apps Script ContentService와 GitHub Pages 간 CORS 이슈를 피하기 위해 JSONP를 사용합니다.
  function loadJsonp(adminKey) {
    return new Promise((resolve, reject) => {
      if (!configured) return reject(new Error('웹앱 주소가 설정되지 않았습니다.'));

      const callbackName = `__fairCallback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => cleanup(new Error('응답 시간이 초과되었습니다.')), 15000);

      function cleanup(error, data) {
        clearTimeout(timer);
        delete window[callbackName];
        script.remove();
        if (error) reject(error); else resolve(data);
      }

      window[callbackName] = (payload) => cleanup(null, payload);
      script.onerror = () => cleanup(new Error('응답을 불러오지 못했습니다. 배포 권한과 웹앱 주소를 확인하세요.'));

      const qs = new URLSearchParams({
        action: 'list',
        adminKey,
        callback: callbackName,
        _: Date.now().toString()
      });
      script.src = `${url}?${qs.toString()}`;
      document.body.appendChild(script);
    });
  }

  function updateStats(data) {
    document.getElementById('statTotal').textContent = data.length;
    document.getElementById('statAttendee').textContent = data.reduce((sum, r) => sum + splitMultiValue(r.attendeeName).length, 0);
    document.getElementById('statVehicle').textContent = data.reduce((sum, r) => sum + splitMultiValue(r.vehicleNumber).length, 0);
    document.getElementById('statDinner').textContent = data.reduce((sum, r) => sum + splitMultiValue(r.dinnerAttendance).filter(v => v === '참석').length, 0);
    document.getElementById('statIceAmericano').textContent = data.reduce((sum, r) => sum + splitMultiValue(r.beverage).filter(v => v === '아이스아메리카노').length, 0);
    document.getElementById('statLunchKinds').textContent = new Set(data.flatMap(r => splitMultiValue(r.lunch))).size;
  }

  function buildCompanyFilter(data) {
    const selected = companyFilter.value;
    const companies = [...new Set(data.map(r => r.company).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ko'));
    companyFilter.innerHTML = '<option value="">전체</option>' + companies.map(c => `<option>${escapeHtml(c)}</option>`).join('');
    if (companies.includes(selected)) companyFilter.value = selected;
  }

  function getFilteredRows() {
    const q = searchText.value.trim().toLowerCase();
    const c = companyFilter.value;
    return rows.filter(r => {
      const companyOk = !c || r.company === c;
      const haystack = [r.company, r.attendeeName, r.vehicleNumber, r.beverage, r.lunch, r.dinnerAttendance].join(' ').toLowerCase();
      const searchOk = !q || haystack.includes(q);
      return companyOk && searchOk;
    });
  }

  function renderTable() {
    const data = getFilteredRows();
    tbody.innerHTML = data.map(r => `
      <tr>
        <td>${escapeHtml(r.timestamp)}</td>
        <td><span class="badge">${escapeHtml(r.company)}</span></td>
        <td>${renderMultiValue(r.attendeeName)}</td>
        <td>${renderMultiValue(r.vehicleNumber)}</td>
        <td>${renderMultiValue(r.beverage)}</td>
        <td>${renderMultiValue(r.lunch)}</td>
        <td>${renderMultiValue(r.dinnerAttendance, '미응답')}</td>
      </tr>`).join('');
    emptyState.style.display = data.length ? 'none' : 'block';
  }

  async function fetchRows() {
    showStatus('loading', '응답을 불러오는 중입니다...');
    try {
      const payload = await loadJsonp(currentKey);
      if (!payload?.ok) throw new Error(payload?.message || '관리자 인증에 실패했습니다.');
      rows = Array.isArray(payload.data) ? payload.data : [];
      dashboard.style.display = 'block';
      updateStats(rows);
      buildCompanyFilter(rows);
      renderTable();
      showStatus('success', `응답 ${rows.length}건을 불러왔습니다.`);
      setTimeout(hideStatus, 2500);
    } catch (err) {
      dashboard.style.display = 'none';
      showStatus('error', err.message || '응답을 불러오지 못했습니다.');
    }
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    currentKey = adminKeyInput.value.trim();
    if (!currentKey) return;
    fetchRows();
  });

  refreshBtn.addEventListener('click', fetchRows);
  searchText.addEventListener('input', renderTable);
  companyFilter.addEventListener('change', renderTable);

  csvBtn.addEventListener('click', () => {
    const data = getFilteredRows();
    const headers = ['제출시각','소속','참석자명','차량번호','음료','점심식사','저녁식사 참석여부'];
    const values = data.map(r => [r.timestamp, r.company, r.attendeeName, r.vehicleNumber, r.beverage, r.lunch, r.dinnerAttendance]);
    const csvEscape = (v) => `"${String(v ?? '').replaceAll('"','""')}"`;
    const csv = '\uFEFF' + [headers, ...values].map(row => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `학술전자정보박람회_참여업체응답_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
})();
