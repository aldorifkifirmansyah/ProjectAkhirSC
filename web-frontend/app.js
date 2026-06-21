// ── Central config ────────────────────────────────────────────────────────────
// Verified against actual microservice route files:
//   auth-service    → routes/api.php
//   booking-service → routes/api.php
//   catalog-service → index.js
const Config = {
  AUTH_URL: "http://localhost:8000",
  CATALOG_URL: "http://localhost:3000",
  BOOKING_URL: "http://localhost:8001",
  NOTIFICATION_URL: "http://localhost:3002",
};

// ── API service layer ─────────────────────────────────────────────────────────
const ApiService = {
  _headers(token = null, json = false) {
    const h = { Accept: "application/json" };
    if (json) h["Content-Type"] = "application/json";
    if (token) h["Authorization"] = "Bearer " + token;
    return h;
  },

  async get(url, token = null) {
    const res = await fetch(url, { headers: this._headers(token) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  },

  async post(url, body, token = null) {
    const res = await fetch(url, {
      method: "POST",
      headers: this._headers(token, true),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  },

  async put(url, body, token = null) {
    const res = await fetch(url, {
      method: "PUT",
      headers: this._headers(token, true),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  },

  // Used for partial updates — catalog-service PATCH /vehicles/:id/status
  // and booking-service cancel/complete (needs backend routes added)
  async patch(url, body, token = null) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: this._headers(token, true),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  },

  async delete(url, token = null) {
    const res = await fetch(url, {
      method: "DELETE",
      headers: this._headers(token),
    });
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  },
};

// ── JWT decoder ───────────────────────────────────────────────────────────────
// Auth-service embeds `role` in the JWT payload (not in the JSON body).
// Base64url uses '-'/'_' instead of '+'/'/'; padding ('=') is omitted.
function decodeJwt(token) {
  try {
    const b64url = token.split(".")[1];
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

// ── Image compression helper ──────────────────────────────────────────────────
// Reads a File object; scales it down via Canvas if > maxBytes (default 1 MB).
// Returns a plain base64 string (no "data:…;base64," prefix).
function compressImage(file, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = ({ target: { result: src } }) => {
      if (file.size <= maxBytes) {
        resolve(src.split(",")[1]);
        return;
      }
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const ratio = Math.sqrt(maxBytes / file.size);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(img.width * ratio));
        canvas.height = Math.max(1, Math.floor(img.height * ratio));
        canvas
          .getContext("2d")
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

// ── Shared auth persistence ───────────────────────────────────────────────────
// Decodes the JWT, writes localStorage, and syncs the Alpine store atomically.
function persistAuth(token) {
  const payload = decodeJwt(token);
  const role = payload.role ?? payload.user_role ?? "customer";
  localStorage.setItem("user_token", token);
  localStorage.setItem("user_role", role);
  Alpine.store("auth").token = token;
  Alpine.store("auth").role = role;
  return role;
}

// ── Alpine registration ───────────────────────────────────────────────────────
document.addEventListener("alpine:init", () => {
  // ── Global auth store ───────────────────────────────────────────────────────
  Alpine.store("auth", {
    token: localStorage.getItem("user_token"),
    role: localStorage.getItem("user_role"),
    isAuthenticated() {
      return !!this.token;
    },
    logout() {
      localStorage.clear();
      this.token = null;
      this.role = null;
      window.location.href = "login.html";
    },
  });

  // ── loginComponent ──────────────────────────────────────────────────────────
  Alpine.data("loginComponent", () => ({
    email: "",
    password: "",
    loading: false,
    error: "",
    // Show a success notice when redirected back from register.html?registered=1
    registered:
      new URLSearchParams(window.location.search).get("registered") === "1",

    async submit() {
      this.error = "";
      this.loading = true;
      try {
        const data = await ApiService.post(
          `${Config.AUTH_URL}/api/auth/login`,
          {
            email: this.email,
            password: this.password,
          },
        );
        const token = data.token ?? data.access_token;
        const role = persistAuth(token);
        window.location.href = role === "admin" ? "admin.html" : "index.html";
      } catch (e) {
        this.error = e.message || "Invalid credentials. Please try again.";
      } finally {
        this.loading = false;
      }
    },
  }));

  // ── registerComponent ───────────────────────────────────────────────────────
  Alpine.data("registerComponent", () => ({
    name: "",
    email: "",
    password: "",
    confirm: "",
    loading: false,
    error: "",

    async submit() {
      this.error = "";
      if (this.password !== this.confirm) {
        this.error = "Passwords do not match.";
        return;
      }
      if (this.password.length < 6) {
        this.error = "Password must be at least 6 characters.";
        return;
      }
      this.loading = true;
      try {
        const data = await ApiService.post(
          `${Config.AUTH_URL}/api/auth/register`,
          {
            name: this.name,
            email: this.email,
            password: this.password,
            role: "customer", // self-registration is always customer
          },
        );
        const raw = data.token ?? data.access_token;
        if (raw) {
          // Backend auto-logged in — decode JWT and go straight to dashboard
          persistAuth(raw);
          window.location.href = "index.html";
        } else {
          // Backend returned success without a token — go to login with notice
          window.location.href = "login.html?registered=1";
        }
      } catch (e) {
        this.error = e.message || "Registration failed. Please try again.";
      } finally {
        this.loading = false;
      }
    },
  }));

  // ── catalogComponent (Customer dashboard) ───────────────────────────────────
  Alpine.data("catalogComponent", () => ({
    vehicles: [],
    bookings: [],
    loading: true,
    bookingsLoading: false,

    get role() {
      return this.$store.auth.role;
    },
    get token() {
      return this.$store.auth.token;
    },

    async init() {
      if (!this.$store.auth.isAuthenticated()) {
        window.location.href = "login.html";
        return;
      }
      if (this.$store.auth.role === "admin") {
        window.location.href = "admin.html";
        return;
      }
      await Promise.all([this._loadVehicles(), this.loadMyBookings()]);
    },

    async _loadVehicles() {
      try {
        const raw = await ApiService.get(
          `${Config.CATALOG_URL}/api/vehicles`,
          this.token,
        );
        const arr = Array.isArray(raw) ? raw : (raw.data ?? []);
        // Attach isolated per-card date-picker state Alpine can track
        this.vehicles = arr.map((v) => ({
          ...v,
          start_date: "",
          end_date: "",
        }));
      } catch (e) {
        console.error("[catalog] Failed to load vehicles:", e);
      } finally {
        this.loading = false;
      }
    },

    async loadMyBookings() {
      // Endpoint confirmed: GET /api/bookings/my (booking-service routes/api.php)
      this.bookingsLoading = true;
      try {
        const raw = await ApiService.get(
          `${Config.BOOKING_URL}/api/bookings/my`,
          this.token,
        );
        this.bookings = Array.isArray(raw) ? raw : (raw.data ?? []);
      } catch (e) {
        console.error("[booking] Failed to load my bookings:", e);
      } finally {
        this.bookingsLoading = false;
      }
    },

    // Validates dates on the card before submitting.
    async rentVehicle(v) {
      if (!v.start_date || !v.end_date) {
        alert("Please select both a start and end date.");
        return;
      }
      if (new Date(v.end_date) < new Date(v.start_date)) {
        alert("End date must be on or after the start date.");
        return;
      }
      try {
        // Endpoint confirmed: POST /api/bookings (booking-service routes/api.php)
        const data = await ApiService.post(
          `${Config.BOOKING_URL}/api/bookings`,
          {
            vehicle_id: v.id,
            start_date: v.start_date,
            end_date: v.end_date,
          },
          this.token,
        );
        v.status = "booked";
        this.bookings.unshift(data.data ?? data);
        alert("Booking confirmed!");
      } catch (e) {
        alert("Booking failed: " + e.message);
      }
    },

    async cancelBooking(bookingId, vehicleId) {
      if (!confirm("Cancel this rental? This cannot be undone.")) return;
      try {
        await ApiService.patch(
          `${Config.BOOKING_URL}/api/bookings/${bookingId}/cancel`,
          {},
          this.token,
        );
        const b = this.bookings.find((b) => b.id === bookingId);
        if (b) b.status = "cancelled";
        const v = this.vehicles.find((v) => v.id === vehicleId);
        if (v) v.status = "available";
      } catch (e) {
        alert("Cancel failed: " + e.message);
      }
    },

    vehicleName(vehicleId) {
      const v = this.vehicles.find((v) => v.id === vehicleId);
      return v ? v.name : `Unit #${vehicleId}`;
    },

    statusLabel(status) {
      if (status === "available") return "Available";
      if (status === "booked") return "Booked";
      if (status === "maintenance") return "Maintenance";
      return status;
    },

    bookingStatusClass(status) {
      switch ((status ?? "").toLowerCase()) {
        case "cancelled":
          return "text-red-400 bg-red-950/40 border-red-800/40";
        case "completed":
          return "text-zinc-400 bg-zinc-800/40 border-zinc-700";
        default:
          return "text-emerald-400 bg-emerald-950/40 border-emerald-800/40";
      }
    },

    isActiveBooking(status) {
      const s = (status ?? "").toLowerCase();
      return s !== "cancelled" && s !== "completed";
    },

    price(n) {
      return "Rp " + Number(n ?? 0).toLocaleString("id-ID");
    },
  }));

  // ── adminComponent (Admin dashboard) ────────────────────────────────────────
  Alpine.data("adminComponent", () => ({
    vehicles: [],
    bookings: [],
    loading: true,
    bookingsLoading: true,

    // Vehicles supported by catalog-service updateStatus controller
    STATUSES: ["available", "booked", "maintenance"],

    // Add-vehicle form state — matches catalog_vehicles required columns
    form: { name: "", type: "", license_plate: "", price_per_day: "" },
    imageB64: "",
    imagePreview: null,
    imageLoading: false,
    formLoading: false,
    formError: "",
    formSuccess: "",

    editingVehicle: null,
    showEditModal: false,
    editLoading: false,
    editError: "",
    imageEditPreview: null,

    showNotifDropdown: false,
    notifications: [],
    unreadNotifications: false,
    notifLoading: false,

    get role() {
      return this.$store.auth.role;
    },
    get token() {
      return this.$store.auth.token;
    },

    async init() {
      if (
        !this.$store.auth.isAuthenticated() ||
        this.$store.auth.role !== "admin"
      ) {
        window.location.href = "login.html";
        return;
      }
      await Promise.all([this._loadVehicles(), this.fetchAdminNotifications()]);
      setInterval(() => {
        this.fetchAdminNotifications();
      }, 5_000);
    },

    async fetchAdminNotifications() {
      this.notifLoading = true;
      try {
        const data = await ApiService.get(
          `${Config.NOTIFICATION_URL}/api/notifications`,
        );
        this.notifications = Array.isArray(data)
          ? data
          : (data.notifications ?? []);
        this.unreadNotifications = this.notifications.length > 0;
        this._loadAllBookings();
      } catch (e) {
        console.error("[notification] Failed to load notifications:", e);
      } finally {
        this.notifLoading = false;
      }
    },

    markAllAsRead() {
      this.unreadNotifications = false;
    },

    async _loadVehicles() {
      try {
        const raw = await ApiService.get(
          `${Config.CATALOG_URL}/api/vehicles`,
          this.token,
        );
        this.vehicles = Array.isArray(raw) ? raw : (raw.data ?? []);
      } catch (e) {
        console.error("[catalog] Failed to load vehicles:", e);
      } finally {
        this.loading = false;
      }
    },

    // ── Image upload & compression ─────────────────────────────────────────────
    async handleImageUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      this.imagePreview = URL.createObjectURL(file);
      this.imageLoading = true;
      this.formError = "";
      try {
        this.imageB64 = await compressImage(file); // auto-scales if > 1 MB
      } catch {
        this.formError = "Image processing failed. Try a different file.";
        this.imagePreview = null;
        this.imageB64 = "";
      } finally {
        this.imageLoading = false;
      }
    },

    // ── Add vehicle ────────────────────────────────────────────────────────────
    // Required by catalog-service: name, type, license_plate, price_per_day, image_base64
    async addVehicle() {
      this.formError = "";
      this.formSuccess = "";
      const { name, type, license_plate, price_per_day } = this.form;
      if (
        !name.trim() ||
        !type.trim() ||
        !license_plate.trim() ||
        !price_per_day
      ) {
        this.formError =
          "All fields (name, type, license plate, price) are required.";
        return;
      }
      if (!this.imageB64) {
        this.formError = "Please upload a vehicle image.";
        return;
      }
      this.formLoading = true;
      try {
        const created = await ApiService.post(
          `${Config.CATALOG_URL}/api/vehicles`,
          {
            name,
            type,
            license_plate,
            price_per_day: Number(price_per_day),
            image_base64: this.imageB64,
          },
          this.token,
        );

        const rawVehicle = created.data ?? created;
        const finalVehicle = {
          ...rawVehicle,
          status: rawVehicle.status || "available",
        };

        this.vehicles.push(finalVehicle);

        this.form = {
          name: "",
          type: "",
          license_plate: "",
          price_per_day: "",
        };
        this.imageB64 = "";
        this.imagePreview = null;
        this.formSuccess = "Vehicle added to the fleet.";
      } catch (e) {
        this.formError = e.message;
      } finally {
        this.formLoading = false;
      }
    },

    async deleteVehicle(id) {
      if (!confirm("Permanently delete this vehicle?")) return;
      try {
        await ApiService.delete(
          `${Config.CATALOG_URL}/api/vehicles/${id}`,
          this.token,
        );
        this.vehicles = this.vehicles.filter((v) => v.id !== id);
      } catch (e) {
        alert("Delete failed: " + e.message);
      }
    },

    // Uses the dedicated catalog-service endpoint: PATCH /api/vehicles/:id/status
    async updateVehicleStatus(vehicleId, newStatus) {
      const vehicle = this.vehicles.find((v) => v.id === vehicleId);
      const prevStatus = vehicle?.status;
      if (vehicle) vehicle.status = newStatus; // optimistic update
      try {
        await ApiService.patch(
          `${Config.CATALOG_URL}/api/vehicles/${vehicleId}/status`,
          { status: newStatus },
          this.token,
        );
      } catch (e) {
        if (vehicle) vehicle.status = prevStatus; // revert on failure
        alert("Status update failed: " + e.message);
      }
    },

    openEditModal(vehicle) {
      this.editingVehicle = { ...vehicle };
      this.editError = "";
      this.imageEditPreview = null;
      this.showEditModal = true;
    },

    async handleImageEditChange(event) {
      const file = event.target.files[0];
      if (!file) return;
      this.imageEditPreview = URL.createObjectURL(file);
      try {
        this.editingVehicle.image_base64 = await compressImage(file);
      } catch {
        this.editError = "Image processing failed. Try a different file.";
        this.imageEditPreview = null;
      }
    },

    async submitVehicleUpdate() {
      this.editError = "";
      this.editLoading = true;
      try {
        const {
          id,
          name,
          type,
          license_plate,
          price_per_day,
          image_base64,
          status,
        } = this.editingVehicle;
        await ApiService.put(
          `${Config.CATALOG_URL}/api/vehicles/${id}`,
          {
            name,
            type,
            license_plate,
            price_per_day: Number(price_per_day),
            image_base64,
            status,
          },
          this.token,
        );
        await this._loadVehicles();
        this.showEditModal = false;
        this.editingVehicle = null;
      } catch (e) {
        this.editError = e.message;
      } finally {
        this.editLoading = false;
      }
    },

    async _loadAllBookings() {
      try {
        const raw = await ApiService.get(
          `${Config.BOOKING_URL}/api/bookings`,
          this.token,
        );
        this.bookings = Array.isArray(raw) ? raw : (raw.data ?? []);
      } catch (e) {
        console.error("[booking] Failed to load all bookings:", e);
        this.bookings = [];
      } finally {
        this.bookingsLoading = false;
      }
    },

    async completeBooking(bookingId, vehicleId) {
      if (!confirm("Mark this rental as returned and completed?")) return;
      try {
        await ApiService.patch(
          `${Config.BOOKING_URL}/api/bookings/${bookingId}/complete`,
          {},
          this.token,
        );
        const b = this.bookings.find((b) => b.id === bookingId);
        if (b) b.status = "completed";
        const v = this.vehicles.find((v) => v.id === vehicleId);
        if (v) v.status = "available";
        ApiService.post(`${Config.NOTIFICATION_URL}/api/notifications`, {
          type: "booking_completed",
          message:
            "Rental for booking ID " +
            bookingId +
            " has been completed and vehicle returned",
          timestamp: new Date(),
        }).catch(() => {});
      } catch (e) {
        alert("Failed: " + e.message);
      }
    },

    vehicleName(vehicleId) {
      const v = this.vehicles.find((v) => v.id === vehicleId);
      return v ? v.name : `#${vehicleId}`;
    },

    statusLabel(s) {
      return s === "available"
        ? "Available"
        : s === "maintenance"
          ? "Maintenance"
          : "Booked";
    },

    statusBadgeClass(s) {
      if (s === "available")
        return "text-emerald-400 border-emerald-800/60 bg-emerald-950/40";
      if (s === "maintenance")
        return "text-amber-400   border-amber-800/60   bg-amber-950/40";
      return "text-zinc-400   border-zinc-700        bg-zinc-800/40";
    },

    dotClass(s) {
      if (s === "available") return "bg-emerald-400";
      if (s === "maintenance") return "bg-amber-400";
      return "bg-zinc-500";
    },

    bookingStatusClass(status) {
      switch ((status ?? "").toLowerCase()) {
        case "cancelled":
          return "text-red-400   bg-red-950/40   border-red-800/40";
        case "completed":
          return "text-zinc-400  bg-zinc-800/40  border-zinc-700";
        default:
          return "text-emerald-400 bg-emerald-950/40 border-emerald-800/40";
      }
    },

    isActiveBooking(status) {
      const s = (status ?? "").toLowerCase();
      return s !== "cancelled" && s !== "completed";
    },

    price(n) {
      return "Rp " + Number(n ?? 0).toLocaleString("id-ID");
    },
  }));
});
