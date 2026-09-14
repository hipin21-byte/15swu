(() => {
  const form = document.getElementById('vendorForm');
  const status = document.getElementById('formStatus');
  const submitBtn = document.getElementById('submitBtn');
  const iframe = document.getElementById('submitFrame');
  const warning = document.getElementById('configWarning');
  const companySelect = document.getElementById('company');
  const selectedCompanyCode = document.getElementById('selectedCompanyCode');
  const attendeeList = document.getElementById('attendeeList');
  const vehicleList = document.getElementById('vehicleList');
  const addAttendeeBtn = document.getElementById('addAttendeeBtn');
  const addVehicleBtn = document.getElementById('addVehicleBtn');
  const attendeePayload = document.getElementById('attendeeName');
  const vehiclePayload = document.getElementById('vehicleNumber');
  const MAX_ADDITIONAL_FIELDS = 10;

  // 학생이 업체 부스를 방문했을 때 업체에서 학생 참여를 인증하는 참고용 코드입니다.
  const COMPANY_CODES = {
    '메가콘텐츠': '55',
    '아람미디어': '33',
    '아이티컴퍼니': '66',
    '엡스코코리아': '77',
    '참정보': '22',
    '학술교육원': '00',
    '한국학술정보': '11'
  };

  const url = window.APP_CONFIG?.WEB_APP_URL || '';
  const configured = /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url);
  form.action = url;
  if (!configured) warning.classList.add('show');

  let submitting = false;
  let submissionId = '';

  function showStatus(type, message) {
    status.className = `status show ${type}`;
    status.textContent = message;
  }

  function normalizeVehicle(v) {
    return v.trim().toUpperCase().replace(/\s+/g, '');
  }

  function refreshDynamicList(list, inputClass, labelText) {
    const items = [...list.querySelectorAll('.dynamic-item')];
    items.forEach((item, index) => {
      const input = item.querySelector(`.${inputClass}`);
      const position = index + 1;
      input.id = `${inputClass}${position}`;
      input.setAttribute('aria-label', `${labelText} ${position}`);

      const existingRemove = item.querySelector('.remove-button');
      if (items.length === 1) {
        existingRemove?.remove();
      } else if (!existingRemove) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-button';
        removeBtn.textContent = '삭제';
        removeBtn.setAttribute('aria-label', `${labelText} ${position} 입력란 삭제`);
        removeBtn.addEventListener('click', () => {
          item.remove();
          refreshDynamicList(list, inputClass, labelText);
        });
        item.appendChild(removeBtn);
      } else {
        existingRemove.setAttribute('aria-label', `${labelText} ${position} 입력란 삭제`);
      }
    });
  }

  function addDynamicField({ list, inputClass, labelText, placeholder, maxLength, required }) {
    const currentCount = list.querySelectorAll('.dynamic-item').length;
    if (currentCount >= MAX_ADDITIONAL_FIELDS) {
      showStatus('error', `${labelText}은 최대 ${MAX_ADDITIONAL_FIELDS}개까지 입력할 수 있습니다.`);
      return;
    }

    const item = document.createElement('div');
    item.className = 'dynamic-item';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = inputClass;
    input.maxLength = maxLength;
    input.placeholder = placeholder;
    input.required = required;
    item.appendChild(input);
    list.appendChild(item);
    refreshDynamicList(list, inputClass, labelText);
    input.focus();
  }

  function resetDynamicLists() {
    [...attendeeList.querySelectorAll('.dynamic-item')].slice(1).forEach(item => item.remove());
    [...vehicleList.querySelectorAll('.dynamic-item')].slice(1).forEach(item => item.remove());
    refreshDynamicList(attendeeList, 'attendee-input', '참석자명');
    refreshDynamicList(vehicleList, 'vehicle-input', '차량번호');
  }

  addAttendeeBtn.addEventListener('click', () => addDynamicField({
    list: attendeeList,
    inputClass: 'attendee-input',
    labelText: '참석자명',
    placeholder: '추가 참석자명',
    maxLength: 40,
    required: true
  }));

  addVehicleBtn.addEventListener('click', () => addDynamicField({
    list: vehicleList,
    inputClass: 'vehicle-input',
    labelText: '차량번호',
    placeholder: '추가 차량번호',
    maxLength: 20,
    required: false
  }));

  function createSubmissionId() {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    return `sub-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  // 개인정보를 보내지 않고 제출ID 존재 여부만 JSONP로 확인합니다.
  function checkSubmission(id) {
    return new Promise((resolve, reject) => {
      const callbackName = `__submitCheck_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => cleanup(new Error('저장 확인 시간이 초과되었습니다.')), 12000);

      function cleanup(error, data) {
        clearTimeout(timer);
        delete window[callbackName];
        script.remove();
        if (error) reject(error); else resolve(data);
      }

      window[callbackName] = (payload) => cleanup(null, payload);
      script.onerror = () => cleanup(new Error('저장 여부를 확인하지 못했습니다.'));
      const qs = new URLSearchParams({ action: 'status', submissionId: id, callback: callbackName, _: Date.now().toString() });
      script.src = `${url}?${qs.toString()}`;
      document.body.appendChild(script);
    });
  }


  function updateCompanyCode() {
    const company = companySelect.value;
    if (!company) {
      selectedCompanyCode.textContent = '소속을 선택하면 해당 업체의 코드가 표시됩니다.';
      return;
    }
    selectedCompanyCode.textContent = `${company} : ${COMPANY_CODES[company] || '-'} `;
  }

  companySelect.addEventListener('change', updateCompanyCode);
  form.addEventListener('reset', () => setTimeout(() => {
    resetDynamicLists();
    updateCompanyCode();
    status.className = 'status';
    status.textContent = '';
  }, 0));
  refreshDynamicList(attendeeList, 'attendee-input', '참석자명');
  refreshDynamicList(vehicleList, 'vehicle-input', '차량번호');
  updateCompanyCode();

  form.addEventListener('submit', (e) => {
    if (!configured) {
      e.preventDefault();
      showStatus('error', 'Google Apps Script 웹앱 주소가 아직 설정되지 않았습니다.');
      return;
    }

    const company = companySelect.value;
    const attendees = [...document.querySelectorAll('.attendee-input')]
      .map(input => input.value.trim())
      .filter(Boolean);
    const vehicles = [...document.querySelectorAll('.vehicle-input')]
      .map(input => normalizeVehicle(input.value))
      .filter(Boolean);

    if (!company || !attendees.length) return;

    attendeePayload.value = attendees.join(' / ');
    vehiclePayload.value = [...new Set(vehicles)].join(' / ');
    submissionId = createSubmissionId();
    document.getElementById('submissionId').value = submissionId;
    submitting = true;
    submitBtn.disabled = true;
    showStatus('loading', '응답을 저장하고 있습니다...');
  });

  iframe.addEventListener('load', async () => {
    if (!submitting || !submissionId) return;
    try {
      await new Promise(r => setTimeout(r, 400));
      const result = await checkSubmission(submissionId);
      if (!result?.ok || !result?.found) {
        throw new Error(result?.message || '스프레드시트에서 제출 내용을 확인하지 못했습니다.');
      }
      showStatus('success', '응답이 정상적으로 저장되었습니다. 감사합니다.');
      form.reset();
      submissionId = '';
    } catch (err) {
      showStatus('error', `${err.message || '저장 확인에 실패했습니다.'} 잠시 후 다시 시도해 주세요.`);
    } finally {
      submitting = false;
      submitBtn.disabled = false;
    }
  });
})();
