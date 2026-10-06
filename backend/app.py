"""
Weather Dashboard — Flask backend
=================================
Receives a city name from the frontend, calls the OpenWeatherMap API,
and returns ONE clean JSON response containing:
  - current weather (temperature, humidity, wind, pressure, ...)
  - sunrise / sunset times in the city's own timezone
  - a 5-day forecast grouped by day

The OpenWeatherMap API key NEVER leaves this file / the .env file.
Run with:  python app.py   (from inside the backend folder)
"""

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Load the .env file that lives in the project root (one folder above this file).
# This keeps the API key out of the source code completely.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = Flask(__name__)

# Allow the frontend (opened from a different port or file://) to call this API.
# Without this, browsers block the request because of the "same-origin policy".
CORS(app)

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5"
REQUEST_TIMEOUT = 10  # seconds — never let a request hang forever

# OpenWeatherMap returns technical condition names like "Clouds" or "Rain".
# This dictionary maps them to friendlier words for the UI.
CONDITION_LABELS = {
    "Clear": "Clear",
    "Clouds": "Cloudy",
    "Rain": "Rainy",
    "Drizzle": "Drizzle",
    "Thunderstorm": "Stormy",
    "Snow": "Snowy",
    "Mist": "Misty",
    "Fog": "Foggy",
    "Haze": "Hazy",
    "Smoke": "Smoky",
    "Dust": "Dusty",
    "Sand": "Dusty",
    "Ash": "Ashy",
    "Squall": "Windy",
    "Tornado": "Tornado",
}


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def get_condition_label(main_condition):
    """Turn a technical condition name ('Clouds') into a friendly one ('Cloudy')."""
    return CONDITION_LABELS.get(main_condition, main_condition)


def format_local_time(timestamp, utc_offset_seconds):
    """Convert a Unix timestamp to 'HH:MM' in the city's own timezone."""
    city_timezone = timezone(timedelta(seconds=utc_offset_seconds))
    local_time = datetime.fromtimestamp(timestamp, tz=city_timezone)
    return local_time.strftime("%H:%M")


def build_current_weather(data):
    """
    Convert the raw OpenWeatherMap 'current weather' JSON into the clean JSON
    our frontend expects. Raises KeyError/TypeError if the response is
    malformed — the route handler catches that and returns a 500 error.
    """
    weather = data["weather"][0]
    main = data["main"]
    sys_info = data.get("sys", {})
    offset = data.get("timezone", 0)

    # Visibility is in metres in the API; the UI shows kilometres.
    visibility_metres = data.get("visibility")

    return {
        "city": data.get("name", "Unknown"),
        "country": sys_info.get("country", ""),
        "temperature": round(main["temp"]),
        "feels_like": round(main["feels_like"]),
        "condition": get_condition_label(weather.get("main", "")),
        "description": weather.get("description", ""),
        "humidity": main.get("humidity"),
        "wind_speed": round(data.get("wind", {}).get("speed", 0), 1),
        "pressure": main.get("pressure"),
        "visibility": round(visibility_metres / 1000, 1) if visibility_metres is not None else None,
        "sunrise": format_local_time(sys_info["sunrise"], offset) if "sunrise" in sys_info else None,
        "sunset": format_local_time(sys_info["sunset"], offset) if "sunset" in sys_info else None,
        "icon": weather.get("icon", "01d"),
    }


def build_forecast(data):
    """
    The forecast API returns one entry every 3 hours (40 entries for 5 days).
    We group them by LOCAL date and, for each day, keep:
      - the minimum and maximum temperature across all entries
      - one "representative" entry (the one closest to midday) for the
        icon and condition — much nicer than showing every 3-hour step.
    """
    offset = data.get("city", {}).get("timezone", 0)
    city_timezone = timezone(timedelta(seconds=offset))

    days = {}  # "2026-09-22" -> {temp_min, temp_max, representative, hour}

    for entry in data.get("list", []):
        local_dt = datetime.fromtimestamp(entry["dt"], tz=city_timezone)
        date_key = local_dt.strftime("%Y-%m-%d")
        temp = entry["main"]["temp"]

        if date_key not in days:
            days[date_key] = {
                "temp_min": temp,
                "temp_max": temp,
                "representative": entry,
                "hour": local_dt.hour,
            }
        else:
            day = days[date_key]
            day["temp_min"] = min(day["temp_min"], temp)
            day["temp_max"] = max(day["temp_max"], temp)
            # Prefer the entry closest to 12:00 local time as the day's summary.
            if abs(local_dt.hour - 12) < abs(day["hour"] - 12):
                day["representative"] = entry
                day["hour"] = local_dt.hour

    forecast = []
    for date_key in sorted(days)[:5]:  # ISO dates sort chronologically as strings
        day = days[date_key]
        entry = day["representative"]
        weather = entry["weather"][0]

        forecast.append({
            "date": date_key,
            "temp_min": round(day["temp_min"]),
            "temp_max": round(day["temp_max"]),
            "condition": get_condition_label(weather.get("main", "")),
            "description": weather.get("description", ""),
            "icon": weather.get("icon", "01d"),
        })

    return forecast


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/api/weather")
def get_weather():
    """Main endpoint: GET /api/weather?city=London"""
    city = request.args.get("city", "").strip()

    # --- 1. Validate the request ------------------------------------------
    if not city:
        return jsonify({
            "error": "City name is required. Example: /api/weather?city=London"
        }), 400

    # --- 2. Make sure the API key exists ----------------------------------
    if not OPENWEATHER_API_KEY or OPENWEATHER_API_KEY == "your_api_key_here":
        return jsonify({
            "error": "OpenWeatherMap API key is missing. Add it to your .env file."
        }), 500

    # --- 3. Call the OpenWeatherMap 'current weather' API ------------------
    params = {"q": city, "appid": OPENWEATHER_API_KEY, "units": "metric"}

    try:
        current_response = requests.get(
            f"{OPENWEATHER_BASE_URL}/weather", params=params, timeout=REQUEST_TIMEOUT
        )
    except requests.Timeout:
        return jsonify({"error": "The weather service took too long to respond. Please try again."}), 504
    except requests.RequestException:
        return jsonify({"error": "Could not reach the weather service. Check your internet connection."}), 502

    if current_response.status_code == 404:
        return jsonify({"error": "City not found. Please check the spelling and try again."}), 404
    if current_response.status_code == 401:
        # 401 usually means the key is wrong OR brand new (keys take a while to activate).
        return jsonify({"error": "The OpenWeatherMap API key is invalid or not activated yet."}), 500
    if current_response.status_code != 200:
        return jsonify({"error": "The weather service returned an unexpected error. Please try again later."}), 502

    # --- 4. Process the current-weather data -------------------------------
    try:
        weather = build_current_weather(current_response.json())
    except (KeyError, IndexError, TypeError, ValueError):
        return jsonify({"error": "Received an unexpected response from the weather service."}), 500

    # --- 5. Fetch the 5-day forecast ---------------------------------------
    # If only the forecast fails we still show the current weather.
    forecast = []
    try:
        forecast_response = requests.get(
            f"{OPENWEATHER_BASE_URL}/forecast", params=params, timeout=REQUEST_TIMEOUT
        )
        if forecast_response.status_code == 200:
            forecast = build_forecast(forecast_response.json())
    except (requests.RequestException, KeyError, IndexError, TypeError, ValueError):
        pass  # forecast stays empty; the frontend simply hides that section

    # --- 6. Send everything back as one clean JSON response ----------------
    return jsonify({**weather, "forecast": forecast})


# ---------------------------------------------------------------------------
# Start the development server
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # debug=True auto-reloads the server when you save the file.
    # Turn this off (or use a proper server) for production.
    app.run(debug=True, port=5000)
