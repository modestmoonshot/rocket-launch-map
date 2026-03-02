import { fetchLaunches, fetchPads } from './api.js';

async function init() {
  const map = L.map('map').setView([28.6, -80.6], 3);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  document.getElementById('launch-list').innerHTML = '<p class="loading">Scaffold complete.</p>';
}

init();
