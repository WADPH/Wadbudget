const API = '';
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const LEFT_AMOUNT_COLOR = '#2ecc71';
    const DEFAULT_TYPE_COLOR = '#7c6ff7';
    let currentPlan = null;
    let currentCalc = null;
    let currentUser = null;
    let summaryPaidOnly = false;

    function createDefaultAvatarDataUrl(email = '?') {
      const first = (email.trim().charAt(0) || '?').toUpperCase();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="#2a2a4a"/><text x="50%" y="56%" text-anchor="middle" font-family="Segoe UI,Tahoma,sans-serif" font-size="34" fill="#d7d7eb">${first}</text></svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    async function initAccountPanel() {
      try {
        const emailEl = document.getElementById('accountEmail');
        const avatarEl = document.getElementById('accountAvatar');
        if (avatarEl) avatarEl.src = createDefaultAvatarDataUrl('?');
        if (emailEl) emailEl.textContent = 'Loading...';

        const res = await fetch(`${API}/auth/me`);
        if (!res.ok) {
          if (emailEl) emailEl.textContent = 'Unknown user';
          return;
        }
        const data = await res.json();
        if (!data.authenticated || !data.user) {
          if (emailEl) emailEl.textContent = 'Unknown user';
          return;
        }
        currentUser = data.user;

        if (emailEl) emailEl.textContent = currentUser.email || '';
        if (avatarEl) {
          avatarEl.src = currentUser.picture || createDefaultAvatarDataUrl(currentUser.email || '?');
        }
      } catch (err) {
        console.error('Failed to load current user info', err);
        const emailEl = document.getElementById('accountEmail');
        if (emailEl) emailEl.textContent = 'Unknown user';
      }
    }

    async function logout() {
      try {
        await fetch(`${API}/auth/logout`, { method: 'POST' });
      } finally {
        window.location.href = '/auth/login';
      }
    }
    window.logout = logout;

    // Init date pickers
    function initDatePickers() {
      const now = new Date();
      const curM = now.getMonth() + 1;
      const curY = now.getFullYear();

      // New plan date picker
      const mSel = document.getElementById('newPlanMonth');
      const ySel = document.getElementById('newPlanYear');
      MONTHS.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = String(i + 1).padStart(2, '0');
        opt.textContent = m;
        if (i + 1 === curM) opt.selected = true;
        mSel.appendChild(opt);
      });
      for (let y = curY - 2; y <= curY + 5; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === curY) opt.selected = true;
        ySel.appendChild(opt);
      }
    }

    function getNewPlanDate() {
      const m = document.getElementById('newPlanMonth').value;
      const y = document.getElementById('newPlanYear').value;
      return `${m}.${y}`;
    }

    function getNextMonth(monthStr) {
      const [m, y] = monthStr.split('.').map(Number);
      let nm = m + 1, ny = y;
      if (nm > 12) { nm = 1; ny++; }
      return `${String(nm).padStart(2, '0')}.${ny}`;
    }

    function getNextMonthName(monthStr) {
      const [m] = monthStr.split('.').map(Number);
      const nextMonthIndex = m === 12 ? 0 : m;
      return MONTHS[nextMonthIndex];
    }

    function formatMonth(monthStr) {
      const [m, y] = monthStr.split('.');
      return `${MONTHS[parseInt(m) - 1]} ${y}`;
    }

    // Load plans list
    async function loadPlansList() {
      const res = await fetch(`${API}/plans`);
      const plans = await res.json();
      const container = document.getElementById('plansList');
      container.innerHTML = plans.map(p => `
        <div class="plan-item ${currentPlan && currentPlan.month === p.month ? 'active' : ''}" onclick="loadPlan('${p.month}')">
          <span>${formatMonth(p.month)}</span>
          <button class="delete-plan-btn" onclick="event.stopPropagation(); confirmDeletePlan('${p.month}')" title="Delete">&times;</button>
        </div>
      `).join('');
    }

    // Load single plan
    async function loadPlan(month) {
      const res = await fetch(`${API}/plan/${encodeURIComponent(month)}`);
      const data = await res.json();
      currentPlan = data.plan;
      currentCalc = data.calc;
      renderPlan();
      loadPlansList();
      closeSidebar();
    }

    // Render plan
    function renderPlan() {
      if (!currentPlan) return;

      const [pm, py] = currentPlan.month.split('.');

      let html = `
        <div class="header">
          <div class="date-picker">
            <span class="select-wrapper"><select id="planMonth" onchange="renameCurrentPlan()">
              ${MONTHS.map((m, i) => `<option value="${String(i+1).padStart(2,'0')}" ${String(i+1).padStart(2,'0')===pm?'selected':''}>${m}</option>`).join('')}
            </select></span>
            <span class="select-wrapper"><select id="planYear" onchange="renameCurrentPlan()">
              ${Array.from({length:10}, (_,i) => new Date().getFullYear()-2+i).map(y => `<option value="${y}" ${y==py?'selected':''}>${y}</option>`).join('')}
            </select></span>
          </div>
          <div class="controls">
            <div class="start-balance">
              <label>Start Balance:</label>
              <div class="number-wrapper">
                <input type="number" id="startBalanceInput" value="${currentPlan.startBalance}" onchange="updateBalance(this.value)" step="1">
              </div>
            </div>
            <button class="btn btn-primary btn-small" onclick="duplicateToNextMonth()">Copy to ${getNextMonthName(currentPlan.month)}</button>
            <div class="more-controls">
              <button class="btn btn-primary btn-small" onclick="showPieChart()" title="Pie Chart">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
              </button>
              <button class="btn btn-primary btn-small more-mobile-only" onclick="showMoreModal()" title="More">...</button>
            </div>
          </div>
        </div>
      `;

      let runningBalance = currentPlan.startBalance;

      for (let ti = 0; ti < currentPlan.types.length; ti++) {
        const type = currentPlan.types[ti];
        const total = type.items.reduce((s, i) => s + i.amount, 0);
        const afterBalance = runningBalance - total;

        html += `
          <div class="type-section">
            <div class="type-header">
              <div>
                <h2>${type.name}${type.note ? `<span style="color:#888;font-size:13px;font-weight:normal;font-style:italic;margin-left:8px;">${escHtml(type.note)}</span>` : ''}</h2>
                <div class="after-balance">After: ${afterBalance.toFixed(2)} ₼</div>
              </div>
              <div class="type-info">
                <div class="type-total">Total: ${total.toFixed(2)} ₼</div>
                <div class="type-management">
                  <button class="btn-icon btn-icon-edit" onclick="showEditTypeModal(${ti})" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z"></path>
                    </svg>
                  </button>
                  <button class="btn-icon btn-icon-delete" onclick="confirmDeleteType(${ti})" title="Delete">&times;</button>
                </div>
              </div>
            </div>
            <table class="items-table">
              <thead><tr><th style="width:34px;">Paid</th><th style="width:20%">Name</th><th style="width:60%;">Note</th><th style="width:120px;text-align:right;">Amount (₼)</th><th style="width:40px;"></th></tr></thead>
              <tbody>
        `;

        for (let ii = 0; ii < type.items.length; ii++) {
          const item = type.items[ii];
          html += `
            <tr draggable="true" data-type-index="${ti}" data-item-index="${ii}"
                ondragstart="onDragStart(event)" ondragover="onDragOver(event)" ondragenter="onDragEnter(event)"
                ondragleave="onDragLeave(event)" ondrop="onDrop(event)" ondragend="onDragEnd(event)">
              <td><label class="item-paid-toggle" title="Paid"><input type="checkbox" ${item.paid ? 'checked' : ''} onchange="toggleItemPaid('${type.name}','${item.id}',this.checked)"><span class="item-paid-check"></span></label></td>
              <td><input class="item-name" value="${escHtml(item.name)}" onchange="updateItem('${type.name}','${item.id}',this.value,null,null)"></td>
              <td><input class="item-note" value="${escHtml(item.note || '')}" placeholder=" " onchange="updateItem('${type.name}','${item.id}',null,this.value,null)"></td>
              <td>
                <div class="number-wrapper">
                  <input type="number" class="item-amount-input" value="${item.amount}" onchange="updateItem('${type.name}','${item.id}',null,null,this.value)" step="1">
                </div>
              </td>
              <td><button class="btn-icon" onclick="deleteItem('${type.name}','${item.id}')">&times;</button></td>
            </tr>
          `;
        }

        html += `
              </tbody>
            </table>
            <div class="add-item-row">
              <input class="item-name-input" type="text" placeholder="New item name..." id="newItemName_${type.name}">
              <input type="text" placeholder="Note..." id="newItemNote_${type.name}" style="width:130px;padding:8px 12px;background:#0f0f0f;border:1px solid #333;color:#888;border-radius:6px;font-size:13px;">
              <div class="number-wrapper" style="width:120px;">
                <input class="item-amount-input" type="number" placeholder="Amount" id="newItemAmount_${type.name}" step="1" style="width:100%;text-align:right;">
              </div>
              <button class="btn btn-success btn-small" onclick="addItem('${type.name}')">+</button>
            </div>
          </div>
        `;

        runningBalance = afterBalance;
      }

      // Summary bar
      html += `<div class="summary-mode-wrap"><button class="summary-mode-btn ${summaryPaidOnly ? 'active' : ''}" onclick="toggleSummaryPaidOnly()">${summaryPaidOnly ? 'Mode: Paid only' : 'Mode: All expenses'}</button></div><div class="summary-bar">`;

      runningBalance = currentPlan.startBalance;
      for (const type of currentPlan.types) {
        const total = type.items.reduce((s, i) => (summaryPaidOnly && !i.paid ? s : s + i.amount), 0);
        html += `
          <div class="summary-item">
            <div class="label">Total ${type.name}</div>
            <div class="value neutral">${total.toFixed(2)} ₼</div>
          </div>
        `;
        runningBalance -= total;
      }

      const leftClass = runningBalance >= 0 ? 'positive' : 'negative';
      html += `
          <div class="summary-item">
            <div class="label">Left</div>
            <div class="value ${leftClass}">${runningBalance.toFixed(2)} ₼</div>
          </div>
        </div>
      `;

      // Add type button
      html += `
        <div style="text-align:center;margin-top:20px;">
          <button class="btn btn-primary" onclick="showAddTypeModal()">+ Add Type</button>
        </div>
      `;

      document.getElementById('mainContent').innerHTML = html;
    }

    // Helper
    function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    // Drag & Drop
    let dragData = null;

    function onDragStart(e) {
      const tr = e.currentTarget;
      dragData = {
        typeIndex: parseInt(tr.dataset.typeIndex),
        itemIndex: parseInt(tr.dataset.itemIndex)
      };
      tr.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    }

    function onDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }

    function onDragEnter(e) {
      e.preventDefault();
      const tr = e.currentTarget;
      tr.classList.add('drag-over');
    }

    function onDragLeave(e) {
      e.currentTarget.classList.remove('drag-over');
    }

    async function onDrop(e) {
      e.preventDefault();
      const tr = e.currentTarget;
      tr.classList.remove('drag-over');

      if (!dragData) return;
      const targetType = parseInt(tr.dataset.typeIndex);
      const targetIndex = parseInt(tr.dataset.itemIndex);

      if (dragData.typeIndex !== targetType) return; // only within same type

      const typeName = currentPlan.types[targetType].name;
      const items = currentPlan.types[targetType].items;

      // Reorder
      const [moved] = items.splice(dragData.itemIndex, 1);
      items.splice(targetIndex, 0, moved);

      const itemIds = items.map(i => i.id);
      await fetch(`${API}/reorder`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentPlan.month, type: typeName, itemIds })
      });

      await loadPlan(currentPlan.month);
      dragData = null;
    }

    function onDragEnd(e) {
      e.currentTarget.classList.remove('dragging');
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      dragData = null;
    }

    // API calls
    async function updateBalance(val) {
      const res = await fetch(`${API}/plan/${encodeURIComponent(currentPlan.month)}/balance`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startBalance: Number(val) })
      });
      const data = await res.json();
      currentPlan = data.plan;
      currentCalc = data.calc;
      renderPlan();
    }

    async function renameCurrentPlan() {
      const m = document.getElementById('planMonth').value;
      const y = document.getElementById('planYear').value;
      const newMonth = `${m}.${y}`;
      if (newMonth === currentPlan.month) return;

      const res = await fetch(`${API}/plan/${encodeURIComponent(currentPlan.month)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newMonth })
      });
      const data = await res.json();
      currentPlan = data.plan;
      currentCalc = data.calc;
      renderPlan();
      loadPlansList();
    }

    async function addItem(typeName) {
      const nameInput = document.getElementById(`newItemName_${typeName}`);
      const noteInput = document.getElementById(`newItemNote_${typeName}`);
      const amountInput = document.getElementById(`newItemAmount_${typeName}`);
      if (!nameInput.value.trim()) return;

      const res = await fetch(`${API}/item`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentPlan.month, type: typeName, name: nameInput.value.trim(), note: noteInput.value.trim(), amount: Number(amountInput.value) || 0 })
      });
      const data = await res.json();
      currentPlan = data.plan;
      currentCalc = data.calc;
      renderPlan();
    }

    async function updateItem(typeName, itemId, name, note, amount, paid = null) {
      const item = currentPlan.types.find(t => t.name === typeName).items.find(i => i.id === itemId);
      const newName = name !== null ? name : item.name;
      const newNote = note !== null ? note : (item.note || '');
      const newAmount = amount !== null ? Number(amount) : item.amount;
      const newPaid = paid !== null ? !!paid : !!item.paid;

      const res = await fetch(`${API}/item/${itemId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentPlan.month, type: typeName, name: newName, note: newNote, amount: newAmount, paid: newPaid })
      });
      const data = await res.json();
      currentPlan = data.plan;
      currentCalc = data.calc;
      renderPlan();
    }

    async function toggleItemPaid(typeName, itemId, paid) {
      const item = currentPlan.types.find(t => t.name === typeName).items.find(i => i.id === itemId);
      if (!item) return;
      await updateItem(typeName, itemId, item.name, item.note || '', item.amount, paid);
    }

    function toggleSummaryPaidOnly() {
      summaryPaidOnly = !summaryPaidOnly;
      renderPlan();
    }

    async function deleteItem(typeName, itemId) {
      const res = await fetch(`${API}/item`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentPlan.month, type: typeName, itemId })
      });
      const data = await res.json();
      currentPlan = data.plan;
      currentCalc = data.calc;
      renderPlan();
    }

    async function deletePlan(month) {
      hideModal();
      await fetch(`${API}/plan/${encodeURIComponent(month)}`, { method: 'DELETE' });
      currentPlan = null;
      currentCalc = null;
      loadPlansList();
      document.getElementById('mainContent').innerHTML = `
        <div class="no-plan">
          <h2>No plan selected</h2>
          <p>Select a plan from the sidebar or create a new one</p>
        </div>
      `;
    }

    async function createEmptyPlan() {
      const month = getNewPlanDate();

      const res = await fetch(`${API}/plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, startBalance: 0, types: [] })
      });
      const data = await res.json();
      currentPlan = data.plan;
      currentCalc = data.calc;
      renderPlan();
      loadPlansList();
    }

    async function createFromTemplate() {
      const newMonth = getNewPlanDate();
      if (!currentPlan) return alert('Select a template plan first');

      const res = await fetch(`${API}/next-month`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentPlan.month })
      });
      const data = await res.json();
      currentPlan = data.plan;
      currentCalc = data.calc;
      renderPlan();
      loadPlansList();
    }

    async function duplicateToNextMonth() {
      const res = await fetch(`${API}/next-month`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentPlan.month })
      });
      const data = await res.json();
      currentPlan = data.plan;
      currentCalc = data.calc;
      renderPlan();
      loadPlansList();
      hideModal();
    }

    // Modal system
    function showModal(html, extraClass = '') {
      const modalContent = document.getElementById('modalContent');
      modalContent.innerHTML = html;
      modalContent.className = 'modal' + (extraClass ? ' ' + extraClass : '');
      document.getElementById('modalOverlay').classList.add('visible');
    }

    function hideModal() {
      document.getElementById('modalOverlay').classList.remove('visible');
    }

    function showMoreModal() {
      showModal(`
        <h3>More</h3>
        <div class="more-row">
          <label>Start Balance</label>
          <div class="number-wrapper">
            <input type="number" id="moreStartBalanceInput" value="${currentPlan.startBalance}" onchange="updateBalance(this.value)" step="1">
          </div>
        </div>
        <div class="modal-actions modal-actions-center">
          <button class="btn btn-primary btn-small" onclick="duplicateToNextMonth()">Copy to ${getNextMonthName(currentPlan.month)}</button>
        </div>
        <div class="modal-actions modal-actions-center">
          <button class="btn btn-primary btn-small" onclick="hideModal()">Close</button>
        </div>
      `, 'more-modal');
      setTimeout(() => document.getElementById('moreStartBalanceInput')?.focus(), 50);
    }

    // Close modal on overlay click
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) hideModal();
    });

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideModal();
    });

    function showAddTypeModal() {
      showModal(`
        <h3>Add Type</h3>
        <label>Type Name</label>
        <input type="text" id="modalTypeName" placeholder="e.g. Savings" autofocus>
        <label>Type Color</label>
        <input type="color" id="modalTypeColor" value="${DEFAULT_TYPE_COLOR}">
        <label class="custom-checkbox">
          <input type="checkbox" id="modalCarryOver">
          <span class="checkmark"></span>
          <span class="checkbox-label">Carry Over to next month</span>
        </label>
        <div class="modal-actions">
          <button class="btn btn-small" onclick="hideModal()">Cancel</button>
          <button class="btn btn-small btn-success" onclick="addTypeFromModal()">Add</button>
        </div>
      `);
      document.getElementById('modalTypeName').focus();
      document.getElementById('modalTypeName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addTypeFromModal();
      });
    }

    async function addTypeFromModal() {
      const name = document.getElementById('modalTypeName').value.trim();
      if (!name) return;
      const color = document.getElementById('modalTypeColor').value || DEFAULT_TYPE_COLOR;
      const carryOver = document.getElementById('modalCarryOver').checked;

      const res = await fetch(`${API}/type`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentPlan.month, typeName: name, budget: 0, carryOver, color })
      });
      const data = await res.json();
      currentPlan = data.plan;
      currentCalc = data.calc;
      hideModal();
      renderPlan();
    }

    function showEditTypeModal(typeIndex) {
      const type = currentPlan.types[typeIndex];
      showModal(`
        <h3>Edit Type</h3>
        <label>Type Name</label>
        <input type="text" id="modalEditTypeName" value="${escHtml(type.name)}">
        <label>Type Color</label>
        <input type="color" id="modalEditTypeColor" value="${escHtml(type.color || DEFAULT_TYPE_COLOR)}">
        <label>Note</label>
        <input type="text" id="modalEditTypeNote" value="${escHtml(type.note || '')}" placeholder="Optional note...">
        <label class="custom-checkbox">
          <input type="checkbox" id="modalEditCarryOver" ${type.carryOver ? 'checked' : ''}>
          <span class="checkmark"></span>
          <span class="checkbox-label">Carry Over to next month</span>
        </label>
        <div class="modal-actions">
          <button class="btn btn-small btn-primary" onclick="saveEditType(${typeIndex})">Save</button>
        </div>
      `);
      document.getElementById('modalEditTypeName').focus();
      document.getElementById('modalEditTypeName').select();
      document.getElementById('modalEditTypeName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('modalEditTypeNote').focus();
      });
    }

    async function saveEditType(typeIndex) {
      const oldName = currentPlan.types[typeIndex].name;
      const newName = document.getElementById('modalEditTypeName').value.trim();
      if (!newName) return;
      const carryOver = document.getElementById('modalEditCarryOver').checked;
      const color = document.getElementById('modalEditTypeColor').value || DEFAULT_TYPE_COLOR;
      const note = document.getElementById('modalEditTypeNote').value.trim();

      const res = await fetch(`${API}/type`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentPlan.month, oldName, newName, carryOver, note, color })
      });
      const data = await res.json();
      currentPlan = data.plan;
      currentCalc = data.calc;
      hideModal();
      renderPlan();
    }

    function confirmDeleteType(typeIndex) {
      const type = currentPlan.types[typeIndex];
      showModal(`
        <h3>Delete Type</h3>
        <p style="color:#e0e0e0;margin-bottom:15px;">Delete type "<strong>${escHtml(type.name)}</strong>" and all its items?</p>
        <div class="modal-actions">
          <button class="btn btn-small" onclick="hideModal()">Cancel</button>
          <button class="btn btn-small btn-danger" onclick="deleteTypeByIndex(${typeIndex})">Delete</button>
        </div>
      `);
    }

    async function deleteTypeByIndex(typeIndex) {
      const typeName = currentPlan.types[typeIndex].name;
      const res = await fetch(`${API}/type`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentPlan.month, typeName })
      });
      const data = await res.json();
      currentPlan = data.plan;
      currentCalc = data.calc;
      hideModal();
      renderPlan();
    }

    function confirmDeletePlan(month) {
      showModal(`
        <h3>Delete Plan</h3>
        <p style="color:#e0e0e0;margin-bottom:15px;">Delete plan "<strong>${formatMonth(month)}</strong>"?</p>
        <div class="modal-actions">
          <button class="btn btn-small" onclick="hideModal()">Cancel</button>
          <button class="btn btn-small btn-danger" onclick="deletePlan('${month}')">Delete</button>
        </div>
      `);
    }

    // Pie Chart
    let pieMode = 'percent';
    let pieSegments = [];
    let pieTotal = 0;

    async function showPieChart() {
      pieMode = 'percent';
      const left = currentCalc.left;
      const total = currentPlan.startBalance;

      pieSegments = [];
      for (const type of currentPlan.types) {
        const amount = type.items.reduce((s, i) => s + i.amount, 0);
        pieSegments.push({ name: type.name, amount, color: type.color || DEFAULT_TYPE_COLOR });
      }
      pieSegments.push({ name: 'Left', amount: Math.max(left, 0), color: LEFT_AMOUNT_COLOR });
      pieTotal = total;

      renderPieModal();
    }

    function renderPieModal() {
      let legendHtml = '';
      pieSegments.forEach((seg) => {
        const pct = pieTotal > 0 ? ((seg.amount / pieTotal) * 100).toFixed(1) : 0;
        const value = pieMode === 'percent' ? `${pct}%` : `${seg.amount.toFixed(2)} ₼`;
        legendHtml += `
          <div class="pie-legend-item">
            <div class="pie-legend-color" style="background:${seg.color}"></div>
            <span class="pie-legend-label">${escHtml(seg.name)}</span>
            <span class="pie-legend-value">${value}</span>
          </div>
        `;
      });

      const modalHtml = `
        <h3>Breakdown — ${formatMonth(currentPlan.month)}</h3>
        <div class="pie-toggle">
          <button class="${pieMode==='percent'?'active':''}" onclick="setPieMode('percent')">Percent</button>
          <button class="${pieMode==='amount'?'active':''}" onclick="setPieMode('amount')">Amount</button>
        </div>
        <div class="pie-canvas">
          <canvas id="pieCanvas" width="300" height="300"></canvas>
        </div>
        <div class="pie-legend">${legendHtml}</div>
        <div class="modal-actions">
          <button class="btn btn-small btn-primary" onclick="hideModal()">Close</button>
        </div>
      `;

      showModal(modalHtml);
      document.getElementById('modalContent').classList.add('pie-modal');
      setTimeout(() => drawPieChart(), 50);
    }

    function setPieMode(mode) {
      pieMode = mode;
      renderPieModal();
    }

    function drawPieChart() {
      const canvas = document.getElementById('pieCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const size = 300;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      ctx.scale(dpr, dpr);

      const cx = size / 2;
      const cy = size / 2;
      const r = Math.min(cx, cy) - 10;
      const total = pieTotal;

      ctx.clearRect(0, 0, size, size);

      const MIN_LABEL_ANGLE = 0.25; // rad ~14deg
      const pointerR = r + 20;

      let startAngle = -Math.PI / 2;
      const labelLines = [];

      pieSegments.forEach((seg, i) => {
        const sliceAngle = total > 0 ? (seg.amount / total) * 2 * Math.PI : 0;
        if (sliceAngle <= 0) { startAngle += sliceAngle; return; }

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();

        const midAngle = startAngle + sliceAngle / 2;

        if (sliceAngle > MIN_LABEL_ANGLE) {
          // Label inside slice
          const labelR = r * 0.65;
          const lx = cx + Math.cos(midAngle) * labelR;
          const ly = cy + Math.sin(midAngle) * labelR;
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px Segoe UI';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (pieMode === 'percent') {
            const pct = ((seg.amount / total) * 100).toFixed(0);
            ctx.fillText(`${pct}%`, lx, ly);
          } else {
            ctx.fillText(`${seg.amount.toFixed(0)} ₼`, lx, ly);
          }
        } else {
          // Small slice — store for pointer label
          labelLines.push({ angle: midAngle, startAngle, sliceAngle, seg, i, total });
        }

        startAngle += sliceAngle;
      });

      // Draw pointer lines and labels for small slices
      labelLines.forEach(({ angle, seg, i, total }) => {
        const edgeX = cx + Math.cos(angle) * r;
        const edgeY = cy + Math.sin(angle) * r;
        const endX = cx + Math.cos(angle) * pointerR;
        const endY = cy + Math.sin(angle) * pointerR;

        // Horizontal extension
        const isLeft = Math.cos(angle) < 0;
        const horizLen = 25;
        const labelX = endX + (isLeft ? -horizLen : horizLen);
        const labelY = endY;

        ctx.strokeStyle = seg.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(edgeX, edgeY);
        ctx.lineTo(endX, endY);
        ctx.lineTo(labelX, labelY);
        ctx.stroke();

        // Dot
        ctx.beginPath();
        ctx.arc(endX, endY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = seg.color;
        ctx.fill();

        // Label
        const pct = ((seg.amount / total) * 100).toFixed(1);
        const value = pieMode === 'percent' ? `${pct}%` : `${seg.amount.toFixed(1)} ₼`;
        const text = `${escHtml(seg.name)}  ${value}`;

        ctx.fillStyle = '#e0e0e0';
        ctx.font = 'bold 13px Segoe UI';
        ctx.textBaseline = 'middle';
        ctx.textAlign = isLeft ? 'right' : 'left';
        ctx.fillText(text, labelX, labelY);
      });

      // Center circle (donut)
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a2e';
      ctx.fill();

      // Center text
      ctx.fillStyle = '#7c6ff7';
      ctx.font = 'bold 16px Segoe UI';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${total.toFixed(0)} ₼`, cx, cy - 8);
      ctx.fillStyle = '#aaa';
      ctx.font = '11px Segoe UI';
      ctx.fillText('Total', cx, cy + 10);
    }

    // Mobile sidebar
    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebarOverlay').classList.toggle('visible');
    }

    function closeSidebar() {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('visible');
    }

    // Init
    initDatePickers();
    initAccountPanel();
    loadPlansList().then(async () => {
      // Auto-load latest plan
      const res = await fetch(`${API}/plans`);
      const plans = await res.json();
      if (plans.length > 0) {
        // Last plan in sorted list is the most recent
        const latestMonth = plans[plans.length - 1].month;
        loadPlan(latestMonth);
      }
    });

