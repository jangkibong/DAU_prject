// -----------------------------------------------------
// 스크롤 다운 시 현재 scrollTop 값이 섹션 시작위치 -100px에 도달하면 "스냅"
// -----------------------------------------------------
(function ($, win, doc) {

    $(function () {
        const $sections = $(".section.fullpage");
        const $firstSection = $sections.eq(0);
        const $lastSection = $sections.last();

        let lastScrollTop = 0; // 이전 스크롤 값 저장 (스크롤 방향 판단용)
        let snapTregger = 100;
        let scrollbuffer = $(win).innerHeight() * 0.5; // 뷰포트의 50%

        $(win).on("scroll", function () {
            const scrollTop = $(win).scrollTop(); // 현재 스크롤 위치
            const windowHeight = $(win).height(); // 화면 높이
            const isScrollDown = scrollTop > lastScrollTop; // 스크롤 방향 확인
            const isScrollUp = scrollTop < lastScrollTop; // 스크롤 방향 확인


            // console.log('스크롤 탑',scrollTop);

            // 뷰포트 중앙 기준 현재 보이는 섹션 찾기
            const $current = $sections.filter(function () {
                const offsetTop = $(this).offset().top;
                const offsetBottom = offsetTop + $(this).outerHeight();
                return (
                    scrollTop + windowHeight / 2 >= offsetTop &&
                    scrollTop + windowHeight / 2 < offsetBottom
                );
            });

            if(scrollTop < $firstSection.offset().top){
                // console.log('처음 섹션');
                $sections.removeClass("fixedTop");
                $firstSection.removeClass("prev")
            } else if (scrollTop > $lastSection.offset().top - snapTregger){
                // console.log('마지막 섹션');
                $current.removeClass("fixedBottom");
                $current.addClass("prev")
            }

            if ($current.length) {
                const sectionTop = $current.offset().top;
                const snapOffTracker = sectionTop + scrollbuffer; // 스냅 해제하는 스크롤 값

                // console.log("섹션 위치", sectionTop);
                // console.log("snapOffTracker", snapOffTracker);

                // 이전 / 다음 섹션 구분
                $current.next($sections).addClass("next").removeClass('prev');
                $current.prev($sections).addClass("prev").removeClass("next")

                if (scrollTop >= snapOffTracker) {
                    $sections.removeClass("fixedBottom fixedTop");
                    if(isScrollDown){
                        $current.addClass("prev").removeClass("next");
                    }
                }

                if(scrollTop <= sectionTop + snapTregger ) {
                    $sections.removeClass("fixedBottom fixedTop");
                    // console.log("해제");
                    if(isScrollUp) {
                        $current.addClass("next").removeClass("prev");
                    }
                }

                if (
                    // 🔥 조건: 스크롤 다운 + scrollTop이 (섹션 시작위치 - snapTregger)에 도달했을 때
                    isScrollDown && scrollTop < $lastSection.offset().top + scrollbuffer
                ) {
                    if(
                        scrollTop >= sectionTop - snapTregger
                        && scrollTop < snapOffTracker
                    ){
                        $current.addClass("fixedBottom").removeClass("fixedTop");
                    }
                    $current.siblings().removeClass("fixedBottom fixedTop");
                } else if (
                    // 🔥 조건: 스크롤 업 + scrollTop이 (섹션 시작위치 + snapTregger)에 도달했을 때
                    isScrollUp && scrollTop > $firstSection.offset().top - snapTregger
                ) {
                    if(
                        scrollTop <= snapOffTracker
                        && scrollTop > sectionTop - snapTregger
                    ){
                        $current.addClass("fixedTop").removeClass("fixedBottom");
                    }
                    $current.siblings().removeClass("fixedBottom fixedTop");

                    bumper = false;
                }
            }

            // 현재 스크롤 값을 마지막 값으로 저장
            lastScrollTop = scrollTop;
        });
    });
})(jQuery, window, document);
