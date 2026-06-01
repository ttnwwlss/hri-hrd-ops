// =========================================================
// HRI HRD사업팀 과정운영 관리 앱
// 프로젝트 / 차수 역할 분리 전체본
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
  "미정", "전국", "비대면", "서울", "경기", "인천", "강원", "충북", "충남",
  "대전", "세종", "전북", "전남", "광주", "경북", "경남", "대구", "울산", "부산", "제주"
];

const PROJECT_TYPE_LABELS = {
  lecture: "출강",
  outsourcing: "위탁",
};

const PROJECT_CHECKLIST_CODES = [
  "PROJECT_PLAN",
  "PROPOSAL_CONFIRM",
  "SALES_RECOGNITION",
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
  selectedRoundFieldManagerIds: [],
  selectedRoundSupportManagerIds: [],
  checklistEditorScope: "course",
};

// ---------------------------------------------------------
// 초기화
// ---------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  fillStaticSelects();
  await loadAll();
});

// ---------------------------------------------------------
// 이벤트 연결
// ---------------------------------------------------------

function bindEvents() {
  qs("openCourseModalBtn").addEventListener("click", () => openCourseModal());
  qs("courseForm").addEventListener("submit", saveCourse);
  qs("roundForm").addEventListener("submit", saveRound);
  qs("completeForm").addEventListener("submit", submitCompleteRound);

  qs("hideCourseBtn").addEventListener("click", hideCurrentCourse);
  qs("hideRoundBtn").addEventListener("click", hideCurrentRound);
  qs("completeRoundBtn").addEventListener("click", () => {
    const roundId = qs("roundId").value;
    openCompleteModal(roundId);
  });

  qs("quickAddRoundBtn").addEventListener("click", quickAddRound);
  qs("roundStatus").addEventListener("change", toggleCompletedFields);

  qs("openMemberModalBtn").addEventListener("click", () => {
    renderMemberList();
    openModal("memberModal");
  });

  qs("addMemberBtn").addEventListener("click", addMember);
  qs("addRoundFieldManagerBtn").addEventListener("click", addRoundFieldManagerTag);
  qs("addRoundSupportManagerBtn").addEventListener("click", addRoundSupportManagerTag);
  qs("addCustomChecklistBtn").addEventListener("click", addCustomChecklistItem);

  qs("updateDataBtn").addEventListener("click", updateData);
  qs("downloadExcelBtn").addEventListener("click", downloadExcel);

  qs("currentUserSelect").addEventListener("change", (event) => {
    state.currentUserId = event.target.value;
    localStorage.setItem("hri_current_user_id", state.currentUserId);
  });

  ["searchInput", "managerFilter", "statusFilter", "regionFilter"].forEach((id) => {
    qs(id).addEventListener("input", render);
    qs(id).addEventListener("change", render);
  });

  qs("resetFilterBtn").addEventListener("click", () => {
    qs("searchInput").value = "";
    qs("managerFilter").value = "";
    qs("statusFilter").value = "";
    qs("regionFilter").value = "";
    render();
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
  });

  document.querySelectorAll(".view-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentView = btn.dataset.view;
      document.querySelectorAll(".view-tab").forEach((item) => item.classList.remove("active"));
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
      logsRes,
    ] = await Promise.all([
      db.from("members").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
      db.from("courses").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      db.from("rounds").select("*").eq("is_active", true).order("round_no", { ascending: true }),
      db.from("checklist_items").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
      db.from("checklist_statuses").select("*"),
      db.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(50),
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
    qs("currentUserSelect").value = savedUserId;

    render();
    setSyncStatus(`동기화 완료 · ${formatNow()}`);
  } catch (error) {
    console.error(error);
    setSyncStatus("오류 발생");
    alert("데이터를 불러오는 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
}

function throwIfError(response) {
  if (response && response.error) throw response.error;
}

// ---------------------------------------------------------
// 셀렉트박스
// ---------------------------------------------------------

function fillStaticSelects() {
  fillStatusOptions(qs("statusFilter"), true);
  fillStatusOptions(qs("courseStatus"), false);
  fillStatusOptions(qs("roundStatus"), false);
  fillStatusOptions(qs("quickRoundStatus"), false);

  fillRegionOptions(qs("regionFilter"), true);
  fillRegionOptions(qs("region"), false);
}

function fillStatusOptions(select, includeAll) {
  if (!select) return;
  select.innerHTML = includeAll ? `<option value="">상태 전체</option>` : "";
  STATUS_ORDER.forEach((key) => {
    select.insertAdjacentHTML("beforeend", `<option value="${key}">${STATUS_LABELS[key]}</option>`);
  });
}

function fillRegionOptions(select, includeAll) {
  if (!select) return;
  select.innerHTML = includeAll ? `<option value="">연수지역 전체</option>` : "";
  REGIONS.forEach((region) => {
    select.insertAdjacentHTML("beforeend", `<option value="${escapeAttr(region)}">${escapeHtml(region)}</option>`);
  });
}

function fillMemberSelects() {
  const selectConfigs = [
    ["currentUserSelect", "현재 사용자 선택"],
    ["managerFilter", "담당자 전체"],
    ["businessManager", "사업담당자 선택"],
    ["mainManager", "운영PM 선택"],
    ["subManager1", "운영 PL 선택"],
    ["roundFieldManagerSelect", "현장 운영자 선택"],
    ["roundSupportManagerSelect", "운영 지원 선택"],
  ];

  selectConfigs.forEach(([id, label]) => {
    const select = qs(id);
    if (!select) return;

    select.innerHTML = `<option value="">${label}</option>`;
    state.members.forEach((member) => {
      select.insertAdjacentHTML(
        "beforeend",
        `<option value="${member.id}">${escapeHtml(member.name)}${member.position ? " (" + escapeHtml(member.position) + ")" : ""}</option>`
      );
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
  const courseIds = courses.map((course) => course.id);
  const rounds = state.rounds.filter((round) => courseIds.includes(round.course_id));

  const runningCourses = courses.filter((course) => ["ready", "running"].includes(course.status)).length;
  const completedRounds = rounds.filter((round) => round.status === "completed");

  const totalParticipants = completedRounds.reduce((sum, round) => sum + (Number(round.participant_count) || 0), 0);
  const satisfactionRows = completedRounds
    .map((round) => Number(round.satisfaction))
    .filter((value) => Number.isFinite(value) && value > 0);

  const avgSatisfaction = satisfactionRows.length
    ? satisfactionRows.reduce((sum, value) => sum + value, 0) / satisfactionRows.length
    : null;

  const activeMembers = Math.max(state.members.length, 1);
  const rrItems = buildAllRRItems(["ready", "running"]);

  qs("statTotalCourses").textContent = courses.length;
  qs("statRunningCourses").textContent = runningCourses;
  qs("statTotalRounds").textContent = rounds.length;
  qs("statTotalParticipants").textContent = totalParticipants;
  qs("statAvgSatisfaction").textContent = avgSatisfaction === null ? "-" : avgSatisfaction.toFixed(2);
  qs("statAvgWorkload").textContent = (rrItems.length / activeMembers).toFixed(1);
}

function renderViews() {
  ["timeline", "kanban", "rr", "logs"].forEach((view) => {
    qs(`${view}View`).classList.toggle("hidden", state.currentView !== view);
  });

  if (state.currentView === "timeline") renderTimeline();
  if (state.currentView === "kanban") renderKanban();
  if (state.currentView === "rr") renderRR();
  if (state.currentView === "logs") renderLogs();
}

function renderTimeline() {
  const container = qs("timelineView");
  const courses = getFilteredCourses().sort(sortCourseByDate);

  if (!courses.length) {
    container.innerHTML = emptyBox("표시할 프로젝트가 없습니다.");
    return;
  }

  let html = `
    <div class="timeline-table">
      <div class="timeline-head">
        <div>프로젝트</div>
        ${Array.from({ length: 12 }, (_, index) => `<div>${index + 1}월</div>`).join("")}
      </div>
  `;

  courses.forEach((course) => {
    const startMonth = getCourseStartMonth(course) || 1;
    const endMonth = getCourseEndMonth(course) || startMonth;

    html += `
      <div class="timeline-row" onclick="openCourseModalById('${course.id}')">
        <div>
          <strong>${escapeHtml(course.course_name)}</strong><br>
          <span class="rr-sub">${statusText(course.status)} · ${escapeHtml(course.client_name || "고객사 미정")}</span>
        </div>
        ${Array.from({ length: 12 }, (_, index) => {
          const month = index + 1;
          const active = month >= startMonth && month <= endMonth;
          return `<div class="timeline-cell ${active ? "active" : ""}">${active ? "●" : ""}</div>`;
        }).join("")}
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderKanban() {
  const container = qs("kanbanView");
  const courses = getFilteredCourses();
  const statuses = ["planning", "ready", "running", "completed"];

  container.innerHTML = `
    <div class="kanban-board">
      ${statuses.map((status) => {
        const list = courses.filter((course) => course.status === status);
        return `
          <section class="kanban-column">
            <h3>${STATUS_LABELS[status]} <span class="chip">${list.length}</span></h3>
            ${list.length ? list.map(renderCourseMiniCard).join("") : emptyBox("배정된 프로젝트가 없습니다.")}
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderCourseMiniCard(course) {
  const rounds = getRoundsByCourseId(course.id);
  const totalCheckCount = getChecklistRows(course.id, null, "course").length;
  const doneCheckCount = getChecklistRows(course.id, null, "course").filter((row) => row.is_done).length;
  const progress = totalCheckCount ? Math.round((doneCheckCount / totalCheckCount) * 100) : 0;

  const business = getMemberShortName(course.business_manager_id);
  const pm = getMemberShortName(course.main_manager_id);
  const pl = getMemberShortName(course.sub_manager1_id);

  const periodText = makeDateLabel(course.start_date_ymd, course.end_date_ymd) || "-";
  const projectTypeText = PROJECT_TYPE_LABELS[course.project_type] || "유형 미정";
  const budgetText = course.expected_budget ? `₩ ${Number(course.expected_budget).toLocaleString()}` : "";

  return `
    <article class="course-card">
      <div class="course-card-top">
        <span>${escapeHtml(course.client_name || "고객사 미정")} · ${escapeHtml(projectTypeText)}</span>
        <span>${escapeHtml(periodText)}</span>
      </div>

      <h4>${escapeHtml(course.course_name)}</h4>

      <div class="course-meta">
        <span class="chip primary">${statusText(course.status)}</span>
        <span class="chip">${escapeHtml(course.region || "미정")}</span>
        ${course.location_detail ? `<span class="chip">${escapeHtml(course.location_detail)}</span>` : ""}
        ${budgetText ? `<span class="chip">${escapeHtml(budgetText)}</span>` : ""}
      </div>

      <div class="rr-sub">
        사업 ${escapeHtml(business || "-")} · PM ${escapeHtml(pm || "-")} · PL ${escapeHtml(pl || "-")}
      </div>

      <div class="progress-bar">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>
      <div class="rr-sub">프로젝트 체크리스트 ${doneCheckCount}/${totalCheckCount} (${progress}%)</div>

      <div class="round-mini-list">
        ${rounds.length ? rounds.slice(0, 3).map((round) => `
          <div class="round-mini">
            <strong>${round.round_no}차 ${escapeHtml(round.round_name || "")}</strong><br>
            ${escapeHtml(round.date_label || makeDateLabel(round.start_date_ymd, round.end_date_ymd) || "-")}
            ${round.venue ? ` · ${escapeHtml(round.venue)}` : ""}
          </div>
        `).join("") : `<div class="round-mini">등록된 차수 없음</div>`}
        ${rounds.length > 3 ? `<div class="round-mini">외 ${rounds.length - 3}개 차수</div>` : ""}
      </div>

      <div class="card-actions">
        <button type="button" class="btn ghost" onclick="openCourseModalById('${course.id}')">프로젝트 열기</button>
      </div>
    </article>
  `;
}

function renderRR() {
  const container = qs("rrView");
  const activeStatuses = ["ready", "running"];
  const completedStatuses = ["completed"];

  let html = `<div class="rr-grid">`;

  state.members.forEach((member) => {
    const currentItems = buildRRItemsForMember(member.id, activeStatuses);
    const completedItems = buildRRItemsForMember(member.id, completedStatuses);
    const businessCount = currentItems.filter((item) => item.roleLabel === "사업담당자").length;
    const pmCount = currentItems.filter((item) => item.roleLabel === "운영PM").length;
    const plCount = currentItems.filter((item) => item.roleLabel === "운영 PL").length;
    const fieldCount = currentItems.filter((item) => item.roleLabel === "현장 운영").length;
    const supportCount = currentItems.filter((item) => item.roleLabel === "운영 지원").length;

    html += `
      <article class="rr-card">
        <h3>${escapeHtml(member.name)}</h3>
        <div class="rr-sub">${escapeHtml(member.position || "-")}</div>

        <div class="rr-counts">
          <span class="chip primary">${businessCount} 사업</span>
          <span class="chip primary">${pmCount} PM</span>
          <span class="chip primary">${plCount} PL</span>
          <span class="chip">${fieldCount} 현장</span>
          <span class="chip">${supportCount} 지원</span>
        </div>

        <p class="rr-sub">담당자별 프로젝트는 세부 차수 기준으로 표시됩니다.</p>

        ${currentItems.length ? currentItems.map(renderRRItem).join("") : `<div class="rr-item">현재 준비중/운영중인 담당 차수 없음</div>`}

        <div class="rr-sub" style="margin-top:12px;">완료 이력 ${completedItems.length}건</div>
      </article>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderRRItem(item) {
  return `
    <div class="rr-item">
      <strong>${escapeHtml(item.title)}</strong>
      <span class="chip">${escapeHtml(item.roleLabel)}</span>
      <span class="rr-sub">${escapeHtml(item.period)} · ${statusText(item.status)}</span>
    </div>
  `;
}

function renderLogs() {
  const container = qs("logsView");

  if (!state.logs.length) {
    container.innerHTML = emptyBox("최근 이력이 없습니다.");
    return;
  }

  container.innerHTML = `
    <div class="log-list">
      ${state.logs.map((log) => `
        <article class="log-item">
          <strong>${escapeHtml(log.target_type || "-")} · ${escapeHtml(log.action_type || "-")}</strong>
          <div class="rr-sub">${formatDateTime(log.created_at)} · 수정자 ${escapeHtml(getMemberName(log.changed_by) || "-")}</div>
          <p>${escapeHtml(log.change_summary || "")}</p>
        </article>
      `).join("")}
    </div>
  `;
}

// ---------------------------------------------------------
// 프로젝트 등록 / 수정
// ---------------------------------------------------------

window.openCourseModalById = async function (courseId) {
  const course = getCourseById(courseId);
  openCourseModal(course);
};

async function openCourseModal(course = null) {
  qs("courseForm").reset();

  const isEdit = !!course;
  state.selectedCourseId = course?.id || "";

  qs("courseModalTitle").textContent = isEdit ? `[수정] ${course.course_name}` : "신규 프로젝트 등록";
  qs("hideCourseBtn").classList.toggle("hidden", !isEdit);
  qs("courseInnerManageArea").classList.toggle("hidden", !isEdit);
  qs("courseChecklistSection").classList.toggle("hidden", !isEdit);

  qs("courseId").value = course?.id || "";
  qs("courseName").value = course?.course_name || "";
  qs("clientName").value = course?.client_name || "";
  qs("projectType").value = course?.project_type || "";
  qs("targetAudience").value = course?.target_audience || "";
  qs("courseStatus").value = course?.status || "planning";
  qs("expectedBudget").value = course?.expected_budget || "";

  qs("startDateYmd").value = course?.start_date_ymd || "";
  qs("endDateYmd").value = course?.end_date_ymd || "";
  qs("region").value = course?.region || "미정";
  qs("locationDetail").value = course?.location_detail || "";

  qs("businessManager").value = course?.business_manager_id || "";
  qs("mainManager").value = course?.main_manager_id || "";
  qs("subManager1").value = course?.sub_manager1_id || "";

  qs("courseNotes").value = course?.notes || "";

  if (isEdit) {
    qs("quickRoundNo").value = getNextRoundNo(course.id);
    qs("quickRoundName").value = "";
    qs("quickRoundStatus").value = "planning";

    renderCourseModalRounds(course.id);
    await ensureChecklistStatuses(course.id, null, "course");
    renderChecklist(course.id, null, "courseChecklistArea", "course");
  }

  openModal("courseModal");
}

async function saveCourse(event) {
  event.preventDefault();

  const id = qs("courseId").value;
  const startDate = qs("startDateYmd").value.trim();
  const endDate = qs("endDateYmd").value.trim();

  if (startDate && !isYymmdd(startDate)) {
    alert("프로젝트 시작일은 YYMMDD 6자리로 입력해주세요.\n예: 260704");
    return;
  }

  if (endDate && !isYymmdd(endDate)) {
    alert("프로젝트 종료일은 YYMMDD 6자리로 입력해주세요.\n예: 260705");
    return;
  }

  const payload = {
    course_name: qs("courseName").value.trim(),
    client_name: nullIfEmpty(qs("clientName").value.trim()),
    project_type: nullIfEmpty(qs("projectType").value),
    target_audience: nullIfEmpty(qs("targetAudience").value.trim()),
    status: qs("courseStatus").value || "planning",
    expected_budget: toNumberOrNull(qs("expectedBudget").value),
    start_date_ymd: nullIfEmpty(startDate),
    end_date_ymd: nullIfEmpty(endDate),
    start_month: getMonthFromYmd(startDate),
    end_month: getMonthFromYmd(endDate),
    region: qs("region").value || "미정",
    location_detail: nullIfEmpty(qs("locationDetail").value.trim()),
    business_manager_id: nullIfEmpty(qs("businessManager").value),
    main_manager_id: nullIfEmpty(qs("mainManager").value),
    sub_manager1_id: nullIfEmpty(qs("subManager1").value),
    sub_manager2_id: null,
    sub_manager3_id: null,
    support_manager_ids: [],
    notes: nullIfEmpty(qs("courseNotes").value.trim()),
    updated_by: nullIfEmpty(state.currentUserId),
  };

  if (!payload.course_name) {
    alert("프로젝트명을 입력해주세요.");
    return;
  }

  try {
    setSyncStatus("프로젝트 저장 중...");

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

    const savedCourse = response.data;

    await insertLog({
      target_type: "프로젝트",
      course_id: savedCourse.id,
      action_type: actionType,
      change_summary: `${payload.course_name} ${actionType}`,
    });

    await loadAll();

    state.selectedCourseId = savedCourse.id;

    if (!id) {
      closeModal("courseModal");
      alert("프로젝트가 등록되었습니다.\n다시 프로젝트를 열면 차수와 체크리스트를 관리할 수 있습니다.");
    } else {
      await openCourseModal(getCourseById(savedCourse.id));
      alert("프로젝트 정보와 담당자 배정이 저장되었습니다.");
    }

    setSyncStatus(`저장 완료 · ${formatNow()}`);
  } catch (error) {
    console.error(error);
    setSyncStatus("저장 오류");
    alert("프로젝트 저장 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
}

async function hideCurrentCourse() {
  const id = qs("courseId").value;
  if (!id) return;

  if (!confirm("이 프로젝트는 DB에 남고 화면에서만 숨김 처리됩니다.\n진행할까요?")) return;

  try {
    const course = getCourseById(id);
    const response = await db
      .from("courses")
      .update({ is_active: false, updated_by: nullIfEmpty(state.currentUserId) })
      .eq("id", id);

    throwIfError(response);

    await insertLog({
      target_type: "프로젝트",
      course_id: id,
      action_type: "숨김처리",
      change_summary: `${course?.course_name || "프로젝트"} 숨김 처리`,
    });

    closeModal("courseModal");
    await loadAll();
  } catch (error) {
    alert("숨김 처리 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
}

// ---------------------------------------------------------
// 차수 관리
// ---------------------------------------------------------

function renderCourseModalRounds(courseId) {
  const container = qs("courseModalRoundList");
  const rounds = getRoundsByCourseId(courseId);

  if (!rounds.length) {
    container.innerHTML = emptyBox("등록된 차수가 없습니다.");
    return;
  }

  container.innerHTML = `
    <table class="round-table">
      <thead>
        <tr>
          <th>차수</th>
          <th>세부 과정명</th>
          <th>일정</th>
          <th>상태</th>
          <th>장소</th>
          <th>현장/지원</th>
          <th>실적</th>
          <th>관리</th>
        </tr>
      </thead>
      <tbody>
        ${rounds.map((round) => `
          <tr>
            <td>${round.round_no}차</td>
            <td>${escapeHtml(round.round_name || "-")}</td>
            <td>${escapeHtml(round.date_label || makeDateLabel(round.start_date_ymd, round.end_date_ymd) || "-")}</td>
            <td>${statusBadge(round.status)}</td>
            <td>${escapeHtml(round.venue || "-")}</td>
            <td>
              현장 ${escapeHtml(getMemberNames(round.field_manager_ids).join(", ") || "-")}<br>
              지원 ${escapeHtml(getMemberNames(round.round_support_manager_ids).join(", ") || "-")}
            </td>
            <td>인원 ${round.participant_count ?? "-"} / 만족도 ${round.satisfaction ?? "-"}</td>
            <td>
              <div class="round-actions">
                <button type="button" class="btn ghost" onclick="openRoundModal('${round.id}')">수정</button>
                <button type="button" class="btn ghost" onclick="duplicateRound('${round.id}')">복사</button>
                <button type="button" class="btn success" onclick="openCompleteModal('${round.id}')">완료</button>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function quickAddRound() {
  const courseId = qs("courseId").value;
  if (!courseId) {
    alert("먼저 프로젝트를 저장해주세요.");
    return;
  }

  const roundNo = Number(qs("quickRoundNo").value || getNextRoundNo(courseId));

  const payload = {
    course_id: courseId,
    round_no: roundNo,
    round_name: nullIfEmpty(qs("quickRoundName").value.trim()),
    status: qs("quickRoundStatus").value || "planning",
    field_manager_ids: [],
    round_support_manager_ids: [],
    updated_by: nullIfEmpty(state.currentUserId),
  };

  try {
    setSyncStatus("차수 추가 중...");

    const response = await db.from("rounds").insert(payload).select().single();
    throwIfError(response);

    const round = response.data;

    await ensureChecklistStatuses(courseId, round.id, "round");

    await insertLog({
      target_type: "차수",
      course_id: courseId,
      round_id: round.id,
      action_type: "신규등록",
      change_summary: `${roundNo}차 신규 등록`,
    });

    await loadAll();

    state.selectedCourseId = courseId;
    qs("quickRoundNo").value = getNextRoundNo(courseId);
    qs("quickRoundName").value = "";
    qs("quickRoundStatus").value = "planning";

    renderCourseModalRounds(courseId);
    renderStats();
    renderViews();

    setSyncStatus(`차수 추가 완료 · ${formatNow()}`);
  } catch (error) {
    console.error(error);
    setSyncStatus("차수 추가 오류");
    alert("차수 추가 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
}

window.openRoundModal = async function (roundId) {
  const round = getRoundById(roundId);
  if (!round) {
    alert("차수를 찾을 수 없습니다.");
    return;
  }

  state.selectedRoundId = round.id;
  state.selectedCourseId = round.course_id;
  state.selectedRoundFieldManagerIds = arrayValue(round.field_manager_ids);
  state.selectedRoundSupportManagerIds = arrayValue(round.round_support_manager_ids);

  qs("roundForm").reset();
  qs("roundModalTitle").textContent = `${round.round_no}차 수정`;

  qs("roundId").value = round.id;
  qs("roundCourseId").value = round.course_id;
  qs("roundNo").value = round.round_no || "";
  qs("roundName").value = round.round_name || "";
  qs("roundStartDateYmd").value = round.start_date_ymd || "";
  qs("roundEndDateYmd").value = round.end_date_ymd || "";
  qs("roundDateLabel").value = round.date_label || "";
  qs("roundStatus").value = round.status || "planning";
  qs("roundVenue").value = round.venue || "";
  qs("roundRemarks").value = round.remarks || "";
  qs("roundMemo").value = round.round_memo || "";

  qs("operationHours").value = round.operation_hours || "";
  qs("participantCount").value = round.participant_count || "";
  qs("satisfaction").value = round.satisfaction || "";
  qs("instructorSatisfaction").value = round.instructor_satisfaction || "";
  qs("operationSatisfaction").value = round.operation_satisfaction || "";

  renderRoundFieldManagerTags();
  renderRoundSupportManagerTags();
  toggleCompletedFields();

  await ensureChecklistStatuses(round.course_id, round.id, "round");
  renderChecklist(round.course_id, round.id, "roundChecklistArea", "round");

  openModal("roundModal");
};

async function saveRound(event) {
  event.preventDefault();

  const id = qs("roundId").value;
  const courseId = qs("roundCourseId").value;
  const startDate = qs("roundStartDateYmd").value.trim();
  const endDate = qs("roundEndDateYmd").value.trim();

  if (startDate && !isYymmdd(startDate)) {
    alert("교육 시작일은 YYMMDD 6자리로 입력해주세요.");
    return;
  }

  if (endDate && !isYymmdd(endDate)) {
    alert("교육 종료일은 YYMMDD 6자리로 입력해주세요.");
    return;
  }

  const payload = {
    round_no: Number(qs("roundNo").value),
    round_name: nullIfEmpty(qs("roundName").value.trim()),
    start_date_ymd: nullIfEmpty(startDate),
    end_date_ymd: nullIfEmpty(endDate),
    date_label: nullIfEmpty(qs("roundDateLabel").value.trim()),
    status: qs("roundStatus").value || "planning",
    venue: nullIfEmpty(qs("roundVenue").value.trim()),
    remarks: nullIfEmpty(qs("roundRemarks").value.trim()),
    round_memo: nullIfEmpty(qs("roundMemo").value.trim()),
    field_manager_ids: state.selectedRoundFieldManagerIds || [],
    round_support_manager_ids: state.selectedRoundSupportManagerIds || [],
    operation_hours: toNumberOrNull(qs("operationHours").value),
    participant_count: toNumberOrNull(qs("participantCount").value),
    satisfaction: toNumberOrNull(qs("satisfaction").value),
    instructor_satisfaction: toNumberOrNull(qs("instructorSatisfaction").value),
    operation_satisfaction: toNumberOrNull(qs("operationSatisfaction").value),
    updated_by: nullIfEmpty(state.currentUserId),
  };

  if (!payload.round_no) {
    alert("차수를 입력해주세요.");
    return;
  }

  try {
    setSyncStatus("차수 저장 중...");

    const response = await db.from("rounds").update(payload).eq("id", id).select().single();
    throwIfError(response);

    await insertLog({
      target_type: "차수",
      course_id: courseId,
      round_id: id,
      action_type: "수정",
      change_summary: `${payload.round_no}차 정보 수정`,
    });

    await loadAll();

    state.selectedCourseId = courseId;
    state.selectedRoundId = id;

    renderCourseModalRounds(courseId);
    renderStats();
    renderViews();

    setSyncStatus(`차수 저장 완료 · ${formatNow()}`);
    alert("차수 정보가 저장되었습니다.");
  } catch (error) {
    console.error(error);
    setSyncStatus("차수 저장 오류");
    alert("차수 저장 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
}

window.duplicateRound = async function (roundId) {
  const sourceRound = getRoundById(roundId);

  if (!sourceRound) {
    alert("복사할 차수를 찾을 수 없습니다.");
    return;
  }

  const project = getCourseById(sourceRound.course_id);

  if (!project) {
    alert("차수가 연결된 프로젝트를 찾을 수 없습니다.");
    return;
  }

  if (!confirm(`${project.course_name}의 ${sourceRound.round_no}차를 복사하시겠습니까?\n\n프로젝트 담당자 정보는 변경되지 않습니다.\n일정과 운영 실적은 복사하지 않습니다.`)) {
    return;
  }

  try {
    setSyncStatus("차수 복사 중...");

    const nextNo = getNextRoundNo(sourceRound.course_id);

    const payload = {
      course_id: sourceRound.course_id,
      round_no: nextNo,
      round_name: sourceRound.round_name || null,
      status: "planning",
      venue: sourceRound.venue || null,
      remarks: sourceRound.remarks || null,
      round_memo: sourceRound.round_memo || null,
      field_manager_ids: arrayValue(sourceRound.field_manager_ids),
      round_support_manager_ids: arrayValue(sourceRound.round_support_manager_ids),
      start_date_ymd: null,
      end_date_ymd: null,
      date_label: null,
      operation_hours: null,
      participant_count: null,
      satisfaction: null,
      instructor_satisfaction: null,
      operation_satisfaction: null,
      completed_at: null,
      updated_by: nullIfEmpty(state.currentUserId),
    };

    const insertRes = await db.from("rounds").insert(payload).select().single();
    throwIfError(insertRes);

    const newRound = insertRes.data;

    await copyRoundChecklistStatuses(sourceRound.course_id, sourceRound.id, newRound.id);

    await insertLog({
      target_type: "차수",
      course_id: sourceRound.course_id,
      round_id: newRound.id,
      action_type: "복사",
      change_summary: `${sourceRound.round_no}차를 ${nextNo}차로 복사`,
    });

    await loadAll();

    state.selectedCourseId = sourceRound.course_id;
    state.selectedRoundId = newRound.id;

    renderCourseModalRounds(sourceRound.course_id);
    renderStats();
    renderViews();

    setSyncStatus(`차수 복사 완료 · ${formatNow()}`);

    alert(`${nextNo}차가 복사되었습니다.\n\n프로젝트 담당자 정보는 변경하지 않았습니다.\n일정과 운영 실적은 새 차수에서 다시 입력해주세요.`);
  } catch (error) {
    console.error(error);
    setSyncStatus("차수 복사 오류");
    alert("차수 복사 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
};

async function copyRoundChecklistStatuses(courseId, sourceRoundId, newRoundId) {
  const sourceRows = getChecklistRows(courseId, sourceRoundId, "round");

  if (!sourceRows.length) {
    await ensureChecklistStatuses(courseId, newRoundId, "round");
    return;
  }

  const payload = sourceRows.map((row) => ({
    course_id: courseId,
    round_id: newRoundId,
    checklist_item_id: row.checklist_item_id,
    is_done: false,
    is_hidden: !!row.is_hidden,
    sort_order: Number(row.sort_order) || 9999,
    updated_by: nullIfEmpty(state.currentUserId),
  }));

  const response = await db.from("checklist_statuses").insert(payload);
  throwIfError(response);
}

async function hideCurrentRound() {
  const id = qs("roundId").value;
  const courseId = qs("roundCourseId").value;

  if (!id) return;
  if (!confirm("이 차수는 DB에 남고 화면에서만 숨김 처리됩니다.\n진행할까요?")) return;

  try {
    const response = await db
      .from("rounds")
      .update({ is_active: false, updated_by: nullIfEmpty(state.currentUserId) })
      .eq("id", id);

    throwIfError(response);

    await insertLog({
      target_type: "차수",
      course_id: courseId,
      round_id: id,
      action_type: "숨김처리",
      change_summary: "차수 숨김 처리",
    });

    closeModal("roundModal");
    await loadAll();

    if (qs("courseId").value === courseId) {
      renderCourseModalRounds(courseId);
    }
  } catch (error) {
    alert("차수 숨김 처리 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
}

// ---------------------------------------------------------
// 운영 인력 태그
// ---------------------------------------------------------

function addRoundFieldManagerTag() {
  const memberId = qs("roundFieldManagerSelect").value;
  if (!memberId) return;

  if (!state.selectedRoundFieldManagerIds.includes(memberId)) {
    state.selectedRoundFieldManagerIds.push(memberId);
  }

  qs("roundFieldManagerSelect").value = "";
  renderRoundFieldManagerTags();
}

function addRoundSupportManagerTag() {
  const memberId = qs("roundSupportManagerSelect").value;
  if (!memberId) return;

  if (!state.selectedRoundSupportManagerIds.includes(memberId)) {
    state.selectedRoundSupportManagerIds.push(memberId);
  }

  qs("roundSupportManagerSelect").value = "";
  renderRoundSupportManagerTags();
}

function renderRoundFieldManagerTags() {
  qs("roundFieldManagerTags").innerHTML = renderManagerTags(
    state.selectedRoundFieldManagerIds,
    "removeRoundFieldManagerTag"
  );
}

function renderRoundSupportManagerTags() {
  qs("roundSupportManagerTags").innerHTML = renderManagerTags(
    state.selectedRoundSupportManagerIds,
    "removeRoundSupportManagerTag"
  );
}

window.removeRoundFieldManagerTag = function (memberId) {
  state.selectedRoundFieldManagerIds = state.selectedRoundFieldManagerIds.filter((id) => id !== memberId);
  renderRoundFieldManagerTags();
};

window.removeRoundSupportManagerTag = function (memberId) {
  state.selectedRoundSupportManagerIds = state.selectedRoundSupportManagerIds.filter((id) => id !== memberId);
  renderRoundSupportManagerTags();
};

function renderManagerTags(ids, removeFnName) {
  if (!ids || !ids.length) return `<span class="rr-sub">선택된 담당자가 없습니다.</span>`;

  return ids.map((id) => `
    <span class="tag">
      ${escapeHtml(getMemberName(id) || "알 수 없음")}
      <button type="button" onclick="${removeFnName}('${id}')">×</button>
    </span>
  `).join("");
}

// ---------------------------------------------------------
// 교육 완료
// ---------------------------------------------------------

function toggleCompletedFields() {
  qs("completedFields").classList.toggle("hidden", qs("roundStatus").value !== "completed");
}

window.openCompleteModal = function (roundId) {
  const round = getRoundById(roundId);
  if (!round) {
    alert("차수를 찾을 수 없습니다.");
    return;
  }

  qs("completeForm").reset();
  qs("completeRoundId").value = round.id;
  qs("completeParticipantCount").value = round.participant_count || "";
  qs("completeOperationHours").value = round.operation_hours || "";
  qs("completeSatisfaction").value = round.satisfaction || "";
  qs("completeInstructorSatisfaction").value = round.instructor_satisfaction || "";
  qs("completeOperationSatisfaction").value = round.operation_satisfaction || "";
  qs("completeRemarks").value = round.remarks || "";

  openModal("completeModal");
};

async function submitCompleteRound(event) {
  event.preventDefault();

  const roundId = qs("completeRoundId").value;
  const round = getRoundById(roundId);

  if (!round) {
    alert("차수를 찾을 수 없습니다.");
    return;
  }

  const payload = {
    status: "completed",
    participant_count: toNumberOrNull(qs("completeParticipantCount").value),
    operation_hours: toNumberOrNull(qs("completeOperationHours").value),
    satisfaction: toNumberOrNull(qs("completeSatisfaction").value),
    instructor_satisfaction: toNumberOrNull(qs("completeInstructorSatisfaction").value),
    operation_satisfaction: toNumberOrNull(qs("completeOperationSatisfaction").value),
    remarks: nullIfEmpty(qs("completeRemarks").value.trim()),
    completed_at: new Date().toISOString(),
    updated_by: nullIfEmpty(state.currentUserId),
  };

  try {
    const response = await db.from("rounds").update(payload).eq("id", roundId).select().single();
    throwIfError(response);

    await insertLog({
      target_type: "차수",
      course_id: round.course_id,
      round_id: roundId,
      action_type: "교육완료",
      change_summary: `${round.round_no}차 교육 완료 처리`,
    });

    closeModal("completeModal");
    await loadAll();

    if (qs("courseId").value === round.course_id) {
      renderCourseModalRounds(round.course_id);
    }

    alert("교육 완료 처리되었습니다.");
  } catch (error) {
    alert("교육 완료 처리 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
}

// ---------------------------------------------------------
// 체크리스트
// ---------------------------------------------------------

async function ensureChecklistStatuses(courseId, roundId, scope) {
  const items = getChecklistItemsForScope(scope, courseId, roundId);
  const existingRows = getChecklistRows(courseId, roundId, scope);
  const existingItemIds = existingRows.map((row) => row.checklist_item_id);

  const missingItems = items.filter((item) => !existingItemIds.includes(item.id));

  if (!missingItems.length) return;

  const payload = missingItems.map((item) => ({
    course_id: courseId,
    round_id: roundId || null,
    checklist_item_id: item.id,
    is_done: false,
    is_hidden: false,
    sort_order: Number(item.sort_order) || 9999,
    updated_by: nullIfEmpty(state.currentUserId),
  }));

  const response = await db.from("checklist_statuses").insert(payload);
  throwIfError(response);

  const reload = await db.from("checklist_statuses").select("*");
  throwIfError(reload);
  state.checklistStatuses = reload.data || [];
}

function getChecklistItemsForScope(scope, courseId, roundId) {
  if (scope === "course") {
    return state.checklistItems
      .filter((item) => item.scope === "course")
      .filter((item) => PROJECT_CHECKLIST_CODES.includes(item.code))
      .sort((a, b) => (Number(a.sort_order) || 9999) - (Number(b.sort_order) || 9999));
  }

  return state.checklistItems
    .filter((item) => item.scope === "round")
    .filter((item) => !item.course_id || item.course_id === courseId)
    .filter((item) => !item.round_id || item.round_id === roundId)
    .sort((a, b) => (Number(a.sort_order) || 9999) - (Number(b.sort_order) || 9999));
}

function getChecklistRows(courseId, roundId, scope) {
  const items = getChecklistItemsForScope(scope, courseId, roundId);
  const itemIds = items.map((item) => item.id);

  return state.checklistStatuses
    .filter((row) => row.course_id === courseId)
    .filter((row) => normalizeId(row.round_id) === normalizeId(roundId))
    .filter((row) => itemIds.includes(row.checklist_item_id))
    .map((row) => ({
      ...row,
      item: items.find((item) => item.id === row.checklist_item_id),
    }))
    .filter((row) => row.item)
    .sort((a, b) => (Number(a.sort_order) || Number(a.item.sort_order) || 9999) - (Number(b.sort_order) || Number(b.item.sort_order) || 9999));
}

function renderChecklist(courseId, roundId, areaId, scope) {
  const area = qs(areaId);
  const rows = getChecklistRows(courseId, roundId, scope).filter((row) => !row.is_hidden);

  if (!rows.length) {
    area.innerHTML = emptyBox("표시할 체크리스트가 없습니다.");
    return;
  }

  area.innerHTML = `
    <div class="checklist-area">
      ${rows.map((row) => `
        <label class="checklist-item ${row.is_done ? "done" : ""}">
          <input type="checkbox" ${row.is_done ? "checked" : ""} onchange="toggleChecklistDone('${row.id}', this.checked, '${scope}')" />
          <span>${escapeHtml(row.item.title)}</span>
        </label>
      `).join("")}
    </div>
  `;
}

window.toggleChecklistDone = async function (statusId, checked, scope) {
  try {
    const response = await db
      .from("checklist_statuses")
      .update({
        is_done: checked,
        updated_by: nullIfEmpty(state.currentUserId),
      })
      .eq("id", statusId);

    throwIfError(response);

    const target = state.checklistStatuses.find((row) => row.id === statusId);
    if (target) target.is_done = checked;

    if (scope === "course") {
      renderChecklist(state.selectedCourseId, null, "courseChecklistArea", "course");
    } else {
      renderChecklist(state.selectedCourseId, state.selectedRoundId, "roundChecklistArea", "round");
    }

    renderStats();
    renderViews();
  } catch (error) {
    alert("체크리스트 저장 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
};

window.openChecklistEditor = function (scope) {
  state.checklistEditorScope = scope;

  const isCourse = scope === "course";
  qs("checklistModalTitle").textContent = isCourse ? "프로젝트 체크리스트 수정하기" : "차수별 체크리스트 수정하기";
  qs("checklistModalDesc").textContent = isCourse
    ? "프로젝트 체크리스트는 사업단 공통 항목 3개만 사용합니다."
    : "현재 차수에만 적용되는 운영 체크리스트를 관리합니다.";

  qs("customChecklistAddSection").classList.toggle("hidden", isCourse);

  renderChecklistEditList(scope);
  openModal("checklistModal");
};

function renderChecklistEditList(scope) {
  const courseId = state.selectedCourseId;
  const roundId = scope === "round" ? state.selectedRoundId : null;
  const list = qs("checklistEditList");

  const rows = getChecklistRows(courseId, roundId, scope);

  if (!rows.length) {
    list.innerHTML = emptyBox("체크리스트 항목이 없습니다.");
    return;
  }

  list.innerHTML = rows.map((row, index) => {
    const isFixedProjectItem = scope === "course";
    const canDelete = scope === "round" && row.item.is_custom;

    return `
      <div class="checklist-edit-row">
        <div class="checklist-edit-order">${index + 1}</div>
        <div>
          <div class="checklist-edit-title">${escapeHtml(row.item.title)}</div>
          <div class="checklist-edit-meta">
            ${row.is_hidden ? "숨김" : "표시 중"} · ${row.is_done ? "완료" : "미완료"}
            ${isFixedProjectItem ? " · 사업단 고정 항목" : ""}
          </div>
        </div>
        <button type="button" class="btn ghost" onclick="moveChecklistStatus('${row.id}', -1)">↑</button>
        <button type="button" class="btn ghost" onclick="moveChecklistStatus('${row.id}', 1)">↓</button>
        ${
          canDelete
            ? `<button type="button" class="btn danger" onclick="deleteCustomChecklistItem('${row.id}', '${row.item.id}')">삭제</button>`
            : `<button type="button" class="btn ghost" onclick="toggleChecklistHidden('${row.id}', ${!row.is_hidden})">${row.is_hidden ? "표시" : "숨김"}</button>`
        }
      </div>
    `;
  }).join("");
}

async function addCustomChecklistItem() {
  if (state.checklistEditorScope !== "round") {
    alert("프로젝트 체크리스트는 사업단 공통 항목으로 고정되어 있습니다.");
    return;
  }

  const title = qs("customChecklistTitle").value.trim();

  if (!title) {
    alert("추가할 항목을 입력해주세요.");
    return;
  }

  const courseId = state.selectedCourseId;
  const roundId = state.selectedRoundId;

  if (!courseId || !roundId) {
    alert("차수를 먼저 선택해주세요.");
    return;
  }

  try {
    const maxOrder = Math.max(
      0,
      ...getChecklistRows(courseId, roundId, "round").map((row) => Number(row.sort_order) || 0)
    );

    const itemRes = await db
      .from("checklist_items")
      .insert({
        title,
        code: "CUSTOM",
        scope: "round",
        course_id: courseId,
        round_id: roundId,
        is_custom: true,
        is_active: true,
        sort_order: maxOrder + 10,
        updated_by: nullIfEmpty(state.currentUserId),
      })
      .select()
      .single();

    throwIfError(itemRes);

    const statusRes = await db
      .from("checklist_statuses")
      .insert({
        course_id: courseId,
        round_id: roundId,
        checklist_item_id: itemRes.data.id,
        is_done: false,
        is_hidden: false,
        sort_order: maxOrder + 10,
        updated_by: nullIfEmpty(state.currentUserId),
      });

    throwIfError(statusRes);

    qs("customChecklistTitle").value = "";

    await loadAll();
    state.selectedCourseId = courseId;
    state.selectedRoundId = roundId;

    renderChecklist(courseId, roundId, "roundChecklistArea", "round");
    renderChecklistEditList("round");
  } catch (error) {
    alert("체크리스트 추가 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
}

window.toggleChecklistHidden = async function (statusId, hidden) {
  try {
    const response = await db
      .from("checklist_statuses")
      .update({
        is_hidden: hidden,
        updated_by: nullIfEmpty(state.currentUserId),
      })
      .eq("id", statusId);

    throwIfError(response);

    await loadAll();

    renderChecklistEditList(state.checklistEditorScope);

    if (state.checklistEditorScope === "course") {
      renderChecklist(state.selectedCourseId, null, "courseChecklistArea", "course");
    } else {
      renderChecklist(state.selectedCourseId, state.selectedRoundId, "roundChecklistArea", "round");
    }
  } catch (error) {
    alert("체크리스트 표시 상태 변경 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
};

window.moveChecklistStatus = async function (statusId, direction) {
  const scope = state.checklistEditorScope;
  const courseId = state.selectedCourseId;
  const roundId = scope === "round" ? state.selectedRoundId : null;
  const rows = getChecklistRows(courseId, roundId, scope);

  const index = rows.findIndex((row) => row.id === statusId);
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) return;

  const current = rows[index];
  const next = rows[nextIndex];

  const currentOrder = Number(current.sort_order) || Number(current.item.sort_order) || 9999;
  const nextOrder = Number(next.sort_order) || Number(next.item.sort_order) || 9999;

  try {
    const responses = await Promise.all([
      db.from("checklist_statuses").update({ sort_order: nextOrder }).eq("id", current.id),
      db.from("checklist_statuses").update({ sort_order: currentOrder }).eq("id", next.id),
    ]);

    responses.forEach(throwIfError);

    await loadAll();

    renderChecklistEditList(scope);

    if (scope === "course") {
      renderChecklist(courseId, null, "courseChecklistArea", "course");
    } else {
      renderChecklist(courseId, roundId, "roundChecklistArea", "round");
    }
  } catch (error) {
    alert("체크리스트 순서 변경 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
};

window.deleteCustomChecklistItem = async function (statusId, itemId) {
  if (!confirm("이 체크리스트 항목을 삭제하시겠습니까?")) return;

  try {
    const statusRes = await db.from("checklist_statuses").delete().eq("id", statusId);
    throwIfError(statusRes);

    const itemRes = await db.from("checklist_items").update({ is_active: false }).eq("id", itemId);
    throwIfError(itemRes);

    await loadAll();

    renderChecklistEditList("round");
    renderChecklist(state.selectedCourseId, state.selectedRoundId, "roundChecklistArea", "round");
  } catch (error) {
    alert("체크리스트 삭제 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
};

// ---------------------------------------------------------
// 담당자 관리
// ---------------------------------------------------------

function renderMemberList() {
  const list = qs("memberList");

  if (!state.members.length) {
    list.innerHTML = emptyBox("등록된 담당자가 없습니다.");
    return;
  }

  list.innerHTML = state.members.map((member) => `
    <div class="member-row">
      <div>
        <strong>${escapeHtml(member.name)}</strong>
        <div class="rr-sub">${escapeHtml(member.position || "-")}</div>
      </div>
      <span class="chip">순서 ${member.sort_order ?? "-"}</span>
      <button type="button" class="btn danger" onclick="hideMember('${member.id}')">숨김</button>
    </div>
  `).join("");
}

async function addMember() {
  const name = qs("newMemberName").value.trim();
  const position = qs("newMemberPosition").value.trim();
  const sortOrder = toNumberOrNull(qs("newMemberSortOrder").value);

  if (!name) {
    alert("이름을 입력해주세요.");
    return;
  }

  try {
    const response = await db
      .from("members")
      .insert({
        name,
        position: nullIfEmpty(position),
        sort_order: sortOrder || 999,
        is_active: true,
      })
      .select()
      .single();

    throwIfError(response);

    qs("newMemberName").value = "";
    qs("newMemberPosition").value = "";
    qs("newMemberSortOrder").value = "";

    await loadAll();
    renderMemberList();
  } catch (error) {
    alert("담당자 추가 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
}

window.hideMember = async function (memberId) {
  if (!confirm("해당 담당자를 숨김 처리하시겠습니까?")) return;

  try {
    const response = await db.from("members").update({ is_active: false }).eq("id", memberId);
    throwIfError(response);

    await loadAll();
    renderMemberList();
  } catch (error) {
    alert("담당자 숨김 처리 중 오류가 발생했습니다.\n\n" + getErrorMessage(error));
  }
};

// ---------------------------------------------------------
// 필터 / 조회 헬퍼
// ---------------------------------------------------------

function getFilteredCourses() {
  const keyword = qs("searchInput").value.trim().toLowerCase();
  const managerId = qs("managerFilter").value;
  const status = qs("statusFilter").value;
  const region = qs("regionFilter").value;

  return state.courses.filter((course) => {
    const text = [
      course.course_name,
      course.client_name,
      course.location_detail,
      course.region,
      PROJECT_TYPE_LABELS[course.project_type],
    ].join(" ").toLowerCase();

    const matchedKeyword = !keyword || text.includes(keyword);
    const matchedStatus = !status || course.status === status;
    const matchedRegion = !region || course.region === region;

    const projectManagerIds = [
      course.business_manager_id,
      course.main_manager_id,
      course.sub_manager1_id,
    ].filter(Boolean);

    const roundManagerIds = getRoundsByCourseId(course.id)
      .flatMap((round) => [
        ...arrayValue(round.field_manager_ids),
        ...arrayValue(round.round_support_manager_ids),
      ])
      .filter(Boolean);

    const managerIds = [...projectManagerIds, ...roundManagerIds];
    const matchedManager = !managerId || managerIds.includes(managerId);

    return matchedKeyword && matchedStatus && matchedRegion && matchedManager;
  });
}

function buildAllRRItems(statuses) {
  return state.members.flatMap((member) => buildRRItemsForMember(member.id, statuses));
}

function buildRRItemsForMember(memberId, statuses) {
  const items = [];

  state.courses
    .filter((course) => statuses.includes(course.status))
    .forEach((course) => {
      const rounds = getRoundsByCourseId(course.id);
      const targetRounds = rounds.length ? rounds : [null];

      targetRounds.forEach((round) => {
        const roundStatus = round?.status || course.status;
        if (!statuses.includes(roundStatus)) return;

        const title = round
          ? `${course.course_name} · ${round.round_no}차 ${round.round_name || ""}`
          : `${course.course_name} · 차수 미등록`;

        const period = round
          ? round.date_label || makeDateLabel(round.start_date_ymd, round.end_date_ymd) || "-"
          : makeDateLabel(course.start_date_ymd, course.end_date_ymd) || "-";

        if (course.business_manager_id === memberId) {
          items.push({ title, period, status: roundStatus, roleLabel: "사업담당자" });
        }

        if (course.main_manager_id === memberId) {
          items.push({ title, period, status: roundStatus, roleLabel: "운영PM" });
        }

        if (course.sub_manager1_id === memberId) {
          items.push({ title, period, status: roundStatus, roleLabel: "운영 PL" });
        }

        if (round && arrayValue(round.field_manager_ids).includes(memberId)) {
          items.push({ title, period, status: roundStatus, roleLabel: "현장 운영" });
        }

        if (round && arrayValue(round.round_support_manager_ids).includes(memberId)) {
          items.push({ title, period, status: roundStatus, roleLabel: "운영 지원" });
        }
      });
    });

  return items.sort((a, b) => String(a.period || "").localeCompare(String(b.period || "")));
}

function getCourseById(id) {
  return state.courses.find((course) => course.id === id) || null;
}

function getRoundById(id) {
  return state.rounds.find((round) => round.id === id) || null;
}

function getRoundsByCourseId(courseId) {
  return state.rounds
    .filter((round) => round.course_id === courseId)
    .sort((a, b) => Number(a.round_no || 0) - Number(b.round_no || 0));
}

function getNextRoundNo(courseId) {
  const rounds = getRoundsByCourseId(courseId);
  if (!rounds.length) return 1;
  return Math.max(...rounds.map((round) => Number(round.round_no) || 0)) + 1;
}

function getMemberName(id) {
  if (!id) return "";
  return state.members.find((member) => member.id === id)?.name || "";
}

function getMemberShortName(id) {
  const name = getMemberName(id);
  return name || "";
}

function getMemberNames(ids) {
  return arrayValue(ids).map(getMemberName).filter(Boolean);
}

function getCourseStartMonth(course) {
  return getMonthFromYmd(course.start_date_ymd) || Number(course.start_month) || null;
}

function getCourseEndMonth(course) {
  return getMonthFromYmd(course.end_date_ymd) || Number(course.end_month) || getCourseStartMonth(course);
}

function sortCourseByDate(a, b) {
  const dateA = a.start_date_ymd || "999999";
  const dateB = b.start_date_ymd || "999999";
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return String(a.course_name || "").localeCompare(String(b.course_name || ""));
}

// ---------------------------------------------------------
// 로그 / 기타 기능
// ---------------------------------------------------------

async function insertLog({ target_type, course_id = null, round_id = null, action_type, change_summary }) {
  try {
    const response = await db.from("activity_logs").insert({
      target_type,
      course_id,
      round_id,
      action_type,
      change_summary,
      changed_by: nullIfEmpty(state.currentUserId),
    });

    throwIfError(response);
  } catch (error) {
    console.warn("로그 저장 실패:", error);
  }
}

async function updateData() {
  await loadAll();
  alert("데이터를 다시 불러왔습니다.");
}

function downloadExcel() {
  const rows = [];

  state.courses.forEach((course) => {
    const rounds = getRoundsByCourseId(course.id);

    if (!rounds.length) {
      rows.push({
        프로젝트명: course.course_name,
        고객사: course.client_name || "",
        유형: PROJECT_TYPE_LABELS[course.project_type] || "",
        차수: "",
        세부과정명: "",
        상태: STATUS_LABELS[course.status] || course.status,
        사업담당자: getMemberName(course.business_manager_id),
        운영PM: getMemberName(course.main_manager_id),
        운영PL: getMemberName(course.sub_manager1_id),
        현장운영자: "",
        운영지원: "",
        교육인원: "",
        만족도: "",
      });
    }

    rounds.forEach((round) => {
      rows.push({
        프로젝트명: course.course_name,
        고객사: course.client_name || "",
        유형: PROJECT_TYPE_LABELS[course.project_type] || "",
        차수: round.round_no,
        세부과정명: round.round_name || "",
        상태: STATUS_LABELS[round.status] || round.status,
        사업담당자: getMemberName(course.business_manager_id),
        운영PM: getMemberName(course.main_manager_id),
        운영PL: getMemberName(course.sub_manager1_id),
        현장운영자: getMemberNames(round.field_manager_ids).join(", "),
        운영지원: getMemberNames(round.round_support_manager_ids).join(", "),
        교육인원: round.participant_count || "",
        만족도: round.satisfaction || "",
      });
    });
  });

  const csv = convertToCsv(rows);
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hri_hrd_ops_${formatDateFileName()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function convertToCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);

  const escapeCsv = (value) => {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  };

  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ].join("\n");
}

// ---------------------------------------------------------
// 공통 유틸
// ---------------------------------------------------------

function qs(id) {
  return document.getElementById(id);
}

function openModal(id) {
  qs(id).classList.remove("hidden");
}

function closeModal(id) {
  qs(id).classList.add("hidden");
}

function setSyncStatus(text) {
  qs("syncStatus").textContent = text;
}

function emptyBox(text) {
  return `<div class="empty-box">${escapeHtml(text)}</div>`;
}

function statusText(status) {
  return STATUS_LABELS[status] || status || "-";
}

function statusBadge(status) {
  const label = statusText(status);
  const className =
    status === "completed" ? "success" :
    status === "running" ? "primary" :
    status === "ready" ? "warning" :
    "";

  return `<span class="chip ${className}">${escapeHtml(label)}</span>`;
}

function makeDateLabel(start, end) {
  if (!start && !end) return "";
  if (start && end && start !== end) return `${formatYymmdd(start)}~${formatYymmdd(end)}`;
  return formatYymmdd(start || end);
}

function formatYymmdd(value) {
  if (!value) return "";
  const text = String(value);
  if (!/^\d{6}$/.test(text)) return text;
  return `${text.slice(0, 2)}.${text.slice(2, 4)}.${text.slice(4, 6)}`;
}

function getMonthFromYmd(value) {
  if (!value || !/^\d{6}$/.test(value)) return null;
  const month = Number(value.slice(2, 4));
  return month >= 1 && month <= 12 ? month : null;
}

function isYymmdd(value) {
  return /^\d{6}$/.test(value);
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullIfEmpty(value) {
  return value === "" || value === undefined ? null : value;
}

function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeId(value) {
  return value === null || value === undefined || value === "" ? null : value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function formatNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");

  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}

function formatDateFileName() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function getErrorMessage(error) {
  if (!error) return "알 수 없는 오류";
  if (error.message) return error.message;
  return JSON.stringify(error);
}
