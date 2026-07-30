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

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error del servidor' }));
    throw new Error(err.error || 'Error del servidor');
  }

  return res.json();
}

export function login(email, password) {
  return request('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export function register(username, email, password) {
  return request('/auth/register/', {
    method: 'POST',
    body: JSON.stringify({ username, email, password })
  });
}

export function getProfile() {
  return request('/auth/profile/');
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

export function submitComment(comment) {
  return request('/points/comment/', {
    method: 'POST',
    body: JSON.stringify({ comment })
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
