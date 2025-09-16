// -----------------------------------------------------
// 스크롤 다운 시 현재 scrollTop 값이 섹션 시작위치 -100px에 도달하면 "스냅" 출력
// -----------------------------------------------------
(function ($, win, doc) {
    $(function () {
        const $sections = $(".section.fullpage");
        let lastScrollTop = 0; // 이전 스크롤 값 저장 (스크롤 방향 판단용)
        let snapTregger = 300;

        let isScrolling = false;

        $(win).on("scroll", function () {
            // if (isScrolling) return; // 중복 실행 방지

            isScrolling = true;
            const scrollTop = $(win).scrollTop();
            const windowHeight = $(win).height();
            const isScrollDown = scrollTop > lastScrollTop; // 스크롤 방향 확인
            const isScrollUp = scrollTop < lastScrollTop; // 스크롤 방향 확인

            const triggerPx = 100;

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
                isScrolling = false;

                console.clear();
                console.log("현재 보이는 섹션", $current);
                console.log("현재 스크롤 값 (window.scrollTop):", scrollTop);
                console.log("현재 보이는 섹션 시작 위치 (offsetTop):", sectionTop);

                // 🔥 조건: 스크롤 다운 + scrollTop이 (섹션 시작위치 - triggerPx)에 도달했을 때
                if (
                    isScrollDown &&
                    scrollTop >= sectionTop - snapTregger &&
                    scrollTop < sectionTop
                ) {
                    if (isScrolling) return; // 중복 실행 방지
                    // alert("다운스냅");
                    $("html, body").stop().animate(
                        { scrollTop: sectionTop },
                        200, // 애니메이션 시간(ms)
                        "swing" // 이징 (easeInOutCubic 등도 가능)
                    );

                    setTimeout(() => {
                        isScrolling = true;
                        console.log("isScrolling", isScrolling);
                    }, 700);
                }
                // 🔥 조건: 스크롤 업 + scrollTop이 (섹션 시작위치 + triggerPx)에 도달했을 때
                if (isScrollUp && scrollTop >= sectionTop + snapTregger && scrollTop > sectionTop) {
                    if (isScrolling) return; // 중복 실행 방지
                    // alert("업스냅");

                    $("html, body").stop().animate(
                        { scrollTop: sectionTop }, 
                        200, // 애니메이션 시간(ms)
                        "swing" // 이징 (easeInOutCubic 등도 가능)
                    );

                    setTimeout(() => {
                        isScrolling = true;
                    }, 700);
                }
            }

            // 현재 스크롤 값을 마지막 값으로 저장
            lastScrollTop = scrollTop;
        });
    });
})(jQuery, window, document);
