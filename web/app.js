const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const state = {
  locations: [],
  stations: [],
  connections: [],
  routes: [],
  selectedRoute: null,
  candidates: [],
  page: 'overview',
  currentLocation: null,
  lastRouteData: null,
  animationFrame: null,
  animationPaused: false,
  animationElapsed: 0,
  animationDuration: 0
};

const fmt = n => Number(n).toLocaleString('en-IN');
const money = n => '₹' + fmt(Math.round(n));

const duration = n => {
  n = Math.round(n);
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? `${h}h ${m}m` : `${m} min`;
};

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* Connect the Vercel frontend to the Render backend. */
const API_BASE = 'https://skyroute-intelligence.onrender.com';

```javascript
```javascript
async function api(path, options = {}) {
    let url;

    if (/^https?:\/\//i.test(path)) {
        url = path;
    } else {
        const endpoint = path.startsWith("/") ? path : "/" + path;
        url = API_BASE + endpoint;
    }

    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    if (!res.ok) {
        throw new Error("API error: " + res.status + " " + res.statusText);
    }

    return res.json();
}
```
    if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
}
```

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({
    error: 'The server returned an unreadable response.'
  }));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function city(id) {
  return state.locations.find(x => x.id === id);
}

function point(loc) {
  const minLon = 76.1;
  const maxLon = 80.8;
  const minLat = 7.6;
  const maxLat = 13.6;

  return {
    x: 40 + (loc.lon - minLon) / (maxLon - minLon) * 680,
    y: 25 + (maxLat - loc.lat) / (maxLat - minLat) * 330
  };
}

const leafletMaps = {};
const tnBounds = [[7.7, 75.8], [13.7, 80.7]];

function mapSvg() {
  return '<div class="map-fallback">Interactive map needs an internet connection to load OpenStreetMap tiles.</div>';
}

function renderMap(id, { route = null, infra = false, labels = true } = {}) {
  const el = document.getElementById(id);
  if (!el) return;

  if (!window.L) {
    el.innerHTML = mapSvg();
    return;
  }

  if (leafletMaps[id]) {
    leafletMaps[id].remove();
    delete leafletMaps[id];
  }

  el.innerHTML = '';

  const map = L.map(el, {
    zoomControl: false,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    boxZoom: true
  }).setView([10.8, 78.2], 7);

  const osm = L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="\_blank" rel="noopener">OpenStreetMap contributors</a>'
    }
  ).addTo(map);

  const osmHot = L.tileLayer(
    'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors · HOT style'
    }
  );

  L.control.layers(
    {
      'Live street map': osm,
      'Humanitarian style': osmHot
    },
    null,
    {
      position: 'topleft',
      collapsed: true
    }
  ).addTo(map);

  leafletMaps[id] = map;

  /* Accessible zoom controls for desktop and mobile. */
  const zoomControl = L.control({ position: 'topright' });

  zoomControl.onAdd = function () {
    const box = L.DomUtil.create('div', 'skyroute-map-controls');

    box.setAttribute('aria-label', 'Map zoom controls');

    box.innerHTML =
      '<button type="button" class="map-zoom-in" aria-label="Zoom in" title="Zoom in">+</button>' +
      '<button type="button" class="map-zoom-out" aria-label="Zoom out" title="Zoom out">−</button>' +
      '<button type="button" class="map-zoom-home" aria-label="Show all Tamil Nadu" title="Show all Tamil Nadu">⌂</button>';

    L.DomEvent.disableClickPropagation(box);
    L.DomEvent.disableScrollPropagation(box);

    L.DomEvent.on(
      box.querySelector('.map-zoom-in'),
      'click',
      () => map.zoomIn()
    );

    L.DomEvent.on(
      box.querySelector('.map-zoom-out'),
      'click',
      () => map.zoomOut()
    );

    L.DomEvent.on(
      box.querySelector('.map-zoom-home'),
      'click',
      () => map.fitBounds(tnBounds, { padding: [22, 22] })
    );

    return box;
  };

  zoomControl.addTo(map);

  const bounds = [];

  if (infra) {
    state.locations.forEach(loc => {
      const c = state.candidates.find(x => x.id === loc.id);

      const color = c && c.score >= 75
        ? '#8b6be8'
        : c && c.score >= 55
          ? '#e9a64e'
          : '#4d83ed';

      L.circleMarker([loc.lat, loc.lon], {
        radius: 5,
        color: '#fff',
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.95
      })
        .bindPopup(
          `<b>${esc(loc.name)}</b><br>` +
          `${esc(loc.district)} district` +
          `${c ? `<br>Illustrative score: ${c.score}/100` : ''}`
        )
        .addTo(map);

      bounds.push([loc.lat, loc.lon]);
    });

  } else if (route) {
    const segs = (route.segments || [])
      .map(seg => ({
        ...seg,
        coordinates: (seg.coordinates || [])
          .filter(c =>
            Array.isArray(c) &&
            c.length >= 2 &&
            Number.isFinite(+c[0]) &&
            Number.isFinite(+c[1])
          )
          .map(c => [+c[0], +c[1]])
      }))
      .filter(s => s.coordinates.length >= 2);

    /* Fallback for older API responses without route segments. */
    if (
      !segs.length &&
      Array.isArray(route.geometry) &&
      route.geometry.length >= 2
    ) {
      const g = route.geometry
        .filter(c =>
          Array.isArray(c) &&
          c.length >= 2 &&
          Number.isFinite(+c[0]) &&
          Number.isFinite(+c[1])
        )
        .map(c => [+c[0], +c[1]]);

      if (g.length >= 4) {
        segs.push({
          mode: 'road',
          from: route.origin?.name || 'Journey start',
          to: 'Takeoff point',
          distance_km: 2,
          duration_minutes: 8,
          coordinates: [g[0], g[1]]
        });

        segs.push({
          mode: 'air',
          from: 'Takeoff point',
          to: 'Landing point',
          distance_km: 0,
          duration_minutes: 0,
          coordinates: [g[1], g[2]]
        });

        segs.push({
          mode: 'road',
          from: 'Landing point',
          to: route.destination?.name || 'Destination',
          distance_km: 3,
          duration_minutes: 10,
          coordinates: [g[2], g[3]]
        });

      } else {
        segs.push({
          mode: 'road',
          from: route.origin?.name || 'Journey start',
          to: route.destination?.name || 'Destination',
          distance_km: route.distance_km || 0,
          duration_minutes: route.duration_minutes || 0,
          coordinates: g
        });
      }
    }

    const routeRenderer = L.canvas({ padding: 0.5 });

    const routePane =
      map.getPane('routeLines') || map.createPane('routeLines');

    routePane.style.zIndex = 420;

    const markerPane =
      map.getPane('routeMarkers') || map.createPane('routeMarkers');

    markerPane.style.zIndex = 650;

    segs.forEach((seg, i) => {
      const coords = seg.coordinates;
      const air = seg.mode === 'air';
      const color = air ? '#16a34a' : '#2563eb';

      /* White outline keeps the route visible on different map styles. */
      L.polyline(coords, {
        renderer: routeRenderer,
        pane: 'routeLines',
        color: '#ffffff',
        weight: air ? 12 : 13,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false
      }).addTo(map);

      const line = L.polyline(coords, {
        renderer: routeRenderer,
        pane: 'routeLines',
        color,
        weight: air ? 7 : 8,
        opacity: 1,
        dashArray: air ? '10 9' : null,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      const modeName = air ? 'SIMULATED FLIGHT' : 'ROAD TRAVEL';

      line.bindTooltip(
        `${modeName} · ${fmt(seg.distance\_km)} km · ${duration(seg.duration\_minutes)}`,
        {
          sticky: true,
          permanent: true,
          direction: 'center',
          className: air ? 'route-label-air' : 'route-label-road'
        }
      );

      const a = coords[0];
      const b = coords[coords.length - 1];

      bounds.push(...coords);

      const fromLabel = air
        ? 'TAKEOFF POINT'
        : (i === 0 ? 'JOURNEY START' : 'LANDING POINT');

      const toLabel = air
        ? 'LANDING POINT'
        : (i === segs.length - 1 ? 'DESTINATION' : 'TAKEOFF POINT');

      const popup = (title, detail) =>
        `<div class="route-popup"><b>${esc(title)}</b><br>` +
        `${esc(detail || 'Journey waypoint')}<br>` +
        `<strong>${fmt(seg.distance\_km)} km</strong> · ` +
        `${duration(seg.duration\_minutes)}</div>`;

      L.circleMarker(a, {
        pane: 'routeMarkers',
        radius: air ? 9 : 8,
        color: '#fff',
        weight: 3,
        fillColor: air ? '#16a34a' : '#2563eb',
        fillOpacity: 1
      })
        .bindPopup(popup(fromLabel, seg.from))
        .addTo(map);

      L.circleMarker(b, {
        pane: 'routeMarkers',
        radius: air ? 9 : 8,
        color: '#fff',
        weight: 3,
        fillColor: air ? '#16a34a' : '#2563eb',
        fillOpacity: 1
      })
        .bindPopup(popup(toLabel, seg.to))
        .addTo(map);

      if (i === 0 && segs.some(x => x.mode === 'air')) {
        L.marker(b, {
          pane: 'routeMarkers',
          zIndexOffset: 1000,
          icon: L.divIcon({
            className: 'route-point-label takeoff-label',
            html: '<span>✈ TAKEOFF POINT</span>',
            iconSize: [125, 26],
            iconAnchor: [12, 13]
          })
        }).addTo(map);
      }

      if (air) {
        L.marker(b, {
          pane: 'routeMarkers',
          zIndexOffset: 1100,
          icon: L.divIcon({
            className: 'route-point-label landing-label',
            html: '<span>▣ LANDING POINT</span>',
            iconSize: [125, 26],
            iconAnchor: [12, 13]
          })
        }).addTo(map);
      }
    });

    const coords = segs.flatMap(s => s.coordinates);

    if (coords.length) {
      L.marker(coords[0], {
        pane: 'routeMarkers',
        zIndexOffset: 800
      })
        .bindPopup(
          `<b>Journey start</b><br>${esc(route.origin?.name || 'Journey origin')}`
        )
        .addTo(map);

      L.marker(coords[coords.length - 1], {
        pane: 'routeMarkers',
        zIndexOffset: 800
      })
        .bindPopup(
          `<b>Destination</b><br>${esc(route.destination?.name || 'Destination')}`
        )
        .addTo(map);

      map.fitBounds(bounds, {
        padding: [55, 55],
        maxZoom: 12
      });
    }

    /* Map legend. */
    const legend = L.control({ position: 'bottomleft' });

    legend.onAdd = () => {
      const d = L.DomUtil.create('div', 'route-map-legend');

      d.innerHTML =
        '<span><i class="road-swatch"> Road travel</span>' +
        '<span><i class="air-swatch"> Simulated flying-car</span>';

      return d;
    };

    legend.addTo(map);

  } else {
    /* Statewide concept network. Air links are hypothetical. */
    const locById = Object.fromEntries(
      state.locations.map(x => [x.id, x])
    );

    const roadCorridors = [
      ['coimbatore', 'tiruppur'],
      ['tiruppur', 'erode'],
      ['erode', 'salem'],
      ['salem', 'dharmapuri'],
      ['salem', 'tiruchirappalli'],
      ['tiruchirappalli', 'thanjavur'],
      ['tiruchirappalli', 'dindigul'],
      ['dindigul', 'madurai'],
      ['madurai', 'tirunelveli'],
      ['madurai', 'thoothukudi'],
      ['chennai', 'chengalpattu'],
      ['chengalpattu', 'villupuram'],
      ['villupuram', 'cuddalore'],
      ['chennai', 'kanchipuram'],
      ['chennai', 'vellore']
    ];

    roadCorridors.forEach(([a, b]) => {
      const p = locById[a];
      const q = locById[b];

      if (p && q) {
        L.polyline(
          [[p.lat, p.lon], [q.lat, q.lon]],
          {
            color: '#3478f6',
            weight: 3,
            opacity: 0.78,
            lineCap: 'round'
          }
        ).addTo(map);
      }
    });

    state.connections.forEach(con => {
      const p = locById[con.from];
      const q = locById[con.to];

      if (!p || !q) return;

      L.polyline(
        [[p.lat, p.lon], [q.lat, q.lon]],
        {
          color: '#13b89b',
          weight: 2.8,
          opacity: 0.95,
          dashArray: '7 7',
          lineCap: 'round'
        }
      )
        .bindTooltip(
          `SIMULATED AIR LINK · ${esc(p.name)} → ${esc(q.name)}`
        )
        .addTo(map);
    });

    state.locations.forEach(loc => {
      const hub = state.stations.some(st => st.city === loc.id);

      L.circleMarker([loc.lat, loc.lon], {
        radius: hub ? 7 : 4.5,
        color: '#fff',
        weight: hub ? 2 : 1.4,
        fillColor: hub ? '#147fd1' : '#26394b',
        fillOpacity: 1
      })
        .bindPopup(
          `<div class="route-popup"><b>${esc(loc.name)}</b><br>` +
          `${esc(loc.district)} district` +
          `${hub ? '<br><strong>Hypothetical mobility hub</strong>' : ''}` +
          '<br><small>Reference location; not a surveyed district boundary.</small></div>'
        )
        .addTo(map);

      const icon = L.divIcon({
        className: hub ? 'network-hub-label' : 'district-map-label',
        html: hub
          ? `<span>✦ ${esc(loc.name)}</span>`
          : `<span>${esc(loc.district)}</span>`,
        iconSize: [112, 18],
        iconAnchor: [hub ? -6 : 56, -5]
      });

      L.marker([loc.lat, loc.lon], {
        icon,
        interactive: false
      }).addTo(map);

      bounds.push([loc.lat, loc.lon]);
    });

    const titleControl = L.control({ position: 'topleft' });

    titleControl.onAdd = () => {
      const d = L.DomUtil.create('div', 'network-map-title');

      d.innerHTML =
        'TAMIL NADU · HYBRID MOBILITY NETWORK' +
        '<span>Road connectivity + hypothetical flying-car links</span>';

      return d;
    };

    titleControl.addTo(map);

    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = () => {
      const d = L.DomUtil.create('div', 'network-map-legend');

      d.innerHTML =
        '<div><i class="network-road-key"><span>Road corridor<small>Blue solid · indicative</small></span></div>' +
        '<div><i class="network-air-key"><span>Simulated air<small>Green dashed · hypothetical</small></span></div>' +
        '<div><i class="network-hub-key">✦<span>Concept hub<small>Not an operating facility</small></span></div>';

      return d;
    };

    legend.addTo(map);

    map.fitBounds(
      bounds.length ? bounds : tnBounds,
      { padding: [38, 38] }
    );
  }

  if (!route) {
    map.setMaxBounds([[7.2, 75.2], [14.2, 81.2]]);
  }

  if (!route && id === 'overviewMap') {
    map.fitBounds(tnBounds, { padding: [24, 24] });
  }

  setTimeout(() => map.invalidateSize(), 120);
}

function setupLocations() {
  const opts = state.locations
    .slice()
    .sort((a, b) =>
      a.district.localeCompare(b.district) ||
      a.name.localeCompare(b.name)
    )
    .map(l =>
      `<option value="${l.id}">${esc(l.district)} district · ${esc(l.name)}</option>`
    )
    .join('');

  $('#origin').innerHTML = opts;
  $('#destination').innerHTML = opts;
  $('#origin').value = 'dindigul';
  $('#destination').value = 'chennai';
}

function showPage(name) {
  state.page = name;

  $$('.page').forEach(p =>
    p.classList.toggle('active', p.id === `page-${name}`)
  );

  $$('.nav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.page === name)
  );

  $('#crumbTitle').textContent = ({
    overview: 'Overview',
    planner: 'Journey planner',
    infrastructure: 'Infrastructure intelligence',
    simulator: 'Network simulator',
    profile: 'My profile'
  })[name] || 'Overview';

  $('#sidebar').classList.remove('open');

  if (name === 'overview') renderMap('overviewMap');

  if (name === 'infrastructure' && !state.candidates.length) {
    loadInfrastructure();
  }

  if (name === 'profile') loadProfile();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function routeCard(route) {
  const selected = route.id === state.selectedRoute;
  const sim = route.is_simulated;
  const icon = sim ? '✦' : '⌁';

  const detail = route.segments
    .map(s =>
      `${esc(s.mode === 'air' ? 'Air concept' : 'Road')}: ${duration(s.duration\_minutes)}`
    )
    .join(' · ');

  return `
    <article class="route-card ${selected ? 'selected' : ''}" data-route="${route.id}">
      <div class="route-card-main" role="button" tabindex="0">
        <span class="route-type-icon ${sim ? 'air' : ''}">${icon}</span>
        <div class="route-info">
          <span class="route-badge ${sim ? 'sim' : ''}">${sim ? 'SIMULATED CONCEPT' : 'ESTIMATED ROAD'}</span>
          <h4>${esc(route.name)}</h4>
          <p>${route.transfers} transfer${route.transfers === 1 ? '' : 's'} · ${fmt(route.distance_km)} km approx.</p>
        </div>
        <div class="route-metrics">
          ${duration(route.duration_minutes)}
          <small>${money(route.estimated_cost)} est.</small>
        </div>
        <span class="route-radio"></span>
      </div>
      <div class="route-details">
        <span>Journey ${duration(route.duration_minutes)}</span>
        <span>Distance ${fmt(route.distance_km)} km</span>
        <span>Cost ${money(route.estimated_cost)}</span>
        <span>${detail}</span>
      </div>
    </article>`;
}

function renderJourneySteps(route) {
  const box = $('#journeySteps');

  if (!route || !route.segments?.length) {
    box.innerHTML = '<div class="journey-step-placeholder">No itinerary steps available.</div>';
    return;
  }

  box.innerHTML = route.segments.map((seg, i) => {
    const mode = seg.mode === 'air' ? 'air' : 'road';

    const title = seg.mode === 'air'
      ? 'Fly · simulated concept'
      : 'Drive · road segment';

    const defaultText = seg.mode === 'air'
      ? 'Simulated flying-car leg between hypothetical concept points.'
      : `Road travel from ${seg.from} to ${seg.to}.`;

    const stageText = seg.mode === 'air'
      ? 'Take off here and fly to the marked landing point (simulated).'
      : (
          i === 0 && route.segments.some(x => x.mode === 'air')
            ? `Drive approximately ${fmt(seg.distance\_km)} km by road to reach the takeoff point.`
            : (
                route.segments.some(x => x.mode === 'air') &&
                i === route.segments.length - 1
                  ? `After landing, drive approximately ${fmt(seg.distance\_km)} km by road to reach your destination.`
                  : defaultText
              )
        );

    return `
      <article class="journey-step" data-step="${i}">
        <div class="journey-step-number ${mode}">${seg.mode === 'air' ? '✦' : i + 1}</div>
        <div class="journey-step-copy">
          ${esc(title)}
          <span>${esc(seg.from)} <span class="step-arrow">→</span> ${esc(seg.to)}</span>
          <small>${esc(stageText || seg.instruction || defaultText)}</small>
        </div>
        <div class="journey-step-meta">
          ${duration(seg.duration_minutes)}
          <small>${fmt(seg.distance_km)} km</small>
        </div>
      </article>`;
  }).join('') +
  '<div class="itinerary-disclaimer">Concept itinerary only. Generated takeoff/landing points are illustrative, not real facilities. No turn-by-turn road geometry or authorized air corridors are provided.</div>';
}

function renderRoutes(data) {
  state.lastRouteData = data;
  state.routes = data.routes || [];
  state.selectedRoute = data.selected_route_id || state.routes[0]?.id;

  $('#routeSubtitle').textContent =
    `${data.origin.name} → ${data.destination.name} · ${data.preference.replace('\_', ' ')}`;

  $('#resultsCount').textContent =
    `${state.routes.length} OPTION${state.routes.length === 1 ? '' : 'S'}`;

  $('#routeResults').innerHTML = state.routes.length
    ? state.routes.map(routeCard).join('')
    : '<div class="empty-results"><h4>No route options found</h4><p>Try a different origin or destination.</p></div>';

  $$('.route-card').forEach(card => {
    const select = () => selectRoute(card.dataset.route);

    $('.route-card-main', card).addEventListener('click', select);

    $('.route-card-main', card).addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select();
      }
    });
  });

  const selected = state.routes.find(r => r.id === state.selectedRoute);

  if (selected) {
    const withEndpoints = {
      ...selected,
      origin: data.origin,
      destination: data.destination
    };

    renderMap('routeMap', { route: withEndpoints, labels: false });
    renderJourneySteps(withEndpoints);

    $('#routeMap').classList.add('has-route');
    $('#journeyProgressLabel').textContent = 'Ready to animate this journey';
    $('#journeyProgressPercent').textContent = '0%';
    $('#journeyProgressBar').style.width = '0%';
    $('#replayJourney').disabled = false;
    $('#replayJourney').textContent = '▶ Start animation';
    $('#pauseJourney').disabled = true;
    $('#pauseJourney').textContent = 'Ⅱ Pause';

    state.pendingAnimationRoute = withEndpoints;
  } else {
    renderMap('routeMap', {});
    renderJourneySteps(null);
  }

  if (data.warnings?.length) {
    $('#routeMap').setAttribute('title', data.warnings.join(' '));
  }
}

function selectRoute(id) {
  state.selectedRoute = id;

  $$('.route-card').forEach(c =>
    c.classList.toggle('selected', c.dataset.route === id)
  );

  const r = state.routes.find(x => x.id === id);
  if (!r) return;

  const data = state.lastRouteData;

  const route = {
    ...r,
    origin: data.origin,
    destination: data.destination
  };

  renderMap('routeMap', { route, labels: false });
  renderJourneySteps(route);

  $('#replayJourney').disabled = false;
  $('#replayJourney').textContent = '▶ Start animation';
  $('#pauseJourney').disabled = true;

  state.pendingAnimationRoute = route;

  toast(`${r.name} selected · route lines are shown on the map`);
}

function setCurrentLocation() {
  const btn = $('#useCurrentLocation');
  const status = $('#locationStatus');

  if (!navigator.geolocation) {
    status.textContent = 'Geolocation is not supported by this browser.';
    return;
  }

  btn.disabled = true;
  btn.textContent = '⌖ Finding location…';
  status.textContent = 'Requesting permission from your browser…';

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      if (lat < 7.7 || lat > 13.7 || lon < 75.8 || lon > 80.7) {
        status.textContent = 'Your current location appears outside the Tamil Nadu demo coverage. Choose a district instead.';
        btn.disabled = false;
        btn.textContent = '⌖ Use my current location';
        return;
      }

      state.currentLocation = {
        lat,
        lon,
        name: 'My current location'
      };

      let opt = $('#origin').querySelector('option[value="current_location"]');

      if (!opt) {
        opt = document.createElement('option');
        opt.value = 'current_location';
        opt.textContent = 'My current location · GPS';
        $('#origin').prepend(opt);
      }

      $('#origin').value = 'current_location';

      status.textContent =
        `Current location ready · ${lat.toFixed(4)}, ${lon.toFixed(4)}`;

      btn.disabled = false;
      btn.textContent = '✓ Current location set';

      toast('Current location added as your journey origin');
    },
    err => {
      const messages = {
        1: 'Location permission was denied. Allow location access in your browser settings.',
        2: 'Your location could not be determined. Try again or choose a district.',
        3: 'Location request timed out. Try again.'
      };

      status.textContent =
        messages[err.code] || 'Could not get your location. Choose a district manually.';

      btn.disabled = false;
      btn.textContent = '⌖ Use my current location';
    },
    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000
    }
  );
}

async function runRoutes() {
  const origin = $('#origin').value;
  const destination = $('#destination').value;
  const preference = $('input[name="preference"]:checked').value;

  if (origin === destination) {
    toast('Choose two different locations to compare a journey.');
    return;
  }

  const btn = $('#searchRoutes');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Planning your journey…';

  try {
    const payload = {
      origin,
      destination,
      preference,
      flying_car: $('#flyingCarToggle').checked
    };

    if (origin === 'current_location' && state.currentLocation) {
      payload.origin_point = {
        lat: state.currentLocation.lat,
        lon: state.currentLocation.lon
      };
      payload.origin_name = state.currentLocation.name;
    }

    const data = await api('/api/routes/compare', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (data.error) throw new Error(data.error);

    renderRoutes(data);

    if (data.routes.length) {
      toast(
        `Journey ready · ${data.routes.length} route option${data.routes.length > 1 ? 's' : ''}`
      );
    }
  } catch (e) {
    toast(e.message);
    $('#journeyProgressLabel').textContent = 'Could not plan journey';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>⌕</span> Start journey <span class="button-arrow">→</span>';
  }
}

function startJourneyAnimation(route) {
  if (state.animationFrame) {
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
  }

  state.animationPaused = false;
  state.animationElapsed = 0;
  state.animationDuration = 8000;

  const map = leafletMaps.routeMap;

  if (!map || !route) return;

  const segments = (route.segments || [])
    .map(seg => ({
      ...seg,
      coordinates: (seg.coordinates || [])
        .filter(c =>
          Array.isArray(c) &&
          c.length >= 2 &&
          Number.isFinite(+c[0]) &&
          Number.isFinite(+c[1])
        )
        .map(c => [+c[0], +c[1]])
    }))
    .filter(seg => seg.coordinates.length >= 2);

  if (!segments.length) {
    toast('No route geometry is available to animate.');
    return;
  }

  const allPoints = segments.flatMap(seg => seg.coordinates);
  const marker = L.marker(allPoints[0]).addTo(map);

  const startedAt = performance.now();

  $('#pauseJourney').disabled = false;
  $('#replayJourney').textContent = '↻ Replay';

  function frame(now) {
    if (state.animationPaused) return;

    const progress = Math.min(1, (now - startedAt) / state.animationDuration);
    const pointIndex = Math.min(
      allPoints.length - 1,
      Math.floor(progress * (allPoints.length - 1))
    );

    marker.setLatLng(allPoints[pointIndex]);

    $('#journeyProgressPercent').textContent =
      `${Math.round(progress \* 100)}%`;

    $('#journeyProgressBar').style.width =
      `${progress \* 100}%`;

    $('#journeyProgressLabel').textContent =
      progress >= 1 ? 'Journey animation complete' : 'Simulating journey…';

    if (progress < 1) {
      state.animationFrame = requestAnimationFrame(frame);
    } else {
      state.animationFrame = null;
      $('#pauseJourney').disabled = true;
      $('#pauseJourney').textContent = 'Ⅱ Pause';
      toast('Journey animation complete');
    }
  }

  state.animationFrame = requestAnimationFrame(frame);
}

function pauseJourneyAnimation() {
  if (state.animationFrame) {
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
    state.animationPaused = true;
    $('#pauseJourney').textContent = '▶ Resume';
    return;
  }

  if (state.animationPaused) {
    state.animationPaused = false;

    const route = state.pendingAnimationRoute ||
      (() => {
        const r = state.lastRouteData?.routes.find(
          r => r.id === state.selectedRoute
        );

        return r
          ? {
              ...r,
              origin: state.lastRouteData.origin,
              destination: state.lastRouteData.destination
            }
          : null;
      })();

    if (route) resumeJourneyAnimation(route);
  }
}

function resumeJourneyAnimation(route) {
  startJourneyAnimation(route);
}

async function loadInfrastructure() {
  try {
    const d = await api('/api/infrastructure/candidates');

    state.candidates = d.candidates;

    renderCandidates();
    renderMap('infraMap', { infra: true });

    $('#infraCount').innerHTML =
      `${d.count} <small>locations</small>`;

    $('#infraHigh').innerHTML =
      `${d.candidates.filter(c => c.score >= 75).length} <small>candidates</small>`;
  } catch (e) {
    toast('Could not load infrastructure analysis: ' + e.message);
  }
}

function renderCandidates() {
  const search = ($('#candidateSearch')?.value || '').toLowerCase();
  const filter = $('#candidateFilter')?.value || 'all';

  const list = state.candidates
    .filter(c =>
      c.city.toLowerCase().includes(search) ||
      c.district.toLowerCase().includes(search)
    )
    .filter(c =>
      filter === 'all' ||
      (filter === 'high' && c.score >= 75) ||
      (filter === 'medium' && c.score >= 55 && c.score < 75) ||
      (filter === 'low' && c.score < 55)
    );

  $('#candidateRows').innerHTML = list.map((c, i) => `
    <tr>
      <td>
        <div class="location-cell">
          <span class="rank-chip">${String(i + 1).padStart(2, '0')}</span>
          <div>
            ${esc(c.city)}
            <small>${esc(c.district)} · ${c.nearest_hub_km} km to nearest concept hub</small>
          </div>
        </div>
      </td>
      <td>${c.demand_score}<span class="muted-percent">/100</span></td>
      <td>${c.access_score}<span class="muted-percent">/100</span></td>
      <td>${c.coverage_score}<span class="muted-percent">/100</span></td>
      <td>
        <span class="score-pill ${c.score < 55 ? 'low' : c.score < 75 ? 'medium' : ''}">
          ${c.score}<span>●</span>
        </span>
      </td>
      <td><span class="status-label">${esc(c.recommendation)}</span></td>
    </tr>
  `).join('') ||
    '<tr><td colspan="6" class="table-loading">No locations match your filters.</td></tr>';
}

async function applyWeights() {
  const btn = $('#applyWeights');
  btn.disabled = true;

  try {
    const data = await api('/api/infrastructure/analyze', {
      method: 'POST',
      body: JSON.stringify({
        demand_weight: +$('#demandWeight').value,
        access_weight: +$('#accessWeight').value,
        coverage_weight: +$('#coverageWeight').value
      })
    });

    state.candidates = data.candidates;

    renderCandidates();
    renderMap('infraMap', { infra: true });

    $('#infraHigh').innerHTML =
      `${data.candidates.filter(c => c.score >= 75).length} <small>candidates</small>`;

    toast('Candidate scores recalculated');
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
}

function renderSimulation(d) {
  const m = d.metrics;

  $('#simSaved').innerHTML =
    `${m.time\_saved\_minutes}<small>min</small>`;

  $('#simUtil').innerHTML =
    `${m.capacity\_utilization\_pct}<small>%</small>`;

  $('#simCoverage').innerHTML =
    `${m.network\_coverage\_pct}<small>%</small>`;

  const max = Math.max(...d.chart.map(x => x.minutes));

  $('#simChart').innerHTML = d.chart.map((x, i) => `
    <div class="chart-row">
      <div class="chart-label">${esc(x.label)}</div>
      <div class="chart-track">
        <div class="chart-bar ${i === 1 ? 'teal' : i === 2 ? 'orange' : ''}"
          style="width:${Math.max(3, x.minutes / max * 100)}%">
        </div>
      </div>
      <div class="chart-number">${x.minutes} min</div>
    </div>
  `).join('') +
  '<div class="chart-legend">' +
    '<span> Road baseline</span>' +
    '<span><i class="teal"> Multimodal concept</span>' +
    '<span><i class="orange"> Peak congestion</span>' +
  '</div>';

  const level = m.capacity_utilization_pct > 85
    ? 'high'
    : m.capacity_utilization_pct > 60
      ? 'moderate'
      : 'lower';

  const saved = m.time_saved_minutes;

  $('#simSummary').innerHTML =
    `Under these assumptions, the illustrative network shows ` +
    `<strong>${duration(m.road\_only\_minutes)}</strong> for a road-only baseline and ` +
    `<strong>${duration(m.multimodal\_minutes)}</strong> for a multimodal concept journey. ` +
    `The model indicates a potential difference of <strong>${saved} minutes</strong>. ` +
    `Capacity utilization is <strong>${level} (${m.capacity\_utilization\_pct}%)</strong>; ` +
    `${level === 'high'
      ? 'capacity or service frequency may need further scenario testing.'
      : level === 'moderate'
        ? 'the modeled capacity is moderately used under this scenario.'
        : 'the modeled capacity remains relatively available under this scenario.'} ` +
    'These figures are scenario outputs, not real-world forecasts.';
}

async function runSimulation() {
  const btn = $('#runSimulation');
  btn.disabled = true;
  btn.textContent = 'Running scenario…';

  try {
    const d = await api('/api/simulation/run', {
      method: 'POST',
      body: JSON.stringify({
        demand: +$('#simDemand').value,
        congestion: +$('#simCongestion').value,
        capacity: +$('#simCapacity').value,
        frequency: +$('#simFrequency').value
      })
    });

    renderSimulation(d);
    toast('Scenario simulation complete');
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Run simulation';
  }
}

function syncRange(inputId, labelId, suffix) {
  const el = $('#' + inputId);
  const out = $('#' + labelId);

  const update = () => {
    out.textContent = el.value + suffix;
  };

  el.addEventListener('input', update);
  update();
}

function profilePreferenceLabel(v) {
  return ({
    balanced: 'Balanced',
    fastest: 'Fastest',
    cheapest: 'Cheapest',
    road_only: 'Road only'
  })[v] || 'Balanced';
}

function updateProfilePreview(p) {
  const name = (p.name || '').trim();
  const initial = name ? name.charAt(0).toUpperCase() : 'U';

  $('#sidebarProfileName').textContent = name || 'Your profile';
  $('#sidebarProfileRole').textContent = p.home || 'Personal details';
  $('#sidebarAvatar').textContent = initial;
  $('#profilePreviewAvatar').textContent = initial;
  $('#profilePreviewName').textContent = name || 'Your name';
  $('#profilePreviewEmail').textContent =
    p.email || 'Add your email to complete your profile.';
  $('#profilePreviewHome').textContent = p.home || 'Not set';
  $('#profilePreviewPreference').textContent =
    profilePreferenceLabel(p.preference);
}

function loadProfile() {
  let p = {};

  try {
    p = JSON.parse(localStorage.getItem('skyroute_profile') || '{}');
  } catch {}

  $('#profileName').value = p.name || '';
  $('#profileEmail').value = p.email || '';
  $('#profilePhone').value = p.phone || '';
  $('#profileHome').value = p.home || '';
  $('#profilePreference').value = p.preference || 'balanced';

  updateProfilePreview(p);
}

function saveProfile(e) {
  e.preventDefault();

  const p = {
    name: $('#profileName').value.trim(),
    email: $('#profileEmail').value.trim(),
    phone: $('#profilePhone').value.trim(),
    home: $('#profileHome').value,
    preference: $('#profilePreference').value
  };

  try {
    localStorage.setItem('skyroute_profile', JSON.stringify(p));
    updateProfilePreview(p);
    toast('Profile saved on this device');
  } catch {
    toast('Could not save profile in this browser. Check browser storage settings.');
  }
}

async function init() {
  try {
    const [locs, stations, connections, health] = await Promise.all([
      api('/api/locations'),
      api('/api/stations'),
      api('/api/connections'),
      api('/api/health')
    ]);

    state.locations = locs.locations;
    state.stations = stations.stations;
    state.connections = connections.connections;

    $('#metricLocations').innerHTML =
      `${new Set(locs.locations.map(x => x.district)).size} <small>districts</small>`;

    $('#metricStations').innerHTML =
      `${stations.count} <small>hubs</small>`;

    $('#metricLinks').innerHTML =
      `${connections.count} <small>connections</small>`;

    setupLocations();

    $('#profileHome').innerHTML =
      '<option value="">Choose a district</option>' +
      [...new Set(state.locations.map(x => x.district))]
        .sort()
        .map(d => `<option value="${esc(d)}">${esc(d)}</option>`)
        .join('');

    loadProfile();
    renderMap('overviewMap');

  } catch (e) {
    toast(`Could not load SkyRoute data: ${e.message}. Check the API connection.`);
    console.error(e);
  }

  $$('.nav-item').forEach(b =>
    b.addEventListener('click', () => showPage(b.dataset.page))
  );

  $$('[data-goto]').forEach(b =>
    b.addEventListener('click', () => showPage(b.dataset.goto))
  );

  $('#openProfile').addEventListener('click', () => showPage('profile'));

  $('#profileForm').addEventListener('submit', saveProfile);

  $('#routeForm').addEventListener('submit', e => {
    e.preventDefault();
    runRoutes();
  });

  $('#useCurrentLocation').addEventListener('click', setCurrentLocation);

  $('#replayJourney').addEventListener('click', () => {
    const route = state.pendingAnimationRoute ||
      (() => {
        const r = state.lastRouteData?.routes.find(
          r => r.id === state.selectedRoute
        );

        return r
          ? {
              ...r,
              origin: state.lastRouteData.origin,
              destination: state.lastRouteData.destination
            }
          : null;
      })();

    if (route) {
      $('#replayJourney').textContent = '↻ Replay';
      startJourneyAnimation(route);
    }
  });

  $('#pauseJourney').addEventListener('click', pauseJourneyAnimation);

  $('#swapLocations').addEventListener('click', () => {
    const a = $('#origin').value;
    $('#origin').value = $('#destination').value;
    $('#destination').value = a;
  });

  $('#loadSample').addEventListener('click', () => {
    showPage('planner');
    $('#origin').value = 'dindigul';
    $('#destination').value = 'chennai';
    $('#flyingCarToggle').checked = true;
    runRoutes();
  });

  $('#recalculateInfra').addEventListener('click', loadInfrastructure);
  $('#applyWeights').addEventListener('click', applyWeights);

  $('#candidateSearch').addEventListener('input', renderCandidates);
  $('#candidateFilter').addEventListener('change', renderCandidates);

  [['demandWeight', 'demandValue'], ['accessWeight', 'accessValue'], ['coverageWeight', 'coverageValue']]
    .forEach(([a, b]) => syncRange(a, b, '%'));

  [
    ['simDemand', 'simDemandValue', '×'],
    ['simCongestion', 'simCongestionValue', '×'],
    ['simCapacity', 'simCapacityValue', ' seats'],
    ['simFrequency', 'simFrequencyValue', ' / hour']
  ].forEach(([a, b, c]) => syncRange(a, b, c));

  $('#runSimulation').addEventListener('click', runSimulation);

  $('#resetSimulation').addEventListener('click', () => {
    $('#simDemand').value = 1;
    $('#simCongestion').value = 1.25;
    $('#simCapacity').value = 24;
    $('#simFrequency').value = 3;

    [
      ['simDemand', 'simDemandValue', '×'],
      ['simCongestion', 'simCongestionValue', '×'],
      ['simCapacity', 'simCapacityValue', ' seats'],
      ['simFrequency', 'simFrequencyValue', ' / hour']
    ].forEach(([a, b, c]) => {
      $('#' + b).textContent = $('#' + a).value + c;
    });

    runSimulation();
  });

  $('#mobileMenu').addEventListener('click', () =>
    $('#sidebar').classList.toggle('open')
  );

  $('#helpBtn').addEventListener('click', () => {
    $('#helpModal').hidden = false;
  });

  $('#closeHelp').addEventListener('click', () => {
    $('#helpModal').hidden = true;
  });

  $('#ackHelp').addEventListener('click', () => {
    $('#helpModal').hidden = true;
  });

  $('#helpModal').addEventListener('click', e => {
    if (e.target.id === 'helpModal') {
      $('#helpModal').hidden = true;
    }
  });

  $('#dismissNotice').addEventListener('click', () =>
    $('#dismissNotice').closest('.notice-strip').remove()
  );

  await runSimulation();
}

document.addEventListener('DOMContentLoaded', init);
