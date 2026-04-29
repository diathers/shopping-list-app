import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

FILE_URL = f"file://{Path(__file__).parent / 'index.html'}"

PASS = "\033[32m✓\033[0m"
FAIL = "\033[31m✗\033[0m"

results = []

def check(name, cond, detail=""):
    icon = PASS if cond else FAIL
    print(f"  {icon} {name}" + (f"  ({detail})" if detail else ""))
    results.append((name, cond))


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()

        def fresh_page():
            page = ctx.new_page()
            page.goto(FILE_URL)
            page.evaluate("localStorage.clear()")
            page.reload()
            return page

        print("\n[1] 초기 상태")
        page = fresh_page()
        empty = page.locator(".empty")
        check("빈 상태 메시지 표시", empty.is_visible())
        check("헤더 요약 '항목 없음'", "항목 없음" in page.locator("#summary").text_content())
        page.close()

        print("\n[2] 아이템 추가")
        page = fresh_page()
        inp = page.locator("#new-item")
        add_btn = page.locator("#add-btn")

        inp.fill("사과")
        add_btn.click()
        item_labels = page.locator(".item label")
        check("버튼 클릭으로 항목 추가", item_labels.count() == 1)
        check("추가된 텍스트 확인", item_labels.first.text_content() == "사과")

        inp.fill("바나나")
        inp.press("Enter")
        check("Enter 키로 항목 추가", item_labels.count() == 2)

        inp.fill("우유")
        add_btn.click()
        check("3개 항목 추가", item_labels.count() == 3)

        check("헤더 요약 '전체 3개'", "전체 3개" in page.locator("#summary").text_content())

        inp.fill("   ")
        add_btn.click()
        check("공백 입력 무시", item_labels.count() == 3)

        inp.fill("딸기")
        add_btn.click()
        check("추가 후 입력창 비워짐", inp.input_value() == "")

        page.close()

        print("\n[3] 체크(완료) 기능")
        page = fresh_page()
        for text in ["사과", "바나나", "우유"]:
            page.locator("#new-item").fill(text)
            page.locator("#add-btn").click()

        first_cb = page.locator(".item input[type=checkbox]").first
        first_item = page.locator(".item").first

        first_cb.check()
        check("체크 후 done 클래스 추가", "done" in first_item.get_attribute("class"))
        check("체크박스 checked 상태", first_cb.is_checked())

        first_cb.uncheck()
        check("체크 해제 후 done 클래스 제거", "done" not in first_item.get_attribute("class"))

        first_cb.check()
        done_text = page.locator("#done-count").text_content()
        check("완료 카운트 표시 (1 / 3 완료)", "1 / 3 완료" in done_text, done_text)
        page.close()

        print("\n[4] 개별 삭제")
        page = fresh_page()
        for text in ["사과", "바나나", "우유"]:
            page.locator("#new-item").fill(text)
            page.locator("#add-btn").click()

        del_btns = page.locator(".del-btn")
        del_btns.first.click()
        items = page.locator(".item")
        check("첫 번째 항목 삭제 후 2개 남음", items.count() == 2)
        labels = [items.nth(i).locator("label").text_content() for i in range(2)]
        check("나머지 항목 순서 유지", labels == ["바나나", "우유"], str(labels))

        page.locator(".del-btn").first.click()
        page.locator(".del-btn").first.click()
        check("전부 삭제 후 빈 메시지 표시", page.locator(".empty").is_visible())
        page.close()

        print("\n[5] 완료 항목 일괄 삭제")
        page = fresh_page()
        for text in ["사과", "바나나", "우유"]:
            page.locator("#new-item").fill(text)
            page.locator("#add-btn").click()

        checkboxes = page.locator(".item input[type=checkbox]")
        checkboxes.nth(0).check()
        checkboxes.nth(1).check()
        page.locator("#clear-done").click()

        items = page.locator(".item")
        check("완료 2개 삭제 후 1개 남음", items.count() == 1)
        check("미완료 항목(우유) 유지", items.first.locator("label").text_content() == "우유")
        page.close()

        print("\n[6] localStorage 영속성")
        page = ctx.new_page()
        page.goto(FILE_URL)
        page.evaluate("localStorage.clear()")
        page.reload()

        for text in ["사과", "바나나"]:
            page.locator("#new-item").fill(text)
            page.locator("#add-btn").click()
        page.locator(".item input[type=checkbox]").first.check()

        page2 = ctx.new_page()
        page2.goto(FILE_URL)
        items2 = page2.locator(".item")
        check("새로고침 후 항목 유지 (2개)", items2.count() == 2)
        check("체크 상태 유지", "done" in items2.first.get_attribute("class"))
        page.close()
        page2.close()

        browser.close()

    passed = sum(1 for _, ok in results if ok)
    failed = sum(1 for _, ok in results if not ok)
    total  = len(results)
    print(f"\n{'─'*45}")
    print(f"결과: {passed}/{total} 통과", end="")
    if failed:
        print(f"  |  실패: {failed}개")
        for name, ok in results:
            if not ok:
                print(f"    {FAIL} {name}")
    else:
        print("  — 모든 테스트 통과!")
    print()
    return failed == 0


if __name__ == "__main__":
    ok = run()
    sys.exit(0 if ok else 1)