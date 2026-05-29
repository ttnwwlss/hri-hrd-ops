// =========================================================
// HRI HRD사업팀 과정운영 관리 앱
// 최종 통합본
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
  selectedRoundId: "",
};

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  fillStaticSelects();
  await loadAll();
});

// ---------------------------------------------------------
// 이벤트 연결
// ---------------------------------------------------------
function bindEvents() {
  document.getElementById("openCourseModalBtn").addEventListener("click", () => openCourseModal());

  document.getElementById("courseForm").addEventListener("submit", saveCourse);
  document.getElementById("roundForm").addEventListener("submit", saveRound);
  document.getElementById("completeForm").addEventListener("submit", submitCompleteRound);

  document.getElementById("hideCourseBtn").addEventListener("click", hideCurrentCourse);
  document.getElementById("hideRoundBtn").addEventListener("click", hideCurrentRound);
  document.getElementById("completeRoundBtn").addEventListener("click", () => {
    const roundId = document.getElementById("roundId").value;
    openCompleteModal(roundId);
  });

  document.getElementById("quickAddRoundBtn").addEventListener("click", quickAddRound);
  document.getElementById("roundStatus").addEventListener("change", toggleCompletedFields);

  document.getElementById("openMemberModalBtn").addEventListener("click", () => {
    renderMemberList();
    openModal("memberModal");
  });
  document.getElementById("addMemberBtn").addEventListener("click", addMember);

  document.getElementById("updateDataBtn").addEventListener("click", updateData);
  document.getElementById("downloadExcelBtn").addEventListener("click", downloadExcel);

  document.getElementById("currentUserSelect").addEventListener("change", (e) => {
    state.currentUserId = e.target.value;
    localStorage.setItem("hri_current_user_id", state.currentUserId);
  });

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
// 데이터 로드
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
// 셀렉트박스
// ---------------------------------------------------------
function fillStaticSelects() {
  fillStatusOptions(document.getElementById("statusFilter"), true);
  fillStatusOptions(document.getElementById("courseStatus"), false);
  fillStatusOptions(document.getElementById("roundStatus"), false);
  fillStatusOptions(document.getElementById("quickRoundStatus"), false);

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
      "없음";

    select.innerHTML = `<option value="">${label}</option>`;

    state.members.forEach((member) => {
      const option = document.createElement("option");
      option.value = member.id;
      option.textContent = `${member.name}${member.position ? " (" + member.position + ")" : ""}`;
      select.appendChild(option);
    });
  });
}

// ---------------------------------------------------------
// 렌더링
// ---------------------------------------------------------
function render() {
  renderStats();
  renderViews();
}

function renderStats() {
  const courses = getFilteredCourses();
  const rounds = state.rounds.filter((r) => courses.some((c) => c.id === r.course_id));

  const runningCourses = courses.filter((c) => ["ready", "running"].includes(c.status)).length;
  const completedRounds = rounds.filter((r) => r.status === "completed");

  const totalParticipants = completedRounds.reduce((sum, r) => sum + (Number(r.participant_count) || 0), 0);

  const satisfactionRows = completedRounds.filter((r) => r.satisfaction !== null && r.satisfaction !== undefined);
  const avgSatisfaction = satisfactionRows.length
    ? satisfactionRows.reduce((sum, r) => sum + Number(r.satisfaction), 0) / satisfactionRows.length
    : null;

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
  document.getElementById("statTotalParticipants").textContent = totalParticipants;
  document.getElementById("statAvgSatisfaction").textContent = avgSatisfaction === null ? "-" : avgSatisfaction.toFixed(2);
  document.getElementById("statAvgWorkload").textContent = (managerAssignments / activeMembers).toFixed(1);
}

function renderViews() {
  ["timeline", "kanban", "rr", "logs"].forEach((view) => {
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
    <div class="timeline-wrapper">
      <div class="timeline-grid mb-3">
        <div></div>
        ${Array.from({ length: 12 }, (_, i) => `<div class="timeline-month">${i + 1}월</div>`).join("")}
      </div>
      <div class="space-y-3">
  `;

  courses.forEach((course) => {
    const start = getCourseStartMonth(course) || 1;
    const end = getCourseEndMonth(course) || start;

    html += `<div class="timeline-grid cursor-pointer" onclick="openCourseModalById('${course.id}')">`;
    html += `
      <div class="timeline-name">
        ${escapeHtml(course.course_name)}
        <div class="small-muted">${escapeHtml(course.client_name || "")} · ${statusText(course.status)}</div>
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
          <h3 class="font-black text-slate-700">${STATUS_LABELS[status]}</h3>
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
  const roundCount = state.rounds.filter((r) => r.course_id === course.id).length;

  return `
    <div class="course-card cursor-pointer" onclick="openCourseModalById('${course.id}')">
      <div class="flex justify-between gap-2 mb-2">
        <h4 class="font-black text-sm">${escapeHtml(course.course_name)}</h4>
        ${statusBadge(course.status)}
      </div>
      <div class="small-muted">${escapeHtml(course.client_name || "-")}</div>
      <div class="small-muted mt-1">정담당: ${escapeHtml(getMemberName(course.main_manager_id) || "-")}</div>
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
      <div class="course-card">
        <div class="flex justify-between items-center mb-3">
          <div>
            <h3 class="font-black text-[#0f2742]">${escapeHtml(member.name)}</h3>
            <p class="small-muted">${escapeHtml(member.position || "")}</p>
          </div>
          <div class="text-2xl font-black text-[#0f2742]">${assigned.length}</div>
        </div>

        <div class="space-y-2">
          ${assigned.map((course) => `
            <div class="border rounded-lg p-3 cursor-pointer hover:bg-slate-50" onclick="openCourseModalById('${course.id}')">
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
    <div class="course-card">
      <h3 class="font-black text-[#0f2742] mb-4">최근 수정이력 30개</h3>
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
// 과정 등록/수정
// ---------------------------------------------------------
window.openCourseModalById = async function(courseId) {
  const course = getCourseById(courseId);
  openCourseModal(course);
};

async function openCourseModal(course = null) {
  document.getElementById("courseForm").reset();

  const isEdit = !!course;
  state.selectedCourseId = course?.id || "";

  document.getElementById("courseModalTitle").innerHTML = isEdit
    ? `<i class="fa-solid fa-pen-to-square text-amber-400 mr-2"></i>[수정] ${escapeHtml(course.course_name)}`
    : `<i class="fa-solid fa-pen-to-square text-amber-400 mr-2"></i>신규 프로젝트 등록`;

  document.getElementById("hideCourseBtn").classList.toggle("hidden", !isEdit);
  document.getElementById("courseInnerManageArea").classList.toggle("hidden", !isEdit);
  document.getElementById("courseChecklistSection").classList.toggle("hidden", !isEdit);

  document.getElementById("courseId").value = course?.id || "";
  document.getElementById("courseName").value = course?.course_name || "";
  document.getElementById("clientName").value = course?.client_name || "";
  document.getElementById("targetAudience").value = course?.target_audience || "";
  document.getElementById("startDateYmd").value = course?.start_date_ymd || "";
  document.getElementById("endDateYmd").value = course?.end_date_ymd || "";
  document.getElementById("region").value = course?.region || "미정";
  document.getElementById("locationDetail").value = course?.location_detail || "";
  document.getElementById("mainManager").value = course?.main_manager_id || "";
  document.getElementById("subManager1").value = course?.sub_manager1_id || "";
  document.getElementById("subManager2").value = course?.sub_manager2_id || "";
  document.getElementById("subManager3").value = course?.sub_manager3_id || "";
  document.getElementById("courseStatus").value = course?.status || "planning";
  document.getElementById("expectedBudget").value = course?.expected_budget || "";
  document.getElementById("courseNotes").value = course?.notes || "";

  if (isEdit) {
    document.getElementById("quickRoundNo").value = getNextRoundNo(course.id);
    document.getElementById("quickRoundStatus").value = "planning";
    renderCourseModalRounds(course.id);
    await ensureChecklistStatuses(course.id, null, "course");
    renderChecklist(course.id, null, "courseChecklistArea", "course");
  }

  openModal("courseModal");
}

async function saveCourse(event) {
  event.preventDefault();

  const courseStartDate = document.getElementById("startDateYmd").value.trim();
  const courseEndDate = document.getElementById("endDateYmd").value.trim();

  if (courseStartDate && !/^\d{6}$/.test(courseStartDate)) {
    alert("과정 시작일은 YYMMDD 6자리로 입력해주세요.\n예: 260704");
    return;
  }

  if (courseEndDate && !/^\d{6}$/.test(courseEndDate)) {
    alert("과정 종료일은 YYMMDD 6자리로 입력해주세요.\n예: 260705");
    return;
  }

  try {
    const id = document.getElementById("courseId").value;

    const payload = {
      course_name: document.getElementById("courseName").value.trim(),
      client_name: document.getElementById("clientName").value.trim() || null,
      target_audience: document.getElementById("targetAudience").value.trim() || null,
      start_date_ymd: courseStartDate || null,
      end_date_ymd: courseEndDate || null,
      start_month: getMonthFromYmd(courseStartDate),
      end_month: getMonthFromYmd(courseEndDate),
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

    await loadAll();

    if (!id) {
      alert("과정이 등록되었습니다. 다시 과정을 열면 차수와 체크리스트를 관리할 수 있습니다.");
      closeModal("courseModal");
    } else {
      state.selectedCourseId = id;
      renderCourseModalRounds(id);
      await ensureChecklistStatuses(id, null, "course");
      renderChecklist(id, null, "courseChecklistArea", "course");
      alert("과정 정보가 저장되었습니다.");
    }
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
// 차수 관리
// ---------------------------------------------------------
function renderCourseModalRounds(courseId) {
  const container = document.getElementById("courseModalRoundList");
  const rounds = state.rounds
    .filter((r) => r.course_id === courseId)
    .sort((a, b) => a.round_no - b.round_no);

  if (!rounds.length) {
    container.innerHTML = emptyBox("등록된 차수가 없습니다.");
    return;
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="round-table">
        <thead>
          <tr>
            <th>차수</th>
            <th>세부 과정명</th>
            <th>일정</th>
            <th>상태</th>
            <th>실적</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          ${rounds.map((round) => `
            <tr>
              <td class="font-bold">${round.round_no}차</td>
              <td>${escapeHtml(round.round_name || "-")}</td>
              <td>${escapeHtml(round.date_label || makeDateLabel(round.start_date_ymd, round.end_date_ymd) || "-")}</td>
              <td>${statusBadge(round.status)}</td>
              <td>
                <span class="small-muted">
                  인원 ${round.participant_count ?? "-"} / 만족도 ${round.satisfaction ?? "-"}
                </span>
              </td>
              <td>
                <div class="flex gap-1 flex-wrap">
                  <button type="button" class="btn-secondary" onclick="openRoundModalById('${round.id}')">수정</button>
                  <button type="button" class="btn-success" onclick="openCompleteModal('${round.id}')">교육 완료</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function quickAddRound() {
  const courseId = state.selectedCourseId;
  if (!courseId) {
    alert("먼저 과정을 저장해주세요.");
    return;
  }

  const start = document.getElementById("quickRoundStart").value.trim();
  const end = document.getElementById("quickRoundEnd").value.trim();

  if (start && !/^\d{6}$/.test(start)) {
    alert("차수 시작일은 YYMMDD 6자리로 입력해주세요.");
    return;
  }

  if (end && !/^\d{6}$/.test(end)) {
    alert("차수 종료일은 YYMMDD 6자리로 입력해주세요.");
    return;
  }

  try {
    const payload = {
      course_id: courseId,
      round_no: Number(document.getElementById("quickRoundNo").value || getNextRoundNo(courseId)),
      round_name: document.getElementById("quickRoundName").value.trim() || null,
      start_date_ymd: start || null,
      end_date_ymd: end || null,
      date_label: makeDateLabel(start, end),
      status: document.getElementById("quickRoundStatus").value || "planning",
      updated_by: nullIfEmpty(state.currentUserId),
    };

    const response = await db.from("rounds").insert(payload).select().single();
    throwIfError(response);

    await insertLog({
      target_type: "차수",
      course_id: courseId,
      round_id: response.data.id,
      action_type: "신규등록",
      change_summary: `${payload.round_no}차 신규 등록`,
    });

    document.getElementById("quickRoundName").value = "";
    document.getElementById("quickRoundStart").value = "";
    document.getElementById("quickRoundEnd").value = "";

    await loadAll();
    state.selectedCourseId = courseId;
    document.getElementById("quickRoundNo").value = getNextRoundNo(courseId);
    renderCourseModalRounds(courseId);
  } catch (error) {
    alert("차수 추가 중 오류가 발생했습니다.\n\n" + error.message);
  }
}

window.openRoundModalById = async function(roundId) {
  const round = state.rounds.find((r) => r.id === roundId);
  if (!round) return;

  state.selectedRoundId = roundId;
  state.selectedCourseId = round.course_id;

  document.getElementById("roundForm").reset();
  document.getElementById("roundModalTitle").textContent = `${round.round_no}차 수정`;

  document.getElementById("roundId").value = round.id;
  document.getElementById("roundNo").value = round.round_no || "";
  document.getElementById("roundName").value = round.round_name || "";
  document.getElementById("roundStartDate").value = round.start_date_ymd || "";
  document.getElementById("roundEndDate").value = round.end_date_ymd || "";
  document.getElementById("roundDateLabel").value = round.date_label || "";
  document.getElementById("roundStatus").value = round.status || "planning";
  document.getElementById("roundVenue").value = round.venue || "";
  document.getElementById("roundRemarks").value = round.remarks || "";
  document.getElementById("roundMemo").value = round.round_memo || "";
  document.getElementById("operationHours").value = round.operation_hours || "";
  document.getElementById("satisfaction").value = round.satisfaction || "";
  document.getElementById("participantCount").value = round.participant_count || "";

  document.getElementById("hideRoundBtn").classList.remove("hidden");
  toggleCompletedFields();

  await ensureChecklistStatuses(round.course_id, round.id, "round");
  renderChecklist(round.course_id, round.id, "roundChecklistArea", "round");

  openModal("roundModal");
};

function toggleCompletedFields() {
  const status = document.getElementById("roundStatus").value;
  document.getElementById("completedFields").classList.toggle("hidden", status !== "completed");
}

async function saveRound(event) {
  event.preventDefault();

  const id = document.getElementById("roundId").value;
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
    const status = document.getElementById("roundStatus").value;

    const payload = {
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
      completed_at: status === "completed" ? new Date().toISOString() : null,
      updated_by: nullIfEmpty(state.currentUserId),
    };

    const response = await db.from("rounds").update(payload).eq("id", id).select().single();
    throwIfError(response);

    await insertLog({
      target_type: "차수",
      course_id: response.data.course_id,
      round_id: id,
      action_type: "수정",
      change_summary: `${payload.round_no}차 수정`,
    });

    await loadAll();

    state.selectedCourseId = response.data.course_id;
    renderCourseModalRounds(response.data.course_id);
    closeModal("roundModal");
  } catch (error) {
    alert("차수 저장 중 오류가 발생했습니다.\n\n" + error.message);
  }
}

async function hideCurrentRound() {
  const id = document.getElementById("roundId").value;
  if (!id) return;

  if (!confirm("이 차수는 DB에 남고 화면에서만 숨김 처리됩니다. 진행할까요?")) return;

  try {
    const round = state.rounds.find((r) => r.id === id);
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
      course_id: round?.course_id || null,
      round_id: id,
      action_type: "숨김처리",
      change_summary: "차수 숨김 처리",
    });

    await loadAll();

    if (round?.course_id) {
      state.selectedCourseId = round.course_id;
      renderCourseModalRounds(round.course_id);
    }

    closeModal("roundModal");
  } catch (error) {
    alert("차수 숨김 처리 중 오류가 발생했습니다.\n\n" + error.message);
  }
}

// ---------------------------------------------------------
// 교육 완료 처리
// ---------------------------------------------------------
window.openCompleteModal = function(roundId) {
  const round = state.rounds.find((r) => r.id === roundId);
  if (!round) return;

  document.getElementById("completeForm").reset();
  document.getElementById("completeRoundId").value = round.id;
  document.getElementById("completeRoundInfo").textContent =
    `${round.round_no}차 · ${round.round_name || ""} · ${round.date_label || makeDateLabel(round.start_date_ymd, round.end_date_ymd) || ""}`;

  document.getElementById("completeParticipantCount").value = round.participant_count || "";
  document.getElementById("completeSatisfaction").value = round.satisfaction || "";
  document.getElementById("completeOperationHours").value = round.operation_hours || "";
  document.getElementById("completeRemarks").value = round.remarks || "";

  openModal("completeModal");
};

async function submitCompleteRound(event) {
  event.preventDefault();

  const roundId = document.getElementById("completeRoundId").value;
  const round = state.rounds.find((r) => r.id === roundId);
  if (!round) return;

  try {
    const payload = {
      status: "completed",
      participant_count: toNumberOrNull(document.getElementById("completeParticipantCount").value),
      satisfaction: toNumberOrNull(document.getElementById("completeSatisfaction").value),
      operation_hours: toNumberOrNull(document.getElementById("completeOperationHours").value),
      remarks: document.getElementById("completeRemarks").value.trim() || null,
      completed_at: new Date().toISOString(),
      updated_by: nullIfEmpty(state.currentUserId),
    };

    const response = await db.from("rounds").update(payload).eq("id", roundId).select().single();
    throwIfError(response);

    await insertLog({
      target_type: "차수",
      course_id: round.course_id,
      round_id: roundId,
      action_type: "수정",
      change_summary: `${round.round_no}차 교육 완료 및 실적 입력`,
    });

    closeModal("completeModal");
    closeModal("roundModal");

    await loadAll();
    state.selectedCourseId = round.course_id;
    renderCourseModalRounds(round.course_id);

    alert("교육 완료 처리가 저장되었습니다.");
  } catch (error) {
    alert("교육 완료 처리 중 오류가 발생했습니다.\n\n" + error.message);
  }
}

// ---------------------------------------------------------
// 체크리스트
// ---------------------------------------------------------
async function ensureChecklistStatuses(courseId, roundId = null, scope = "course") {
  const usableItems = getChecklistItemsByScope(scope);

  const existingItemIds = state.checklistStatuses
    .filter((s) => s.course_id === courseId && normalizeId(s.round_id) === normalizeId(roundId))
    .map((s) => s.checklist_item_id);

  const missing = usableItems.filter((item) => !existingItemIds.includes(item.id));

  if (!missing.length) return;

  const rows = missing.map((item) => ({
    course_id: courseId,
    round_id: roundId,
    checklist_item_id: item.id,
    is_done: false,
    updated_by: nullIfEmpty(state.currentUserId),
  }));

  const response = await db.from("checklist_statuses").insert(rows).select();
  throwIfError(response);

  state.checklistStatuses = [...state.checklistStatuses, ...(response.data || [])];
}

function renderChecklist(courseId, roundId = null, containerId, scope = "course") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const items = getChecklistItemsByScope(scope);

  container.innerHTML = items.map((item) => {
    const status = state.checklistStatuses.find(
      (s) =>
        s.course_id === courseId &&
        normalizeId(s.round_id) === normalizeId(roundId) &&
        s.checklist_item_id === item.id
    );

    return `
      <label class="check-item">
        <input 
          type="checkbox"
          ${status?.is_done ? "checked" : ""}
          onchange="toggleChecklist('${courseId}', '${roundId || ""}', '${item.id}', this.checked, '${containerId}', '${scope}')"
        />
        <span>
          <b>${escapeHtml(item.code)}</b>
          ${escapeHtml(item.title)}
        </span>
      </label>
    `;
  }).join("");
}

window.toggleChecklist = async function(courseId, roundIdRaw, itemId, checked, containerId, scope) {
  const roundId = roundIdRaw || null;

  try {
    const existing = state.checklistStatuses.find(
      (s) =>
        s.course_id === courseId &&
        normalizeId(s.round_id) === normalizeId(roundId) &&
        s.checklist_item_id === itemId
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
          round_id: roundId,
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
      round_id: roundId,
      action_type: "수정",
      change_summary: `체크리스트 ${checked ? "완료" : "미완료"} 처리`,
    });

    await loadAll();
    renderChecklist(courseId, roundId, containerId, scope);
  } catch (error) {
    alert("체크리스트 저장 중 오류가 발생했습니다.\n\n" + error.message);
  }
};

function getChecklistItemsByScope(scope) {
  return state.checklistItems.filter((item) => {
    if (scope === "course") return item.scope === "course" || item.scope === "both" || !item.scope;
    if (scope === "round") return item.scope === "round" || item.scope === "both";
    return true;
  });
}

// ---------------------------------------------------------
// 담당자 관리
// ---------------------------------------------------------
function renderMemberList() {
  const container = document.getElementById("memberListArea");

  if (!state.members.length) {
    container.innerHTML = emptyBox("등록된 담당자가 없습니다.");
    return;
  }

  container.innerHTML = state.members.map((member) => `
    <div class="bg-white border rounded-xl p-3 grid grid-cols-1 md:grid-cols-7 gap-2 items-center">
      <input class="input" id="member-name-${member.id}" value="${escapeHtml(member.name || "")}" />
      <input class="input" id="member-position-${member.id}" value="${escapeHtml(member.position || "")}" />
      <input class="input" id="member-department-${member.id}" value="${escapeHtml(member.department || "")}" />
      <input class="input" id="member-email-${member.id}" value="${escapeHtml(member.email || "")}" />
      <input class="input" id="member-sort-${member.id}" type="number" value="${member.sort_order ?? 999}" />

      <button class="btn-secondary" onclick="updateMember('${member.id}')">
        수정
      </button>

      <button class="btn-danger" onclick="hideMember('${member.id}')">
        숨김
      </button>
    </div>
  `).join("");
}

async function addMember() {
  const name = document.getElementById("newMemberName").value.trim();

  if (!name) {
    alert("담당자 이름을 입력해주세요.");
    return;
  }

  try {
    const payload = {
      name,
      position: document.getElementById("newMemberPosition").value.trim() || null,
      department: document.getElementById("newMemberDepartment").value.trim() || "HRD사업팀",
      email: document.getElementById("newMemberEmail").value.trim() || null,
      sort_order: toNumberOrNull(document.getElementById("newMemberSortOrder").value) || 999,
      is_active: true,
    };

    const response = await db.from("members").insert(payload).select().single();
    throwIfError(response);

    await insertLog({
      target_type: "담당자",
      action_type: "신규등록",
      change_summary: `${payload.name} 담당자 신규 등록`,
    });

    document.getElementById("newMemberName").value = "";
    document.getElementById("newMemberPosition").value = "";
    document.getElementById("newMemberEmail").value = "";
    document.getElementById("newMemberSortOrder").value = "";

    await loadAll();
    renderMemberList();

    alert("담당자가 추가되었습니다.");
  } catch (error) {
    alert("담당자 추가 중 오류가 발생했습니다.\n\n" + error.message);
  }
}

window.updateMember = async function(memberId) {
  try {
    const payload = {
      name: document.getElementById(`member-name-${memberId}`).value.trim(),
      position: document.getElementById(`member-position-${memberId}`).value.trim() || null,
      department: document.getElementById(`member-department-${memberId}`).value.trim() || "HRD사업팀",
      email: document.getElementById(`member-email-${memberId}`).value.trim() || null,
      sort_order: toNumberOrNull(document.getElementById(`member-sort-${memberId}`).value) || 999,
    };

    if (!payload.name) {
      alert("이름은 비워둘 수 없습니다.");
      return;
    }

    const response = await db
      .from("members")
      .update(payload)
      .eq("id", memberId)
      .select()
      .single();

    throwIfError(response);

    await insertLog({
      target_type: "담당자",
      action_type: "수정",
      change_summary: `${payload.name} 담당자 정보 수정`,
    });

    await loadAll();
    renderMemberList();

    alert("담당자 정보가 수정되었습니다.");
  } catch (error) {
    alert("담당자 수정 중 오류가 발생했습니다.\n\n" + error.message);
  }
};

window.hideMember = async function(memberId) {
  const member = state.members.find((m) => m.id === memberId);

  if (!confirm(`${member?.name || "담당자"}님을 숨김 처리할까요?`)) {
    return;
  }

  try {
    const response = await db
      .from("members")
      .update({ is_active: false })
      .eq("id", memberId);

    throwIfError(response);

    await insertLog({
      target_type: "담당자",
      action_type: "숨김처리",
      change_summary: `${member?.name || "담당자"} 숨김 처리`,
    });

    await loadAll();
    renderMemberList();

    alert("담당자가 숨김 처리되었습니다.");
  } catch (error) {
    alert("담당자 숨김 처리 중 오류가 발생했습니다.\n\n" + error.message);
  }
};

// ---------------------------------------------------------
// 데이터 업데이트 / 엑셀 다운로드
// ---------------------------------------------------------
async function updateData() {
  try {
    setSyncStatus("데이터 업데이트 중...");

    const response = await db.rpc("refresh_round_and_course_statuses");
    throwIfError(response);

    await insertLog({
      target_type: "설정",
      action_type: "상태갱신",
      change_summary: "데이터 업데이트 버튼을 통한 상태 갱신 및 최신 데이터 조회",
    });

    await loadAll();

    setSyncStatus(`업데이트 완료 · ${formatNow()}`);
    alert("데이터 업데이트가 완료되었습니다.");
  } catch (error) {
    console.error(error);
    setSyncStatus("업데이트 오류");
    alert("데이터 업데이트 중 오류가 발생했습니다.\n\n" + error.message);
  }
}

function downloadExcel() {
  const courses = getFilteredCourses();

  if (!courses.length) {
    alert("다운로드할 데이터가 없습니다.");
    return;
  }

  const rows = [];

  rows.push([
    "과정명",
    "고객사",
    "교육대상",
    "과정시작일",
    "과정종료일",
    "연수지역",
    "세부장소",
    "정담당자",
    "부담당자1",
    "부담당자2",
    "부담당자3",
    "과정상태",
    "예상예산",
    "차수",
    "세부과정명",
    "교육시작일",
    "교육종료일",
    "교육일정표기",
    "차수상태",
    "운영장소",
    "운영시간",
    "전반만족도",
    "교육인원",
    "차수비고",
    "특이사항"
  ]);

  courses.forEach((course) => {
    const courseRounds = state.rounds
      .filter((round) => round.course_id === course.id)
      .sort((a, b) => a.round_no - b.round_no);

    if (!courseRounds.length) {
      rows.push([
        course.course_name,
        course.client_name,
        course.target_audience,
        course.start_date_ymd,
        course.end_date_ymd,
        course.region,
        course.location_detail,
        getMemberName(course.main_manager_id),
        getMemberName(course.sub_manager1_id),
        getMemberName(course.sub_manager2_id),
        getMemberName(course.sub_manager3_id),
        STATUS_LABELS[course.status] || course.status,
        course.expected_budget,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        course.notes
      ]);
    } else {
      courseRounds.forEach((round) => {
        rows.push([
          course.course_name,
          course.client_name,
          course.target_audience,
          course.start_date_ymd,
          course.end_date_ymd,
          course.region,
          course.location_detail,
          getMemberName(course.main_manager_id),
          getMemberName(course.sub_manager1_id),
          getMemberName(course.sub_manager2_id),
          getMemberName(course.sub_manager3_id),
          STATUS_LABELS[course.status] || course.status,
          course.expected_budget,
          round.round_no,
          round.round_name,
          round.start_date_ymd,
          round.end_date_ymd,
          round.date_label,
          STATUS_LABELS[round.status] || round.status,
          round.venue,
          round.operation_hours,
          round.satisfaction,
          round.participant_count,
          round.remarks,
          course.notes
        ]);
      });
    }
  });

  const csv = rows
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });

  const today = new Date();
  const fileName = `HRI_과정운영_데이터_${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}.csv`;

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------
// 이력
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
// Helper
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

function statusText(status) {
  return STATUS_LABELS[status] || status || "-";
}

function emptyBox(message) {
  return `
    <div class="bg-white rounded-xl border p-8 text-center text-slate-500">
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

function normalizeId(value) {
  return value || null;
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

function getMonthFromYmd(value) {
  if (!value || !/^\d{6}$/.test(value)) return null;
  const month = Number(value.slice(2, 4));
  if (month < 1 || month > 12) return null;
  return month;
}

function getCourseStartMonth(course) {
  return getMonthFromYmd(course.start_date_ymd) || course.start_month || null;
}

function getCourseEndMonth(course) {
  return getMonthFromYmd(course.end_date_ymd) || course.end_month || null;
}

function getNextRoundNo(courseId) {
  const courseRounds = state.rounds.filter((r) => r.course_id === courseId);
  if (!courseRounds.length) return 1;
  return Math.min(Math.max(...courseRounds.map((r) => r.round_no)) + 1, 15);
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).replaceAll('"', '""');
  return `"${text}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
