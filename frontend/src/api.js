const API = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(url, options = {}) {
  const res = await fetch(`${API}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers
    }
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const text = await res.text();

  if (!res.ok) {
    let message = 'Error del servidor';
    if (isJson && text) {
      const err = JSON.parse(text);
      message = err.error || err.detail || message;
      if (!message && typeof err === 'object' && err !== null) {
        const msgs = Object.values(err).flat();
        message = msgs.length ? msgs[0] : 'Error del servidor';
      }
    } else if (text) {
      message = `Error del servidor (${res.status})`;
    }
    throw new Error(message);
  }

  if (!text) return null;
  return isJson ? JSON.parse(text) : text;
}

function uploadForm(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}${url}`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress({ loaded: e.loaded, total: e.total, percent: Math.round((e.loaded / e.total) * 100) });
        }
      };
    }
    xhr.onload = () => {
      let body = null;
      try { body = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { body = xhr.responseText; }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body);
      const msg = body && typeof body === 'object' ? (body.error || body.detail || 'Error del servidor') : `Error del servidor (${xhr.status})`;
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error('Error de red'));
    xhr.send(formData);
  });
}

const CHUNK_SIZE = 50 * 1024 * 1024; // 50 MiB por parte (PythonAnywhere limita a ~100 MiB por petición)
const CHUNK_THRESHOLD = 25 * 1024 * 1024;

function appendExtra(formData, entries) {
  entries.forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') formData.append(k, v);
  });
}

function uploadWithField(url, file, field, onProgress, extra = []) {
  if (file.size <= CHUNK_THRESHOLD) {
    const formData = new FormData();
    appendExtra(formData, extra);
    formData.append(field, file);
    return uploadForm(url, formData, onProgress);
  }
  return chunkedUpload(url, file, field, onProgress, extra);
}

async function chunkedUpload(url, file, field, onProgress, extra) {
  const total = file.size;
  const totalParts = Math.ceil(total / CHUNK_SIZE);
  const init = await request('/uploads/', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, size: total, total_parts: totalParts })
  });
  const uploadId = init.upload_id;

  for (let i = 0; i < totalParts; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, total);
    const part = file.slice(start, end);
    const formData = new FormData();
    formData.append('index', String(i));
    formData.append('offset', String(start));
    formData.append('part', part, file.name);
    await uploadForm(`/uploads/${uploadId}/parts/`, formData, (p) => {
      if (onProgress) {
        const loaded = start + p.loaded;
        onProgress({ loaded, total, percent: Math.round((loaded / total) * 100) });
      }
    });
  }

  await request(`/uploads/${uploadId}/complete/`, { method: 'POST' });
  if (onProgress) onProgress({ loaded: total, total, percent: 100 });

  const formData = new FormData();
  appendExtra(formData, extra);
  formData.append(`${field}_upload_id`, uploadId);
  return uploadForm(url, formData, onProgress);
}

export function login(email, password) {
  return request('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export function register(name, email, password) {
  return request('/auth/register/', {
    method: 'POST',
    body: JSON.stringify({ name, email, password })
  });
}

export function getProfile() {
  return request('/auth/profile/');
}

export function getPendingUsers() {
  return request('/auth/pending-users/');
}

export function reviewUser(userId, action) {
  return request('/auth/users/review/', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, action })
  });
}

export function updateProfile(data) {
  return request('/auth/profile/', {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export function getSports() {
  return request('/sports/');
}

export function getSport(id) {
  return request(`/sports/${id}/`);
}

export function createSport(data) {
  return request('/sports/', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function updateSport(id, data) {
  return request(`/sports/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export function deleteSport(id) {
  return request(`/sports/${id}/`, {
    method: 'DELETE'
  });
}

export function getActivities(sportId) {
  const query = sportId ? `?sport_id=${sportId}` : '';
  return request(`/activities/${query}`);
}

export function createActivity(data) {
  return request('/activities/', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function updateActivity(id, data) {
  return request(`/activities/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export function deleteActivity(id) {
  return request(`/activities/${id}/`, {
    method: 'DELETE'
  });
}

export function getTodayPoints() {
  return request('/points/today/');
}

export function getLeaderboard() {
  return request('/points/leaderboard/');
}

export function uploadDailyEvidence(file, kind, onProgress) {
  return uploadWithField('/points/image/', file, kind, onProgress);
}

export function submitSteps(steps, file, onProgress) {
  return uploadWithField('/points/steps/', file, 'steps_image', onProgress, [['steps', steps]]);
}

export function submitActivity(activityId) {
  return request('/points/activity/', {
    method: 'POST',
    body: JSON.stringify({ activity_id: activityId })
  });
}

export function getHistory() {
  return request('/points/history/');
}

export function getChallenges(active) {
  const query = active ? '?active=true' : '';
  return request(`/challenges/${query}`);
}

export function createChallenge(data, file, onProgress) {
  const extra = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (file) {
    return uploadWithField('/challenges/', file, 'video', onProgress, extra);
  }
  return request('/challenges/', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function updateChallenge(id, data) {
  return request(`/challenges/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

export function deleteChallenge(id) {
  return request(`/challenges/${id}/`, {
    method: 'DELETE'
  });
}

export function submitChallengeEvidence(challengeId, file, kind, onProgress) {
  return uploadWithField(`/challenges/${challengeId}/submit/`, file, kind, onProgress);
}

export function getChallengeSubmissions(challengeId, status) {
  const query = status ? `?status=${status}` : '';
  return request(`/challenges/${challengeId}/submissions/${query}`);
}

export function reviewSubmission(submissionId, status, points, comment) {
  return request(`/challenges/submissions/${submissionId}/review/`, {
    method: 'PATCH',
    body: JSON.stringify({ status, points, comment })
  });
}

export function deleteSubmission(submissionId) {
  return request(`/challenges/submissions/${submissionId}/`, {
    method: 'DELETE'
  });
}

export function approveUserSubmissions(challengeId, userId) {
  return request(`/challenges/${challengeId}/approve-user/`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId })
  });
}

export function completeChallenge(challengeId, message) {
  return request(`/challenges/${challengeId}/complete/`, {
    method: 'POST',
    body: JSON.stringify({ message: message || '' })
  });
}

export function getPendingCompletions() {
  return request('/challenges/completions/');
}

export function getSupervisorDashboard() {
  return request('/challenges/dashboard/');
}

export function getMedals(mine) {
  const query = mine ? '?mine=true' : '';
  return request(`/challenges/medals/${query}`);
}

export function getEvidence() {
  return request('/challenges/evidence/');
}

export function toggleEvidenceLike(evidenceId) {
  return request('/challenges/evidence/likes/', {
    method: 'POST',
    body: JSON.stringify({ evidence_id: evidenceId })
  });
}

export function getMessages() {
  return request('/chat/');
}

export function sendMessage(text) {
  return request('/chat/', {
    method: 'POST',
    body: JSON.stringify({ text })
  });
}

export function markChatRead(lastReadId) {
  return request('/chat/read/', {
    method: 'POST',
    body: JSON.stringify({ last_read_id: lastReadId })
  });
}

export function getUnreadCount() {
  return request('/chat/unread/');
}
