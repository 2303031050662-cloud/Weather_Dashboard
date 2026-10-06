# Weather Dashboard 🌤️

A responsive weather web application where you can search any city and see the **current weather** plus a **5-day forecast** — built with **HTML, CSS and Vanilla JavaScript** on the frontend and **Python (Flask)** on the backend.

## Description

The frontend never talks to OpenWeatherMap directly. Instead it calls a small Flask API (`/api/weather?city=...`), which:

1. Receives the city name.
2. Calls the OpenWeatherMap API using a **secret key stored in `.env`**.
3. Cleans up the raw data (groups the 3-hourly forecast into 5 days, converts sunrise/sunset to the city's local time) and returns **one clean JSON response**.

This keeps the API key private on the server and keeps the frontend simple.

**Data flow:**
`User → index.html/script.js → Flask backend → OpenWeatherMap API → Flask → JSON → JavaScript → updated page`

## Features

- 🔍 Search any city (button click **or** Enter key)
- 🌡️ Current temperature in Celsius + "feels like"
- ☁️ Weather condition and description
- 💧 Humidity, wind speed, pressure, visibility
- 🌅 Sunrise and sunset in the city's local time
- 📅 5-day forecast grouped by date (min/max, day name, icons)
- ⏳ Loading spinner + "Searching..." button state
- ❌ Friendly in-page error messages (invalid city, empty search, server down, ...)
- 📱 Fully responsive (desktop / tablet / mobile)
- ♿ Semantic HTML, labels, alt text, `aria-live`/`role="alert"`

## Technologies

| Layer     | Technology |
|-----------|------------|
| Frontend  | HTML5, CSS3, Vanilla JavaScript (no frameworks) |
| Backend   | Python 3 + Flask |
| API       | OpenWeatherMap (current weather + 5-day/3-hour forecast) |
| Libraries | `requests`, `python-dotenv`, `flask-cors` |
| Icons     | OpenWeatherMap weather icons, Font Awesome |

## Project Structure

```
weather-dashboard/
│
├── frontend/
│   ├── index.html    # Page structure: header, search, weather cards, footer
│   ├── style.css     # All styling: cards, grid, spinner, breakpoints
│   └── script.js     # Search logic: fetch backend, update DOM, errors
│
├── backend/
│   ├── app.py            # Flask API: /api/weather, calls OpenWeatherMap
│   └── requirements.txt  # Python dependencies
│
├── .env            # Your secret API key (NEVER committed to GitHub)
├── .env.example    # Template for .env
├── .gitignore      # Tells Git which files to ignore (.env, venv, ...)
└── README.md
```

## Prerequisites

- **Python 3.8+** — check with `python --version` (Windows)
- A modern browser (Chrome, Edge, Firefox)
- A free OpenWeatherMap account

## 1. Get an OpenWeatherMap API key (free)

1. Go to <https://openweathermap.org/api> and click **Sign Up**.
2. After verifying your email, open **My API keys** (or <https://home.openweathermap.org/api_keys>).
3. Copy the default key.
4. ⚠️ **New keys take ~10 minutes to 2 hours to activate** — a fresh key returns `401 Unauthorized` until then.

The free plan includes current weather and the 5-day forecast (1,000 calls/day).

## 2. Create a virtual environment (Windows)

Open **Command Prompt** in the project root folder (the folder containing `frontend/` and `backend/`) and run:

```bat
python -m venv venv
```

Activate it (you must do this in every new terminal before running the app):

```bat
venv\Scripts\activate
```

(If you use PowerShell: `venv\Scripts\Activate.ps1`. If Git Bash: `source venv/Scripts/activate`.)

You should now see `(venv)` at the start of your prompt.

## 3. Install dependencies

Still in the project root with `(venv)` active:

```bat
pip install -r backend\requirements.txt
```

## 4. Configure `.env`

Open the `.env` file in the project root and paste your key:

```
OPENWEATHER_API_KEY=paste_your_real_key_here
```

### Why `.env` must never be uploaded to GitHub

The API key is a **password**. If it lands in a public repository, bots find it within minutes and run up calls on your account. `.gitignore` already excludes `.env`, so Git will never commit it. That's why the repo also contains `.env.example` — a template so other people know *which* variables to create without seeing your values. Only the Python backend reads this file; the key never appears in HTML, CSS, JavaScript, or the browser.

## 5. Start the Flask backend

```bat
cd backend
python app.py
```

You should see:

```
 * Running on http://127.0.0.1:5000
```

Keep this terminal window **open** — the backend must keep running for the frontend to work.

## 6. Open the frontend

Open `frontend/index.html` in your browser (double-click it, or drag it into a browser window). London's weather loads automatically.

> Tip: with VS Code you can also use the "Live Server" extension → "Open with Live Server". Both work because Flask sends permissive CORS headers.

## API Endpoint Documentation

### `GET /api/weather?city=CityName`

| Parameter | Type   | Description                |
|-----------|--------|----------------------------|
| `city`    | string | City name, e.g. `London`   |

**Success — `200 OK`** (all fields may be present; `visibility` can be `null` in rare conditions):

```json
{
  "city": "London",
  "country": "GB",
  "temperature": 18,
  "feels_like": 17,
  "condition": "Cloudy",
  "description": "broken clouds",
  "humidity": 72,
  "wind_speed": 4.2,
  "pressure": 1012,
  "visibility": 10.0,
  "sunrise": "06:12",
  "sunset": "19:45",
  "icon": "04d",
  "forecast": [
    {
      "date": "2026-09-22",
      "temp_min": 14,
      "temp_max": 21,
      "condition": "Cloudy",
      "description": "broken clouds",
      "icon": "04d"
    }
  ]
}
```

**Errors** always return JSON of the form `{ "error": "message" }`:

| Status | Meaning |
|--------|---------|
| `400`  | Missing `city` parameter |
| `404`  | City not found (check spelling) |
| `500`  | Server error: missing/invalid API key or malformed API response |
| `502`  | Could not reach OpenWeatherMap (network problem) |
| `504`  | OpenWeatherMap timed out |

Example:

```json
{ "error": "City not found. Please check the spelling and try again." }
```

## Screenshots

> 📷 _Placeholder — add screenshots here:_
> - `screenshots/current-weather.png` — main card + statistics
> - `screenshots/forecast.png` — 5-day forecast
> - `screenshots/mobile.png` — mobile layout

## Why CORS?

Browsers block a page at `file:///...` from reading responses of `http://127.0.0.1:5000` — they are different "origins". `flask-cors` adds the `Access-Control-Allow-Origin` header so the browser allows the request. It is a **development convenience**; in production you would serve the frontend and API from the same domain and lock CORS down.

## Troubleshooting

| Problem | Likely cause & fix |
|---------|--------------------|
| `401 ... invalid or not activated yet` | New API key — wait 10 min–2 h, or re-check the key in `.env` |
| `ModuleNotFoundError: No module named 'flask'` | Virtual environment not activated — run `venv\Scripts\activate`, then `pip install -r backend\requirements.txt` |
| "Could not connect to the weather server" | Backend isn't running — start it (`cd backend`, `python app.py`) |
| `Address already in use` / port 5000 busy | Another app uses port 5000 — change `port=5000` at the bottom of `app.py` **and** `API_BASE_URL` in `script.js` to the same new port |
| "City not found" for a real city | Check spelling, or try "City, CountryCode" (e.g. `Springfield,US`) |
| Forecast section missing | Rare — forecast API hiccup; the app intentionally still shows current weather |

## Future Improvements

- °C / °F / K unit switcher
- "Use my location" button (browser geolocation)
- Recent-search chips saved in `localStorage`
- Hourly temperature chart (Chart.js)
- Air quality index card
- Serve the frontend from Flask and deploy (Render / Railway / PythonAnywhere)
- Caching responses to reduce API calls
- Automated tests (`pytest`) for the backend
#   W e a t h e r _ D a s h b o a r d  
 