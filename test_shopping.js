const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "shopping_list.html"), "utf8");

const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const results = [];

function check(name, cond, detail = "") {
  const icon = cond ? PASS : FAIL;
  console.log(`  ${icon} ${name}` + (detail ? `  (${detail})` : ""));
  results.push([name, cond]);
}

function makeDom(preload = null) {
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    url: "http://localhost/shopping_list.html",
    beforeParse(window) {
      if (preload) window.localStorage.setItem("shopping-list-v1", JSON.stringify(preload));
    },
  });
  return dom;
}

// 헬퍼: 입력 → 추가
function addItem(doc, text) {
  const inp = doc.getElementById("new-item");
  const btn = doc.getElementById("add-btn");
  inp.value = text;
  btn.dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles: true }));
}

function addItemEnter(doc, text) {
  const inp = doc.getElementById("new-item");
  inp.value = text;
  inp.dispatchEvent(
    new doc.defaultView.KeyboardEvent("keydown", { key: "Enter", bubbles: true })
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 1. 초기 상태
// ────────────────────────────────────────────────────────────────────────────
console.log("\n[1] 초기 상태");
{
  const { document: doc } = makeDom().window;
  check("빈 상태 메시지 표시", !!doc.querySelector(".empty"));
  check("헤더 요약 '항목 없음'", doc.getElementById("summary").textContent.includes("항목 없음"));
  check("아이템 0개", doc.querySelectorAll(".item").length === 0);
}

// ────────────────────────────────────────────────────────────────────────────
// 2. 아이템 추가
// ────────────────────────────────────────────────────────────────────────────
console.log("\n[2] 아이템 추가");
{
  const { document: doc } = makeDom().window;

  addItem(doc, "사과");
  const labels = () => doc.querySelectorAll(".item label");
  check("버튼 클릭으로 항목 추가", labels().length === 1);
  check("추가된 텍스트 확인", labels()[0].textContent === "사과");

  addItemEnter(doc, "바나나");
  check("Enter 키로 항목 추가", labels().length === 2);

  addItem(doc, "우유");
  check("3개 항목 추가", labels().length === 3);

  check("헤더 요약 '전체 3개'", doc.getElementById("summary").textContent.includes("전체 3개"));

  // 공백 무시
  addItem(doc, "   ");
  check("공백 입력 무시", labels().length === 3);

  // 추가 후 입력창 비워짐
  addItem(doc, "딸기");
  check("추가 후 입력창 비워짐", doc.getElementById("new-item").value === "");
}

// ────────────────────────────────────────────────────────────────────────────
// 3. 체크(완료) 기능
// ────────────────────────────────────────────────────────────────────────────
console.log("\n[3] 체크(완료) 기능");
{
  const dom2 = makeDom();
  const doc2 = dom2.window.document;

  addItem(doc2, "사과");
  addItem(doc2, "바나나");
  addItem(doc2, "우유");

  const items = () => doc2.querySelectorAll(".item");
  const cbs   = () => doc2.querySelectorAll(".item input[type=checkbox]");

  // 체크
  cbs()[0].checked = true;
  cbs()[0].dispatchEvent(new dom2.window.Event("change", { bubbles: true }));
  check("체크 후 done 클래스 추가", items()[0].classList.contains("done"));
  check("체크박스 checked 상태", cbs()[0].checked);

  const doneText = doc2.getElementById("done-count").textContent;
  check("완료 카운트 '1 / 3 완료'", doneText.includes("1 / 3 완료"), doneText);

  // 체크 해제
  cbs()[0].checked = false;
  cbs()[0].dispatchEvent(new dom2.window.Event("change", { bubbles: true }));
  check("체크 해제 후 done 클래스 제거", !items()[0].classList.contains("done"));
}

// ────────────────────────────────────────────────────────────────────────────
// 4. 개별 삭제
// ────────────────────────────────────────────────────────────────────────────
console.log("\n[4] 개별 삭제");
{
  const dom = makeDom();
  const doc = dom.window.document;

  addItem(doc, "사과");
  addItem(doc, "바나나");
  addItem(doc, "우유");

  const delBtns = () => doc.querySelectorAll(".del-btn");
  const itemLabels = () => [...doc.querySelectorAll(".item label")].map(l => l.textContent);

  delBtns()[0].click();
  check("첫 번째 항목 삭제 후 2개 남음", doc.querySelectorAll(".item").length === 2);
  const remaining = itemLabels();
  check("나머지 항목 순서 유지 (바나나, 우유)", JSON.stringify(remaining) === JSON.stringify(["바나나", "우유"]), JSON.stringify(remaining));

  // 나머지 전부 삭제
  delBtns()[0].click();
  delBtns()[0].click();
  check("전부 삭제 후 빈 메시지 표시", !!doc.querySelector(".empty"));
}

// ────────────────────────────────────────────────────────────────────────────
// 5. 완료 항목 일괄 삭제
// ────────────────────────────────────────────────────────────────────────────
console.log("\n[5] 완료 항목 일괄 삭제");
{
  const dom = makeDom();
  const doc = dom.window.document;

  addItem(doc, "사과");
  addItem(doc, "바나나");
  addItem(doc, "우유");

  const cbs = () => doc.querySelectorAll(".item input[type=checkbox]");
  cbs()[0].checked = true;
  cbs()[0].dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  cbs()[1].checked = true;
  cbs()[1].dispatchEvent(new dom.window.Event("change", { bubbles: true }));

  doc.getElementById("clear-done").click();

  const items = doc.querySelectorAll(".item");
  check("완료 2개 삭제 후 1개 남음", items.length === 1);
  check("미완료 항목(우유) 유지", items[0].querySelector("label").textContent === "우유");
}

// ────────────────────────────────────────────────────────────────────────────
// 6. localStorage 영속성
// ────────────────────────────────────────────────────────────────────────────
console.log("\n[6] localStorage 영속성");
{
  const dom = makeDom();
  const doc = dom.window.document;

  addItem(doc, "사과");
  addItem(doc, "바나나");

  const cbs = () => doc.querySelectorAll(".item input[type=checkbox]");
  cbs()[0].checked = true;
  cbs()[0].dispatchEvent(new dom.window.Event("change", { bubbles: true }));

  // localStorage에 저장된 데이터 직접 읽기
  const stored = JSON.parse(dom.window.localStorage.getItem("shopping-list-v1") || "[]");
  check("localStorage에 2개 항목 저장", stored.length === 2, `저장된 개수: ${stored.length}`);
  check("첫 번째 항목 done=true 저장", stored[0].done === true, `done: ${stored[0].done}`);
  check("두 번째 항목 done=false 저장", stored[1].done === false, `done: ${stored[1].done}`);

  // 동일 localStorage로 새 DOM 생성해 영속성 검증
  const dom2 = makeDom(stored);
  const doc2 = dom2.window.document;
  const items2 = doc2.querySelectorAll(".item");
  check("새 DOM 로드 후 항목 유지 (2개)", items2.length === 2, `실제: ${items2.length}`);
  check("체크 상태 유지 (done 클래스)", items2[0].classList.contains("done"));
}

// ────────────────────────────────────────────────────────────────────────────
// 결과 요약
// ────────────────────────────────────────────────────────────────────────────
const passed = results.filter(([, ok]) => ok).length;
const failed = results.filter(([, ok]) => !ok).length;
console.log("\n" + "─".repeat(45));
process.stdout.write(`결과: ${passed}/${results.length} 통과`);
if (failed) {
  console.log(`  |  실패: ${failed}개`);
  results.filter(([, ok]) => !ok).forEach(([name]) => console.log(`    ${FAIL} ${name}`));
} else {
  console.log("  — 모든 테스트 통과!");
}
console.log();
process.exit(failed > 0 ? 1 : 0);