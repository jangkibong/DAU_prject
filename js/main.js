/*! main.js — Clean Rebuild (Snap logic removed + SubVisual section-wide control)
 * jQuery 3.7.1
 * - Intro: viewport 100% 덮을 때만 진행도 모션(화면 고정)
 * - Scroller: 부드러운 감쇠 스크롤(관성)
 * - Sub Visual: .sub_visual_content 세로 슬라이드, section 전체 스크롤로 제어
 *   - 스와이퍼가 이동 가능한 경우, 화면(페이지) 스크롤은 완전히 차단
 *   - 스와이퍼 경계(처음/마지막)에서만 페이지 스크롤 통과
 */

// main.js
// -----------------------------------------------------
// 0) 인트로 처리
// -----------------------------------------------------
// $(function () {
//     setTimeout(function () {
//         $(".intro").removeClass("intro");
//     }, 200);
// });

(function ($, win, doc) {
    window.scrollEnabled = true;

    // 제어 함수도 window에 붙여두면 더 편리
    window.disableCustomScroll = function () {
        window.scrollEnabled = false;
    };
    window.enableCustomScroll = function () {
        window.scrollEnabled = true;
    };

    if (!$) return;

    // =========================================================
    // 0) 모바일 뷰포트 높이 계산
    // =========================================================
    function setRealVH() {
        // window.innerHeight = 네비게이션 바 제외하고 실제 보이는 높이
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);
    }
    // 페이지 처음 로드할 때 실행
    setRealVH();
    // 화면 크기 바뀌면 다시 계산
    window.addEventListener("resize", setRealVH);

    // =========================================================
    // 0-1) 유틸/접근성
    // =========================================================
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const reduceMotion = (() => {
        try {
            return win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
        } catch (_) {
            return false;
        }
    })();

    // =========================================================
    // 1) Intro (진행도형 패럴랙스)
    // =========================================================
    const Intro = (() => {
        const $win = $(win);
        const $intro = $("#intro");
        const $img = $intro.find(".main_visual_img");
        const $title = $intro.find(".main_title");

        if (!$intro.length || !$img.length || !$title.length) {
            return {
                ready: false,
                covers: () => false,
                wheel: () => false,
                tstart: () => {},
                tmove: () => false,
                tend: () => {},
                resize: () => {},
            };
        }


        let CFG = {
            imgScaleFrom: 1.0,
            imgScaleTo: 0.55,
            imgYFromVH: 0,
            imgYToVH: -45,

            imgScaleSpeed: 2.2,
            imgScaleEase: "easeOutCubic",
            imgMoveSpeed: 1,
            imgMoveEase: "linear",

            titleTopFromVH: 95,
            titleTopToVH: 20,
            titleSpeed: 1.2,
            titleEase: "linear",
            titleFollowImage: true,
            virtualRangePx: window.innerHeight,
            epsilon: 0,
        };

        // if($win.innerWidth <= 720) {
        //     CFG = {
        //         imgScaleFrom: 1.0,
        //         imgScaleTo: 0.55,
        //         imgYFromVH: 0,
        //         imgYToVH: -45,

        //         imgScaleSpeed: 2.2,
        //         imgScaleEase: "easeOutCubic",
        //         imgMoveSpeed: 1,
        //         imgMoveEase: "linear",

        //         titleTopFromVH: 95,
        //         titleTopToVH: 20,
        //         titleSpeed: 1.2,
        //         titleEase: "linear",
        //         titleFollowImage: true,
        //         virtualRangePx: 300,
        //         epsilon: 0,
        //     };
        // }

        const clamp01 = (v) => Math.max(0, Math.min(1, v));
        const lerp = (a, b, t) => a + (b - a) * t;
        const Ease = {
            linear: (t) => t,
            easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
            easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
        };
        const shape = (t, s) => Math.pow(clamp01(t), 1 / Math.max(s || 1, 0.0001));

        let progress = 0; // 0~1
        let startY = null;
        let introTop = 0,
            introH = 1,
            measuring = false;

        function measure() {
            if (measuring) return;
            measuring = true;
            requestAnimationFrame(() => {
                introTop = $intro.offset().top;
                introH = Math.max(1, $intro.outerHeight());
                measuring = false;
            });
        }

        function covers() {
            const y = $win.scrollTop() || 0;
            const vh = win.innerHeight || doc.documentElement.clientHeight || 0;
            return y >= introTop - 1 && y + vh <= introTop + introH + 1;
        }

        function computeTs(baseT) {
            const tScale = (Ease[CFG.imgScaleEase] || Ease.linear)(shape(baseT, CFG.imgScaleSpeed));
            const tMove = (Ease[CFG.imgMoveEase] || Ease.linear)(shape(baseT, CFG.imgMoveSpeed));
            const tTitleRaw = (Ease[CFG.titleEase] || Ease.linear)(shape(baseT, CFG.titleSpeed));
            const tTitle = CFG.titleFollowImage ? Math.max(tTitleRaw, tScale, tMove) : tTitleRaw;
            return { tScale, tMove, tTitle };
        }

        function apply(p) {
            const baseT = clamp01(p);
            const { tScale, tMove, tTitle } = computeTs(baseT);
            const vh = win.innerHeight || doc.documentElement.clientHeight || 0;
            const scale = lerp(CFG.imgScaleFrom, CFG.imgScaleTo, tScale);
            const imgY = (lerp(CFG.imgYFromVH, CFG.imgYToVH, tMove) * vh) / 100;
            const titleVH = lerp(CFG.titleTopFromVH, CFG.titleTopToVH, tTitle);
            $img.css("transform", `translateY(${imgY}px) scale(${scale})`);
            $title.css("top", `${titleVH}vh`);
        }

        function atEnds(p) {
            const { tScale, tMove, tTitle } = computeTs(clamp01(p));
            const eps = CFG.epsilon;
            return {
                start: tScale <= eps && tMove <= eps && tTitle <= eps,
                end: tScale >= 1 - eps && tMove >= 1 - eps && tTitle >= 1 - eps,
            };
        }

        function step(dy) {
            progress = clamp(progress + dy / CFG.virtualRangePx, 0, 1);
            apply(progress);
        }

        function wheel(e) {
            if (!covers()) return false;
            const dy = e.deltaY;
            const { start, end } = atEnds(progress);
            const down = dy > 0,
                up = dy < 0;
            if ((down && !end) || (up && !start)) {
                e.preventDefault();
                step(dy);
                return true;
            }
            return false;
        }

        function tstart(e) {
            if (!covers()) return;
            const t = e.touches && e.touches[0];
            startY = t ? t.clientY : null;
        }
        function tmove(e) {
            if (!covers()) return false;
            const t = e.touches && e.touches[0];
            if (startY == null || !t) return false;
            const dy = startY - t.clientY;
            const { start, end } = atEnds(progress);
            if ((dy > 0 && !end) || (dy < 0 && !start)) {
                e.preventDefault();
                step(dy);
                startY = t.clientY;
                return true;
            }
            startY = t.clientY;
            return false;
        }
        function tend() {
            startY = null;
        }

        measure();
        (function initOnRefresh() {
            // Intro 초기값 세팅
            progress = 0;
            $img.css("transform", "translateY(0px) scale(1)");
            $title.css("top", "100vh");
        })();

        win.addEventListener("resize", measure, { passive: true });
        win.addEventListener(
            "scroll",
            () => {
                if (!covers()) {
                    const y = $win.scrollTop() || 0;
                    const newP = y <= introTop ? 0 : 1;
                    if (newP !== progress) {
                        progress = newP;
                        apply(progress);
                    }
                }
            },
            { passive: true }
        );

        return { ready: true, covers, wheel, tstart, tmove, tend, resize: measure };
    })();

    // =========================================================
    // 2) Scroller (관성 스크롤)
    // =========================================================
    const Scroller = (() => {
        let target = win.pageYOffset;
        let current = target;
        let raf = null;
        const EPS = 0.5;
        let DAMPING = 0.14;

        function start() {
            if (!raf) raf = requestAnimationFrame(loop);
        }
        function loop() {
            const diff = target - current;
            if (Math.abs(diff) < EPS) {
                current = target;
                win.scrollTo(0, Math.round(current));
                raf = null;
                return;
            }
            current += diff * DAMPING;
            win.scrollTo(0, Math.round(current));
            raf = requestAnimationFrame(loop);
        }
        function maxScroll() {
            const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
            return Math.max(0, h - win.innerHeight);
        }

        return {
            add(dy) {
                if (reduceMotion) {
                    win.scrollTo(0, clamp(win.pageYOffset + dy, 0, maxScroll()));
                    return;
                }
                target = clamp(target + dy, 0, maxScroll());
                start();
            },
            jumpTo(y) {
                if (reduceMotion) {
                    win.scrollTo(0, clamp(y, 0, maxScroll()));
                    return;
                }
                target = clamp(y, 0, maxScroll());
                win.scrollTo(0, Math.round(target));
            },
            resize() {
                target = clamp(target, 0, maxScroll());
                current = clamp(current, 0, maxScroll());
            },
            config(opt = {}) {
                if (typeof opt.damping === "number") DAMPING = opt.damping;
            },
        };
    })();

    // =========================================================
    // 3) 입력 라우터(전역)
    // =========================================================
    (function bindRouter() {
        function onWheel(e) {
            if (!scrollEnabled) {
                e.preventDefault(); // 기본 스크롤도 막고
                return; // 관성 스크롤도 안 태움
            }
            if (Intro.ready && Intro.covers()) {
                if (Intro.wheel(e)) return;
            }
            e.preventDefault();
            const dy = e.deltaY;
            Scroller.add(dy);
        }
        let prevY = null;
        function onTouchStart(e) {
            if (Intro.ready) Intro.tstart(e);
            const t = e.touches && e.touches[0];
            prevY = t ? t.clientY : null;
        }
        function onTouchMove(e) {
            if (Intro.ready && Intro.covers()) {
                if (Intro.tmove(e)) return;
            }
            e.preventDefault();
            const t = e.touches && e.touches[0];
            if (!t) {
                prevY = null;
                return;
            }
            if (prevY == null) {
                prevY = t.clientY;
                return;
            }
            let dy = prevY - t.clientY || 0;
            prevY = t.clientY;
            // ------------------------------
            // 모바일 화면 크기일 때 스크롤 양 조절
            // ------------------------------
            if (window.innerWidth <= 720) {
                dy *= 1.5; // 1.5배 늘림 (원하는 배수로 조정 가능)
            }

            Scroller.add(dy);
        }
        function onTouchEnd(e) {
            if (Intro.ready) Intro.tend(e);
            prevY = null;
        }
        function onResize() {
            Scroller.resize();
            if (Intro.ready) Intro.resize();
        }

        win.addEventListener("wheel", onWheel, { passive: false });
        win.addEventListener("touchstart", onTouchStart, { passive: true });
        win.addEventListener("touchmove", onTouchMove, { passive: false });
        win.addEventListener("touchend", onTouchEnd, { passive: true });
        win.addEventListener("resize", onResize, { passive: true });
    })();

    // =========================================================
    // 4) Sub Visual: Vertical Swiper + 인디케이터 페이드
    //    - 컨테이너: .sub_visual > .sub_visual_content
    //    - 전환: slide(스와이프)
    //    - section 전체 스크롤로 스와이퍼 제어
    // =========================================================
    (function SubVisualModule() {
        // ----- 헬퍼 함수 (위로 이동) -----
        function getVisibleRatio($el) {
            // if (win.innerWidth < 720) return;
            if (!$el.length) return 0;
            const rect = $el[0].getBoundingClientRect();
            const vh = window.innerHeight || document.documentElement.clientHeight;
            const visibleH = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
            return visibleH / vh; // 뷰포트 기준
        }
        function upgradeToSwiperDOM($container) {
            if ($container.children(".swiper-wrapper").length) {
                return $container.find(".swiper-slide").toArray();
            }
            $container.addClass("swiper");
            const $items = $container.find(".sub_visual_item");
            const wrapper = doc.createElement("div");
            wrapper.className = "swiper-wrapper";
            $items.each(function (i, el) {
                const slide = doc.createElement("div");
                slide.className = "swiper-slide";
                if (!el.id) el.id = `sub-visual-slide-${i + 1}`;
                el.parentNode.insertBefore(slide, el);
                slide.appendChild(el);
                wrapper.appendChild(slide);
            });
            $container.append(wrapper);
            return Array.from($container.find(".swiper-slide"));
        }
        function decorateIndicatorsA11y($wrap, $indicators, slideEls) {
            $wrap.attr({ role: "tablist", "aria-label": "섹션 슬라이드 인디케이터" });
            $indicators.each(function (idx) {
                const $it = $(this);
                const slideId =
                    slideEls[idx] && slideEls[idx].querySelector(".sub_visual_item")?.id;
                $it.attr({
                    role: "tab",
                    tabindex: idx === 0 ? "0" : "-1",
                    "aria-selected": idx === 0 ? "true" : "false",
                    ...(slideId ? { "aria-controls": slideId } : {}),
                }).css("opacity", idx === 0 ? 1 : 0);
            });
        }
        function bindIndicatorEvents($indicators, swiper, NS) {
            $indicators.off("click" + NS).on("click" + NS, function (e) {
                e.preventDefault();
                swiper.slideTo($(this).index());
            });
        }
        function fadeSetIndicator($indicators, activeIndex, immediate) {
            const DURATION = 280;
            $indicators.each(function (idx) {
                const $it = $(this);
                const isActive = idx === activeIndex;
                $it.toggleClass("is-active", isActive)
                    .attr("aria-selected", isActive ? "true" : "false")
                    .attr("tabindex", isActive ? "0" : "-1");
                const toOpacity = isActive ? 1 : 0;
                if (immediate) $it.stop(true, true).css("opacity", toOpacity);
                else $it.stop(true, true).animate({ opacity: toOpacity }, DURATION, "swing");
            });
        }
        function getActiveIndex(sw) {
            return (sw && (typeof sw.realIndex === "number" ? sw.realIndex : sw.activeIndex)) || 0;
        }
        function writeSavedIndex(idx) {
            try {
                localStorage.setItem("dau:subvisual:lastIndex", String(idx));
            } catch (_) {}
        }
        function readSavedIndex() {
            try {
                const v = localStorage.getItem("dau:subvisual:lastIndex");
                const n = parseInt(v, 10);
                return Number.isNaN(n) ? null : n;
            } catch (_) {
                return null;
            }
        }
        function clampIndex(n, len) {
            return typeof n !== "number" || typeof len !== "number" || len <= 0
                ? 0
                : Math.max(0, Math.min(len - 1, n));
        }

        $(function initSubVisualVerticalSwiper() {
            const NS = ".subVisualV";
            $(".sub_visual").each(function () {
                const $host = $(this);
                if ($host.data("svV-init")) return;
                $host.data("svV-init", true);

                const $container = $host.find(".sub_visual_content");
                const $titlesWrap = $host.find(".sub_titles_wrap");
                const $indicators = $titlesWrap.find(".sub_tilte_wrap");
                if (!$container.length || !$indicators.length) return;

                const slideEls = upgradeToSwiperDOM($container);
                decorateIndicatorsA11y($titlesWrap, $indicators, slideEls);

                const savedIndex = readSavedIndex();
                const initialIndex = clampIndex(
                    Number.isInteger(savedIndex) ? savedIndex : 0,
                    slideEls.length
                );

                const swiper = new Swiper($container.get(0), {
                    direction: "vertical",
                    effect: "slide",
                    speed: 600,
                    allowTouchMove: true,
                    loop: false,
                    initialSlide: initialIndex,
                    mousewheel: false,
                    observer: true,
                    observeParents: true,
                    touchAngle: 45,
                    preventInteractionOnTransition: true,
                    resistanceRatio: 0,        // 끝에서 바운스 효과 제거
                    touchReleaseOnEdges: true, // 끝에서 스와이프 시 그냥 멈추게 함
                    a11y: { enabled: true },
                    on: {
                        afterInit(sw) {
                            fadeSetIndicator($indicators, getActiveIndex(sw), true);
                        },
                        slideChange(sw) {
                            const idx = getActiveIndex(sw);
                            fadeSetIndicator($indicators, idx);
                            writeSavedIndex(idx);
                        },
                    },
                });

                bindIndicatorEvents($indicators, swiper, NS);

                const $section = $host.closest("section");
                if (!$section.length) return;

                let tStartY = 0,
                    TOUCH_THRESHOLD = 8;
                $section.off("wheel" + NS).on("wheel" + NS, function (e) {
                    const $article = $section.find(".sub_visual")

                    // if (win.innerWidth > 720) return; // Sub Visual Module (뷰포트의 95% 이상 보여질 떄 작동)
                    if (getVisibleRatio($article) < 1 ) return; // Sub Visual Module (뷰포트의 95% 이상 보여질 떄 작동)

                    const evt = e.originalEvent || e;
                    const dy = evt.deltaY || 0;
                    if (swiper.animating) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        return;
                    }
                    if (dy > 0 && !swiper.isEnd) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        swiper.slideNext();
                        return;
                    }
                    if (dy < 0 && !swiper.isBeginning) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        swiper.slidePrev();
                        return;
                    }
                });
                $section.off("touchstart" + NS).on("touchstart" + NS, function (e) {
                    const t = e.originalEvent.touches && e.originalEvent.touches[0];
                    tStartY = t ? t.clientY : 0;
                });
                $section.off("touchmove" + NS).on("touchmove" + NS, function (e) {
                    if (getVisibleRatio($section) < 0.9) return;
                    const t = e.originalEvent.touches && e.originalEvent.touches[0];
                    if (!t) return;
                    const dy = tStartY - t.clientY;
                    if (swiper.animating) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        return;
                    }
                    if (Math.abs(dy) < TOUCH_THRESHOLD) return;
                    if (dy > 0 && !swiper.isEnd) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        swiper.slideNext();
                        tStartY = t.clientY;
                        return;
                    }
                    if (dy < 0 && !swiper.isBeginning) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        swiper.slidePrev();
                        tStartY = t.clientY;
                        return;
                    }
                });
            });
        });
    })();

    // =========================================================
    // 5) 초기 설정(옵션)
    // =========================================================
    $(function () {
        // Scroller.config({ damping: 0.14 });
    });

    /* =========================================================
     * 6) #project Horizontal Swiper (CSS 호환 생성)
     * - 컨테이너: #project .swiper  (가로 슬라이드)
     * - DOM 자동 보강:
     *   · .swiper_wrap (버튼 기준 포지셔닝용)
     *   · .swiper-button-prev / .swiper-button-next (좌/우 버튼)
     *   · .project-controls 내부에
     *       - .swiper-pagination (bullets)
     *       - .swiper-play-toggle (플레이/일시정지 토글)
     * - 스크롤/터치로 좌우 이동 (섹션 전체에서 가로 슬라이드 제어)
     * - 스와이퍼가 더 이동 가능하면 페이지 스크롤 차단
     * - 상태 저장: localStorage('dau:project:lastIndex')
     * =======================================================*/
    (function () {
        if (!$) return;

        $(function initProjectSwiper() {
            const NS = ".projectSwiper";
            const $root = $("#project");
            if (!$root.length) return;

            // 컨테이너
            let $swiper = $root.find(".swiper").first();
            if (!$swiper.length) return;

            // 1) .swiper_wrap 보강(버튼 absolute 기준)
            let $wrap = $swiper.closest(".swiper_wrap");
            if (!$wrap.length) {
                $wrap = $('<div class="swiper_wrap"></div>');
                $swiper.after($wrap);
                $wrap.append($swiper);
            }

            // 2) 좌/우 버튼 생성(없으면)
            if (!$wrap.find(".swiper-button-prev").length) {
                $wrap.append(
                    '<button type="button" class="swiper-button-prev" aria-label="이전 슬라이드"></button>'
                );
            }
            if (!$wrap.find(".swiper-button-next").length) {
                $wrap.append(
                    '<button type="button" class="swiper-button-next" aria-label="다음 슬라이드"></button>'
                );
            }

            // 3) 하단 컨트롤(.project-controls) + pagination + play-toggle 생성(없으면)
            let $controls = $root.find(".project-controls").first();
            if (!$controls.length) {
                $controls = $(
                    '<div class="project-controls" role="group" aria-label="프로젝트 슬라이드 컨트롤"></div>'
                );
                $wrap.append($controls);
            }
            if (!$controls.find(".swiper-pagination").length) {
                $controls.append(
                    '<div class="swiper-pagination" aria-label="프로젝트 슬라이드 인디케이터"></div>'
                );
            }
            if (!$controls.find(".swiper-play-toggle").length) {
                // 기본은 '재생 중' 상태이므로 아이콘은 pause (CSS와 맞춤)
                $controls.append(
                    '<button type="button" class="swiper-play-toggle" aria-pressed="false">toggle</button>'
                );
            }

            const $btnPrev = $wrap.find(".swiper-button-prev");
            const $btnNext = $wrap.find(".swiper-button-next");
            const $pagination = $controls.find(".swiper-pagination");
            const $playToggle = $controls.find(".swiper-play-toggle");

            // 4) .swiper 내부 슬라이드 래핑 보강 (이미 wrapper가 있으면 패스)
            ensureSlides($swiper);

            // 5) 초기 인덱스 복원
            const saved = readSavedIndex();
            const slideCount = $swiper.find(".swiper-slide").length;
            const initial = clampIndex(Number.isInteger(saved) ? saved : 0, slideCount);

            // 6) Swiper 생성
            const sw = new Swiper($swiper.get(0), {
                direction: "horizontal",
                effect: "slide",
                speed: 700,
                loop: false,
                initialSlide: initial,
                allowTouchMove: true,
                // 섹션에서 수동으로 wheel 제어하므로 내부 mousewheel은 비활성
                mousewheel: false,
                observer: true,
                observeParents: true,
                touchAngle: 45,
                preventInteractionOnTransition: true,
                a11y: { enabled: true },

                navigation: {
                    nextEl: $btnNext.get(0),
                    prevEl: $btnPrev.get(0),
                },
                pagination: {
                    el: $pagination.get(0),
                    clickable: true, // bullets 클릭 가능
                    bulletClass: "swiper-pagination-bullet",
                    bulletActiveClass: "swiper-pagination-bullet-active",
                    // 접근성 라벨
                    renderBullet: function (index, className) {
                        const n = index + 1;
                        return `<span class="${className}" role="tab" aria-label="${n}번 슬라이드" aria-controls="project-slide-${n}" tabindex="${
                            index === initial ? 0 : -1
                        }"></span>`;
                    },
                },
                autoplay: {
                    delay: 4000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: false,
                },

                on: {
                    afterInit(swiper) {
                        reflectPlayState(swiper);
                        // pagination bullets 접근성 동기화
                        syncPaginationA11y($pagination, getActiveIndex(swiper));
                    },
                    slideChange(swiper) {
                        const idx = getActiveIndex(swiper);
                        writeSavedIndex(idx);
                        syncPaginationA11y($pagination, idx);
                    },
                },
            });

            // 7) 플레이/일시정지 토글
            $playToggle.off("click" + NS).on("click" + NS, function (e) {
                e.preventDefault();
                if (!sw.autoplay) return;
                if (sw.autoplay.running) sw.autoplay.stop();
                else sw.autoplay.start();
                reflectPlayState(sw);
            });

            // 8) 섹션 전체 스크롤/터치로 좌우 이동 + 페이지 스크롤 차단
            const $section = $root.closest("section").length ? $root.closest("section") : $root;
            // bindSectionScrollControl($section, sw, NS);

            /* -------------------- 유틸/헬퍼 -------------------- */

            // 역할: .swiper 내부를 .swiper-wrapper/.swiper-slide 구조로 보강
            function ensureSlides($container) {
                if ($container.children(".swiper-wrapper").length) return;
                const $items = $container.find(".project_item, .swiper_item, .slide_item, > *");
                const wrapper = doc.createElement("div");
                wrapper.className = "swiper-wrapper";
                $items.each(function (i, el) {
                    // 이미 wrapper/slides가 아니라면만 감싸기
                    if (
                        el.classList.contains("swiper-wrapper") ||
                        el.classList.contains("swiper-slide")
                    )
                        return;
                    const slide = doc.createElement("div");
                    slide.className = "swiper-slide";
                    if (!el.id) el.id = `project-slide-${i + 1}`; // bullets aria-controls 타겟
                    el.parentNode.insertBefore(slide, el);
                    slide.appendChild(el);
                    wrapper.appendChild(slide);
                });
                $container.append(wrapper);
            }

            // 역할: bullets에 tabindex/aria-selected 동기화(접근성)
            function syncPaginationA11y($pagi, activeIdx) {
                const $bullets = $pagi.find(".swiper-pagination-bullet");
                $bullets.each(function (i) {
                    const $b = $(this);
                    const isActive = i === activeIdx;
                    $b.attr({
                        tabindex: isActive ? "0" : "-1",
                        "aria-selected": isActive ? "true" : "false",
                    });
                });
            }

            // 역할: 섹션에서 wheel/터치로 좌우 이동 제어 (가능 시 페이지 스크롤 차단)
            function bindSectionScrollControl($sec, swiper, NS) {
                if (!$sec || !$sec.length) return;

                // Wheel → 좌우 슬라이드
                $sec.off("wheel" + NS).on("wheel" + NS, function (e) {
                    const evt = e.originalEvent || e;
                    const dy = evt.deltaY || 0;

                    if (swiper.animating) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        return;
                    }

                    if (dy > 0 && !swiper.isEnd) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        swiper.slideNext();
                        return;
                    }
                    if (dy < 0 && !swiper.isBeginning) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        swiper.slidePrev();
                        return;
                    }
                    // 경계에서 바깥 방향 → 페이지 스크롤 허용
                });

                // Touch(수직 제스처를 좌우 이동에 매핑)
                let tStartY = 0;
                const TOUCH_THRESHOLD = 8;
                $sec.off("touchstart" + NS).on("touchstart" + NS, function (e) {
                    const t = e.originalEvent.touches && e.originalEvent.touches[0];
                    tStartY = t ? t.clientY : 0;
                });
                $sec.off("touchmove" + NS).on("touchmove" + NS, function (e) {
                    const t = e.originalEvent.touches && e.originalEvent.touches[0];
                    if (!t) return;
                    const dy = tStartY - t.clientY;

                    if (swiper.animating) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        return;
                    }
                    if (Math.abs(dy) < TOUCH_THRESHOLD) return;

                    if (dy > 0 && !swiper.isEnd) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        swiper.slideNext();
                        tStartY = t.clientY;
                        return;
                    }
                    if (dy < 0 && !swiper.isBeginning) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        swiper.slidePrev();
                        tStartY = t.clientY;
                        return;
                    }
                    // 경계에서 바깥 방향 → 페이지 스크롤 허용
                });
            }

            function reflectPlayState(swiper) {
                const running = !!(swiper.autoplay && swiper.autoplay.running);
                $playToggle
                    .toggleClass("is-paused", !running) // CSS: .is-paused → 재생 아이콘
                    .attr("aria-pressed", (!running).toString());
            }

            function getActiveIndex(swiper) {
                if (!swiper) return 0;
                if (typeof swiper.realIndex === "number") return swiper.realIndex;
                if (typeof swiper.activeIndex === "number") return swiper.activeIndex;
                return 0;
            }
            function readSavedIndex() {
                try {
                    const v = localStorage.getItem("dau:project:lastIndex");
                    const n = parseInt(v, 10);
                    return Number.isNaN(n) ? null : n;
                } catch (_) {
                    return null;
                }
            }
            function writeSavedIndex(idx) {
                try {
                    localStorage.setItem("dau:project:lastIndex", String(idx));
                } catch (_) {}
            }
            function clampIndex(n, len) {
                if (typeof n !== "number" || typeof len !== "number" || len <= 0) return 0;
                return Math.max(0, Math.min(len - 1, n));
            }
        });
    })();

    /* =========================================================
     * 7) tech 호버패널
     * =======================================================*/
    $(function () {
        const $firstItem = $("#tec .section_content_item").first();
        const $firstPanel = $firstItem.find(".image_wrap + .panel");
        $firstItem.addClass("on");
        $firstPanel.slideDown().attr("aria-hidden", "true");

        $("#tec").on("mouseenter focusin", ".section_content_item", function () {
            const $nowPanel = $(this).find(".image_wrap").first().next("div");
            $(this).addClass("on").siblings().removeClass("on");
            $nowPanel
                .css({ display: "flex" })
                .hide()
                .stop(true, true)
                .slideDown(300)
                .attr("aria-hidden", "false");
            $(this).siblings().find(".panel").slideUp(200).attr("aria-hidden", "true");
        });
    });

    // -----------------------------------------------------
    // 8) PR 가로 스와이퍼 (#pr .section_contents .swiper)
    // -----------------------------------------------------
    (function initPRSwiper() {
        const prHost = document.querySelector("#pr .section_contents .swiper");
        if (!prHost) return;
        if (prHost.__inited) return;
        prHost.__inited = true;

        const items = Array.from(prHost.querySelectorAll(".swiper_item"));
        if (!items.length) return;

        const wrapper = document.createElement("div");
        wrapper.className = "swiper-wrapper";

        items.forEach((item) => {
            const slide = document.createElement("div");
            slide.className = "swiper-slide";
            slide.appendChild(item);
            wrapper.appendChild(slide);
        });

        while (prHost.firstChild) prHost.removeChild(prHost.firstChild);
        prHost.appendChild(wrapper);

        const pad2 = (n) => String(n).padStart(2, "0");

        const prSwiper = new Swiper(prHost, {
            direction: "horizontal",
            slidesPerView: "auto",
            spaceBetween: 70,
            centeredSlides: false,
            loop: false,
            speed: 600,
            allowTouchMove: true,
            simulateTouch: true,
            grabCursor: true,
            nested: true,
            touchAngle: 30,
            threshold: 6,
            navigation: {
                prevEl: ".btn_prev",
                nextEl: ".btn_next",
            },
            breakpoints: {
                720: {
                    spaceBetween: 160,
                },
            },
            on: {
                init() {
                    const total = this.slides.length - this.loopedSlides * 2 || this.slides.length;
                    document.querySelector(".count .total").textContent = pad2(total);
                    document.querySelector(".count .current").textContent = pad2(
                        this.realIndex + 1
                    );
                },
                slideChange() {
                    document.querySelector(".count .current").textContent = pad2(
                        this.realIndex + 1
                    );
                },
            },
        });
    })();
})(window.jQuery, window, document);

// 반응형 이미지 / 영상 변경
$(function () {
    const updateMainVisual = () => {
        const $intro = $(".main_visual_img");
        const $subVisualImg = $("#fullpage .section img");

        if ($(window).width() <= 720) {
            // 모바일용
            $intro.attr("src", "./images/main/mo_all_source_down.mp4");
            $subVisualImg.eq(0).attr("src", "./images/main/sub_visual_mo_1.png");
            $subVisualImg.eq(1).attr("src", "./images/main/sub_visual_mo_2.png");
            $subVisualImg.eq(2).attr("src", "./images/main/sub_visual_mo_3.png");
            $subVisualImg.eq(3).attr("src", "./images/main/sub_visual_mo_4.png");
        } else {
            // PC용
            $intro.attr("src", "./images/main/pc_all_source_down.mp4");
            $subVisualImg.eq(0).attr("src", "./images/main/sub_visual_1.png");
            $subVisualImg.eq(1).attr("src", "./images/main/sub_visual_2.png");
            $subVisualImg.eq(2).attr("src", "./images/main/sub_visual_3.png");
            $subVisualImg.eq(3).attr("src", "./images/main/sub_visual_4.png");
        }
    };

    updateMainVisual();
    $(window).on("resize", updateMainVisual);
});
