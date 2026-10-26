// ============================================================
// TEAM CALENDAR — SCRIPT.JS
// Firebase Authentication + Cloud Firestore integration.
//
// SECURITY NOTICE
// ---------------
// Client-side permission checks in this file exist for UX only.
// Real authorization MUST be enforced by Firestore Security Rules.
// This file contains no private credentials; only the public
// Firebase web config (which is not a secret).
// ============================================================


// ============================================================
// 1. FIREBASE CONFIGURATION
// ============================================================
// This app is wired for the Firebase project:
//     team-calendar-c68c3
//
// Fill in the remaining values from:
//   Firebase Console → Project Settings → General → Your apps
//
// Required: apiKey, authDomain, projectId, appId
// Optional for this app: storageBucket, messagingSenderId
//   (only needed if you add Storage or Cloud Messaging later)
//
// These values are PUBLIC by design. Do NOT put service-account
// keys, Admin SDK credentials, or passwords in this file.
//
// Firestore Security Rules are a separate, mandatory step — the
// web config is NOT a security boundary.

const firebaseConfig = {
    apiKey: "AIzaSyAzEhzpU9UlUdXSYqtro6w7HTlktunmBLw",
    authDomain: "team-calendar-c68c3.firebaseapp.com",
    projectId: "team-calendar-c68c3",
    storageBucket: "team-calendar-c68c3.firebasestorage.app",
    messagingSenderId: "6152996174",
    appId: "1:6152996174:web:c3a1efb7d86c9b488d8a1f",
    measurementId: "G-EQ7XBK2RV1"
  };

function getMissingConfigKeys(config) {
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  return required.filter(
    (key) =>
      typeof config[key] !== "string" ||
      config[key].length === 0 ||
      config[key].startsWith("REPLACE_WITH")
  );
}

const CONFIG_READY = getMissingConfigKeys(firebaseConfig).length === 0;


// ============================================================
// 2. FIREBASE SDK IMPORTS (ES MODULES, v13.1.0)
// ============================================================
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";


// ============================================================
// 3. DOM REFERENCES
// ============================================================
const $ = (id) => document.getElementById(id);

const dom = {
  // Auth
  authScreen:     $("auth-screen"),
  loginForm:      $("login-form"),
  loginEmail:     $("login-email"),
  loginPassword:  $("login-password"),
  togglePassword: $("toggle-password"),
  loginError:     $("login-error"),
  loginSubmit:    $("login-submit"),
  loginLoading:   $("login-loading"),

  // App shell
  appShell:      $("app-shell"),
  sidebar:       $("app-sidebar"),
  sidebarToggle: $("sidebar-toggle"),
  mobileNav:     $("mobile-nav"),
  navLinks: document.querySelectorAll(
    ".nav-link[data-nav-target], .mobile-nav__link[data-nav-target]"
  ),

  // Topbar
  pageTitle:       $("page-title"),
  notificationBtn: $("notification-button"),
  themeToggle:     $("theme-toggle"),
  userAvatar:      $("user-avatar"),
  userDisplayName: $("user-display-name"),
  logoutBtn:       $("logout-button"),

  sections: document.querySelectorAll(".app-section"),

  // Dashboard
  dashTodayEvents:      $("dashboard-today-events"),
  dashUpcomingTests:    $("dashboard-upcoming-tests"),
  dashTeamAvailability: $("dashboard-team-availability"),
  dashActiveProjects:   $("dashboard-active-projects"),
  dashPendingTasks:     $("dashboard-pending-tasks"),
  dashProgress:         $("dashboard-progress"),
  dashProgressBar:      $("dashboard-progress-bar"),
  dashProgressValue:    $("dashboard-progress-value"),

  // Calendar
  calendarPrev:          $("calendar-prev"),
  calendarToday:         $("calendar-today"),
  calendarNext:          $("calendar-next"),
  calendarTitle:         $("calendar-title"),
  viewMonth:             $("view-month"),
  viewWeek:              $("view-week"),
  viewDay:               $("view-day"),
  addEventBtn:           $("add-event-button"),
  calendarGrid:          $("calendar-grid"),
  calendarLoading:       $("calendar-loading"),
  calendarError:         $("calendar-error"),
  selectedDateSummary:   $("selected-date-summary"),
  selectedDateEventList: $("selected-date-event-list"),
  selectedDateEmpty:     $("selected-date-empty"),

  // Event dialog
  eventDialog:      $("event-dialog"),
  eventForm:        $("event-form"),
  eventDialogTitle: $("event-dialog-title"),
  eventDialogClose: $("event-dialog-close"),
  eventId:          $("event-id"),
  eventTitle:       $("event-title"),
  eventType:        $("event-type"),
  eventStartDate:   $("event-start-date"),
  eventStartTime:   $("event-start-time"),
  eventEndDate:     $("event-end-date"),
  eventEndTime:     $("event-end-time"),
  eventDescription: $("event-description"),
  eventLink:        $("event-link"),
  eventAssignee:    $("event-assignee"),
  eventFormError:   $("event-form-error"),
  eventDelete:      $("event-delete"),
  eventCancel:      $("event-cancel"),
  eventSave:        $("event-save"),

  // Pipeline
  pipelineStages: document.querySelectorAll("[data-stage-cards]"),

  // Team
  memberCards: document.querySelectorAll(".member-card[data-member-slot]"),

  // Activity
  activityList:  $("activity-list"),
  activityEmpty: $("activity-empty"),

  // Settings
  settingsForm:         $("settings-form"),
  settingsThemeLight:   $("theme-preference-light"),
  settingsThemeDark:    $("theme-preference-dark"),
  settingsThemeSystem:  $("theme-preference-system"),
  settingsWeekStart:    $("settings-week-start"),
  settingsDefaultView:  $("settings-default-view"),
  settingsShowWeekends: $("settings-show-weekends"),
  settingsDisplayName:  $("settings-display-name"),
  settingsEmail:        $("settings-email"),
  settingsSave:         $("settings-save"),

  dataStatus: $("data-status"),
};


// ============================================================
// 4. APPLICATION STATE
// ============================================================
const state = {
  auth: null,
  db: null,
  currentUser: null,
  userProfile: null,

  members: [],
  events: [],
  projects: [],
  activity: [],
  eventsByDate: new Map(),

  viewMode: "month",
  viewDate: new Date(),
  selectedDate: new Date(),

  signingIn: false,
  savingEvent: false,
  themePreference: "system",
  toastTimer: null,

  unsubs: {
    events: null,
    projects: null,
    members: null,
    activity: null,
  },
};


// ============================================================
// 5. DATE UTILITIES
// ============================================================
// Storage: Firestore Timestamps (UTC) for startDate / endDate.
// Display: LOCAL calendar dates. We always use local components
// so events never slide to a different day after timezone shifts.

const pad2 = (n) => String(n).padStart(2, "0");

const toLocalDateKey = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const tsToDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const splitDateTime = (date) => {
  if (!date) return { dateStr: "", timeStr: "" };
  return {
    dateStr: toLocalDateKey(date),
    timeStr: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
};

const combineDateTime = (dateStr, timeStr) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
};

const addDays = (date, days) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
};

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isoWeekday = (date) => (date.getDay() + 6) % 7; // Mon=0..Sun=6
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth   = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const isPastEvent = (event) => {
  const end = tsToDate(event.endDate || event.endDateTime);
  return end ? end.getTime() < Date.now() : false;
};

const isPastDay = (date) =>
  startOfDay(date).getTime() < startOfDay(new Date()).getTime();

const formatDateLong = (date) =>
  date.toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

const formatMonthYear = (date) =>
  date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

const formatTime = (date) =>
  date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const formatRelativeTime = (date) => {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return date.toLocaleDateString();
};


// ============================================================
// 6. FIREBASE INITIALIZATION
// ============================================================
async function initFirebase() {
  if (!CONFIG_READY) return { ok: false, reason: "config-missing" };
  try {
    const app = initializeApp(firebaseConfig);
    state.auth = getAuth(app);
    state.db   = getFirestore(app);
    try {
      await setPersistence(state.auth, browserLocalPersistence);
    } catch {
      /* persistence unavailable — session still works, just not across reloads */
    }
    return { ok: true };
  } catch (err) {
    console.error("Firebase init failed:", err?.code || err?.message);
    return { ok: false, reason: err?.message || "init-failed" };
  }
}


// ============================================================
// 7. AUTHENTICATION
// ============================================================
function showAuthScreen() {
  dom.authScreen.hidden = false;
  dom.appShell.hidden   = true;
}

function showAppShell() {
  dom.authScreen.hidden = true;
  dom.appShell.hidden   = false;
}

function showLoginError(message) {
  if (!message) {
    dom.loginError.hidden = true;
    dom.loginError.textContent = "";
    return;
  }
  dom.loginError.textContent = message;
  dom.loginError.hidden = false;
}

function setLoginLoading(isLoading) {
  state.signingIn = isLoading;
  dom.loginSubmit.disabled = isLoading;
  dom.loginLoading.hidden = !isLoading;
}

function authErrorMessage(code) {
  const map = {
    "auth/invalid-email":          "That email address looks invalid.",
    "auth/user-disabled":          "This account has been disabled.",
    "auth/user-not-found":         "No account found for that email.",
    "auth/wrong-password":         "Incorrect password.",
    "auth/invalid-credential":     "Incorrect email or password.",
    "auth/too-many-requests":      "Too many attempts. Try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/missing-password":       "Please enter a password.",
  };
  return map[code] || "Unable to sign in. Please try again.";
}

async function handleSignIn(e) {
  e.preventDefault();
  if (state.signingIn) return;

  if (!CONFIG_READY) {
    showLoginError(
      "Firebase is not configured yet. Edit script.js → firebaseConfig " +
      "with the values from your Firebase Console."
    );
    return;
  }

  const email    = dom.loginEmail.value.trim();
  const password = dom.loginPassword.value;
  if (!email || !password) {
    showLoginError("Enter both email and password.");
    return;
  }

  showLoginError("");
  setLoginLoading(true);

  try {
    await signInWithEmailAndPassword(state.auth, email, password);
    // onAuthStateChanged handles the UI switch.
  } catch (err) {
    showLoginError(authErrorMessage(err?.code));
  } finally {
    setLoginLoading(false);
  }
}

async function handleSignOut() {
  if (!state.auth) return;
  try {
    await signOut(state.auth);
  } catch (err) {
    console.error("Sign out failed:", err?.code || err?.message);
    showToast("Sign out failed. Please try again.", "error");
  }
}

async function loadUserProfile(user) {
  if (!state.db || !user) return null;
  try {
    const snap = await getDoc(doc(state.db, "members", user.uid));
    if (!snap.exists()) return null;
    return { uid: user.uid, ...snap.data() };
  } catch (err) {
    console.error("Profile load failed:", err?.code || err?.message);
    return null;
  }
}

function renderUserChip() {
  const name =
    state.userProfile?.displayName ||
    state.currentUser?.email ||
    "—";
  dom.userDisplayName.textContent = name;
  dom.userAvatar.textContent = name.trim().charAt(0).toUpperCase() || "—";

  if (dom.settingsDisplayName)
    dom.settingsDisplayName.value = state.userProfile?.displayName || "";
  if (dom.settingsEmail)
    dom.settingsEmail.value = state.currentUser?.email || "";
}


// ============================================================
// 8. PERMISSIONS (CLIENT-SIDE UX ONLY)
// ============================================================
// These checks gate the UI. They are NOT a security boundary.
// Firestore Security Rules must independently enforce ownership,
// roles, and timestamps.

const PERMISSIONS = {
  canManageSharedEvents(member) {
    if (!member) return false;
    return member.role === "admin" || member.role === "editor";
  },
  canManageTeam(member) {
    return member?.role === "admin";
  },
  canUpdateProjectStage(user, member, project) {
    if (!user || !member || !project) return false;
    return member.role === "admin" || project.assigneeUid === user.uid;
  },
};


// ============================================================
// 9. APPLICATION NAVIGATION
// ============================================================
const SECTION_TITLES = {
  dashboard: "Dashboard",
  calendar:  "Calendar",
  pipeline:  "Content Pipeline",
  team:      "Team Members",
  activity:  "Activity History",
  settings:  "Settings",
};

function navigateTo(target) {
  if (!SECTION_TITLES[target]) return;

  dom.sections.forEach((s) => {
    s.hidden = s.id !== target;
  });

  dom.navLinks.forEach((link) => {
    const active = link.dataset.navTarget === target;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else        link.removeAttribute("aria-current");
  });

  dom.pageTitle.textContent = SECTION_TITLES[target];

  if (dom.sidebar.classList.contains("is-open")) closeSidebar();

  if (target === "dashboard") renderDashboard();
  if (target === "calendar")  renderCalendar();
  if (target === "pipeline")  renderPipeline();
  if (target === "team")      renderTeam();
  if (target === "activity")  renderActivity();
}


// ============================================================
// 10. THEME MANAGEMENT
// ============================================================
const THEME_KEY = "team-calendar-theme";

function applyThemePreference(pref) {
  const resolved =
    pref === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : pref;

  document.documentElement.setAttribute("data-theme", resolved);

  const isDark = resolved === "dark";
  if (dom.themeToggle) {
    dom.themeToggle.setAttribute("aria-pressed", String(isDark));
    dom.themeToggle.setAttribute(
      "aria-label",
      isDark ? "Switch to light theme" : "Switch to dark theme"
    );
  }

  if (dom.settingsThemeLight)  dom.settingsThemeLight.checked  = pref === "light";
  if (dom.settingsThemeDark)   dom.settingsThemeDark.checked   = pref === "dark";
  if (dom.settingsThemeSystem) dom.settingsThemeSystem.checked = pref === "system";
}

function initTheme() {
  let stored = null;
  try { stored = localStorage.getItem(THEME_KEY); } catch { /* unavailable */ }
  if (!["light", "dark", "system"].includes(stored)) stored = "system";
  state.themePreference = stored;
  applyThemePreference(stored);
}

function setThemePreference(pref) {
  if (!["light", "dark", "system"].includes(pref)) return;
  state.themePreference = pref;
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* unavailable */ }
  applyThemePreference(pref);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  setThemePreference(current === "dark" ? "light" : "dark");
}


// ============================================================
// 11. CALENDAR RENDERING
// ============================================================
const WEEKDAYS_SUN_FIRST = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEKDAYS_MON_FIRST = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function getWeekStartDay() {
  return dom.settingsWeekStart?.value === "sunday" ? 0 : 1;
}

function renderWeekdayHeadings() {
  const container = dom.calendarGrid?.parentElement?.querySelector(
    ".calendar-weekdays"
  );
  if (!container) return;

  const order = getWeekStartDay() === 0 ? WEEKDAYS_SUN_FIRST : WEEKDAYS_MON_FIRST;
  container.innerHTML = "";
  order.forEach((label) => {
    const cell = document.createElement("span");
    cell.className = "calendar-weekdays__cell";
    cell.setAttribute("aria-hidden", "true");
    cell.textContent = label;
    container.appendChild(cell);
  });
}

function buildMonthMatrix(anchor, weekStart) {
  const firstOfMonth = startOfMonth(anchor);
  const lastOfMonth  = endOfMonth(anchor);
  const startWeekday = weekStart === 0
    ? firstOfMonth.getDay()
    : isoWeekday(firstOfMonth);
  const gridStart = addDays(firstOfMonth, -startWeekday);

  const endWeekday = weekStart === 0
    ? lastOfMonth.getDay()
    : isoWeekday(lastOfMonth);
  const gridEnd = addDays(lastOfMonth, 6 - endWeekday);

  const days = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

function buildWeekMatrix(anchor, weekStart) {
  const anchorIdx = weekStart === 0 ? anchor.getDay() : isoWeekday(anchor);
  const weekStartDate = addDays(startOfDay(anchor), -anchorIdx);
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
}

function buildDayMatrix(anchor) {
  return [startOfDay(anchor)];
}

function eventsForDay(day) {
  return state.eventsByDate.get(toLocalDateKey(day)) || [];
}

function eventTypeClass(type) {
  const map = {
    "class-test":   "event-chip--class-test",
    "class":        "event-chip--class",
    "busy":         "event-chip--busy",
    "free":         "event-chip--free",
    "content-task": "event-chip--content-task",
    "other":        "event-chip--other",
  };
  return map[type] || "event-chip--other";
}

const PROTECTED_STATUSES = [
  "script-uploaded",
  "voice-uploaded",
  "video-completed",
  "video-posted",
];

function productionStatusClass(status) {
  return PROTECTED_STATUSES.includes(status)
    ? `event-status--${status}`
    : "";
}

function buildEventChip(event) {
  const chip = document.createElement("div");
  chip.className = `event-chip ${eventTypeClass(event.type)}`;

  const past       = isPastEvent(event);
  const isProtected = PROTECTED_STATUSES.includes(event.productionStatus);

  if (past && !isProtected) chip.classList.add("is-past");

  if (isProtected) {
    const statusClass = productionStatusClass(event.productionStatus);
    if (statusClass) chip.classList.add(statusClass);
  }

  const title = document.createElement("span");
  title.className = "event-chip__title";
  title.textContent = event.title || "(untitled)";
  chip.appendChild(title);

  chip.dataset.eventId = event.id;
  chip.title = event.title || "";
  return chip;
}

function renderDayCell(day, anchor, selectedDate) {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "calendar-day";
  cell.dataset.date = toLocalDateKey(day);
  cell.setAttribute("role", "gridcell");
  cell.setAttribute("aria-label", formatDateLong(day));

  const isOutside =
    day.getMonth() !== anchor.getMonth() ||
    day.getFullYear() !== anchor.getFullYear();
  if (isOutside)                     cell.classList.add("is-outside");
  if (isSameDay(day, new Date()))    cell.classList.add("is-today");
  if (isSameDay(day, selectedDate))  cell.classList.add("is-selected");
  if (isPastDay(day))                cell.classList.add("is-past");

  const dayEvents = eventsForDay(day);
  if (dayEvents.length > 0) cell.classList.add("has-events");

  const num = document.createElement("span");
  num.className = "calendar-day__number";
  num.textContent = String(day.getDate());
  cell.appendChild(num);

  const eventsWrap = document.createElement("div");
  eventsWrap.className = "calendar-day__events";
  const maxVisible = 3;
  dayEvents.slice(0, maxVisible).forEach((ev) => {
    eventsWrap.appendChild(buildEventChip(ev));
  });
  if (dayEvents.length > maxVisible) {
    const more = document.createElement("span");
    more.className = "calendar-day__more";
    more.textContent = `+${dayEvents.length - maxVisible} more`;
    eventsWrap.appendChild(more);
  }
  cell.appendChild(eventsWrap);

  cell.addEventListener("click", (e) => {
    if (e.target.closest(".event-chip")) return;
    selectDate(day);
  });

  eventsWrap.querySelectorAll(".event-chip").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const ev = state.events.find((x) => x.id === chip.dataset.eventId);
      if (ev) openEventDialog(ev);
    });
  });

  return cell;
}

function renderCalendar() {
  if (!state.db) {
    showCalendarError("Firebase is not configured. Calendar data is unavailable.");
    return;
  }
  hideCalendarError();
  renderWeekdayHeadings();

  const anchor   = state.viewDate;
  const selected = state.selectedDate;
  const mode     = state.viewMode;

  if (mode === "month") {
    dom.calendarTitle.textContent = formatMonthYear(anchor);
  } else if (mode === "week") {
    const wStart = addDays(
      startOfDay(anchor),
      -(getWeekStartDay() === 0 ? anchor.getDay() : isoWeekday(anchor))
    );
    dom.calendarTitle.textContent = `Week of ${formatDateLong(wStart)}`;
  } else {
    dom.calendarTitle.textContent = formatDateLong(anchor);
  }

  dom.calendarGrid.innerHTML = "";

  const days = mode === "month"
    ? buildMonthMatrix(anchor, getWeekStartDay())
    : mode === "week"
      ? buildWeekMatrix(anchor, getWeekStartDay())
      : buildDayMatrix(anchor);

  days.forEach((day) => {
    dom.calendarGrid.appendChild(renderDayCell(day, anchor, selected));
  });

  renderSelectedDatePanel();
}

function renderSelectedDatePanel() {
  const day = state.selectedDate;
  dom.selectedDateSummary.textContent = formatDateLong(day);
  dom.selectedDateEventList.innerHTML = "";

  const dayEvents = eventsForDay(day).slice().sort((a, b) => {
    const at = tsToDate(a.startDate)?.getTime() || 0;
    const bt = tsToDate(b.startDate)?.getTime() || 0;
    return at - bt;
  });

  if (dayEvents.length === 0) {
    dom.selectedDateEmpty.hidden = false;
    return;
  }
  dom.selectedDateEmpty.hidden = true;

  dayEvents.forEach((ev) => {
    const li = document.createElement("li");
    li.className = "event-list__item";

    const title = document.createElement("div");
    title.className = "event-list__title";
    title.textContent = ev.title || "(untitled)";
    li.appendChild(title);

    const time = document.createElement("div");
    time.className = "event-list__time";
    const start = tsToDate(ev.startDate);
    const end   = tsToDate(ev.endDate);
    if (start) {
      time.textContent = end
        ? `${formatTime(start)} – ${formatTime(end)}`
        : formatTime(start);
    }
    li.appendChild(time);

    li.addEventListener("click", () => openEventDialog(ev));
    dom.selectedDateEventList.appendChild(li);
  });
}

function selectDate(date) {
  state.selectedDate = startOfDay(date);
  if (state.viewMode === "day") state.viewDate = state.selectedDate;
  renderCalendar();
}

function setCalendarView(mode) {
  if (!["month", "week", "day"].includes(mode)) return;
  state.viewMode = mode;
  [dom.viewMonth, dom.viewWeek, dom.viewDay].forEach((btn) => {
    const btnMode = btn === dom.viewMonth
      ? "month"
      : btn === dom.viewWeek ? "week" : "day";
    const active = btnMode === mode;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  renderCalendar();
}

function calendarStep(direction) {
  const d = state.viewDate;
  if (state.viewMode === "month") {
    state.viewDate = new Date(d.getFullYear(), d.getMonth() + direction, 1);
  } else if (state.viewMode === "week") {
    state.viewDate = addDays(d, direction * 7);
  } else {
    state.viewDate = addDays(d, direction);
  }
  renderCalendar();
}

function showCalendarError(msg) {
  if (!dom.calendarError) return;
  dom.calendarError.textContent = msg;
  dom.calendarError.hidden = false;
}

function hideCalendarError() {
  if (dom.calendarError) dom.calendarError.hidden = true;
}

function showCalendarLoading() {
  if (dom.calendarLoading) dom.calendarLoading.hidden = false;
}

function hideCalendarLoading() {
  if (dom.calendarLoading) dom.calendarLoading.hidden = true;
}

function indexEventsByDate() {
  const map = new Map();
  state.events.forEach((ev) => {
    const start = tsToDate(ev.startDate);
    const end   = tsToDate(ev.endDate) || start;
    if (!start) return;
    let cursor = startOfDay(start);
    const stop = startOfDay(end);
    while (cursor <= stop) {
      const key = toLocalDateKey(cursor);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
      cursor = addDays(cursor, 1);
    }
  });
  state.eventsByDate = map;
}


// ============================================================
// 12. EVENT CRUD
// ============================================================
function openEventDialog(event = null, presetDate = null) {
  if (!CONFIG_READY || !state.db) {
    showToast("Firebase is not configured. Event editing is unavailable.", "error");
    return;
  }
  dom.eventForm.reset();
  dom.eventFormError.hidden = true;

  if (event) {
    dom.eventDialogTitle.textContent = "Edit event";
    dom.eventId.value          = event.id || "";
    dom.eventTitle.value       = event.title || "";
    dom.eventType.value        = event.type || "";
    dom.eventDescription.value = event.description || "";
    dom.eventLink.value        = event.resourceUrl || "";
    dom.eventAssignee.value    = event.assigneeUid || "";

    const start = tsToDate(event.startDate);
    if (start) {
      const { dateStr, timeStr } = splitDateTime(start);
      dom.eventStartDate.value = dateStr;
      dom.eventStartTime.value = timeStr;
    }
    const end = tsToDate(event.endDate);
    if (end) {
      const { dateStr, timeStr } = splitDateTime(end);
      dom.eventEndDate.value = dateStr;
      dom.eventEndTime.value = timeStr;
    }
    dom.eventDelete.hidden = false;
  } else {
    dom.eventDialogTitle.textContent = "New event";
    dom.eventId.value = "";
    const base = presetDate || state.selectedDate;
    const { dateStr } = splitDateTime(base);
    dom.eventStartDate.value = dateStr;
    dom.eventEndDate.value   = dateStr;
    dom.eventStartTime.value = "09:00";
    dom.eventEndTime.value   = "10:00";
    dom.eventDelete.hidden   = true;
  }

  populateAssigneeOptions();
  if (typeof dom.eventDialog.showModal === "function") {
    dom.eventDialog.showModal();
  } else {
    dom.eventDialog.setAttribute("open", "");
  }
  dom.eventTitle.focus();
}

function closeEventDialog() {
  if (typeof dom.eventDialog.close === "function") {
    dom.eventDialog.close();
  } else {
    dom.eventDialog.removeAttribute("open");
  }
}

function populateAssigneeOptions() {
  if (!dom.eventAssignee) return;
  const current = dom.eventAssignee.value;
  dom.eventAssignee.innerHTML = "";

  const none = document.createElement("option");
  none.value = "";
  none.textContent = "Unassigned";
  dom.eventAssignee.appendChild(none);

  state.members.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.uid;
    opt.textContent = m.displayName || m.email || m.uid;
    dom.eventAssignee.appendChild(opt);
  });

  dom.eventAssignee.value = current;
}

function validateEventForm() {
  const errors = [];
  const title  = dom.eventTitle.value.trim();
  const type   = dom.eventType.value;

  if (!title) errors.push("Title is required.");
  if (!type)  errors.push("Event type is required.");

  const start = combineDateTime(dom.eventStartDate.value, dom.eventStartTime.value);
  const end   = combineDateTime(dom.eventEndDate.value,   dom.eventEndTime.value);

  if (!start) errors.push("Start date and time are required.");
  if (!end)   errors.push("End date and time are required.");
  if (start && end && end < start) errors.push("End must be after start.");

  const link = dom.eventLink.value.trim();
  if (link) {
    try { new URL(link); }
    catch { errors.push("External link must be a valid URL."); }
  }

  return { errors, title, type, start, end, link };
}

async function submitEventForm(e) {
  e.preventDefault();
  if (state.savingEvent) return;
  if (!state.db) {
    showToast("Firebase is not configured.", "error");
    return;
  }

  const result = validateEventForm();
  if (result.errors.length > 0) {
    dom.eventFormError.textContent = result.errors[0];
    dom.eventFormError.hidden = false;
    return;
  }
  dom.eventFormError.hidden = true;

  state.savingEvent = true;
  dom.eventSave.disabled = true;

  try {
    const id = dom.eventId.value;
    const payload = {
      title:        result.title,
      type:         result.type,
      startDate:    Timestamp.fromDate(result.start),
      endDate:      Timestamp.fromDate(result.end),
      description:  dom.eventDescription.value.trim(),
      resourceUrl:  result.link,
      assigneeUid:  dom.eventAssignee.value || null,
      updatedAt:    serverTimestamp(),
    };

    if (id) {
      await updateDoc(doc(state.db, "events", id), payload);
      showToast("Event updated.", "success");
    } else {
      payload.createdBy = state.currentUser.uid;
      payload.createdAt = serverTimestamp();
      await addDoc(collection(state.db, "events"), payload);
      showToast("Event created.", "success");
    }
    closeEventDialog();
    // Realtime listener refreshes the calendar automatically.
  } catch (err) {
    console.error("Save event failed:", err?.code || err?.message);
    showToast(
      err?.code === "permission-denied"
        ? "You do not have permission to save this event."
        : "Failed to save the event. Please try again.",
      "error"
    );
  } finally {
    state.savingEvent = false;
    dom.eventSave.disabled = false;
  }
}

async function deleteCurrentEvent() {
  const id = dom.eventId.value;
  if (!id) return;
  if (!state.db) {
    showToast("Firebase is not configured.", "error");
    return;
  }
  if (!confirm("Delete this event permanently?")) return;

  try {
    await deleteDoc(doc(state.db, "events", id));
    showToast("Event deleted.", "success");
    closeEventDialog();
  } catch (err) {
    console.error("Delete event failed:", err?.code || err?.message);
    showToast(
      err?.code === "permission-denied"
        ? "You do not have permission to delete this event."
        : "Failed to delete the event.",
      "error"
    );
  }
}


// ============================================================
// 13. PROJECT CRUD (PREPARED FOR FUTURE UI)
// ============================================================
// These functions are ready to be called from a future project UI.
// The current HTML does not include project-creation or stage-change
// controls, so they are exposed as module-scoped helpers only.
// Firestore Security Rules must authorize these operations.

async function createProject({
  title, description, stage, assigneeUid, dueDate, resourceUrl, notes,
}) {
  if (!state.db) throw new Error("Firestore is not initialized.");
  if (!PIPELINE_STAGES.includes(stage)) throw new Error("Invalid stage.");
  if (!title || typeof title !== "string") throw new Error("Title is required.");

  return addDoc(collection(state.db, "projects"), {
    title,
    description: description || "",
    stage,
    assigneeUid: assigneeUid || null,
    dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
    resourceUrl: resourceUrl || "",
    notes: notes || "",
    createdBy: state.currentUser?.uid || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function updateProjectStage(projectId, newStage) {
  if (!state.db) throw new Error("Firestore is not initialized.");
  if (!PIPELINE_STAGES.includes(newStage)) throw new Error("Invalid stage.");
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found.");
  if (!PERMISSIONS.canUpdateProjectStage(state.currentUser, state.userProfile, project)) {
    throw new Error("Not authorized to change this project stage.");
  }
  return updateDoc(doc(state.db, "projects", projectId), {
    stage: newStage,
    updatedAt: serverTimestamp(),
  });
}

async function updateProject(projectId, updates) {
  if (!state.db) throw new Error("Firestore is not initialized.");
  const allowed = ["title", "description", "assigneeUid", "resourceUrl", "notes"];
  const filtered = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }
  if (updates.dueDate !== undefined) {
    filtered.dueDate = updates.dueDate
      ? Timestamp.fromDate(updates.dueDate)
      : null;
  }
  filtered.updatedAt = serverTimestamp();
  return updateDoc(doc(state.db, "projects", projectId), filtered);
}

async function deleteProject(projectId) {
  if (!state.db) throw new Error("Firestore is not initialized.");
  return deleteDoc(doc(state.db, "projects", projectId));
}


// ============================================================
// 14. CONTENT PRODUCTION PIPELINE RENDERING
// ============================================================
const PIPELINE_STAGES = [
  "script-pending",
  "script-uploaded",
  "voice-pending",
  "voice-uploaded",
  "video-editing",
  "video-completed",
  "video-posted",
];

function renderPipeline() {
  if (!dom.pipelineStages.length) return;
  dom.pipelineStages.forEach((container) => { container.innerHTML = ""; });

  if (state.projects.length === 0) {
    dom.pipelineStages.forEach((container) => {
      container.appendChild(makeEmpty("No projects in this stage."));
    });
    return;
  }

  const grouped = new Map(PIPELINE_STAGES.map((s) => [s, []]));
  state.projects.forEach((p) => {
    const stage = PIPELINE_STAGES.includes(p.stage) ? p.stage : "script-pending";
    grouped.get(stage).push(p);
  });

  dom.pipelineStages.forEach((container) => {
    const stage = container.dataset.stageCards;
    const projects = grouped.get(stage) || [];

    const countEl = document.getElementById(`stage-${stage}-count`);
    if (countEl) {
      countEl.textContent = String(projects.length);
      countEl.setAttribute(
        "aria-label",
        `${projects.length} project${projects.length === 1 ? "" : "s"}`
      );
    }

    if (projects.length === 0) {
      container.appendChild(makeEmpty("No projects in this stage."));
      return;
    }
    projects.forEach((p) => container.appendChild(buildProjectCard(p)));
  });
}

function makeEmpty(text) {
  const p = document.createElement("p");
  p.className = "empty-state";
  p.textContent = text;
  return p;
}

function buildProjectCard(project) {
  const card = document.createElement("div");
  card.className = "project-card";

  const title = document.createElement("h4");
  title.className = "project-card__title";
  title.textContent = project.title || "(untitled)";
  card.appendChild(title);

  const stage = document.createElement("span");
  stage.className = "project-card__stage";
  stage.textContent = project.stage || "—";
  card.appendChild(stage);

  const meta = document.createElement("div");
  meta.className = "project-card__meta";

  const member = state.members.find((m) => m.uid === project.assigneeUid);
  if (member) {
    const item = document.createElement("span");
    item.className = "project-card__meta-item";
    item.textContent = member.displayName || member.email || "Unassigned";
    meta.appendChild(item);
  }
  if (project.dueDate) {
    const due = tsToDate(project.dueDate);
    if (due) {
      const item = document.createElement("span");
      item.className = "project-card__meta-item";
      item.textContent = `Due ${due.toLocaleDateString()}`;
      meta.appendChild(item);
    }
  }
  card.appendChild(meta);

  if (project.notes) {
    const notes = document.createElement("p");
    notes.className = "project-card__notes";
    notes.textContent = project.notes;
    card.appendChild(notes);
  }

  if (project.resourceUrl) {
    try {
      const url = new URL(project.resourceUrl);
      if (["http:", "https:"].includes(url.protocol)) {
        const a = document.createElement("a");
        a.className = "project-card__link";
        a.href = url.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "Open resource";
        card.appendChild(a);
      }
    } catch { /* invalid URL — skip link */ }
  }

  if (project.updatedAt) {
    const updated = tsToDate(project.updatedAt);
    if (updated) {
      const upd = document.createElement("div");
      upd.className = "project-card__updated";
      upd.textContent = `Updated ${formatRelativeTime(updated)}`;
      card.appendChild(upd);
    }
  }

  return card;
}


// ============================================================
// 15. TEAM MEMBERS
// ============================================================
function renderTeam() {
  if (!dom.memberCards.length) return;
  const slots = Array.from(dom.memberCards);

  slots.forEach((card, idx) => {
    const member = state.members[idx];
    const avatar     = card.querySelector("[data-member-avatar]");
    const name       = card.querySelector("[data-member-name]");
    const role       = card.querySelector("[data-member-role]");
    const color      = card.querySelector("[data-member-color]");
    const colorLabel = card.querySelector("[data-member-color-label]");
    const avail      = card.querySelector("[data-member-availability]");

    if (!member) {
      if (avatar) avatar.textContent = "—";
      if (name)   name.textContent = "Member not configured";
      if (role)   role.textContent = "—";
      if (avail)  avail.textContent = "Unknown";
      return;
    }

    const displayName = member.displayName || member.email || "Unnamed";
    if (avatar)     avatar.textContent = displayName.charAt(0).toUpperCase();
    if (name)       name.textContent = displayName;
    if (role)       role.textContent = member.role || "Member";
    if (color && member.color) color.style.backgroundColor = member.color;
    if (colorLabel) colorLabel.textContent = member.color || "—";
    if (avail)      avail.textContent = computeMemberAvailability(member);
  });
}

function computeMemberAvailability(member) {
  if (state.eventsByDate.size === 0 && state.events.length === 0) {
    return "Not loaded";
  }
  const todayKey = toLocalDateKey(new Date());
  const theirs = (state.eventsByDate.get(todayKey) || [])
    .filter((e) => e.assigneeUid === member.uid);

  if (theirs.length === 0) return "Available";
  if (theirs.some((e) => e.type === "busy")) return "Busy";
  if (theirs.some((e) => e.type === "free")) return "Free";
  return "Scheduled";
}


// ============================================================
// 16. DASHBOARD
// ============================================================
function renderDashboard() {
  const today = startOfDay(new Date());

  // Today's events
  const todayEvents = (state.eventsByDate.get(toLocalDateKey(today)) || [])
    .slice()
    .sort((a, b) =>
      (tsToDate(a.startDate)?.getTime() || 0) -
      (tsToDate(b.startDate)?.getTime() || 0)
    );

  dom.dashTodayEvents.innerHTML = "";
  if (todayEvents.length === 0) {
    dom.dashTodayEvents.appendChild(makeEmpty("No events scheduled for today."));
  } else {
    todayEvents.slice(0, 5).forEach((ev) => {
      dom.dashTodayEvents.appendChild(buildSimpleItem(ev.title || "(untitled)"));
    });
  }

  // Upcoming class tests (next 14 days)
  const tests = state.events.filter((e) => {
    if (e.type !== "class-test") return false;
    const d = tsToDate(e.startDate);
    if (!d) return false;
    const diff = startOfDay(d).getTime() - today.getTime();
    return diff >= 0 && diff <= 14 * 86400000;
  });
  dom.dashUpcomingTests.innerHTML = "";
  if (tests.length === 0) {
    dom.dashUpcomingTests.appendChild(makeEmpty("No class tests scheduled."));
  } else {
    tests.forEach((t) => {
      const d = tsToDate(t.startDate);
      dom.dashUpcomingTests.appendChild(
        buildSimpleItem(`${t.title || "Class Test"} · ${d.toLocaleDateString()}`)
      );
    });
  }

  // Team availability
  dom.dashTeamAvailability.innerHTML = "";
  if (state.members.length === 0) {
    dom.dashTeamAvailability.appendChild(makeEmpty("Team not loaded."));
  } else {
    state.members.forEach((m) => {
      dom.dashTeamAvailability.appendChild(
        buildSimpleItem(
          `${m.displayName || "Member"} — ${computeMemberAvailability(m)}`
        )
      );
    });
  }

  // Active projects (not video-posted)
  const active = state.projects.filter((p) => p.stage !== "video-posted");
  dom.dashActiveProjects.innerHTML = "";
  if (active.length === 0) {
    dom.dashActiveProjects.appendChild(makeEmpty("No active projects."));
  } else {
    active.slice(0, 5).forEach((p) => {
      dom.dashActiveProjects.appendChild(
        buildSimpleItem(p.title || "(untitled)")
      );
    });
  }

  // Pending tasks (future content-task events)
  const pending = state.events.filter((e) => {
    if (e.type !== "content-task") return false;
    const d = tsToDate(e.startDate);
    return d && d.getTime() >= Date.now();
  });
  dom.dashPendingTasks.innerHTML = "";
  if (pending.length === 0) {
    dom.dashPendingTasks.appendChild(makeEmpty("No pending tasks."));
  } else {
    pending.slice(0, 5).forEach((t) => {
      dom.dashPendingTasks.appendChild(buildSimpleItem(t.title || "(untitled)"));
    });
  }

  // Production progress
  const total     = state.projects.length;
  const completed = state.projects.filter((p) => p.stage === "video-posted").length;
  const pct       = total === 0 ? 0 : Math.round((completed / total) * 100);

  if (dom.dashProgressBar)   dom.dashProgressBar.style.width = pct + "%";
  if (dom.dashProgressValue) dom.dashProgressValue.textContent = String(pct);
  if (dom.dashProgress)      dom.dashProgress.setAttribute("aria-valuenow", String(pct));
}

function buildSimpleItem(text) {
  const p = document.createElement("p");
  p.className = "form-hint";
  p.textContent = text;
  return p;
}


// ============================================================
// 17. ACTIVITY HISTORY
// ============================================================
function renderActivity() {
  dom.activityList.innerHTML = "";
  if (state.activity.length === 0) {
    dom.activityEmpty.hidden = false;
    return;
  }
  dom.activityEmpty.hidden = true;

  state.activity.forEach((item) => {
    const li = document.createElement("li");
    li.className = "activity-list__item";

    const content = document.createElement("div");
    content.className = "activity-list__content";

    const desc = document.createElement("div");
    desc.className = "activity-list__description";
    desc.textContent = item.description || "";
    content.appendChild(desc);

    const meta = document.createElement("div");
    meta.className = "activity-list__meta";
    const member = state.members.find((m) => m.uid === item.actorUid);
    meta.textContent = member
      ? member.displayName || member.email
      : "Unknown member";
    content.appendChild(meta);

    li.appendChild(content);

    const timeEl = document.createElement("time");
    timeEl.className = "activity-list__time";
    const created = tsToDate(item.createdAt);
    if (created) {
      timeEl.dateTime = created.toISOString();
      timeEl.textContent = formatRelativeTime(created);
    }
    li.appendChild(timeEl);

    dom.activityList.appendChild(li);
  });
}


// ============================================================
// 18. NOTIFICATIONS (TOASTS)
// ============================================================
function showToast(message, kind = "success") {
  const existing = document.getElementById("app-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "app-toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 1000;
    padding: 12px 16px; border-radius: 10px; font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 340px;
    color: #ffffff;
    background: ${kind === "error" ? "#b23a3a" : "#1f5d3f"};
  `;
  document.body.appendChild(toast);

  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.remove(), 4500);
}


// ============================================================
// 19. REAL-TIME SUBSCRIPTIONS
// ============================================================
function attachRealtimeListeners() {
  if (!state.db) return;

  // Events
  if (state.unsubs.events) state.unsubs.events();
  showCalendarLoading();
  state.unsubs.events = onSnapshot(
    collection(state.db, "events"),
    (snap) => {
      hideCalendarLoading();
      const events = [];
      snap.forEach((d) => events.push({ id: d.id, ...d.data() }));
      state.events = events;
      indexEventsByDate();
      renderCalendar();
      renderDashboard();
      renderTeam();
    },
    (err) => {
      hideCalendarLoading();
      console.error("Events listener failed:", err?.code || err?.message);
      showCalendarError("Unable to load events. " + (err?.code || ""));
      setDataStatus("Error loading events");
    }
  );

  // Projects
  if (state.unsubs.projects) state.unsubs.projects();
  state.unsubs.projects = onSnapshot(
    collection(state.db, "projects"),
    (snap) => {
      const projects = [];
      snap.forEach((d) => projects.push({ id: d.id, ...d.data() }));
      state.projects = projects;
      renderPipeline();
      renderDashboard();
    },
    (err) => {
      console.error("Projects listener failed:", err?.code || err?.message);
      setDataStatus("Error loading projects");
    }
  );

  // Members
  if (state.unsubs.members) state.unsubs.members();
  state.unsubs.members = onSnapshot(
    collection(state.db, "members"),
    (snap) => {
      const members = [];
      snap.forEach((d) => members.push({ uid: d.id, ...d.data() }));
      state.members = members;
      populateAssigneeOptions();
      renderTeam();
      renderDashboard();
      renderPipeline();
    },
    (err) => {
      console.error("Members listener failed:", err?.code || err?.message);
    }
  );

  // Activity
  if (state.unsubs.activity) state.unsubs.activity();
  state.unsubs.activity = onSnapshot(
    query(
      collection(state.db, "activity"),
      orderBy("createdAt", "desc"),
      limit(100)
    ),
    (snap) => {
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      state.activity = items;
      renderActivity();
    },
    (err) => {
      console.error("Activity listener failed:", err?.code || err?.message);
    }
  );

  setDataStatus("Connected");
}

function detachRealtimeListeners() {
  Object.values(state.unsubs).forEach((unsub) => {
    if (typeof unsub === "function") {
      try { unsub(); } catch { /* ignore */ }
    }
  });
  state.unsubs = { events: null, projects: null, members: null, activity: null };
}


// ============================================================
// 20. AUTH STATE HANDLING
// ============================================================
let authEpoch = 0;

async function handleAuthStateChange(user) {
  const epoch = ++authEpoch;

  if (!user) {
    detachRealtimeListeners();
    state.currentUser   = null;
    state.userProfile   = null;
    state.members       = [];
    state.events        = [];
    state.projects      = [];
    state.activity      = [];
    state.eventsByDate  = new Map();
    showAuthScreen();
    setDataStatus("Signed out");
    return;
  }

  state.currentUser = user;
  const profile = await loadUserProfile(user);
  if (epoch !== authEpoch) return;

  if (!profile) {
    // Fail closed: signed in to Firebase, but no member profile.
    // Sign out so the user can try another account or an admin
    // can create their profile.
    try { await signOut(state.auth); } catch { /* ignore */ }
    if (epoch !== authEpoch) return; // signOut triggered a new cycle
    showAuthScreen();
    showLoginError(
      "Signed in, but no member profile exists for this account. " +
      "Ask a team administrator to create a document in the 'members' " +
      "collection with ID: " + user.uid
    );
    setDataStatus("Profile missing");
    return;
  }

  state.userProfile = profile;
  renderUserChip();
  showAppShell();
  navigateTo("dashboard");
  setDataStatus("Loading…");
  attachRealtimeListeners();
}


// ============================================================
// 21. SETUP / STATUS HELPERS
// ============================================================
function setDataStatus(text) {
  if (dom.dataStatus) dom.dataStatus.textContent = text;
}

function closeSidebar() {
  dom.sidebar.classList.remove("is-open");
  dom.sidebarToggle.setAttribute("aria-expanded", "false");
}

function toggleSidebar() {
  const open = dom.sidebar.classList.toggle("is-open");
  dom.sidebarToggle.setAttribute("aria-expanded", String(open));
}

function showSetupMessage() {
  showAuthScreen();
  const panel = dom.authScreen?.querySelector(".auth-screen__panel");
  if (!panel || panel.querySelector(".setup-notice")) return;

  const missing = getMissingConfigKeys(firebaseConfig);
  const notice = document.createElement("div");
  notice.className = "setup-notice form-error";
  notice.setAttribute("role", "alert");
  notice.textContent =
    missing.length > 0
      ? `Firebase configuration incomplete. Missing: ${missing.join(", ")}. ` +
        `Edit script.js → firebaseConfig with the values from your Firebase Console ` +
        `(Project Settings → General → Your apps).`
      : `Firebase could not be initialized. Check the browser console for details.`;

  const form = panel.querySelector(".auth-form");
  if (form) panel.insertBefore(notice, form);
  else      panel.appendChild(notice);

  setDataStatus("Setup required");
}


// ============================================================
// 22. EVENT LISTENERS
// ============================================================
function attachListeners() {
  // Auth
  if (dom.loginForm) dom.loginForm.addEventListener("submit", handleSignIn);

  if (dom.togglePassword) {
    dom.togglePassword.addEventListener("click", () => {
      const isPassword = dom.loginPassword.type === "password";
      dom.loginPassword.type = isPassword ? "text" : "password";
      dom.togglePassword.setAttribute("aria-pressed", String(isPassword));
      dom.togglePassword.setAttribute(
        "aria-label",
        isPassword ? "Hide password" : "Show password"
      );
    });
  }

  // Navigation
  dom.navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(link.dataset.navTarget);
    });
  });

  // Sidebar / logout
  if (dom.sidebarToggle) dom.sidebarToggle.addEventListener("click", toggleSidebar);
  if (dom.logoutBtn)     dom.logoutBtn.addEventListener("click", handleSignOut);

  // Theme
  if (dom.themeToggle) dom.themeToggle.addEventListener("click", toggleTheme);

  [dom.settingsThemeLight, dom.settingsThemeDark, dom.settingsThemeSystem].forEach((r) => {
    if (!r) return;
    r.addEventListener("change", () => setThemePreference(r.value));
  });

  // Calendar
  if (dom.calendarPrev)  dom.calendarPrev.addEventListener("click", () => calendarStep(-1));
  if (dom.calendarNext)  dom.calendarNext.addEventListener("click", () => calendarStep(1));
  if (dom.calendarToday) {
    dom.calendarToday.addEventListener("click", () => {
      state.viewDate     = new Date();
      state.selectedDate = startOfDay(new Date());
      renderCalendar();
    });
  }
  if (dom.viewMonth) dom.viewMonth.addEventListener("click", () => setCalendarView("month"));
  if (dom.viewWeek)  dom.viewWeek.addEventListener("click",  () => setCalendarView("week"));
  if (dom.viewDay)   dom.viewDay.addEventListener("click",   () => setCalendarView("day"));

  if (dom.addEventBtn) {
    dom.addEventBtn.addEventListener("click", () =>
      openEventDialog(null, state.selectedDate)
    );
  }

  // Event dialog
  if (dom.eventDialogClose) dom.eventDialogClose.addEventListener("click", closeEventDialog);
  if (dom.eventCancel)      dom.eventCancel.addEventListener("click", closeEventDialog);
  if (dom.eventForm)        dom.eventForm.addEventListener("submit", submitEventForm);
  if (dom.eventDelete)      dom.eventDelete.addEventListener("click", deleteCurrentEvent);

  // Settings form — local-only for now
  if (dom.settingsForm) {
    dom.settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      showToast(
        "Theme preference saved locally. Other settings are not yet persisted to Firestore.",
        "success"
      );
    });
  }

  // Notification button (no notification system configured)
  if (dom.notificationBtn) {
    dom.notificationBtn.addEventListener("click", () => {
      showToast("Notifications are not configured yet.", "success");
    });
  }

  // System theme changes when preference is "system"
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => {
    if (state.themePreference === "system") {
      applyThemePreference("system");
    }
  });
}


// ============================================================
// 23. INITIALIZATION
// ============================================================
async function init() {
  attachListeners();
  initTheme();
  showAuthScreen();

  if (!CONFIG_READY) {
    showSetupMessage();
    return;
  }

  const result = await initFirebase();
  if (!result.ok) {
    showLoginError("Firebase failed to initialize: " + result.reason);
    return;
  }

  onAuthStateChanged(state.auth, (user) => {
    handleAuthStateChange(user).catch((err) => {
      console.error("Auth state handler failed:", err?.code || err?.message);
      showLoginError("Failed to initialize the application.");
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
