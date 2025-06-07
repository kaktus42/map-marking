// ----- Parameters: Set according to your SVG map -----
const SVG_FILENAME = "germany.svg";
// You need to set these according to your SVG map's projection:
const SVG_VIEWBOX = { minX: 0, minY: 0, width: 600, height: 800 };
const MAP_MIN_LON = 5.866, MAP_MAX_LON = 15.042;
const MAP_MIN_LAT = 47.270, MAP_MAX_LAT = 55.059;

//---------------------------------------------------------------------

let svgDoc = null;             // loaded SVG will be here
let markedCities = [];         // { name, lat, lon }
const cityMarkerGroupId = 'city-markers-group';

// --- 1. Load SVG ---
fetch(SVG_FILENAME)
  .then(res => res.text())
  .then(svgStr => {
    document.getElementById('svg-container').innerHTML = svgStr;
    svgDoc = document.querySelector("#svg-container svg");
    ensureMarkerGroup();
    restoreFromURL();
    updateCityMarkers();
  });

function ensureMarkerGroup() {
  if (!svgDoc) return;
  let group = svgDoc.getElementById(cityMarkerGroupId);
  if (!group) {
    group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', cityMarkerGroupId);
    svgDoc.appendChild(group);
  }
}

// --- 2. Autocomplete logic ---
const searchInput = document.getElementById('city-search');
const autocompleteDiv = document.getElementById('autocomplete');

// Helper for fast lookup of already marked cities
function isCityMarked(name) {
  return markedCities.some(c => c.name === name);
}

searchInput.addEventListener('input', function () {
  const val = searchInput.value.trim().toLowerCase();
  autocompleteDiv.innerHTML = '';
  if (!val) return;
  let filtered = cities
    .filter(c => c.name.toLowerCase().includes(val) && !isCityMarked(c.name));

  if (filtered.length === 0) return;

  // Only show autocomplete if <= 10 matches or when user types more
  if (filtered.length <= 10) {
    filtered.forEach(city => {
      const cityDiv = document.createElement('div');
      cityDiv.innerText = city.name;
      cityDiv.addEventListener('click', () => {
        addCity(city);
        autocompleteDiv.innerHTML = '';
        searchInput.value = '';
      });
      autocompleteDiv.appendChild(cityDiv);
    });
  }
});

// Hide autocomplete on blur
searchInput.addEventListener('blur', () => {
  setTimeout(() => autocompleteDiv.innerHTML = '', 200);
});

// On enter, add city if unique match
searchInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const val = searchInput.value.trim().toLowerCase();
    let filtered = cities
      .filter(c => c.name.toLowerCase().includes(val) && !isCityMarked(c.name));
    if (filtered.length === 1) {
      addCity(filtered[0]);
      autocompleteDiv.innerHTML = '';
      searchInput.value = '';
      e.preventDefault();
    }
  }
});

// --- 3. Add/Remove Logic ---
function addCity(city) {
  if (isCityMarked(city.name)) return;
  markedCities.push(city);
  updateCityMarkers();
  updateCityList();
  updateShareURL();
}

function removeCity(cityName) {
  markedCities = markedCities.filter(c => c.name !== cityName);
  updateCityMarkers();
  updateCityList();
  updateShareURL();
}

// --- 4. Map coords (lat/lon) to SVG x/y (Assuming simple equirectangular) ---
function geoToSvg(lat, lon) {
  // Linearly scale longitude to viewBox x
  const x = ((lon - MAP_MIN_LON) / (MAP_MAX_LON - MAP_MIN_LON)) * SVG_VIEWBOX.width + SVG_VIEWBOX.minX;
  // Linearly scale latitude to viewBox y (SVG y grows downward; latitude grows upward)
  const y = SVG_VIEWBOX.minY + SVG_VIEWBOX.height - ((lat - MAP_MIN_LAT) / (MAP_MAX_LAT - MAP_MIN_LAT)) * SVG_VIEWBOX.height;
  return { x, y };
}

// --- 5. Render markers in SVG ---
function updateCityMarkers() {
  if (!svgDoc) return;
  ensureMarkerGroup();
  const markerGroup = svgDoc.getElementById(cityMarkerGroupId);
  markerGroup.innerHTML = '';
  markedCities.forEach(city => {
    const {x, y} = geoToSvg(city.lat, city.lon);
    // Draw marker
    const marker = document.createElementNS('http://www.w3.org/2000/svg','circle');
    marker.setAttribute('cx', x);
    marker.setAttribute('cy', y);
    marker.setAttribute('r', 5);
    marker.setAttribute('data-city', city.name);
    markerGroup.appendChild(marker);

    // City name label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x + 13);
    label.setAttribute('y', y + 4);
    label.setAttribute('font-size', '18');
    label.setAttribute('fill', '#212121');
    label.setAttribute('font-family', 'sans-serif');
    label.textContent = city.name;
    label.setAttribute('pointer-events','none');
    markerGroup.appendChild(label);

    // Optional: allow removing city by clicking marker:
    marker.addEventListener('click', () => removeCity(city.name));
  });
}

// --- 6. List of currently marked cities ---
function updateCityList() {
  const div = document.getElementById('city-list');
  div.innerHTML = '';
  markedCities.forEach(city => {
    const span = document.createElement('span');
    span.className = 'marked-city';
    span.innerText = city.name;
    const removeBtn = document.createElement('span');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '✕';
    removeBtn.addEventListener('click', ()=> removeCity(city.name));
    span.appendChild(removeBtn);
    div.appendChild(span);
  });
}

// --- 7. Download SVG with city markers ---
document.getElementById('download-btn').addEventListener('click', function() {
  if (!svgDoc) return;
  // Clone and serialize
  const svgElem = svgDoc.cloneNode(true);
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgElem);

  const blob = new Blob([source], {type:'image/svg+xml;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'germany_marked.svg';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 100);
});

// --- 8. Shareable URL ---
function updateShareURL() {
  if (!markedCities.length) {
    history.replaceState({}, '', window.location.pathname); // clean url
    return;
  }
  // use comma-separated city names
  const cityNames = markedCities.map(c=>encodeURIComponent(c.name)).join(",");
  const url = `${window.location.pathname}?cities=${cityNames}`;
  history.replaceState({}, '', url);
}

document.getElementById('share-btn').addEventListener('click', function() {
  const url = window.location.href;
  navigator.clipboard.writeText(url)
    .then(() => {
      document.getElementById('share-status').textContent = " Link copied!";
      setTimeout(()=>document.getElementById('share-status').textContent='', 1500);
    })
    .catch(() => {
      document.getElementById('share-status').textContent = " Could not copy.";
    });
});

// --- 9. Restore state from URL ---
function restoreFromURL() {
  const params = new URLSearchParams(window.location.search);
  let urlCities = params.get('cities');
  if (urlCities) {
    let names = urlCities.split(',').map(decodeURIComponent);
    markedCities = [];
    for (let n of names) {
      let city = cities.find(c => c.name === n);
      if (city) markedCities.push(city);
    }
    // If svg loaded, add
    updateCityMarkers();
    updateCityList();
  }
}
