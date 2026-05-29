// =========================================================
// HRI HRD사업팀 과정운영 관리 앱
// 1단계 MVP
// =========================================================

const STATUS_LABELS = {
  planning: "기획중",
  ready: "준비중",
  running: "운영중",
  completed: "완료",
  hold: "보류",
  canceled: "취소",
};

const STATUS_ORDER = ["planning", "ready", "running", "completed", "hold", "canceled"];

const REGIONS = [
  "미정", "서울", "경기", "인천", "강원", "충북", "충남", "대전", "세종",
  "전북", "전남", "광주", "경북", "경남", "대구", "울산", "부산", "제주"
];

let state = {
  members: [],
  courses: [],
  rounds: [],
  checklistItems: [],
  checklistStatuses: [],
  logs: [],
  currentUserId: "",
  currentView: "timeline",
  selectedCourseId: "",
};

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  fillStaticSelects();
  await loadAll();
});

// ---------------------------------------------------------
// Event Binding
// ---------------------------------------------------------
function bindEvents() {
  document.getElementById("openCourseModalBtn").addEventListener("click", () => openCourseModal());
  document.getElementById("courseForm").addEventListener("submit", saveCourse);
  document.getElementById("roundForm").addEventListener("submit", saveRound);

  document.getElementById("hideCourseBtn").addEventListener("click", hideCurrentCourse);
  document.getElementById("hideRoundBtn").addEventListener("click", hideCurrentRound);

  document.getElementById("openRoundModalBtn").addEventListener("click", () => openRoundModal());
  document.getElementById("editCourseFromDetailBtn").addEventListener("click", () => {
    const course = getCourseById(state.selectedCourseId);
    closeModal("detailModal");
    openCourseModal(course);
  });

  document.getElementById("roundStatus").addEventListener("change", toggleCompletedFields);

  document.getElementById("currentUserSelect").addEventListener("change", (e) => {
    state.currentUserId = e.target.value;
    localStorage.setItem("hri_current_user_id", state.currentUserId);
  });

  document.getElementById("refreshStatusBtn").addEventListener("click", refreshStatuses);

  ["searchInput", "managerFilter", "statusFilter", "regionFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("input", render);
    document.getElementById(id).addEventListener("change", render);
  });

  document.getElementById("resetFilterBtn").addEventListener("click", () => {
    document.getElementById("searchInput").value = "";
    document.getElementById("managerFilter").value = "";
    document.getElementById("statusFilter").value = "";
    document.getElementById("regionFilter").value = "";
    render();
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
  });

  document.querySelectorAll(".view-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentView = btn.dataset.view;
      document.querySelectorAll(".view-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderViews();
    });
  });
}

// ---------------------------------------------------------
// Load Data
// ---------------------------------------------------------
async function loadAll() {
  try {
    setSyncStatus("데이터 불러오는 중...");

    const [
      membersRes,
      coursesRes,
      roundsRes,
      checklistItemsRes,
      checklistStatusesRes,
      logsRes
    ] = await Promise.all([
      db.from("members").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
      db.from("courses").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      db.from("rounds").select("*").eq("is_active", true).order("round_no", { ascending: true }),
      db.from("checklist_items").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
      db.from("checklist_statuses").select("*"),
      db.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(30),
    ]);

    throwIfError(membersRes);
    throwIfError(coursesRes);
    throwIfError(roundsRes);
    throwIfError(checklistItemsRes);
    throwIfError(checklistStatusesRes);
    throwIfError(logsRes);

    state.members = membersRes.data || [];
    state.courses = coursesRes.data || [];
    state.rounds = roundsRes.data || [];
    state.checklistItems = checklistItemsRes.data || [];
    state.checklistStatuses = checklistStatusesRes.data || [];
    state.logs = logsRes.data || [];

    fillMemberSelects();

    const savedUserId = localStorage.getItem("hri_current_user_id") || "";
    state.currentUserId = savedUserId;
    document.getElementById("currentUserSelect").value = savedUserId;

    render();
    setSyncStatus(`동기화 완료 · ${formatNow()}`);
  } catch (error) {
    console.error(error);
    setSyncStatus("오류 발생");
    alert("데이터를 불러오는 중 오류가 발생했습니다.\n\n" + error.message);
  }
}

function throwIfError(response) {
  if (response.error) throw response.error;
}

// ---------------------------------------------------------
// Static Selects
// ---------------------------------------------------------
function fillStaticSelects() {
  fillStatusOptions(document.getElementById("statusFilter"), true);
  fillStatusOptions(document.getElementById("courseStatus"), false);
  fillStatusOptions(document.getElementById("roundStatus"), false);

  fillRegionOptions(document.getElementById("regionFilter"), true);
  fillRegionOptions(document.getElementById("region"), false);
}

function fillStatusOptions(select, includeAll) {
  select.innerHTML = includeAll ? `<option value="">상태 전체</option>` : "";
  STATUS_ORDER.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = STATUS_LABELS[key];
    select.appendChild(option);
  });
}

function fillRegionOptions(select, includeAll) {
  select.innerHTML = includeAll ? `<option value="">연수지역 전체</option>` : "";
  REGIONS.forEach((region) => {
    const option = document.createElement("option");
    option.value = region;
    option.textContent = region;
    select.appendChild(option);
  });
}

function fillMemberSelects() {
  const selectors = [
    "currentUserSelect",
    "managerFilter",
    "mainManager",
    "subManager1",
    "subManager2",
    "subManager3",
  ];

  selectors.forEach((id) => {
    const select = document.getElementById(id);
    const label =
      id === "currentUserSelect" ? "현재 사용자 선택" :
      id === "managerFilter" ? "담당자 전체" :
      "선택 안 함";

    select.innerHTML = `<option value="">${label}</option>`;

    state.members.forEach((member) => {
      const option = document.createElement("option");
      option.value = member.id;
      option.textContent = `${member.name}${member.position ? " / " + member.position : ""}`;
      select.appendChild(option);
    });
  });
}

// ---------------------------------------------------------
// Render
// ---------------------------------------------------------
function render() {
  renderStats();
  renderViews();
}

function renderStats() {
  const courses = getFilteredCourses();
  const rounds = state.rounds.filter((r) => courses.some((c) => c.id === r.course_id));

  const runningCourses = courses.filter((c) => ["ready", "running"].includes(c.status)).length;

  const activeMembers = state.members.length || 1;
  const managerAssignments = courses.reduce((sum, c) => {
    return sum + [
      c.main_manager_id,
      c.sub_manager1_id,
      c.sub_manager2_id,
      c.sub_manager3_id
    ].filter(Boolean).length;
  }, 0);

  document.getElementById("statTotalCourses").textContent = courses.length;
  document.getElementById("statRunningCourses").textContent = runningCourses;
  document.getElementById("statTotalRounds").textContent = rounds.length;
  document.getElementById("statAvgWorkload").textContent = (managerAssignments / activeMembers).toFixed(1);
}

function renderViews() {
  const views = ["timeline", "kanban", "rr", "logs"];
  views.forEach((view) => {
    document.getElementById(`${view}View`).classList.toggle("hidden", state.currentView !== view);
  });

  if (state.currentView === "timeline") renderTimeline();
  if (state.currentView === "kanban") renderKanban();
  if (state.currentView === "rr") renderRR();
  if (state.currentView === "logs") renderLogs();
}

function getFilteredCourses() {
  const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
  const managerId = document.getElementById("managerFilter").value;
  const status = document.getElementById("statusFilter").value;
  const region = document.getElementById("regionFilter").value;

  return state.courses.filter((course) => {
    const text = [
      course.course_name,
      course.client_name,
      course.location_detail,
      course.region
    ].join(" ").toLowerCase();

    const matchedKeyword = !keyword || text.includes(keyword);
    const matchedStatus = !status || course.status === status;
    const matchedRegion = !region || course.region === region;

    const managerIds = [
      course.main_manager_id,
      course.sub_manager1_id,
      course.sub_manager2_id,
      course.sub_manager3_id
    ].filter(Boolean);

    const matchedManager = !managerId || managerIds.includes(managerId);

    return matchedKeyword && matchedStatus && matchedRegion && matchedManager;
  });
}

function renderTimeline() {
  const container = document.getElementById("timelineView");
  const courses = getFilteredCourses();

  if (!courses.length) {
    container.innerHTML = emptyBox("표시할 과정이 없습니다.");
    return;
  }

  let html = `
    <div class="bg-white rounded-xl shadow p-4 overflow-x-auto">
      <div class="timeline-grid mb-3">
        <div></div>
        ${Array.from({ length: 12 }, (_, i) => `<div class="timeline-month">${i + 1}월</div>`).join("")}
      </div>
      <div class="space-y-3 min-w-[900px]">
  `;

  courses.forEach((course) => {
    const start = course.start_month || 1;
    const end = course.end_month || start;

    html += `<div class="timeline-grid course-row cursor-pointer" onclick="openDetailModal('${course.id}')">`;
    html += `
      <div class="timeline-name">
        ${escapeHtml(course.course_name)}
        <div class="small-muted">${escapeHtml(course.client_name || "")}</div>
      </div>
    `;

    for (let month = 1; month <= 12; month++) {
      const active = month >= start && month <= end;
      html += `<div class="timeline-cell ${active ? "active" : ""}"></div>`;
    }

    html += `</div>`;
  });

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderKanban() {
  const container = document.getElementById("kanbanView");
  const courses = getFilteredCourses();

  let html = `<div class="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">`;

  STATUS_ORDER.forEach((status) => {
    const list = courses.filter((c) => c.status === status);

    html += `
      <div class="kanban-column">
        <div class="flex justify-between items-center mb-3">
          <h3 class="font-extrabold text-slate-700">${STATUS_LABELS[status]}</h3>
          <span class="text-xs bg-white rounded-full px-2 py-1">${list.length}</span>
        </div>
        <div class="space-y-3">
          ${list.map(renderCourseMiniCard).join("") || `<div class="small-muted">해당 과정 없음</div>`}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderCourseMiniCard(course) {
  const manager = getMemberName(course.main_manager_id);
  const roundCount = state.rounds.filter((r) => r.course_id === course.id).length;

  return `
    <div class="course-card cursor-pointer" onclick="openDetailModal('${course.id}')">
      <div class="flex justify-between gap-2 mb-2">
        <h4 class="font-extrabold text-sm">${escapeHtml(course.course_name)}</h4>
        ${statusBadge(course.status)}
      </div>
      <div class="small-muted">${escapeHtml(course.client_name || "-")}</div>
      <div class="small-muted mt-1">정담당: ${escapeHtml(manager || "-")}</div>
      <div class="small-muted mt-1">차수: ${roundCount}개 · ${escapeHtml(course.region || "미정")}</div>
    </div>
  `;
}

function renderRR() {
  const container = document.getElementById("rrView");
  const courses = getFilteredCourses();

  let html = `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">`;

  state.members.forEach((member) => {
    const assigned = courses.filter((c) => {
      return [
        c.main_manager_id,
        c.sub_manager1_id,
        c.sub_manager2_id,
        c.sub_manager3_id
      ].includes(member.id);
    });

    html += `
      <div class="bg-white rounded-xl shadow p-4">
        <div class="flex justify-between items-center mb-3">
          <div>
            <h3 class="font-extrabold text-[#0f2742]">${escapeHtml(member.name)}</h3>
            <p class="small-muted">${escapeHtml(member.position || "")}</p>
          </div>
          <div class="text-2xl font-black text-[#0f2742]">${assigned.length}</div>
        </div>

        <div class="space-y-2">
          ${assigned.map((course) => `
            <div class="border rounded-lg p-3 cursor-pointer hover:bg-slate-50" onclick="openDetailModal('${course.id}')">
              <div class="font-bold text-sm">${escapeHtml(course.course_name)}</div>
              <div class="small-muted">${escapeHtml(getRoleLabel(course, member.id))} · ${STATUS_LABELS[course.status]}</div>
            </div>
          `).join("") || `<div class="small-muted">배정된 과정 없음</div>`}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderLogs() {
  const container = document.getElementById("logsView");

  if (!state.logs.length) {
    container.innerHTML = emptyBox("최근 이력이 없습니다.");
    return;
  }

  container.innerHTML = `
    <div class="bg-white rounded-xl shadow p-4">
      <h3 class="section-title">최근 수정이력 30개</h3>
      <div class="space-y-2">
        ${state.logs.map((log) => `
          <div class="border rounded-lg p-3">
            <div class="flex flex-wrap justify-between gap-2">
              <div class="font-bold">${escapeHtml(log.target_type)} · ${escapeHtml(log.action_type)}</div>
              <div class="small-muted">${formatDateTime(log.created_at)}</div>
            </div>
            <div class="small-muted mt-1">${escapeHtml(log.change_summary || "")}</div>
            <div class="small-muted mt-1">수정자: ${escapeHtml(getMemberName(log.changed_by) || "-")}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------
// Course Modal
// ---------------------------------------------------------
function openCourseModal(course = null) {
  document.getElementById("courseForm").reset();

  const isEdit = !!course;
  document.getElementById("courseModalTitle").textContent = isEdit ? "프로젝트 수정" : "신규 프로젝트 등록";
  document.getElementById("hideCourseBtn").classList.toggle("hidden", !isEdit);

  document.getElementById("courseId").value = course?.id || "";
  document.getElementById("courseName").value = course?.course_name || "";
  document.getElementById("clientName").value = course?.client_name || "";
  document.getElementById("targetAudience").value = course?.target_audience || "";
  document.getElementById("startMonth").value = course?.start_month || "";
  document.getElementById("endMonth").value = course?.end_month || "";
  document.getElementById("region").value = course?.region || "미정";
  document.getElementById("locationDetail").value = course?.location_detail || "";
  document.getElementById("mainManager").value = course?.main_manager_id || "";
  document.getElementById("subManager1").value = course?.sub_manager1_id || "";
  document.getElementById("subManager2").value = course?.sub_manager2_id || "";
  document.getElementById("subManager3").value = course?.sub_manager3_id || "";
  document.getElementById("courseStatus").value = course?.status || "planning";
  document.getElementById("expectedBudget").value = course?.expected_budget || "";
  document.getElementById("courseNotes").value = course?.notes || "";

  openModal("courseModal");
}

async function saveCourse(event) {
  event.preventDefault();

  try {
    const id = document.getElementById("courseId").value;
    const payload = {
      course_name: document.getElementById("courseName").value.trim(),
      client_name: document.getElementById("clientName").value.trim() || null,
      target_audience: document.getElementById("targetAudience").value.trim() || null,
      start_month: toNumberOrNull(document.getElementById("startMonth").value),
      end_month: toNumberOrNull(document.getElementById("endMonth").value),
      region: document.getElementById("region").value || "미정",
      location_detail: document.getElementById("locationDetail").value.trim() || null,
      main_manager_id: nullIfEmpty(document.getElementById("mainManager").value),
      sub_manager1_id: nullIfEmpty(document.getElementById("subManager1").value),
      sub_manager2_id: nullIfEmpty(document.getElementById("subManager2").value),
      sub_manager3_id: nullIfEmpty(document.getElementById("subManager3").value),
      status: document.getElementById("courseStatus").value,
      expected_budget: toNumberOrNull(document.getElementById("expectedBudget").value),
      notes: document.getElementById("courseNotes").value.trim() || null,
      updated_by: nullIfEmpty(state.currentUserId),
    };

    let response;
    let actionType;

    if (id) {
      response = await db.from("courses").update(payload).eq("id", id).select().single();
      actionType = "수정";
    } else {
      response = await db.from("courses").insert(payload).select().single();
      actionType = "신규등록";
    }

    throwIfError(response);

    await insertLog({
      target_type: "과정",
      course_id: response.data.id,
      action_type: actionType,
      change_summary: `${payload.course_name} ${actionType}`,
    });

    closeModal("courseModal");
    await loadAll();
  } catch (error) {
    console.error(error);
    alert("과정 저장 중 오류가 발생했습니다.\n\n" + error.message);
  }
}

async function hideCurrentCourse() {
  const id = document.getElementById("courseId").value;
  if (!id) return;

  if (!confirm("이 과정은 DB에 남고 화면에서만 숨김 처리됩니다. 진행할까요?")) return;

  try {
    const course = getCourseById(id);

    const response = await db
      .from("courses")
      .update({
        is_active: false,
        updated_by: nullIfEmpty(state.currentUserId),
      })
      .eq("id", id);

    throwIfError(response);

    await insertLog({
      target_type: "과정",
      course_id: id,
      action_type: "숨김처리",
      change_summary: `${course?.course_name || "과정"} 숨김 처리`,
    });

    closeModal("courseModal");
    await loadAll();
  } catch (error) {
    alert("숨김 처리 중 오류가 발생했습니다.\n\n" + error.message);
  }
}

// ---------------------------------------------------------
// Detail Modal
// ---------------------------------------------------------
window.openDetailModal = async function(courseId) {
  state.selectedCourseId = courseId;

  const course = getCourseById(courseId);
  if (!course) return;

  document.getElementById("detailTitle").textContent = course.course_name;
  document.getElementById("detailSubtitle").textContent =
    `${course.client_name || "-"} · ${course.region || "미정"} · 정담당 ${getMemberName(course.main_manager_id) || "-"}`;

  renderRoundList(courseId);
  await ensureChecklistStatuses(courseId);
  renderChecklist(courseId);

  openModal("detailModal");
};

function renderRoundList(courseId) {
  const container = document.getElementById("roundList");
  const rounds = state.rounds
    .filter((r) => r.course_id === courseId)
    .sort((a, b) => a.round_no - b.round_no);

  if (!rounds.length) {
    container.innerHTML = emptyBox("등록된 차수가 없습니다.");
    return;
  }

  container.innerHTML = rounds.map((round) => `
    <div class="round-card">
      <div class="flex flex-wrap justify-between gap-2 mb-2">
        <div>
          <div class="font-extrabold">${round.round_no}차 ${escapeHtml(round.round_name || "")}</div>
          <div class="small-muted">${escapeHtml(round.date_label || makeDateLabel(round.start_date_ymd, round.end_date_ymd) || "-")}</div>
        </div>
        <div>${statusBadge(round.status)}</div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-1 small-muted">
        <div>운영장소: ${escapeHtml(round.venue || "-")}</div>
        <div>비고: ${escapeHtml(round.remarks || "-")}</div>
        <div>운영시간: ${round.operation_hours ?? "-"}</div>
        <div>만족도/인원: ${round.satisfaction ?? "-"} / ${round.participant_count ?? "-"}</div>
      </div>

      ${round.round_memo ? `<div class="mt-2 text-sm bg-slate-50 rounded p-2">${escapeHtml(round.round_memo)}</div>` : ""}

      <div class="mt-3">
        <button class="btn-secondary" onclick="openRoundModalById('${round.id}')">차수 수정</button>
      </div>
    </div>
  `).join("");
}

async function ensureChecklistStatuses(courseId) {
  const existingItemIds = state.checklistStatuses
    .filter((s) => s.course_id === courseId)
    .map((s) => s.checklist_item_id);

  const missing = state.checklistItems.filter((item) => !existingItemIds.includes(item.id));

  if (!missing.length) return;

  const rows = missing.map((item) => ({
    course_id: courseId,
    checklist_item_id: item.id,
    is_done: false,
    updated_by: nullIfEmpty(state.currentUserId),
  }));

  const response = await db.from("checklist_statuses").insert(rows).select();
  throwIfError(response);

  state.checklistStatuses = [...state.checklistStatuses, ...(response.data || [])];
}

function renderChecklist(courseId) {
  const container = document.getElementById("checklistArea");

  const rows = state.checklistItems.map((item) => {
    const status = state.checklistStatuses.find(
      (s) => s.course_id === courseId && s.checklist_item_id === item.id
    );

    return {
      item,
      status,
    };
  });

  container.innerHTML = rows.map(({ item, status }) => `
    <label class="check-item">
      <input 
        type="checkbox"
        ${status?.is_done ? "checked" : ""}
        onchange="toggleChecklist('${courseId}', '${item.id}', this.checked)"
      />
      <span class="text-sm">
        <b>${escapeHtml(item.code)}</b>
        ${escapeHtml(item.title)}
      </span>
    </label>
  `).join("");
}

window.toggleChecklist = async function(courseId, itemId, checked) {
  try {
    const existing = state.checklistStatuses.find(
      (s) => s.course_id === courseId && s.checklist_item_id === itemId
    );

    let response;

    if (existing) {
      response = await db
        .from("checklist_statuses")
        .update({
          is_done: checked,
          updated_by: nullIfEmpty(state.currentUserId),
        })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      response = await db
        .from("checklist_statuses")
        .insert({
          course_id: courseId,
          checklist_item_id: itemId,
          is_done: checked,
          updated_by: nullIfEmpty(state.currentUserId),
        })
        .select()
        .single();
    }

    throwIfError(response);

    await insertLog({
      target_type: "체크리스트",
      course_id: courseId,
      action_type: "수정",
      change_summary: `체크리스트 ${checked ? "완료" : "미완료"} 처리`,
    });

    await loadAll();
    if (state.selectedCourseId) {
      renderChecklist(state.selectedCourseId);
    }
  } catch (error) {
    alert("체크리스트 저장 중 오류가 발생했습니다.\n\n" + error.message);
  }
};

// ---------------------------------------------------------
// Round Modal
// ---------------------------------------------------------
window.openRoundModalById = function(roundId) {
  const round = state.rounds.find((r) => r.id === roundId);
  openRoundModal(round);
};

function openRoundModal(round = null) {
  document.getElementById("roundForm").reset();

  const isEdit = !!round;
  document.getElementById("roundModalTitle").textContent = isEdit ? "차수 수정" : "차수 등록";
  document.getElementById("hideRoundBtn").classList.toggle("hidden", !isEdit);

  document.getElementById("roundId").value = round?.id || "";
  document.getElementById("roundNo").value = round?.round_no || getNextRoundNo();
  document.getElementById("roundName").value = round?.round_name || "";
  document.getElementById("roundStartDate").value = round?.start_date_ymd || "";
  document.getElementById("roundEndDate").value = round?.end_date_ymd || "";
  document.getElementById("roundDateLabel").value = round?.date_label || "";
  document.getElementById("roundStatus").value = round?.status || "planning";
  document.getElementById("roundVenue").value = round?.venue || "";
  document.getElementById("roundRemarks").value = round?.remarks || "";
  document.getElementById("roundMemo").value = round?.round_memo || "";
  document.getElementById("operationHours").value = round?.operation_hours || "";
  document.getElementById("satisfaction").value = round?.satisfaction || "";
  document.getElementById("participantCount").value = round?.participant_count || "";

  toggleCompletedFields();

  openModal("roundModal");
}

function getNextRoundNo() {
  const courseRounds = state.rounds.filter((r) => r.course_id === state.selectedCourseId);
  if (!courseRounds.length) return 1;
  return Math.min(Math.max(...courseRounds.map((r) => r.round_no)) + 1, 15);
}

function toggleCompletedFields() {
  const status = document.getElementById("roundStatus").value;
  document.getElementById("completedFields").classList.toggle("hidden", status !== "completed");
}

async function saveRound(event) {
  event.preventDefault();

  if (!state.selectedCourseId) {
    alert("과정이 선택되지 않았습니다.");
    return;
  }

  const startDate = document.getElementById("roundStartDate").value.trim();
  const endDate = document.getElementById("roundEndDate").value.trim();

  if (startDate && !/^\d{6}$/.test(startDate)) {
    alert("교육시작일은 YYMMDD 6자리로 입력해주세요.");
    return;
  }

  if (endDate && !/^\d{6}$/.test(endDate)) {
    alert("교육종료일은 YYMMDD 6자리로 입력해주세요.");
    return;
  }

  try {
    const id = document.getElementById("roundId").value;
    const status = document.getElementById("roundStatus").value;

    const payload = {
      course_id: state.selectedCourseId,
      round_no: Number(document.getElementById("roundNo").value),
      round_name: document.getElementById("roundName").value.trim() || null,
      start_date_ymd: startDate || null,
      end_date_ymd: endDate || null,
      date_label: document.getElementById("roundDateLabel").value.trim() || makeDateLabel(startDate, endDate),
      status,
      venue: document.getElementById("roundVenue").value.trim() || null,
      round_memo: document.getElementById("roundMemo").value.trim() || null,
      remarks: document.getElementById("roundRemarks").value.trim() || null,
      operation_hours: status === "completed" ? toNumberOrNull(document.getElementById("operationHours").value) : null,
      satisfaction: status === "completed" ? toNumberOrNull(document.getElementById("satisfaction").value) : null,
      participant_count: status === "completed" ? toNumberOrNull(document.getElementById("participantCount").value) : null,
      updated_by: nullIfEmpty(state.currentUserId),
    };

    let response;
    let actionType;

    if (id) {
      response = await db.from("rounds").update(payload).eq("id", id).select().single();
      actionType = "수정";
    } else {
      response = await db.from("rounds").insert(payload).select().single();
      actionType = "신규등록";
    }

    throwIfError(response);

    await insertLog({
      target_type: "차수",
      course_id: state.selectedCourseId,
      round_id: response.data.id,
      action_type: actionType,
      change_summary: `${payload.round_no}차 ${actionType}`,
    });

    closeModal("roundModal");
    await loadAll();

    if (state.selectedCourseId) {
      renderRoundList(state.selectedCourseId);
    }
  } catch (error) {
    console.error(error);
    alert("차수 저장 중 오류가 발생했습니다.\n\n" + error.message);
  }
}

async function hideCurrentRound() {
  const id = document.getElementById("roundId").value;
  if (!id) return;

  if (!confirm("이 차수는 DB에 남고 화면에서만 숨김 처리됩니다. 진행할까요?")) return;

  try {
    const response = await db
      .from("rounds")
      .update({
        is_active: false,
        updated_by: nullIfEmpty(state.currentUserId),
      })
      .eq("id", id);

    throwIfError(response);

    await insertLog({
      target_type: "차수",
      course_id: state.selectedCourseId,
      round_id: id,
      action_type: "숨김처리",
      change_summary: "차수 숨김 처리",
    });

    closeModal("roundModal");
    await loadAll();

    if (state.selectedCourseId) {
      renderRoundList(state.selectedCourseId);
    }
  } catch (error) {
    alert("차수 숨김 처리 중 오류가 발생했습니다.\n\n" + error.message);
  }
}

// ---------------------------------------------------------
// Status Refresh
// ---------------------------------------------------------
async function refreshStatuses() {
  try {
    setSyncStatus("상태 갱신 중...");

    const response = await db.rpc("refresh_round_and_course_statuses");
    throwIfError(response);

    await insertLog({
      target_type: "설정",
      action_type: "상태갱신",
      change_summary: "오늘 날짜 기준 차수/과정 상태 갱신",
    });

    await loadAll();
    alert("상태 갱신이 완료되었습니다.");
  } catch (error) {
    console.error(error);
    alert("상태 갱신 중 오류가 발생했습니다.\n\n" + error.message);
  }
}

// ---------------------------------------------------------
// Activity Log
// ---------------------------------------------------------
async function insertLog({ target_type, course_id = null, round_id = null, action_type, change_summary }) {
  const response = await db.from("activity_logs").insert({
    target_type,
    course_id,
    round_id,
    action_type,
    change_summary,
    changed_by: nullIfEmpty(state.currentUserId),
  });

  if (response.error) {
    console.warn("이력 저장 실패:", response.error.message);
  }
}

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------
function getCourseById(id) {
  return state.courses.find((c) => c.id === id);
}

function getMemberName(id) {
  if (!id) return "";
  const member = state.members.find((m) => m.id === id);
  if (!member) return "";
  return `${member.name}${member.position ? " / " + member.position : ""}`;
}

function getRoleLabel(course, memberId) {
  if (course.main_manager_id === memberId) return "정담당자";
  if (course.sub_manager1_id === memberId) return "부담당자1";
  if (course.sub_manager2_id === memberId) return "부담당자2";
  if (course.sub_manager3_id === memberId) return "부담당자3";
  return "담당자";
}

function statusBadge(status) {
  return `<span class="status-badge status-${status}">${STATUS_LABELS[status] || status}</span>`;
}

function emptyBox(message) {
  return `
    <div class="bg-white rounded-xl shadow p-10 text-center text-slate-500">
      ${escapeHtml(message)}
    </div>
  `;
}

function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

function setSyncStatus(text) {
  document.getElementById("syncStatus").textContent = text;
}

function formatNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleString("ko-KR");
}

function nullIfEmpty(value) {
  return value ? value : null;
}

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function makeDateLabel(start, end) {
  if (!start && !end) return "";
  if (start && !end) return yymmddToShort(start);
  if (!start && end) return yymmddToShort(end);
  if (start === end) return yymmddToShort(start);
  return `${yymmddToShort(start)}~${yymmddToShort(end)}`;
}

function yymmddToShort(value) {
  if (!value || !/^\d{6}$/.test(value)) return "";
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  return `${month}/${day}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
