async function checkAuth() {
  const response = await fetch("/check-auth", {
    credentials: "include"
  });
  const data = await response.json();
  if (!data.authenticated) {
    window.location.href = "login.html";
  }
}
checkAuth();


async function saveAttendance(data) {
  const response = await fetch("/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data)
  });
  return await response.json();
}

const today = new Date();

const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let currentSubject = '';

document.getElementById('dateChip').textContent =
  DAY_NAMES[today.getDay()] + ', ' +
  today.getDate() + ' ' +
  MONTH_NAMES[today.getMonth()] + ' ' +
  today.getFullYear();

const rows = [];
let rowCounter = 0;
let cameraStream = null;

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    cameraStream = stream;

    const video = document.getElementById('cameraFeed');
    video.srcObject = stream;
    video.classList.add('active');

    document.getElementById('vfHint').style.display = 'none';
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').classList.add('visible');
    document.querySelector('.cam-dot').classList.add('live');
    document.getElementById('camStatusText').textContent = 'Live';

    startJsQRLoop(video);

  } catch (err) {
    showToast('Camera access denied');
    console.error('Camera error:', err);
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  const video = document.getElementById('cameraFeed');
  video.srcObject = null;
  video.classList.remove('active');

  document.getElementById('vfHint').style.display = '';
  document.getElementById('startBtn').style.display = '';
  document.getElementById('stopBtn').classList.remove('visible');
  document.querySelector('.cam-dot').classList.remove('live');
  document.getElementById('camStatusText').textContent = 'Idle';
}

function startJsQRLoop(video) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  function loop() {
    if (!cameraStream) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height);
    if (code) {
      onQRSuccess(code.data);
    }
    requestAnimationFrame(loop);
  }

  video.onloadedmetadata = () => loop();
}

async function onQRSuccess(decodedText) {
  try {
    const data = JSON.parse(decodedText);
    data.subject = currentSubject;
    const result = await saveAttendance(data);

    if (!result.success) {
      showToast(result.message);
      return;
    }

    const flashOverlay = document.getElementById('flash');
    flashOverlay.classList.add('on');
    setTimeout(() => flashOverlay.classList.remove('on'), 320);

    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' +
                 String(now.getMinutes()).padStart(2, '0');

    rowCounter++;
    rows.unshift({
      id: rowCounter,
      name: result.record.name,
      roll: result.record.roll,
      branch: result.record.branch,
      subject: result.record.subject,
      time: time,
      status: 'present'
    });

    renderTable();
    showToast('✓ ' + result.record.name + ' marked present', true);

  } catch(e) {
    showToast('Invalid QR code');
  }
}

function renderTable() {
  const tbody = document.getElementById('tableBody');

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">No scans yet — tap Start Camera</td>
      </tr>`;
    return;
  }

  tbody.innerHTML = rows.map((student, index) => `
    <tr class="${index === 0 ? 'new-row' : ''}">
      <td style="color:var(--muted); font-family:'DM Mono',monospace; font-size:.7rem">
        ${student.id}
      </td>
      <td>
        <span
          class="name-cell"
          contenteditable="true"
          onblur="updateName(${student.id}, this.textContent.trim())"
          onkeydown="if(event.key==='Enter'){ event.preventDefault(); this.blur(); }"
        >${escapeHTML(student.name)}</span>
      </td>
      <td style="font-family:'DM Mono',monospace; font-size:.72rem; color:var(--muted)">
        ${student.time}
      </td>
      <td>
        <button class="status-pill ${student.status}" onclick="toggleStatus(${student.id})">
          <span class="dot"></span>
          ${student.status === 'present' ? 'Present' : 'Absent'}
        </button>
      </td>
      <td>
        <button class="del-btn" onclick="deleteRow(${student.id})" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </td>
    </tr>`).join('');
}

function updateName(id, newName) {
  const student = rows.find(r => r.id === id);
  if (student && newName) {
    student.name = newName;
  }
}

function toggleStatus(id) {
  const student = rows.find(r => r.id === id);
  if (!student) return;
  student.status = student.status === 'present' ? 'absent' : 'present';
  renderTable();
}

function deleteRow(id) {
  const index = rows.findIndex(r => r.id === id);
  if (index !== -1) {
    rows.splice(index, 1);
  }
  renderTable();
}

function downloadExcel() {
  if (rows.length === 0) {
    showToast('No data to download');
    return;
  }
  window.location.href = "/download";
  showToast('✓ Downloaded — opens in Excel', true);
}

let toastTimer;

function showToast(message, isGreen = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className   = 'toast show' + (isGreen ? ' green' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = 'toast';
  }, 2400);
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

document.getElementById("startBtn").addEventListener("click", function() {
  const subjectInput = document.getElementById("subject-input").value.trim();
  if (!subjectInput) {
    showToast("Please enter subject first");
    return;
  }
  currentSubject = subjectInput;
  startCamera();
});

document.getElementById("logout-btn").addEventListener("click", async function() {
  await fetch("/logout", {
    credentials: "include"
  });
  window.location.href = "login.html";
});