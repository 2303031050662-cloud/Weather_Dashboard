/* ============================================================
   Weather Dashboard — script.js
   Talks to the Flask backend (NOT directly to OpenWeatherMap).
   The API key stays on the server — it never appears in this file.
   ============================================================ */

// ------------------- Configuration -------------------

// Base URL of the Flask backend. Change the port here if you edit app.py.
const API_BASE_URL = "http://127.0.0.1:5000";

// City shown automatically when the page first loads (easy to change).
const DEFAULT_CITY = "London";

// OpenWeatherMap's free icon images (the icon *code* comes from our backend).
const ICON_BASE_URL = "https://openweathermap.org/img/wn/";

// Search button states.
const BUTTON_IDLE_HTML =
  '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Search';
const BUTTON_BUSY_HTML =
  '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Searching...';

// ------------------- Element references -------------------

const elements = {
  form: document.getElementById("search-form"),
  input: document.getElementById("city-input"),
  button: document.getElementById("search-button"),
  loading: document.getElementById("loading"),
  error: document.getElementById("error-message"),

  currentSection: document.getElementById("current-weather-section"),
  cityName: document.getElementById("city-name"),
  currentDate: document.getElementById("current-date"),
  weatherIcon: document.getElementById("weather-icon"),
  temperature: document.getElementById("temperature"),
  condition: document.getElementById("condition"),
  description: document.getElementById("description"),
  feelsLike: document.getElementById("feels-like"),

  statsSection: document.getElementById("stats-section"),
  humidity: document.getElementById("humidity-value"),
  wind: document.getElementById("wind-value"),
  pressure: document.getElementById("pressure-value"),
  visibility: document.getElementById("visibility-value"),
  sunrise: document.getElementById("sunrise-value"),
  sunset: document.getElementById("sunset-value"),

  forecastSection: document.getElementById("forecast-section"),
  forecastContainer: document.getElementById("forecast-container"),
};

// ------------------- Events -------------------

document.addEventListener("DOMContentLoaded", () => {
  // The form's "submit" event fires on BOTH the button click and the
  // Enter key, so this one listener covers both ways of searching.
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault(); // stop the browser from reloading the page

    const city = elements.input.value.trim();
    if (!city) {
      displayError("Please enter a city name.");
      return;
    }
    searchWeather(city);
  });

  // Show the default city as soon as the page opens.
  searchWeather(DEFAULT_CITY);
});

// ------------------- Main search flow -------------------

/**
 * Runs one complete search:
 * show loading → fetch from backend → update the UI → hide loading.
 * Any error is shown inside the page (never with alert()).
 */
async function searchWeather(city) {
  showLoading();
  hideError();
  hideWeatherSections();

  try {
    const data = await fetchWeather(city);
    displayCurrentWeather(data);
    displayForecast(data.forecast);
  } catch (error) {
    displayError(error.message);
  } finally {
    hideLoading();
  }
}

/**
 * Calls the Flask backend (GET /api/weather?city=...) and returns the JSON.
 * Throws an Error with a friendly message when anything goes wrong.
 */
async function fetchWeather(city) {
  // URLSearchParams safely encodes spaces and special characters ("New York").
  const params = new URLSearchParams({ city });
  const response = await fetch(`${API_BASE_URL}/api/weather?${params}`);

  let data = null;
  try {
    data = await response.json();
  } catch (parseError) {
    // The server did not send JSON (e.g. an HTML error page).
  }

  if (!response.ok) {
    // Our backend always sends { "error": "..." } for failures.
    const message = data && data.error
      ? data.error
      : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }
  if (!data) {
    throw new Error("The server sent a response we could not read.");
  }
  return data;
}

// ------------------- Display functions -------------------

/** Fills in the main weather card and the six stat cards. */
function displayCurrentWeather(data) {
  elements.cityName.textContent = data.country
    ? `${data.city}, ${data.country}`
    : data.city;
  elements.currentDate.textContent =
    `${formatDate(new Date(), "full")} · updated ${formatTime(new Date())}`;

  elements.temperature.textContent = `${data.temperature}\u00B0C`;
  elements.condition.textContent = data.condition;
  elements.description.textContent = data.description;
  elements.feelsLike.textContent = `Feels like ${data.feels_like}\u00B0C`;

  // Weather icon (from OpenWeatherMap's free icon CDN).
  elements.weatherIcon.src = `${ICON_BASE_URL}${data.icon}@2x.png`;
  elements.weatherIcon.alt = data.description || "Weather icon";
  elements.weatherIcon.hidden = false;

  elements.humidity.textContent = data.humidity != null ? `${data.humidity}%` : "\u2014";
  elements.wind.textContent = data.wind_speed != null ? `${data.wind_speed} m/s` : "\u2014";
  elements.pressure.textContent = data.pressure != null ? `${data.pressure} hPa` : "\u2014";
  elements.visibility.textContent = data.visibility != null ? `${data.visibility} km` : "\u2014";
  elements.sunrise.textContent = data.sunrise || "\u2014";
  elements.sunset.textContent = data.sunset || "\u2014";

  elements.currentSection.classList.remove("hidden");
  elements.statsSection.classList.remove("hidden");
}

/** Builds one card per forecast day and shows the forecast section. */
function displayForecast(forecast) {
  elements.forecastContainer.innerHTML = ""; // clear any previous cards

  if (!Array.isArray(forecast) || forecast.length === 0) {
    elements.forecastSection.classList.add("hidden");
    return;
  }

  for (const day of forecast) {
    const card = document.createElement("article");
    card.className = "forecast-card";
    card.innerHTML = `
      <p class="day">${formatDate(day.date, "weekday")}</p>
      <p class="date">${formatDate(day.date, "short")}</p>
      <img src="${ICON_BASE_URL}${day.icon}@2x.png" alt="${day.description}">
      <p class="condition">${day.condition}</p>
      <p class="temps">${day.temp_min}\u00B0C / ${day.temp_max}\u00B0C</p>
    `;
    elements.forecastContainer.appendChild(card);
  }

  elements.forecastSection.classList.remove("hidden");
}

// ------------------- Loading & error helpers -------------------

/** Shows the spinner and puts the button into its "Searching..." state. */
function showLoading() {
  elements.loading.classList.remove("hidden");
  elements.button.disabled = true;
  elements.button.innerHTML = BUTTON_BUSY_HTML;
}

/** Hides the spinner and restores the normal search button. */
function hideLoading() {
  elements.loading.classList.add("hidden");
  elements.button.disabled = false;
  elements.button.innerHTML = BUTTON_IDLE_HTML;
}

/** Shows a friendly error message inside the page. */
function displayError(message) {
  elements.error.textContent = message;
  elements.error.classList.remove("hidden");
}

/** Hides the error message area. */
function hideError() {
  elements.error.classList.add("hidden");
}

/** Hides all weather sections (used while a new search is running). */
function hideWeatherSections() {
  elements.currentSection.classList.add("hidden");
  elements.statsSection.classList.add("hidden");
  elements.forecastSection.classList.add("hidden");
}

// ------------------- Formatting helpers -------------------

/**
 * Formats a date for display.
 *   style "full"    → "Tuesday, 22 September 2026"   (current weather)
 *   style "weekday" → "Tuesday"                      (forecast card heading)
 *   style "short"   → "22 Sep"                       (forecast card date)
 */
function formatDate(dateValue, style = "full") {
  const date = toLocalDate(dateValue);
  if (!date) return "\u2014";

  if (style === "weekday") {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }
  if (style === "short") {
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Formats a Date as "HH:MM" (e.g. "14:05"). */
function formatTime(date) {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Turns a Date or a "YYYY-MM-DD" string into a LOCAL Date.
 * We parse "YYYY-MM-DD" by hand because new Date("2026-09-22") would be
 * treated as UTC midnight, which can show the wrong day in some timezones.
 */
function toLocalDate(dateValue) {
  if (dateValue instanceof Date) return dateValue;

  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [year, month, day] = dateValue.split("-").map(Number);
    return new Date(year, month - 1, day); // months are 0-based in JavaScript
  }

  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
