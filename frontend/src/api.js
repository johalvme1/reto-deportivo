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

export function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  return fetch(`${API}/points/image/`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
    return res.json();
  });
}

export function submitSteps(steps, file) {
  const formData = new FormData();
  formData.append('steps', steps);
  formData.append('steps_image', file);
  return fetch(`${API}/points/steps/`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.error); });
    return res.json();
  });
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

export function createChallenge(data, file) {
  if (file) {
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') formData.append(k, v);
    });
    formData.append('video', file);
    return fetch(`${API}/challenges/`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    }).then(res => {
      if (!res.ok) return res.json().then(e => { throw new Error(e.error || e.detail || 'Error del servidor'); });
      return res.json();
    });
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

export function submitChallengeEvidence(challengeId, file, kind) {
  const formData = new FormData();
  formData.append(kind, file);
  return fetch(`${API}/challenges/${challengeId}/submit/`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData
  }).then(async res => {
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    if (!res.ok) {
      const body = isJson ? await res.json() : await res.text();
      const msg = body && typeof body === 'object' ? (body.error || body.detail || 'Error del servidor') : `Error del servidor (${res.status})`;
      throw new Error(msg);
    }
    return isJson ? res.json() : res.text();
  });
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

export function getMedals(mine) {
  const query = mine ? '?mine=true' : '';
  return request(`/challenges/medals/${query}`);
}

export function getEvidence() {
  return request('/challenges/evidence/');
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
