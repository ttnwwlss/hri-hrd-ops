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
  selectedSupportManagerIds: [],
};

// ---------------------------------------------------------
// 공통 유틸 함수
// ---------------------------------------------------------
function formatTinyDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yy}.${mm}.${dd}`;
}


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
  document.getElementById("addSupportManagerBtn").addEventListener("click", addSupportManagerTag);
  document.getElementById("addCustomChecklistBtn").addEventListener("click", addCustomChecklistItem);

  document.getElementById("updateDataBtn").addEventListener("click", updateData);
  document.getElementById("downloadExcelBtn").addEventListener("click", downloadExcel);

  document.getElementById("weeklyApplyDateBtn").addEventListener("click", applyWeeklyBaseDate);

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
  if (!select) return;
  select.innerHTML = includeAll ? `<option value="">상태 전체</option>` : "";
  STATUS_ORDER.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = STATUS_LABELS[key];
    select.appendChild(option);
  });
}

function fillRegionOptions(select, includeAll) {
  if (!select) return;
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
    "businessManager",
    "mainManager",
    "subManager1",
    "subManager2",
    "supportManagerSelect",
  ];

  selectors.forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;

    const label =
      id === "currentUserSelect" ? "현재 사용자 선택" :
      id === "managerFilter" ? "담당자 전체" :
      id === "businessManager" ? "사업담당자 선택" :
      id === "mainManager" ? "운영PM 선택" :
      id === "supportManagerSelect" ? "현장지원 인원 선택" :
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
      c.business_manager_id,
      c.main_manager_id,
      c.sub_manager1_id,
      c.sub_manager2_id,
      ...(c.support_manager_ids || []),
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
      course.business_manager_id,
      course.main_manager_id,
      course.sub_manager1_id,
      course.sub_manager2_id,
      ...(course.support_manager_ids || []),
    ].filter(Boolean);

    const matchedManager = !managerId || managerIds.includes(managerId);

    return matchedKeyword && matchedStatus && matchedRegion && matchedManager;
  });
}

function renderTimeline() {
  const container = document.getElementById("timelineView");
  const courses = getTimelineSortedCourses();

  if (!courses.length) {
    container.innerHTML = emptyBox("표시할 과정이 없습니다.");
    return;
  }

  let html = `
    <div class="timeline-wrapper">
      <div class="timeline-guide">
        <div>
          <b>연간 타임라인</b>
          <span>프로젝트 블록을 드래그하거나 ↑↓ 버튼으로 순서를 조정할 수 있습니다.</span>
        </div>
        <button type="button" class="btn-secondary" onclick="saveTimelineOrder()">
          <i class="fa-solid fa-floppy-disk"></i>
          순서 저장
        </button>
      </div>

      <div class="timeline-grid mb-3 timeline-header-grid">
        <div></div>
        ${Array.from({ length: 12 }, (_, i) => `<button type="button" class="timeline-month timeline-month-btn" onclick="openWeeklyLayer(${i + 1})">${i + 1}월</button>`).join("")}
      </div>

      <div id="timelineRows" class="space-y-3">
  `;

  courses.forEach((course, index) => {
    const start = getCourseStartMonth(course) || 1;
    const end = getCourseEndMonth(course) || start;

    html += `
      <div
        class="timeline-grid timeline-row-block timeline-row-${course.status}"
        draggable="true"
        data-course-id="${course.id}"
        ondragstart="handleTimelineDragStart(event, '${course.id}')"
        ondragover="handleTimelineDragOver(event)"
        ondrop="handleTimelineDrop(event, '${course.id}')"
        ondragend="handleTimelineDragEnd(event)"
      >
    `;

    html += `
      <div class="timeline-name timeline-name-block">
        <div class="timeline-row-actions" onclick="event.stopPropagation()">
          <button type="button" title="위로 이동" onclick="moveTimelineCourse('${course.id}', -1)">
            <i class="fa-solid fa-chevron-up"></i>
          </button>
          <button type="button" title="아래로 이동" onclick="moveTimelineCourse('${course.id}', 1)">
            <i class="fa-solid fa-chevron-down"></i>
          </button>
        </div>

        <div class="timeline-drag-handle" title="드래그해서 순서 변경">
          <i class="fa-solid fa-grip-vertical"></i>
        </div>

        <div class="timeline-title-area" onclick="openCourseModalById('${course.id}')">
          <div class="timeline-title-main">${escapeHtml(course.course_name)}</div>
          <div class="timeline-title-sub">
            <span class="timeline-status-mini timeline-status-mini-${course.status}">${statusText(course.status)}</span>
            <span>${escapeHtml(course.client_name || "")}</span>
          </div>
        </div>
      </div>
    `;

    for (let month = 1; month <= 12; month++) {
      const active = month >= start && month <= end;
      html += `
        <div
          class="timeline-cell ${active ? `active timeline-status-${course.status}` : ""}"
          onclick="openCourseModalById('${course.id}')"
        ></div>
      `;
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

  const mainStatuses = ["planning", "ready", "running", "completed"];
  const subStatuses = ["hold", "canceled"];

  const renderColumn = (status) => {
    const list = courses.filter((c) => c.status === status);

    return `
      <div class="kanban-column-v2 kanban-${status}">
        <div class="kanban-header-v2">
          <div class="flex items-center gap-2">
            <span class="kanban-dot dot-${status}"></span>
            <h3>${STATUS_LABELS[status]}</h3>
          </div>
          <span class="kanban-count">${list.length}</span>
        </div>

        <div class="kanban-body-v2">
          ${
            list.length
              ? list.map(renderCourseMiniCard).join("")
              : `
                <div class="kanban-empty">
                  <i class="fa-solid fa-box-open"></i>
                  <div>배정된 과정이 없습니다.</div>
                </div>
              `
          }
        </div>
      </div>
    `;
  };

  container.innerHTML = `
    <div class="kanban-board-main">
      ${mainStatuses.map(renderColumn).join("")}
    </div>

    <div class="kanban-board-sub">
      ${subStatuses.map(renderColumn).join("")}
    </div>
  `;
}

function renderCourseMiniCard(course) {
  const rounds = state.rounds
    .filter((r) => r.course_id === course.id)
    .sort((a, b) => a.round_no - b.round_no);

  const totalCheckCount = getCourseChecklistCount(course.id);
  const doneCheckCount = getCourseDoneChecklistCount(course.id);

  const progress = totalCheckCount
    ? Math.round((doneCheckCount / totalCheckCount) * 100)
    : 0;

  const business = getMemberShortName(course.business_manager_id);
  const pm = getMemberShortName(course.main_manager_id);
  const sub1 = getMemberShortName(course.sub_manager1_id);
  const fieldCount = (course.support_manager_ids || []).length;

  const budgetText = course.expected_budget ? `₩ ${Number(course.expected_budget).toLocaleString()}` : "";
  const periodText = makeDateLabel(course.start_date_ymd, course.end_date_ymd)
    || makeMonthRangeLabel(course)
    || "-";

  return `
    <div class="kanban-course-card" onclick="openCourseModalById('${course.id}')">
      <div class="kanban-card-top">
        <span class="client-pill">${escapeHtml(course.client_name || "고객사 미정")}</span>
        <span class="period-text">${escapeHtml(periodText)}</span>
      </div>

      <h4 class="kanban-card-title">${escapeHtml(course.course_name)}</h4>

      <div class="kanban-card-location">
        <i class="fa-solid fa-location-dot"></i>
        ${escapeHtml(course.region || "미정")}
        ${course.location_detail ? ` | ${escapeHtml(course.location_detail)}` : ""}
      </div>

      <div class="progress-row">
        <div class="flex justify-between text-xs mb-1">
          <span>과정 준비율</span>
          <b>${doneCheckCount}/${totalCheckCount} (${progress}%)</b>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${progress}%;"></div>
        </div>
      </div>

      <div class="round-preview">
        <div class="round-preview-title">
          <i class="fa-solid fa-layer-group"></i>
          세부 차수 정보 (${rounds.length}개)
        </div>

        ${
          rounds.length
            ? rounds.slice(0, 3).map((round) => `
              <div class="round-preview-item">
                <span class="round-dot dot-${round.status}"></span>
                <span class="round-preview-name">${round.round_no}차수 ${escapeHtml(round.round_name || "")}</span>
                <span class="round-preview-date">${escapeHtml(round.date_label || makeDateLabel(round.start_date_ymd, round.end_date_ymd) || "-")}</span>
              </div>
            `).join("")
            : `<div class="small-muted">등록된 차수 없음</div>`
        }

        ${
          rounds.length > 3
            ? `<div class="small-muted mt-1">외 ${rounds.length - 3}개 차수</div>`
            : ""
        }
      </div>

      <div class="kanban-card-footer">
        <div class="avatar-group">
          ${business ? `<span class="avatar business-avatar" title="사업담당자">${escapeHtml(business)}</span>` : ""}
          ${pm ? `<span class="avatar pm-avatar" title="운영PM">${escapeHtml(pm)}</span>` : ""}
          ${sub1 ? `<span class="avatar sub-avatar" title="운영보조">${escapeHtml(sub1)}</span>` : ""}
          ${fieldCount ? `<span class="avatar field-avatar" title="현장지원">+${fieldCount}</span>` : ""}
        </div>

        <div class="budget-text">${escapeHtml(budgetText)}</div>
      </div>
    </div>
  `;
}

function renderRR() {
  const container = document.getElementById("rrView");
  const courses = getFilteredCourses();

  let html = `<div class="rr-grid">`;

  state.members.forEach((member) => {
    const assigned = courses.filter((course) => {
      const managerIds = [
        course.business_manager_id,
        course.main_manager_id,
        course.sub_manager1_id,
        course.sub_manager2_id,
        ...(course.support_manager_ids || [])
      ].filter(Boolean);

      return managerIds.includes(member.id);
    });

    const businessCourses = assigned.filter((course) => course.business_manager_id === member.id);
    const pmCourses = assigned.filter((course) => course.main_manager_id === member.id);
    const assistCourses = assigned.filter((course) =>
      course.sub_manager1_id === member.id || course.sub_manager2_id === member.id
    );
    const fieldCourses = assigned.filter((course) =>
      (course.support_manager_ids || []).includes(member.id)
    );

    const loadStatus = getLoadStatus(assigned.length);

    html += `
      <div class="rr-card">
        <div class="rr-card-head">
          <div>
            <div class="rr-position">${escapeHtml(member.position || "-")}</div>
            <div class="rr-name">${escapeHtml(member.name)}</div>
          </div>

          <span class="load-badge ${loadStatus.className}">
            ${loadStatus.label}
          </span>
        </div>

        <div class="rr-divider"></div>

        <div class="rr-summary rr-summary-4">
          <div>
            <b>${businessCourses.length}</b>
            <span>사업</span>
          </div>
          <div>
            <b>${pmCourses.length}</b>
            <span>PM</span>
          </div>
          <div>
            <b>${assistCourses.length}</b>
            <span>보조</span>
          </div>
          <div>
            <b>${fieldCourses.length}</b>
            <span>현장</span>
          </div>
        </div>

        <div class="rr-section-title">
          담당 프로젝트
          <span>
            (사업 ${businessCourses.length} / PM ${pmCourses.length} / 보조 ${assistCourses.length} / 현장 ${fieldCourses.length})
          </span>
        </div>

        <div class="rr-project-list">
          ${
            assigned.length
              ? assigned.map((course) => {
                  const role = getRoleLabel(course, member.id);
                  const period = makeDateLabel(course.start_date_ymd, course.end_date_ymd)
                    || makeMonthRangeLabel(course)
                    || "-";

                  return `
                    <div class="rr-project-item" onclick="openCourseModalById('${course.id}')">
                      <div class="rr-project-main">
                        <span class="rr-status-dot dot-${course.status}"></span>
                        <b>${escapeHtml(course.course_name)}</b>
                      </div>

                      <div class="rr-project-sub">
                        <span class="role-chip ${getRoleChipClass(role)}">
                          ${escapeHtml(getRoleShortLabel(role))}
                        </span>
                        <span>${escapeHtml(period)}</span>
                      </div>
                    </div>
                  `;
                }).join("")
              : `<div class="rr-empty">현재 배정된 과정 없음</div>`
          }
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
// 연간 타임라인 순서 조정
// ---------------------------------------------------------
function getTimelineSortedCourses() {
  return getFilteredCourses().sort((a, b) => {
    const orderA = Number.isFinite(Number(a.timeline_order)) ? Number(a.timeline_order) : 999999;
    const orderB = Number.isFinite(Number(b.timeline_order)) ? Number(b.timeline_order) : 999999;

    if (orderA !== orderB) return orderA - orderB;

    const startA = a.start_date_ymd || "991231";
    const startB = b.start_date_ymd || "991231";

    if (startA !== startB) return startA.localeCompare(startB);

    return String(a.course_name || "").localeCompare(String(b.course_name || ""));
  });
}

window.moveTimelineCourse = function(courseId, direction) {
  const courses = getTimelineSortedCourses();
  const currentIndex = courses.findIndex((course) => course.id === courseId);

  if (currentIndex < 0) return;

  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= courses.length) return;

  const reordered = [...courses];
  const [target] = reordered.splice(currentIndex, 1);
  reordered.splice(nextIndex, 0, target);

  applyTimelineOrderToState(reordered);
  renderTimeline();
};

window.handleTimelineDragStart = function(event, courseId) {
  state.timelineDragCourseId = courseId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", courseId);

  const row = event.currentTarget;
  row.classList.add("is-dragging");
};

window.handleTimelineDragOver = function(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";

  const row = event.currentTarget;
  document.querySelectorAll(".timeline-row-block.is-drop-target").forEach((el) => {
    if (el !== row) el.classList.remove("is-drop-target");
  });
  row.classList.add("is-drop-target");
};

window.handleTimelineDrop = function(event, targetCourseId) {
  event.preventDefault();

  const draggedCourseId = state.timelineDragCourseId || event.dataTransfer.getData("text/plain");

  document.querySelectorAll(".timeline-row-block").forEach((el) => {
    el.classList.remove("is-dragging", "is-drop-target");
  });

  if (!draggedCourseId || draggedCourseId === targetCourseId) return;

  const courses = getTimelineSortedCourses();
  const fromIndex = courses.findIndex((course) => course.id === draggedCourseId);
  const toIndex = courses.findIndex((course) => course.id === targetCourseId);

  if (fromIndex < 0 || toIndex < 0) return;

  const reordered = [...courses];
  const [dragged] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, dragged);

  applyTimelineOrderToState(reordered);
  renderTimeline();
};

window.handleTimelineDragEnd = function(event) {
  state.timelineDragCourseId = null;
  document.querySelectorAll(".timeline-row-block").forEach((el) => {
    el.classList.remove("is-dragging", "is-drop-target");
  });
};

function applyTimelineOrderToState(orderedCourses) {
  orderedCourses.forEach((course, index) => {
    const target = state.courses.find((item) => item.id === course.id);
    if (target) target.timeline_order = index + 1;
  });
}

window.saveTimelineOrder = async function() {
  const courses = getTimelineSortedCourses();

  if (!courses.length) {
    alert("저장할 프로젝트 순서가 없습니다.");
    return;
  }

  try {
    setSyncStatus("타임라인 순서 저장 중...");

    const updates = courses.map((course, index) => {
      return db
        .from("courses")
        .update({
          timeline_order: index + 1,
          updated_by: nullIfEmpty(state.currentUserId),
        })
        .eq("id", course.id);
    });

    const responses = await Promise.all(updates);
    responses.forEach(throwIfError);

    await insertLog({
      target_type: "과정",
      action_type: "수정",
      change_summary: "연간 타임라인 프로젝트 순서 변경",
    });

    await loadAll();
    setSyncStatus(`순서 저장 완료 · ${formatNow()}`);
    alert("연간 타임라인 순서가 저장되었습니다.");
  } catch (error) {
    console.error(error);
    setSyncStatus("순서 저장 오류");
    alert("타임라인 순서 저장 중 오류가 발생했습니다.\n\n" + error.message);
  }
};


// ---------------------------------------------------------
// 월 클릭 주간 프로젝트 레이어
// ---------------------------------------------------------
window.openWeeklyLayer = function(month) {
  state.weeklyLayerMonth = month;

  const baseDate = getDefaultMonthDate(2026, month);
  const sunday = getSundayOfWeek(baseDate);

  state.weeklyLayerBaseDate = sunday;
  document.getElementById("weeklyBaseDate").value = toDateInputValue(sunday);

  renderWeeklyLayer();
  openModal("weeklyLayerModal");
};

function applyWeeklyBaseDate() {
  const value = document.getElementById("weeklyBaseDate").value;
  if (!value) {
    alert("기준일을 선택해주세요.");
    return;
  }

  const selectedDate = new Date(value + "T00:00:00");
  const sunday = getSundayOfWeek(selectedDate);

  state.weeklyLayerBaseDate = sunday;
  document.getElementById("weeklyBaseDate").value = toDateInputValue(sunday);

  renderWeeklyLayer();
}

function renderWeeklyLayer() {
  const month = state.weeklyLayerMonth;
  const baseDate = state.weeklyLayerBaseDate || getSundayOfWeek(getDefaultMonthDate(2026, month));
  const content = document.getElementById("weeklyLayerContent");

  document.getElementById("weeklyLayerTitle").innerHTML =
    `<i class="fa-solid fa-calendar-week text-amber-400 mr-2"></i>2026년 ${month}월 주간 캘린더`;

  const weeks = buildMonthWeeks(baseDate, month);
  const events = collectTimelineEventsForMonth(month);

  if (!events.length) {
    content.innerHTML = `
      <div class="weekly-empty">
        <i class="fa-solid fa-calendar-xmark"></i>
        <div>${month}월에 표시할 프로젝트 또는 차수가 없습니다.</div>
      </div>
    `;
    return;
  }

  content.innerHTML = `
    <div class="weekly-calendar-summary">
      <div>
        <b>${month}월 주간 캘린더</b>
        <span>총 ${events.length}개 프로젝트/차수 · 일요일 시작 기준</span>
      </div>
      <div class="weekly-help">
        차수 일정이 있으면 차수 기준, 차수가 없으면 과정 기간 기준으로 표시됩니다.
      </div>
    </div>

    <div class="weekly-calendar-table">
      <div class="weekly-calendar-head">
        <div>주차</div>
        <div>일</div>
        <div>월</div>
        <div>화</div>
        <div>수</div>
        <div>목</div>
        <div>금</div>
        <div>토</div>
      </div>

      <div class="weekly-calendar-body">
        ${weeks.map((week, weekIndex) => {
          const days = Array.from({ length: 7 }, (_, dayIndex) => addDays(week.start, dayIndex));
          const weekEvents = events.filter((event) => rangesOverlap(event.startDate, event.endDate, week.start, week.end));

          return `
            <div class="weekly-calendar-row">
              <div class="weekly-week-label">
                <strong>${weekIndex + 1}주차</strong>
                <span>${formatWeekRange(week.start, week.end)}</span>
                <em>${weekEvents.length}건</em>
              </div>

              ${days.map((day) => {
                const dayEvents = events.filter((event) => rangesOverlap(event.startDate, event.endDate, day, day));
                const isOtherMonth = day.getMonth() + 1 !== month;
                const isToday = isSameDate(day, new Date());

                return `
                  <div class="weekly-day-cell ${isOtherMonth ? "other-month" : ""} ${isToday ? "today" : ""}">
                    <div class="weekly-day-number">
                      <span>${day.getDate()}</span>
                    </div>

                    <div class="weekly-day-events">
                      ${
                        dayEvents.length
                          ? dayEvents.slice(0, 3).map((event) => renderWeeklyEvent(event, day)).join("")
                          : `<div class="weekly-day-empty">-</div>`
                      }

                      ${
                        dayEvents.length > 3
                          ? `<button type="button" class="weekly-day-more" onclick="openWeeklyDayDetail('${toDateInputValue(day)}')">+${dayEvents.length - 3}개 더보기</button>`
                          : ""
                      }
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <div id="weeklyDayDetailArea" class="weekly-day-detail-area hidden"></div>
  `;
}

function renderWeeklyEvent(event, day = null) {
  return `
    <div class="weekly-calendar-event ${event.type === "round" ? "event-round" : "event-course"}" onclick="openCourseModalById('${event.courseId}')">
      <div class="weekly-calendar-event-title">
        ${event.type === "round" ? `<span>차</span>` : `<span>과</span>`}
        ${escapeHtml(event.title)}
      </div>
      <div class="weekly-calendar-event-meta">
        ${escapeHtml(formatShortDate(event.startDate))}~${escapeHtml(formatShortDate(event.endDate))}
      </div>
    </div>
  `;
}

window.openWeeklyDayDetail = function(dateValue) {
  const date = new Date(dateValue + "T00:00:00");
  const month = state.weeklyLayerMonth;
  const events = collectTimelineEventsForMonth(month)
    .filter((event) => rangesOverlap(event.startDate, event.endDate, date, date));

  const area = document.getElementById("weeklyDayDetailArea");
  if (!area) return;

  area.classList.remove("hidden");
  area.innerHTML = `
    <div class="weekly-detail-panel">
      <div class="weekly-detail-head">
        <div>
          <b>${formatShortDate(date)} 상세 일정</b>
          <span>${events.length}건</span>
        </div>
        <button type="button" onclick="document.getElementById('weeklyDayDetailArea').classList.add('hidden')">닫기</button>
      </div>

      <div class="weekly-detail-list">
        ${
          events.length
            ? events.map((event) => `
              <div class="weekly-detail-item" onclick="openCourseModalById('${event.courseId}')">
                <div class="weekly-detail-top">
                  <span class="weekly-type ${event.type === "round" ? "type-round" : "type-course"}">
                    ${event.type === "round" ? "차수" : "과정"}
                  </span>
                  ${statusBadge(event.status)}
                </div>
                <div class="weekly-detail-title">${escapeHtml(event.title)}</div>
                <div class="weekly-detail-meta">
                  <i class="fa-solid fa-calendar-day"></i>
                  ${formatShortDate(event.startDate)} ~ ${formatShortDate(event.endDate)}
                </div>
                <div class="weekly-detail-meta">
                  <i class="fa-solid fa-user"></i>
                  PM ${escapeHtml(getMemberName(event.pmId) || "-")}
                </div>
                ${
                  event.place
                    ? `<div class="weekly-detail-meta"><i class="fa-solid fa-location-dot"></i>${escapeHtml(event.place)}</div>`
                    : ""
                }
              </div>
            `).join("")
            : `<div class="weekly-no-event">해당 날짜 일정 없음</div>`
        }
      </div>
    </div>
  `;

  area.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

function collectTimelineEventsForMonth(month) {
  const courses = getFilteredCourses();
  const events = [];

  courses.forEach((course) => {
    const activeRounds = state.rounds
      .filter((round) => round.course_id === course.id)
      .filter((round) => round.start_date_ymd || round.end_date_ymd);

    if (activeRounds.length) {
      activeRounds.forEach((round) => {
        const startDate = yymmddToDate(round.start_date_ymd || round.end_date_ymd);
        const endDate = yymmddToDate(round.end_date_ymd || round.start_date_ymd);

        if (!startDate || !endDate) return;
        if (!dateRangeTouchesMonth(startDate, endDate, month)) return;

        events.push({
          type: "round",
          courseId: course.id,
          roundId: round.id,
          title: `${course.course_name} · ${round.round_no}차 ${round.round_name || ""}`,
          startDate,
          endDate,
          status: round.status || course.status,
          pmId: course.main_manager_id,
          place: round.venue || course.location_detail || course.region || "",
          updatedAt: round.updated_at || course.updated_at || course.created_at,
        });
      });
    } else {
      const startDate = yymmddToDate(course.start_date_ymd);
      const endDate = yymmddToDate(course.end_date_ymd || course.start_date_ymd);

      if (!startDate || !endDate) return;
      if (!dateRangeTouchesMonth(startDate, endDate, month)) return;

      events.push({
        type: "course",
        courseId: course.id,
        roundId: null,
        title: course.course_name,
        startDate,
        endDate,
        status: course.status,
        pmId: course.main_manager_id,
        place: course.location_detail || course.region || "",
        updatedAt: course.updated_at || course.created_at,
      });
    }
  });

  return events.sort((a, b) => {
    const dateDiff = a.startDate - b.startDate;
    if (dateDiff !== 0) return dateDiff;
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
}

function buildMonthWeeks(baseSunday, month) {
  const weeks = [];
  let cursor = new Date(baseSunday);

  for (let i = 0; i < 6; i++) {
    const start = new Date(cursor);
    const end = addDays(start, 6);

    if (i > 0 && start.getMonth() + 1 !== month && end.getMonth() + 1 !== month) {
      break;
    }

    weeks.push({ start, end });
    cursor = addDays(cursor, 7);
  }

  return weeks;
}

function getDefaultMonthDate(year, month) {
  return new Date(year, month - 1, 1);
}

function getSundayOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA <= endB && endA >= startB;
}

function dateRangeTouchesMonth(startDate, endDate, month) {
  const year = 2026;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  return rangesOverlap(startDate, endDate, monthStart, monthEnd);
}

function yymmddToDate(value) {
  if (!value || !/^\d{6}$/.test(value)) return null;

  const yy = Number(value.slice(0, 2));
  const mm = Number(value.slice(2, 4));
  const dd = Number(value.slice(4, 6));

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  return new Date(2000 + yy, mm - 1, dd);
}

function toDateInputValue(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatShortDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatWeekRange(start, end) {
  return `${formatShortDate(start)}(일) ~ ${formatShortDate(end)}(토)`;
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
  state.selectedSupportManagerIds = course?.support_manager_ids || [];

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
  document.getElementById("businessManager").value = course?.business_manager_id || "";
  document.getElementById("mainManager").value = course?.main_manager_id || "";
  document.getElementById("subManager1").value = course?.sub_manager1_id || "";
  document.getElementById("subManager2").value = course?.sub_manager2_id || "";
  document.getElementById("courseStatus").value = course?.status || "planning";
  document.getElementById("expectedBudget").value = course?.expected_budget || "";
  document.getElementById("courseNotes").value = course?.notes || "";

  renderSupportManagerTags();

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

  const id = document.getElementById("courseId").value;

  const businessManagerId = document.getElementById("businessManager").value || null;
  const mainManagerId = document.getElementById("mainManager").value || null;
  const subManager1Id = document.getElementById("subManager1").value || null;
  const subManager2Id = document.getElementById("subManager2").value || null;

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

    business_manager_id: businessManagerId,
    main_manager_id: mainManagerId,
    sub_manager1_id: subManager1Id,
    sub_manager2_id: subManager2Id,
    sub_manager3_id: null,
    support_manager_ids: state.selectedSupportManagerIds || [],

    status: document.getElementById("courseStatus").value,
    expected_budget: toNumberOrNull(document.getElementById("expectedBudget").value),
    notes: document.getElementById("courseNotes").value.trim() || null,
    updated_by: state.currentUserId || null,
  };

  if (!payload.course_name) {
    alert("프로젝트명을 입력해주세요.");
    return;
  }

  try {
    setSyncStatus("과정 저장 중...");

    let response;
    let actionType;

    if (id) {
      response = await db
        .from("courses")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      actionType = "수정";
    } else {
      response = await db
        .from("courses")
        .insert(payload)
        .select()
        .single();

      actionType = "신규등록";
    }

    throwIfError(response);

    const savedCourse = response.data;

    await insertLog({
      target_type: "과정",
      course_id: savedCourse.id,
      action_type: actionType,
      change_summary: `${payload.course_name} ${actionType}`,
    });

    await loadAll();

    state.selectedCourseId = savedCourse.id;
    state.selectedSupportManagerIds = savedCourse.support_manager_ids || [];

    if (!id) {
      closeModal("courseModal");
      alert("과정이 등록되었습니다. 다시 과정을 열면 차수와 체크리스트를 관리할 수 있습니다.");
    } else {
      document.getElementById("courseId").value = savedCourse.id;
      document.getElementById("businessManager").value = savedCourse.business_manager_id || "";
      document.getElementById("mainManager").value = savedCourse.main_manager_id || "";
      document.getElementById("subManager1").value = savedCourse.sub_manager1_id || "";
      document.getElementById("subManager2").value = savedCourse.sub_manager2_id || "";

      renderSupportManagerTags();
      renderCourseModalRounds(savedCourse.id);
      await ensureChecklistStatuses(savedCourse.id, null, "course");
      renderChecklist(savedCourse.id, null, "courseChecklistArea", "course");

      renderStats();
      renderViews();

      alert("과정 정보와 담당자 배정이 저장되었습니다.");
    }

    setSyncStatus(`저장 완료 · ${formatNow()}`);
  } catch (error) {
    console.error(error);
    setSyncStatus("저장 오류");

    alert(
      "과정 저장 중 오류가 발생했습니다.\n\n" +
      "오류 메시지:\n" +
      (error.message || JSON.stringify(error))
    );
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
  const usableItems = getChecklistItemsByScope(scope, courseId, roundId);

  const existingItemIds = state.checklistStatuses
    .filter((s) => s.course_id === courseId && normalizeId(s.round_id) === normalizeId(roundId))
    .map((s) => s.checklist_item_id);

  const missing = usableItems.filter((item) => !existingItemIds.includes(item.id));

  if (!missing.length) return;

const baseOrder = state.checklistStatuses
  .filter((s) => s.course_id === courseId && normalizeId(s.round_id) === normalizeId(roundId))
  .reduce((max, s) => Math.max(max, Number(s.sort_order) || 0), 0);

const rows = missing.map((item, index) => ({
  course_id: courseId,
  round_id: roundId,
  checklist_item_id: item.id,
  is_done: false,
  is_hidden: false,
  sort_order: baseOrder + index + 1,
  updated_by: nullIfEmpty(state.currentUserId),
}));

  const response = await db.from("checklist_statuses").insert(rows).select();
  throwIfError(response);

  state.checklistStatuses = [...state.checklistStatuses, ...(response.data || [])];
}

function renderChecklist(courseId, roundId = null, containerId, scope = "course") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const items = getChecklistItemsByScope(scope, courseId, roundId);

  const rows = items.map((item) => {
    const status = state.checklistStatuses.find(
      (s) =>
        s.course_id === courseId &&
        normalizeId(s.round_id) === normalizeId(roundId) &&
        s.checklist_item_id === item.id
    );

    return {
      item,
      status,
      isDone: !!status?.is_done,
      isHidden: !!status?.is_hidden,
      checkedAt: status?.is_done ? status?.updated_at : null,
    };
})
.filter((row) => !row.isHidden)
.sort((a, b) => {
  const orderA = Number(a.status?.sort_order ?? a.item.sort_order ?? 9999);
  const orderB = Number(b.status?.sort_order ?? b.item.sort_order ?? 9999);

  if (orderA !== orderB) return orderA - orderB;

  return String(a.item.title || "").localeCompare(String(b.item.title || ""));
});
  const totalCount = rows.length;
  const doneCount = rows.filter((row) => row.isDone).length;
  const percent = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  const title = scope === "round" ? "차수 운영 체크리스트" : "프로젝트 체크리스트";
  const guideText =
    scope === "round"
      ? "해당 차수에만 적용되는 운영 체크리스트입니다. 필요한 항목을 직접 추가·숨김 처리할 수 있습니다."
      : "이 프로젝트에만 적용되는 체크리스트입니다. 기본 항목을 바탕으로 항목을 직접 추가·숨김 처리할 수 있습니다.";

  container.innerHTML = `
    <div class="checklist-panel">
      <div class="checklist-summary">
        <div>
          <div class="checklist-title">${title}</div>
          <div class="checklist-guide">${guideText}</div>
        </div>

        <div class="checklist-actions">
          <button type="button" class="checklist-edit-btn" onclick="openChecklistEditModal('${courseId}', '${roundId || ""}', '${scope}', '${containerId}')">
            <i class="fa-solid fa-pen-to-square"></i>
            체크리스트 수정하기
          </button>

          <div class="checklist-score">
            <strong>${doneCount}</strong>
            <span>/ ${totalCount}</span>
          </div>
        </div>
      </div>

      <div class="checklist-progress">
        <div class="checklist-progress-fill" style="width:${percent}%;"></div>
      </div>

      <div class="checklist-percent-row">
        <span>완료율</span>
        <b>${percent}%</b>
      </div>

      <div class="checklist-list">
        ${
          rows.length
            ? rows.map(({ item, isDone, checkedAt }) => `
              <label class="checklist-card ${isDone ? "is-done" : ""}">
                <input
                  type="checkbox"
                  ${isDone ? "checked" : ""}
                  onchange="toggleChecklist('${courseId}', '${roundId || ""}', '${item.id}', this.checked, '${containerId}', '${scope}')"
                />

                <span class="checklist-custom-box">
                  <i class="fa-solid fa-check"></i>
                </span>

                <span class="checklist-content">
                  <span class="checklist-code">
                    ${escapeHtml(item.code || (item.is_custom ? "CUSTOM" : ""))}
                    ${item.is_custom ? `<em class="custom-mark">직접추가</em>` : ""}
                  </span>
                  <span class="checklist-name">${escapeHtml(item.title)}</span>
                  ${
                    checkedAt
                      ? `<span class="checklist-date">체크일 ${escapeHtml(formatTinyDate(checkedAt))}</span>`
                      : `<span class="checklist-date muted">미체크</span>`
                  }
                </span>

                <span class="checklist-state">
                  ${isDone ? "완료" : "대기"}
                </span>
              </label>
            `).join("")
            : `<div class="checklist-empty">등록된 체크리스트 항목이 없습니다. [체크리스트 수정하기]로 항목을 추가해보세요.</div>`
        }
      </div>
    </div>
  `;
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
          is_hidden: false,
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
          is_hidden: false,
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

function getChecklistItemsByScope(scope, courseId = null, roundId = null) {
  return state.checklistItems.filter((item) => {
    const itemScopeMatched =
      scope === "course"
        ? item.scope === "course" || item.scope === "both" || !item.scope
        : item.scope === "round" || item.scope === "both";

    if (!itemScopeMatched) return false;

    // 기본 체크리스트: 모든 프로젝트/차수에 공통 표시
    if (!item.is_custom && !item.course_id && !item.round_id) return true;

    // 커스텀 체크리스트: 해당 프로젝트 또는 해당 차수에만 표시
    if (item.is_custom) {
      if (scope === "course") {
        return item.course_id === courseId && !item.round_id;
      }

      if (scope === "round") {
        return item.course_id === courseId && item.round_id === roundId;
      }
    }

    return false;
  });
}


// ---------------------------------------------------------
// 체크리스트 항목 편집
// ---------------------------------------------------------
window.openChecklistEditModal = async function(courseId, roundIdRaw, scope, containerId) {
  const roundId = roundIdRaw || null;

  try {
    document.getElementById("checklistEditCourseId").value = courseId;
    document.getElementById("checklistEditRoundId").value = roundId || "";
    document.getElementById("checklistEditScope").value = scope;
    document.getElementById("newChecklistTitle").value = "";

    const course = getCourseById(courseId);
    const round = roundId ? state.rounds.find((r) => r.id === roundId) : null;

    document.getElementById("checklistEditInfo").textContent =
      scope === "round"
        ? `${course?.course_name || ""} · ${round?.round_no || ""}차 ${round?.round_name || ""}에만 적용됩니다.`
        : `${course?.course_name || ""} 프로젝트에만 적용됩니다.`;

    await ensureChecklistStatuses(courseId, roundId, scope);
    renderChecklistEditList(courseId, roundId, scope, containerId);
    openModal("checklistEditModal");
  } catch (error) {
    console.error(error);
    alert("체크리스트 수정 창을 여는 중 오류가 발생했습니다.\n\n" + error.message);
  }
};

function renderChecklistEditList(courseId, roundId = null, scope = "course", containerId = "") {
  const container = document.getElementById("checklistEditList");
  if (!container) return;

  const items = getChecklistItemsByScope(scope, courseId, roundId);

  const rows = items.map((item) => {
    const status = state.checklistStatuses.find(
      (s) =>
        s.course_id === courseId &&
        normalizeId(s.round_id) === normalizeId(roundId) &&
        s.checklist_item_id === item.id
    );

    return {
      item,
      status,
      isHidden: !!status?.is_hidden,
      sortOrder: Number(status?.sort_order ?? item.sort_order ?? 9999),
    };
  }).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return String(a.item.title || "").localeCompare(String(b.item.title || ""));
  });

  if (!rows.length) {
    container.innerHTML = `<div class="checklist-edit-empty">등록된 항목이 없습니다.</div>`;
    return;
  }

  container.innerHTML = rows.map(({ item, status, isHidden }, index) => `
    <div class="checklist-edit-row ${isHidden ? "is-hidden" : ""}">
      <div>
        <div class="checklist-edit-title">
          ${escapeHtml(item.title)}
          ${item.is_custom ? `<span class="custom-mark">직접추가</span>` : `<span class="default-mark">기본</span>`}
        </div>
        <div class="checklist-edit-meta">
          ${escapeHtml(item.code || "CUSTOM")} · ${isHidden ? "숨김 처리됨" : "표시 중"}
        </div>
      </div>

      <div class="checklist-edit-actions">
        <button
          type="button"
          class="btn-secondary"
          ${index === 0 ? "disabled" : ""}
          onclick="moveChecklistItem('${courseId}', '${roundId || ""}', '${item.id}', -1, '${scope}', '${containerId}')"
        >↑</button>

        <button
          type="button"
          class="btn-secondary"
          ${index === rows.length - 1 ? "disabled" : ""}
          onclick="moveChecklistItem('${courseId}', '${roundId || ""}', '${item.id}', 1, '${scope}', '${containerId}')"
        >↓</button>

        ${
          isHidden
            ? `<button type="button" class="btn-secondary" onclick="restoreChecklistItem('${courseId}', '${roundId || ""}', '${item.id}', '${scope}', '${containerId}')">복원</button>`
            : `<button type="button" class="btn-danger" onclick="hideChecklistItem('${courseId}', '${roundId || ""}', '${item.id}', '${scope}', '${containerId}')">삭제</button>`
        }
      </div>
    </div>
  `).join("");
}

window.moveChecklistItem = async function(courseId, roundIdRaw, itemId, direction, scope, containerId) {
  const roundId = roundIdRaw || null;
  const targetContainerId = containerId || (scope === "round" ? "roundChecklistArea" : "courseChecklistArea");

  try {
    await ensureChecklistStatuses(courseId, roundId, scope);

    const items = getChecklistItemsByScope(scope, courseId, roundId);

    const rows = items.map((item) => {
      const status = state.checklistStatuses.find(
        (s) =>
          s.course_id === courseId &&
          normalizeId(s.round_id) === normalizeId(roundId) &&
          s.checklist_item_id === item.id
      );

      return {
        item,
        status,
        isHidden: !!status?.is_hidden,
        sortOrder: Number(status?.sort_order ?? item.sort_order ?? 9999),
      };
    })
    .filter((row) => !row.isHidden && row.status)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return String(a.item.title || "").localeCompare(String(b.item.title || ""));
    });

    const currentIndex = rows.findIndex((row) => row.item.id === itemId);
    if (currentIndex < 0) return;

    const nextIndex = currentIndex + Number(direction);
    if (nextIndex < 0 || nextIndex >= rows.length) return;

    const reordered = [...rows];
    const [target] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, target);

    const updates = reordered.map((row, index) => {
      return db
        .from("checklist_statuses")
        .update({
          sort_order: index + 1,
          updated_by: nullIfEmpty(state.currentUserId),
        })
        .eq("id", row.status.id);
    });

    const responses = await Promise.all(updates);
    responses.forEach(throwIfError);

    await insertLog({
      target_type: "체크리스트",
      course_id: courseId,
      round_id: roundId,
      action_type: "수정",
      change_summary: "체크리스트 항목 순서 변경",
    });

    await loadAll();

    renderChecklistEditList(courseId, roundId, scope, targetContainerId);
    renderChecklist(courseId, roundId, targetContainerId, scope);

  } catch (error) {
    console.error(error);
    alert("체크리스트 순서 변경 중 오류가 발생했습니다.\n\n" + error.message);
  }
};

async function addCustomChecklistItem() {
  const courseId = document.getElementById("checklistEditCourseId").value;
  const roundId = document.getElementById("checklistEditRoundId").value || null;
  const scope = document.getElementById("checklistEditScope").value || "course";
  const title = document.getElementById("newChecklistTitle").value.trim();

  if (!title) {
    alert("추가할 체크리스트 항목명을 입력해주세요.");
    return;
  }

  try {
    const payload = {
      code: makeCustomChecklistCode(scope),
      title,
      scope,
      is_custom: true,
      course_id: courseId,
      round_id: scope === "round" ? roundId : null,
      sort_order: 999,
      is_active: true,
    };

    const itemRes = await db.from("checklist_items").insert(payload).select().single();
    throwIfError(itemRes);

    const statusRes = await db.from("checklist_statuses").insert({
      course_id: courseId,
      round_id: scope === "round" ? roundId : null,
      checklist_item_id: itemRes.data.id,
      is_done: false,
      is_hidden: false,
      sort_order: getNextChecklistSortOrder(courseId, roundId),
      updated_by: nullIfEmpty(state.currentUserId),
    }).select().single();

    throwIfError(statusRes);

    await insertLog({
      target_type: "체크리스트",
      course_id: courseId,
      round_id: scope === "round" ? roundId : null,
      action_type: "신규등록",
      change_summary: `커스텀 체크리스트 추가: ${title}`,
    });

    document.getElementById("newChecklistTitle").value = "";
    await loadAll();

    renderChecklistEditList(courseId, roundId, scope);
    renderChecklist(courseId, roundId, scope === "round" ? "roundChecklistArea" : "courseChecklistArea", scope);

    alert("체크리스트 항목이 추가되었습니다.");
  } catch (error) {
    alert("체크리스트 항목 추가 중 오류가 발생했습니다.\n\n" + error.message);
  }
}

window.hideChecklistItem = async function(courseId, roundIdRaw, itemId, scope, containerId) {
  const roundId = roundIdRaw || null;

  if (!confirm("이 항목을 현재 프로젝트/차수에서 삭제할까요?\n기본 항목은 다른 프로젝트에는 영향을 주지 않고 현재 화면에서만 숨김 처리됩니다.")) {
    return;
  }

  try {
    const item = state.checklistItems.find((i) => i.id === itemId);

    if (item?.is_custom) {
      const response = await db
        .from("checklist_items")
        .update({ is_active: false })
        .eq("id", itemId);
      throwIfError(response);
    } else {
      let existing = state.checklistStatuses.find(
        (s) =>
          s.course_id === courseId &&
          normalizeId(s.round_id) === normalizeId(roundId) &&
          s.checklist_item_id === itemId
      );

      if (!existing) {
        const insertRes = await db.from("checklist_statuses").insert({
          course_id: courseId,
          round_id: roundId,
          checklist_item_id: itemId,
          is_done: false,
          is_hidden: true,
          updated_by: nullIfEmpty(state.currentUserId),
        }).select().single();
        throwIfError(insertRes);
      } else {
        const updateRes = await db
          .from("checklist_statuses")
          .update({
            is_hidden: true,
            updated_by: nullIfEmpty(state.currentUserId),
          })
          .eq("id", existing.id);
        throwIfError(updateRes);
      }
    }

    await insertLog({
      target_type: "체크리스트",
      course_id: courseId,
      round_id: roundId,
      action_type: "숨김처리",
      change_summary: `체크리스트 항목 삭제/숨김 처리`,
    });

    await loadAll();
    renderChecklistEditList(courseId, roundId, scope, containerId);
    renderChecklist(courseId, roundId, containerId || (scope === "round" ? "roundChecklistArea" : "courseChecklistArea"), scope);
  } catch (error) {
    alert("체크리스트 항목 삭제 중 오류가 발생했습니다.\n\n" + error.message);
  }
};

window.restoreChecklistItem = async function(courseId, roundIdRaw, itemId, scope, containerId) {
  const roundId = roundIdRaw || null;

  try {
    const existing = state.checklistStatuses.find(
      (s) =>
        s.course_id === courseId &&
        normalizeId(s.round_id) === normalizeId(roundId) &&
        s.checklist_item_id === itemId
    );

    if (existing) {
      const response = await db
        .from("checklist_statuses")
        .update({
          is_hidden: false,
          updated_by: nullIfEmpty(state.currentUserId),
        })
        .eq("id", existing.id);
      throwIfError(response);
    }

    await insertLog({
      target_type: "체크리스트",
      course_id: courseId,
      round_id: roundId,
      action_type: "복원",
      change_summary: `체크리스트 항목 복원`,
    });

    await loadAll();
    renderChecklistEditList(courseId, roundId, scope, containerId);
    renderChecklist(courseId, roundId, containerId || (scope === "round" ? "roundChecklistArea" : "courseChecklistArea"), scope);
  } catch (error) {
    alert("체크리스트 항목 복원 중 오류가 발생했습니다.\n\n" + error.message);
  }
};

function getNextChecklistSortOrder(courseId, roundId = null) {
  const relatedStatuses = state.checklistStatuses.filter(
    (s) => s.course_id === courseId && normalizeId(s.round_id) === normalizeId(roundId)
  );

  const maxStatusOrder = relatedStatuses.reduce(
    (max, s) => Math.max(max, Number(s.sort_order) || 0),
    0
  );

  const relatedItems = state.checklistItems.filter(
    (item) =>
      item.course_id === courseId &&
      normalizeId(item.round_id) === normalizeId(roundId)
  );

  const maxItemOrder = relatedItems.reduce(
    (max, item) => Math.max(max, Number(item.sort_order) || 0),
    0
  );

  return Math.max(maxStatusOrder, maxItemOrder) + 1;
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
// 현장지원 태그
// ---------------------------------------------------------
function addSupportManagerTag() {
  const select = document.getElementById("supportManagerSelect");
  const memberId = select.value;

  if (!memberId) {
    alert("현장지원 인원을 선택해주세요.");
    return;
  }

  if (state.selectedSupportManagerIds.includes(memberId)) {
    alert("이미 추가된 인원입니다.");
    return;
  }

  state.selectedSupportManagerIds.push(memberId);
  select.value = "";
  renderSupportManagerTags();
}

function removeSupportManagerTag(memberId) {
  state.selectedSupportManagerIds = state.selectedSupportManagerIds.filter((id) => id !== memberId);
  renderSupportManagerTags();
}

function renderSupportManagerTags() {
  const container = document.getElementById("supportManagerTags");
  if (!container) return;

  if (!state.selectedSupportManagerIds.length) {
    container.innerHTML = `<div class="support-empty">현장지원 인원이 없습니다.</div>`;
    return;
  }

  container.innerHTML = state.selectedSupportManagerIds.map((memberId) => {
    const member = state.members.find((m) => m.id === memberId);
    const name = member ? `${member.name}${member.position ? " / " + member.position : ""}` : "알 수 없음";

    return `
      <span class="support-tag">
        <i class="fa-solid fa-person-circle-plus"></i>
        ${escapeHtml(name)}
        <button type="button" onclick="removeSupportManagerTag('${memberId}')">
          ×
        </button>
      </span>
    `;
  }).join("");
}

window.removeSupportManagerTag = removeSupportManagerTag;

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
    "사업담당자",
    "운영PM",
    "운영보조1",
    "운영보조2",
    "현장지원",
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
        getMemberName(course.business_manager_id),
        getMemberName(course.main_manager_id),
        getMemberName(course.sub_manager1_id),
        getMemberName(course.sub_manager2_id),
        getSupportManagerNames(course.support_manager_ids),
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
          getMemberName(course.business_manager_id),
          getMemberName(course.main_manager_id),
          getMemberName(course.sub_manager1_id),
          getMemberName(course.sub_manager2_id),
          getSupportManagerNames(course.support_manager_ids),
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

function getMemberShortName(id) {
  if (!id) return "";
  const member = state.members.find((m) => m.id === id);
  if (!member) return "";
  return member.name.slice(-2);
}

function getSupportManagerNames(ids) {
  if (!ids || !ids.length) return "";
  return ids
    .map((id) => getMemberName(id))
    .filter(Boolean)
    .join(", ");
}

function getRoleLabel(course, memberId) {
  if (course.business_manager_id === memberId) return "사업담당자";
  if (course.main_manager_id === memberId) return "운영PM";
  if (course.sub_manager1_id === memberId) return "운영보조1";
  if (course.sub_manager2_id === memberId) return "운영보조2";
  if ((course.support_manager_ids || []).includes(memberId)) return "현장지원";
  return "담당자";
}

function getRoleChipClass(role) {
  if (role === "사업담당자") return "role-business";
  if (role === "운영PM") return "role-pm";
  if (role === "운영보조1" || role === "운영보조2") return "role-sub";
  if (role === "현장지원") return "role-field";
  return "role-sub";
}

function getRoleShortLabel(role) {
  if (role === "사업담당자") return "사업";
  if (role === "운영PM") return "PM";
  if (role === "운영보조1") return "보조1";
  if (role === "운영보조2") return "보조2";
  if (role === "현장지원") return "현장";
  return role;
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

function makeMonthRangeLabel(course) {
  const start = getCourseStartMonth(course);
  const end = getCourseEndMonth(course);

  if (!start && !end) return "";
  if (start && !end) return `${start}월`;
  if (!start && end) return `${end}월`;
  if (start === end) return `${start}월`;
  return `${start}월 ~ ${end}월`;
}

function getNextRoundNo(courseId) {
  const courseRounds = state.rounds.filter((r) => r.course_id === courseId);
  if (!courseRounds.length) return 1;
  return Math.min(Math.max(...courseRounds.map((r) => r.round_no)) + 1, 15);
}

function getCourseChecklistCount(courseId) {
  return state.checklistStatuses.filter((item) => {
    return item.course_id === courseId && !item.round_id;
  }).length;
}

function getCourseDoneChecklistCount(courseId) {
  return state.checklistStatuses.filter((item) => {
    return item.course_id === courseId && !item.round_id && item.is_done;
  }).length;
}

function getLoadStatus(count) {
  if (count >= 5) {
    return {
      label: `과다 (${count})`,
      className: "load-high",
    };
  }

  if (count >= 1) {
    return {
      label: `적정 (${count})`,
      className: "load-normal",
    };
  }

  return {
    label: `정상 (0)`,
    className: "load-low",
  };
}

function makeCustomChecklistCode(scope) {
  const prefix = scope === "round" ? "R-CUSTOM" : "P-CUSTOM";
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
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
