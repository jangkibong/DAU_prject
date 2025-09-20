// -----------------------------------------------------
// 스크롤 다운 시 현재 scrollTop 값이 섹션 시작위치 -100px에 도달하면 "스냅" 출력
// -----------------------------------------------------
(function ($, win, doc) {
    $(function () {
        const $sections = $(".section.fullpage");
        let lastScrollTop = 0; // 이전 스크롤 값 저장 (스크롤 방향 판단용)
        let snapTregger = 80;

        function scrollBumper() {
            disableCustomScroll();
            setTimeout(function () {
                enableCustomScroll();
            }, 500);
        }

        $(win).on("scroll", function () {
            const scrollTop = $(win).scrollTop();
            const windowHeight = $(win).height();
            const isScrollDown = scrollTop > lastScrollTop; // 스크롤 방향 확인
            const isScrollUp = scrollTop < lastScrollTop; // 스크롤 방향 확인

            // 뷰포트 중앙 기준 현재 보이는 섹션 찾기
            const $current = $sections.filter(function () {
                const offsetTop = $(this).offset().top;
                const offsetBottom = offsetTop + $(this).outerHeight();
                return (
                    scrollTop + windowHeight / 2 >= offsetTop &&
                    scrollTop + windowHeight / 2 < offsetBottom
                );
            });

            if ($current.length) {
                const sectionTop = $current.offset().top;
                const snapOffTracker = sectionTop - scrollTop;

                if (snapTregger * 2 >= snapOffTracker || snapTregger * 2 >= snapOffTracker) {
                    $sections.removeClass("fixedTop");
                }

                // 🔥 조건: 스크롤 다운 + scrollTop이 (섹션 시작위치 - snapTregger)에 도달했을 때
                if (
                    isScrollDown &&
                    scrollTop >= sectionTop - snapTregger &&
                    scrollTop < sectionTop
                ) {
                    scrollBumper();
                    $sections.removeClass("fixedTop");
                    $current.addClass("fixedTop");
                }
                // 🔥 조건: 스크롤 업 + scrollTop이 (섹션 시작위치 + snapTregger)에 도달했을 때
                if (isScrollUp && snapTregger >= scrollTop - sectionTop && scrollTop > sectionTop) {
                    scrollBumper();
                    $sections.removeClass("fixedTop");
                    $current.addClass("fixedTop");
                }
            }

            // 현재 스크롤 값을 마지막 값으로 저장
            lastScrollTop = scrollTop;
        });
    });
})(jQuery, window, document);
