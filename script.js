// =====================================
// CUACAID - JAVASCRIPT
// =====================================

// API Open-Meteo
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";

// Kota awal
const DEFAULT_CITY = {
  name: "Makassar",
  latitude: -5.1477,
  longitude: 119.4327,
  admin1: "Sulawesi Selatan"
};

// Daftar 5 kota besar Indonesia
const BIG_CITIES = [
  { name: "Jakarta", latitude: -6.2088, longitude: 106.8456 },
  { name: "Surabaya", latitude: -7.2575, longitude: 112.7521 },
  { name: "Bandung", latitude: -6.9175, longitude: 107.6191 },
  { name: "Medan", latitude: 3.5952, longitude: 98.6722 },
  { name: "Makassar", latitude: -5.1477, longitude: 119.4327 }
];

let weatherMap = null;
let mapMarkers = null;
let currentPlace = DEFAULT_CITY;
let requestNumber = 0;

// =====================================
// ELEMENT HELPER
// =====================================
const getEl = (id) => document.getElementById(id);

function setText(id, value) {
  const el = getEl(id);
  if (el) el.textContent = value;
}

function rounded(value, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "--" + suffix;
  }
  return Math.round(Number(value)) + suffix;
}

function formatDay(dateString) {
  const date = new Date(dateString + "T12:00:00");
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long"
  }).format(date);
}

function formatDate(dateString) {
  const date = new Date(dateString + "T12:00:00");
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short"
  }).format(date);
}

function formatTime(dateTime) {
  return dateTime ? dateTime.slice(11, 16) : "--:--";
}

function showMessage(message) {
  setText("searchMessage", message);
}

function showToast(message) {
  setText("toastMessage", message);

  if (window.bootstrap) {
    const toast = bootstrap.Toast.getOrCreateInstance(
      getEl("siteToast")
    );
    toast.show();
  }
}

// =====================================
// WEATHER CODE WMO
// =====================================
function weatherCondition(code, isDay = true) {
  const c = Number(code);

  if (c === 0) {
    return {
      text: "Cerah",
      icon: isDay ? "bi-sun-fill" : "bi-moon-stars-fill"
    };
  }

  if (c === 1 || c === 2) {
    return {
      text: c === 1 ? "Cerah Berawan" : "Berawan Sebagian",
      icon: isDay ? "bi-cloud-sun-fill" : "bi-cloud-moon-fill"
    };
  }

  if (c === 3) {
    return { text: "Berawan", icon: "bi-cloud-fill" };
  }

  if ([45, 48].includes(c)) {
    return { text: "Berkabut", icon: "bi-cloud-haze2-fill" };
  }

  if ([51, 53, 55, 56, 57].includes(c)) {
    return { text: "Gerimis", icon: "bi-cloud-drizzle-fill" };
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) {
    return { text: "Hujan", icon: "bi-cloud-rain-heavy-fill" };
  }

  if ([71, 73, 75, 77, 85, 86].includes(c)) {
    return { text: "Salju", icon: "bi-cloud-snow-fill" };
  }

  if ([95, 96, 99].includes(c)) {
    return { text: "Badai Petir", icon: "bi-cloud-lightning-rain-fill" };
  }

  return { text: "Tidak Diketahui", icon: "bi-cloud" };
}

// =====================================
// FETCH JSON DENGAN ERROR HANDLING
// =====================================
async function fetchJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Server API merespons dengan status " + response.status);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.reason || "Terjadi kesalahan dari API.");
  }

  return data;
}

// =====================================
// API CUACA
// =====================================
async function fetchWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: latitude,
    longitude: longitude,
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "weather_code",
      "wind_speed_10m",
      "precipitation",
      "pressure_msl",
      "is_day"
    ].join(","),
    hourly: [
      "temperature_2m",
      "weather_code"
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max"
    ].join(","),
    timezone: "auto",
    forecast_days: "5",
    forecast_hours: "48"
  });

  return await fetchJSON(`${WEATHER_API}?${params.toString()}`);
}

// =====================================
// MENAMPILKAN CUACA UTAMA
// =====================================
function renderCurrentWeather(data, place) {
  const current = data.current;
  const condition = weatherCondition(
    current.weather_code,
    current.is_day === 1
  );

  setText("weatherCity", place.name);
  setText("weatherDate", formatDate(current.time.slice(0, 10)));
  setText("weatherTemp", rounded(current.temperature_2m, "°"));
  setText("weatherDesc", condition.text);
  setText("feelsLike", rounded(current.apparent_temperature, "°C"));
  setText("updateTime", formatTime(current.time));

  setText("humidity", rounded(current.relative_humidity_2m, "%"));
  setText("windSpeed", rounded(current.wind_speed_10m, " km/jam"));

  const precipitation = current.precipitation;
  setText(
    "rainfall",
    precipitation == null ? "-- mm" : Number(precipitation).toFixed(1) + " mm"
  );

  setText("pressure", rounded(current.pressure_msl, " hPa"));

  getEl("weatherIcon").className = "bi " + condition.icon;
  getEl("weatherIcon").setAttribute("aria-label", condition.text);
}

// =====================================
// PRAKIRAAN 5 HARI
// =====================================
function renderForecast(data, cityName) {
  const daily = data.daily;
  const container = getEl("forecastCards");

  setText(
    "forecastSubtitle",
    "Prakiraan lima hari untuk " + cityName + " berdasarkan data Open-Meteo."
  );

  container.innerHTML = "";

  daily.time.slice(0, 5).forEach((dateString, index) => {
    const condition = weatherCondition(daily.weather_code[index]);

    const column = document.createElement("div");
    column.className = "col-lg col-md-4 col-6";
    column.setAttribute("data-aos", "fade-up");
    column.setAttribute("data-aos-delay", String(index * 60));

    column.innerHTML = `
      <div class="forecast-card">
        <h4>${index === 0 ? "Hari Ini" : formatDay(dateString)}</h4>
        <span class="forecast-date">${formatDate(dateString)}</span>

        <i class="bi ${condition.icon} forecast-icon"></i>

        <p class="forecast-description">${condition.text}</p>

        <div class="forecast-temperature">
          ${rounded(daily.temperature_2m_max[index], "°")}
          <small>${rounded(daily.temperature_2m_min[index], "°")}</small>
        </div>

        <p class="forecast-rain">
          <i class="bi bi-droplet"></i>
          ${rounded(daily.precipitation_probability_max[index], "%")}
          peluang hujan
        </p>
      </div>
    `;

    container.appendChild(column);
  });

  if (window.AOS) AOS.refreshHard();
}

// =====================================
// PRAKIRAAN PER JAM
// =====================================
function renderHourly(data) {
  const container = getEl("hourlyForecast");
  const hourly = data.hourly;
  const now = data.current.time.slice(0, 13);

  container.innerHTML = "";

  // Cari indeks jam cuaca terbaru yang tersedia
  let startIndex = hourly.time.findIndex(
    (time) => time.slice(0, 13) >= now
  );

  if (startIndex < 0) startIndex = 0;

  const endIndex = Math.min(startIndex + 8, hourly.time.length);

  for (let i = startIndex; i < endIndex; i++) {
    const time = hourly.time[i];
    const condition = weatherCondition(
      hourly.weather_code[i],
      Number(time.slice(11, 13)) >= 6 &&
      Number(time.slice(11, 13)) < 18
    );

    const item = document.createElement("div");
    item.className = "hourly-item";

    item.innerHTML = `
      <span>${formatTime(time)}</span>
      <i class="bi ${condition.icon}" title="${condition.text}"></i>
      <strong>${rounded(hourly.temperature_2m[i], "°")}</strong>
    `;

    container.appendChild(item);
  }
}

// =====================================
// MEMUAT CUACA BERDASARKAN LOKASI
// =====================================
async function loadWeather(place) {
  const requestId = ++requestNumber;
  currentPlace = place;

  showMessage("Mengambil data cuaca " + place.name + "...");

  try {
    const data = await fetchWeather(place.latitude, place.longitude);

    // Abaikan respons lama apabila pengguna memilih kota baru
    if (requestId !== requestNumber) return;

    renderCurrentWeather(data, place);
    renderForecast(data, place.name);
    renderHourly(data);

    showMessage("");
    updateMapLocation(place, data);

  } catch (error) {
    if (requestId !== requestNumber) return;

    console.error("Weather API:", error);
    showMessage("Data cuaca gagal dimuat. Periksa koneksi internet dan coba lagi.");
    showToast("Gagal mengambil data cuaca. Silakan coba kembali.");
  }
}

// =====================================
// PENCARIAN KOTA MELALUI GEOCODING API
// =====================================
async function searchCity(query) {
  const resultsContainer = getEl("searchResults");

  resultsContainer.innerHTML = "";
  showMessage("Mencari wilayah...");

  try {
    const params = new URLSearchParams({
      name: query,
      count: "10",
      language: "id",
      countryCode: "ID"
    });

    const data = await fetchJSON(`${GEO_API}?${params.toString()}`);
    const results = data.results || [];

    resultsContainer.innerHTML = "";

    if (results.length === 0) {
      showMessage("Kota tidak ditemukan. Coba nama kota atau kabupaten lain.");
      return;
    }

    showMessage("Pilih wilayah yang sesuai:");

    results.forEach((city) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result-item";

      const area = [city.name, city.admin2, city.admin1]
        .filter(Boolean)
        .filter((value, index, arr) => arr.indexOf(value) === index)
        .join(", ");

      // textContent mencegah injeksi HTML dari hasil API
      button.textContent = area;

      button.addEventListener("click", () => {
        const selectedCity = {
          name: city.name,
          latitude: city.latitude,
          longitude: city.longitude,
          admin1: city.admin1 || ""
        };

        getEl("cityInput").value = city.name;
        resultsContainer.innerHTML = "";

        loadWeather(selectedCity);
        getEl("cuaca").scrollIntoView({ behavior: "smooth" });
      });

      resultsContainer.appendChild(button);
    });

  } catch (error) {
    console.error("Geocoding API:", error);
    showMessage("Pencarian gagal. Periksa koneksi internet.");
  }
}

// =====================================
// 5 KOTA BESAR REAL-TIME
// =====================================
async function loadBigCities() {
  const container = getEl("cityCards");
  container.innerHTML = "";

  const results = await Promise.allSettled(
    BIG_CITIES.map(async (city) => {
      const data = await fetchWeather(city.latitude, city.longitude);
      return { city, data };
    })
  );

  results.forEach((result, index) => {
    const city = BIG_CITIES[index];
    const col = document.createElement("div");
    col.className = "col-lg col-md-4 col-6";
    col.setAttribute("data-aos", "fade-up");
    col.setAttribute("data-aos-delay", String(index * 60));

    if (result.status !== "fulfilled") {
      col.innerHTML = `
        <div class="city-card">
          <h3>${city.name}</h3>
          <p class="city-condition">Data tidak tersedia</p>
          <button class="btn btn-sm btn-outline-primary retry-city">
            Coba Lagi
          </button>
        </div>
      `;

      col.querySelector(".retry-city").addEventListener("click", () => {
        loadBigCities();
      });

      container.appendChild(col);
      return;
    }

    const current = result.value.data.current;
    const condition = weatherCondition(
      current.weather_code,
      current.is_day === 1
    );

    col.innerHTML = `
      <div class="city-card" role="button" tabindex="0">
        <h3>${city.name}</h3>
        <p class="city-condition">${condition.text}</p>

        <i class="bi ${condition.icon} city-weather-icon"></i>

        <div class="city-temperature">
          ${rounded(current.temperature_2m, "°C")}
        </div>

        <div class="city-card-bottom">
          <span>
            <i class="bi bi-droplet"></i>
            ${rounded(current.relative_humidity_2m, "%")}
          </span>
          <span>
            <i class="bi bi-wind"></i>
            ${rounded(current.wind_speed_10m, " km/j")}
          </span>
        </div>
      </div>
    `;

    const card = col.querySelector(".city-card");

    const selectCity = () => {
      loadWeather(city);
      getEl("cuaca").scrollIntoView({ behavior: "smooth" });
    };

    card.addEventListener("click", selectCity);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectCity();
      }
    });

    container.appendChild(col);
  });

  if (window.AOS) AOS.refreshHard();
}

// =====================================
// PETA INTERAKTIF
// =====================================
function initializeMap() {
  if (!window.L) {
    console.warn("Leaflet tidak tersedia.");
    return;
  }

  weatherMap = L.map("weatherMap", {
    scrollWheelZoom: false
  }).setView([-2.5, 118], 5);

  // Peta dasar: Esri (tanpa API key). Jika gagal dimuat, otomatis pindah
  // ke OpenStreetMap. Latar biru muda dipakai agar marker tetap terlihat.
  weatherMap.getContainer().style.background = "#dbeafe";

  const esriLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 18,
      attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
    }
  ).addTo(weatherMap);

  let tileErrors = 0;
  esriLayer.on("tileerror", () => {
    tileErrors++;
    if (tileErrors === 4) {
      weatherMap.removeLayer(esriLayer);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(weatherMap);
    }
  });

  mapMarkers = L.layerGroup().addTo(weatherMap);

  BIG_CITIES.forEach(async (city) => {
    const marker = L.marker([city.latitude, city.longitude])
      .addTo(mapMarkers);

    marker.bindPopup(
      `<strong>${city.name}</strong><p>Memuat cuaca...</p>`
    );

    marker.on("click", () => loadWeather(city));

    try {
      const data = await fetchWeather(city.latitude, city.longitude);
      const condition = weatherCondition(data.current.weather_code);

      marker.bindPopup(`
        <strong>${city.name}</strong>
        <p style="margin:5px 0">
          ${condition.text}<br>
          Suhu: ${rounded(data.current.temperature_2m, "°C")}
        </p>
        <small>Klik penanda untuk memilih kota.</small>
      `);

    } catch (error) {
      marker.bindPopup(
        `<strong>${city.name}</strong><p>Data cuaca belum tersedia.</p>`
      );
    }
  });

  // Pengguna dapat memilih titik mana saja di peta
  weatherMap.on("click", (event) => {
    const lat = event.latlng.lat;
    const lon = event.latlng.lng;

    const selected = {
      name: `Lokasi ${lat.toFixed(3)}, ${lon.toFixed(3)}`,
      latitude: lat,
      longitude: lon
    };

    loadWeather(selected);
  });
}

function updateMapLocation(place, data) {
  if (!weatherMap || !mapMarkers) return;

  if (window.selectedMapMarker) {
    weatherMap.removeLayer(window.selectedMapMarker);
  }

  const condition = weatherCondition(data.current.weather_code);

  window.selectedMapMarker = L.marker([
    place.latitude,
    place.longitude
  ]).addTo(weatherMap);

  // Isi popup memakai nama sebagai teks aman
  const popupBox = document.createElement("div");
  const title = document.createElement("strong");
  const info = document.createElement("p");

  title.textContent = place.name;
  info.textContent =
    condition.text + " - " +
    rounded(data.current.temperature_2m, "°C");

  popupBox.appendChild(title);
  popupBox.appendChild(info);

  window.selectedMapMarker.bindPopup(popupBox);

  weatherMap.setView([place.latitude, place.longitude], 9);
}

// =====================================
// LOKASI PENGGUNA
// =====================================
function useCurrentLocation() {
  if (!navigator.geolocation) {
    showToast("Browser ini tidak mendukung akses lokasi.");
    return;
  }

  showMessage("Meminta izin akses lokasi...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const place = {
        name: "Lokasi Saya",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      loadWeather(place);
    },
    (error) => {
      showMessage("");

      if (error.code === 1) {
        showToast("Izin lokasi ditolak. Gunakan pencarian kota.");
      } else {
        showToast("Lokasi tidak tersedia. Coba cari kota secara manual.");
      }
    },
    {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 300000
    }
  );
}

// =====================================
// PARALLAX BANNER, NAVBAR, BACK TO TOP
// =====================================
let scrollTicking = false;

function handleScroll() {
  const scrollY = window.scrollY;
  const navbar = getEl("mainNavbar");
  const backToTop = getEl("backToTop");
  const hero = getEl("beranda");
  const heroImage = document.querySelector(".hero-image");

  navbar.classList.toggle("scrolled", scrollY > 40);
  backToTop.classList.toggle("show", scrollY > 400);

  // Gambar bergerak lebih lambat dibanding halaman
  // Menghasilkan efek parallax yang terlihat saat scroll
  if (heroImage && hero && scrollY < hero.offsetHeight) {
    const shift = Math.min(scrollY * 0.26, hero.offsetHeight * 0.19);
    heroImage.style.transform = `translate3d(0, ${shift}px, 0)`;
  } else if (heroImage) {
    heroImage.style.transform = "translate3d(0, 0, 0)";
  }

  scrollTicking = false;
}

function onScroll() {
  if (!scrollTicking) {
    requestAnimationFrame(handleScroll);
    scrollTicking = true;
  }
}

// =====================================
// CONTACT FORM
// =====================================
function handleContactForm(event) {
  event.preventDefault();

  const form = getEl("contactForm");

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // Versi frontend: tidak ada backend untuk mengirim pesan.
  showToast(
    "Formulir berhasil divalidasi. Untuk benar-benar mengirim pesan, hubungkan ke backend atau layanan formulir."
  );
}

// =====================================
// INITIALIZE WEBSITE
// =====================================
document.addEventListener("DOMContentLoaded", () => {
  // Tahun footer
  setText("copyrightYear", new Date().getFullYear());

  // AOS animation
  if (window.AOS) {
    AOS.init({
      duration: 850,
      easing: "ease-out-cubic",
      once: true,
      offset: 75,
      delay: 0,
      disable: window.matchMedia("(prefers-reduced-motion: reduce)").matches
    });
  }

  // Bootstrap scrollspy
  if (window.bootstrap) {
    bootstrap.ScrollSpy.getOrCreateInstance(document.body, {
      target: "#navbarMenu",
      offset: 100
    });
  }

  // Map
  initializeMap();

  // Data awal
  loadWeather(DEFAULT_CITY);
  loadBigCities();

  // Search form
  getEl("searchForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const query = getEl("cityInput").value.trim();

    if (query.length < 2) {
      showMessage("Masukkan minimal dua karakter nama kota.");
      return;
    }

    searchCity(query);
  });

  // Geolocation
  getEl("locationButton").addEventListener(
    "click",
    useCurrentLocation
  );

  // Contact form
  getEl("contactForm").addEventListener(
    "submit",
    handleContactForm
  );

  // Scroll and parallax
  window.addEventListener("scroll", onScroll, { passive: true });
  handleScroll();

  // Back to top
  getEl("backToTop").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Menutup navbar mobile setelah pilih menu
  document.querySelectorAll("#navbarMenu .nav-link")
    .forEach((link) => {
      link.addEventListener("click", () => {
        const menu = getEl("navbarMenu");

        if (menu.classList.contains("show") && window.bootstrap) {
          bootstrap.Collapse.getOrCreateInstance(menu).hide();
        }
      });
    });
});