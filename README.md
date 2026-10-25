# SkyRoute Intelligence

**Designed & Developed by Theo.**

A responsive, local-first Tamil Nadu transportation concept planner. It covers all 38 districts and demonstrates road-only routing, simulated road → flying-car/eVTOL concept → road itineraries, animated route progress, optional browser geolocation, infrastructure candidate scoring, and a network scenario simulator.

> **Important:** This is a hackathon/research prototype. Road distances, duration and costs are rough estimates, not live traffic or turn-by-turn navigation. Generated takeoff/landing points, flying-car routes, fares and schedules are hypothetical simulations—not real facilities, operating services, or authorized aviation corridors.

## Quick start (Windows)

1. Install Python 3.10 or newer and enable **Add Python to PATH**.
2. Extract the ZIP to a normal folder.
3. Double-click `start.bat`.
4. Open <http://127.0.0.1:8000> if the browser does not open automatically.
5. Keep the terminal open while using the application.

No npm installation, pip installation, database, paid API key, or external map service is required for the local demo. Current-location access is requested only after you press **Use my current location**; browsers normally allow geolocation on localhost. If the browser denies permission or the device is outside the demo's Tamil Nadu bounds, choose a district manually.

## Journey planner

- All **38 Tamil Nadu districts** are represented in the location selector; some existing urban locations are also retained, so there are 39 location anchors.
- Choose an origin and destination, or press **Use my current location** to set GPS coordinates as the origin.
- Enable **flying-car concept** to compare a three-stage illustrative itinerary:
  1. Road travel to a generated concept takeoff point about 1–2 km from the origin.
  2. A simulated air segment to a generated landing point about 1–2 km before the destination.
  3. Final road travel to the destination.
- Select Fastest, Cheapest, Balanced, or Road Only.
- Press **Start journey** to display the stage-by-stage itinerary and animate a vehicle marker along the schematic route. Replay and pause/resume controls are available.

The generated points are for illustrating the product concept only. They are not real vertiports, safe landing zones, or verified road access points. The schematic animation is not navigational guidance.

## Other pages

- **Overview:** Tamil Nadu mobility network overview.
- **Infrastructure:** explainable candidate scoring based on illustrative demand proxies, hub proximity, and coverage gaps.
- **Network simulator:** change demand, congestion, capacity, and service frequency assumptions to explore scenario outputs.

## Run tests

From the extracted project folder:

```bat
python -m unittest discover -s tests -v
node --check web\app.js
```

## API endpoints

- `GET /api/health`
- `GET /api/locations`
- `GET /api/stations`
- `GET /api/connections`
- `GET /api/infrastructure/candidates`
- `POST /api/routes/compare`
- `POST /api/infrastructure/analyze`
- `POST /api/simulation/run`

## Data and limitations

- District anchors are approximate district-HQ/city coordinates for statewide coverage, not parcel-level geospatial data.
- Road estimates use a great-circle distance multiplier and average-speed assumptions. They are not based on live road-network geometry or traffic.
- The route animation is a schematic visualization projected onto an illustrative state map, not a Google Maps/OSM navigation map.
- eVTOL/flying-car service segments, points, costs, and durations are synthetic assumptions.
- Candidate scores are prioritization proxies only, not engineering feasibility, environmental approval, airspace clearance, or aviation safety assessments.
- Browser geolocation is permission-based. The demo accepts coordinates within broad Tamil Nadu bounds; it does not transmit them to a third-party service.

## Troubleshooting

- **Python not found:** install Python 3.10+ and enable PATH, then reopen the terminal.
- **Port 8000 is in use:** close the other process or change the port in `start.bat` and launch URL accordingly.
- **GPS button does not work:** open the app on `http://127.0.0.1:8000`, allow browser location permission, and ensure device location services are on.
- **Outside Tamil Nadu:** use a supported district as the origin instead.

## Footer

The app displays **Designed & Developed by Theo.**

## Enhanced close-up journey map
- The map uses Leaflet with OpenStreetMap tiles so the real geographic shape of Tamil Nadu and district/city geography are shown instead of the previous hand-drawn schematic. An internet connection is required to load map tiles.
- Road legs are drawn in **black** and the simulated air leg is drawn in **blue dashed** styling. During Start journey, the map zooms in and follows the moving marker; the marker changes color for road versus simulated flight.
- The demo route models an approximately **2 km road access leg**, a hypothetical simulated air leg, and an approximately **1 km final road leg**. These are illustrative straight-line access points, not actual road navigation or authorized flight corridors. Do not use for real travel.
- OpenStreetMap attribution is shown on the map. The tile service is subject to its usage policy and may require internet access.

## Recent enhancements

- Live online street-map tiles using Leaflet/OpenStreetMap, with a switchable street/Humanitarian-style base layer, zoom in/out controls, and a Tamil Nadu home extent. Internet is required for map tiles; this is **not live traffic data**.
- Journey steps explicitly describe the estimated road distance to a hypothetical takeoff point and the estimated road distance from a hypothetical landing point to the destination.
- A My Profile page saves optional name, email, phone, home district, and travel preference in browser-local storage only. The profile is not sent to the backend.
- Route map line styling differentiates black road legs from blue dashed simulated air legs.

All takeoff/landing points and flight legs are hypothetical demo points, not authorized facilities or air corridors. Road distances in this prototype are estimates and not turn-by-turn navigation.


## Route map update
- Road access legs are shown in blue; hypothetical simulated air legs are shown in green dashed lines.
- Route lines have persistent labels with estimated distance and duration.
- The takeoff and landing points are labelled on the map and in the itinerary.
- Multimodal demo assumptions target about 2 km of initial road access and about 3 km of final road access, subject to the selected endpoints and the model's distance calculation.
- The route access lines are illustrative straight-line geometry, not verified road-network paths. The app does not provide turn-by-turn directions or live traffic.
- Tamil Nadu district locations are listed from the included dataset; map tiles show the live basemap and need an internet connection. District-boundary polygons are not bundled in this prototype.

## Tamil Nadu network map update

The overview map now uses a live OpenStreetMap basemap with an infographic-style network overlay: indicative blue road corridors, green dashed hypothetical air links from the local connections dataset, labels for the supported Tamil Nadu city/district reference locations, blue concept-hub markers, and a floating legend. Standard Leaflet zoom/pan controls and the existing custom zoom/home controls remain enabled. Map tiles require an internet connection.

**Data accuracy note:** The labels are reference locations, not official district-centroid or district-boundary survey data. This build does not bundle an authoritative 38-district GeoJSON boundary layer. Road corridors are indicative straight-line connections rather than road-following routing geometry, and air links are hypothetical—not approved aviation corridors or operating services. Route planner segment distance/time values remain estimates.


## Route map visibility fix (2026 update)

The Journey Planner now keeps the complete route visible after route search instead of immediately starting the vehicle-follow animation and zooming away from the route. It draws every returned segment on the map and fits the camera to the complete route first. Use **Start animation** to begin the close-up vehicle-follow sequence, or **Replay** after it has run.

- **Blue solid line:** road access segment(s).
- **Green dashed line:** simulated flying-car segment.
- Takeoff and landing labels are placed at the road/air hand-off points.
- Each segment has a permanent map label showing its mode, estimated distance, and estimated duration.
- The itinerary below the map explains the road access before takeoff and final road access after landing.

**Data accuracy note:** This demo generates illustrative access points about 2 km from the origin and about 3 km before the destination when geography permits. The drawn road access lines are schematic straight-line geometry, not verified road-network geometry. The green segment is a hypothetical air leg, not an approved flight corridor. District labels identify representative locations; this build does not include official district-boundary polygons. The map tiles are live OpenStreetMap tiles, but traffic is not live.


## Deploy publicly on Render (free tier availability/limits may change)

1. Create a GitHub repository and upload the **contents of this folder** to the repository root (README.md, app/, data/, web/, render.yaml, etc.). Do not upload only the ZIP file.
2. In Render, choose **New + → Blueprint** and connect that GitHub repository, or choose **New + → Web Service** and connect the repo.
3. If using Blueprint, Render reads `render.yaml`. If using Web Service manually, choose Python and set:
   - Build Command: `python --version`
   - Start Command: `python app/server.py --host 0.0.0.0 --port $PORT`
   - Health Check Path: `/api/health` (if available)
4. Create/deploy the service and wait for status **Live**. Open the `https://<your-service-name>.onrender.com` URL Render provides.
5. Check `https://<your-service-name>.onrender.com/api/health` and then open the homepage.

The app reads Render's `PORT` environment variable and binds to `0.0.0.0` for public hosting. Render free web services may sleep after inactivity and take time to wake up. Online OpenStreetMap tiles require internet. Profile data is stored only in each user's browser.
