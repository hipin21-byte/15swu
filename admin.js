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
  const tabButtons = [...document.querySelectorAll('.tab-button')];
  const tabPanels = [...document.querySelectorAll('.summary-panel')];
  const vehicleSummaryBody = document.getElementById('vehicleSummaryBody');
  const vehicleSummaryEmpty = document.getElementById('vehicleSummaryEmpty');
  const vehicleSummaryCount = document.getElementById('vehicleSummaryCount');
  const beverageSummary = document.getElementById('beverageSummary');
  const lunchSummary = document.getElementById('lunchSummary');
  const dinnerTotals = document.getElementById('dinnerTotals');
  const dinnerSummaryBody = document.getElementById('dinnerSummaryBody');
  const dinnerSummaryEmpty = document.getElementById('dinnerSummaryEmpty');

  const BEVERAGE_OPTIONS = ['아이스아메리카노', 'Hot아메리카노', '아이스티', '선택안함'];
  const LUNCH_OPTIONS = [
    '더덕 장어구이 바싹불고기 한상',
    '울릉도 오징어 석갈비 한상',
    '매콤낙지 석갈비 한상',
    '매콤낙지 꽈리닭구이 한상',
    '선택안함'
  ];
  const COMPANY_ORDER = ['서원대학교', '메가콘텐츠', '아람미디어', '아이티컴퍼니', '엡스코코리아', '참정보', '학술교육원', '한국학술정보'];

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

  function activateSummaryTab(tabName) {
    tabButtons.forEach(button => {
      const selected = button.dataset.tab === tabName;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    tabPanels.forEach(panel => { panel.hidden = panel.dataset.panel !== tabName; });
  }

  function countValues(data, field) {
    const counts = new Map();
    data.forEach(row => {
      splitMultiValue(row[field]).forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
    });
    return counts;
  }

  function getVehicleEntries(data) {
    const vehicles = new Map();
    data.forEach(row => {
      splitMultiValue(row.vehicleNumber).forEach(vehicleNumber => {
        const key = vehicleNumber.replace(/\s+/g, '').toUpperCase();
        if (!vehicles.has(key)) vehicles.set(key, { company: row.company, vehicleNumber: key });
      });
    });
    return [...vehicles.values()];
  }

  function renderCountCards(container, options, counts) {
    container.innerHTML = options.map(option => `
      <div class="count-card${option === '선택안함' ? ' muted' : ''}">
        <div class="count-label">${escapeHtml(option)}</div>
        <div class="count-value">${counts.get(option) || 0}<span>개</span></div>
      </div>`).join('');
  }

  function renderVehicleSummary(data) {
    const vehicles = getVehicleEntries(data);
    vehicles.sort((a, b) => a.company.localeCompare(b.company, 'ko') || a.vehicleNumber.localeCompare(b.vehicleNumber, 'ko'));
    vehicleSummaryBody.innerHTML = vehicles.map(item => `
      <tr><td><span class="badge">${escapeHtml(item.company)}</span></td><td class="vehicle-number">${escapeHtml(item.vehicleNumber)}</td></tr>`).join('');
    vehicleSummaryCount.textContent = `총 ${vehicles.length}대`;
    vehicleSummaryEmpty.style.display = vehicles.length ? 'none' : 'block';
  }

  function renderDinnerSummary(data) {
    const companies = [...new Set([...COMPANY_ORDER, ...data.map(row => row.company).filter(Boolean)])];
    const summaries = companies.map(company => {
      const companyRows = data.filter(row => row.company === company);
      const attendeeTotal = companyRows.reduce((sum, row) => sum + splitMultiValue(row.attendeeName).length, 0);
      const responses = companyRows.flatMap(row => splitMultiValue(row.dinnerAttendance));
      const attending = responses.filter(value => value === '참석').length;
      const absent = responses.filter(value => value === '불참').length;
      return { company, attendeeTotal, attending, absent, unanswered: Math.max(0, attendeeTotal - attending - absent) };
    });

    const seowonAttending = summaries.find(item => item.company === '서원대학교')?.attending || 0;
    const vendorAttending = summaries
      .filter(item => item.company !== '서원대학교')
      .reduce((sum, item) => sum + item.attending, 0);
    const totalAttending = seowonAttending + vendorAttending;

    dinnerTotals.innerHTML = `
      <div class="count-card total-card">
        <div class="count-label">전체 저녁식사 참석</div>
        <div class="count-value">${totalAttending}<span>명</span></div>
      </div>
      <div class="count-card">
        <div class="count-label">서원대학교 참석</div>
        <div class="count-value">${seowonAttending}<span>명</span></div>
      </div>
      <div class="count-card">
        <div class="count-label">참여업체 참석 <small>(서원대 제외)</small></div>
        <div class="count-value">${vendorAttending}<span>명</span></div>
      </div>`;

    dinnerSummaryBody.innerHTML = summaries.map(item => `
      <tr>
        <td><span class="badge">${escapeHtml(item.company)}</span></td>
        <td><strong>${item.attending}명</strong></td>
        <td>${item.absent}명</td>
        <td>${item.unanswered}명</td>
      </tr>`).join('');
    dinnerSummaryEmpty.style.display = data.length ? 'none' : 'block';
  }

  function renderSummaries(data) {
    renderVehicleSummary(data);
    renderCountCards(beverageSummary, BEVERAGE_OPTIONS, countValues(data, 'beverage'));
    renderCountCards(lunchSummary, LUNCH_OPTIONS, countValues(data, 'lunch'));
    renderDinnerSummary(data);
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
    document.getElementById('statVehicle').textContent = getVehicleEntries(data).length;
    document.getElementById('statDinner').textContent = data.reduce((sum, r) => sum + splitMultiValue(r.dinnerAttendance).filter(v => v === '참석').length, 0);
    document.getElementById('statIceAmericano').textContent = data.reduce((sum, r) => sum + splitMultiValue(r.beverage).filter(v => v === '아이스아메리카노').length, 0);
    document.getElementById('statLunchKinds').textContent = new Set(data.flatMap(r => splitMultiValue(r.lunch)).filter(v => v !== '선택안함')).size;
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
      renderSummaries(rows);
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
  tabButtons.forEach(button => button.addEventListener('click', () => activateSummaryTab(button.dataset.tab)));
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
