// main.js
// -----------------------------------------------------
// 0) 인트로 처리
// -----------------------------------------------------
// $(function () {
//     setTimeout(function () {
//         $(".intro").removeClass("intro");
//     }, 200);
// });

(function () {
    document.addEventListener("DOMContentLoaded", init);

    function init() {
        const fullpage = document.querySelector("#fullpage");
        if (!fullpage) return;

        const track = fullpage.querySelector(".fullpage_track");
        const sections = Array.from(fullpage.querySelectorAll(".section"));
        if (!track || sections.length === 0) return;

        // ===== 유틸 =====
        const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
        const scrollY = () => window.pageYOffset;
        const docH = () =>
            Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        const maxScroll = () => Math.max(0, docH() - window.innerHeight);

        // -----------------------------------------------------
        // A) 글로벌 스무스 스크롤러 (#fullpage 캡처 바깥에서만 사용)
        // -----------------------------------------------------
        const Smooth = (() => {
            let target = scrollY();
            let current = target;
            let raf = null;
            const ease = 0.12;
            const minStep = 0.1;

            function loop() {
                const diff = target - current;
                if (Math.abs(diff) < minStep) {
                    current = target;
                    window.scrollTo(0, Math.round(current));
                    raf = null;
                    return;
                }
                current += diff * ease;
                window.scrollTo(0, Math.round(current));
                raf = requestAnimationFrame(loop);
            }

            return {
                add(deltaY) {
                    target = clamp(target + deltaY, 0, maxScroll());
                    if (!raf) raf = requestAnimationFrame(loop);
                },
                jumpTo(y) {
                    target = clamp(y, 0, maxScroll());
                    current = target;
                    window.scrollTo(0, Math.round(current));
                },
                resize() {
                    target = clamp(target, 0, maxScroll());
                    current = clamp(current, 0, maxScroll());
                },
            };
        })();

        // -----------------------------------------------------
        // B) #fullpage 상태/유틸
        // -----------------------------------------------------
        let currentIndex = 0;
        let stack = 0;
        let prevStack = 0;
        let animating = false; // #fullpage 섹션 전환 중
        let vh = window.innerHeight;
        let touchStartY = 0;

        const TRANSITION_MS = 700;
        const TRANSITION_BUFFER = 50;
        const TOL = 1;
        const TTL_MS = 60 * 60 * 1000; // fullpage 1h
        const LS_KEY = "dau:fullpage:lastIndex";

        // 첫 섹션만 스크롤 1/4로
        const FIRST_SECTION_SCROLL_FACTOR = 0.4;

        const viewportBottom = () => scrollY() + window.innerHeight;
        const fullTop = () => fullpage.getBoundingClientRect().top + scrollY();
        const fullBottom = () => fullTop() + fullpage.offsetHeight;
        const isAtFullpageBottom = () => Math.abs(fullBottom() - viewportBottom()) <= TOL;

        function applyTransform() {
            track.style.transform = `translate3d(0, ${-currentIndex * vh}px, 0)`;
        }
        function applyTransformImmediate() {
            const prev = track.style.transition;
            track.style.transition = "none";
            // reflow
            // eslint-disable-next-line no-unused-expressions
            track.offsetHeight;
            applyTransform();
            requestAnimationFrame(() => {
                track.style.transition = prev || "";
            });
        }

        // -----------------------------------------------------
        // B-1) 첫 섹션 패럴럭스 상태/렌더 (초기화 금지 + 역방향 복원)
        // -----------------------------------------------------
        let introProgress = 0; // 0 ~ vh
        const firstSection = sections[0];
        const introTitles = firstSection
            ? Array.from(firstSection.querySelectorAll(".main_title"))
            : [];
        const introImage = firstSection?.querySelector(".visual_img_box > .main_visual_img");

        const INTRO_TITLE_MAX_SHIFT_PX = 140;
        const INTRO_MIN_SCALE_CURVE = 0.85;
        const MIN_SCALE_CAP = 0.6;
        const EXTRA_TOP_MAX_PX = 220;

        const SCALE_SLOPE = 3.5 - INTRO_MIN_SCALE_CURVE;
        const R_AT_MIN_SCALE = Math.max(0, Math.min(1, (1 - MIN_SCALE_CAP) / SCALE_SLOPE));

        function updateIntroParallax() {
            if (introTitles.length === 0 || !introImage) return;

            const r = Math.max(0, Math.min(introProgress / vh, 1)); // 0~1

            // 타이틀 Y오프셋: 핑퐁 없이 멈춤(요청 반영)
            const offset = Math.round(r * INTRO_TITLE_MAX_SHIFT_PX);
            const rawShift = offset * 15;
            let shift = rawShift <= vh / 1.3 ? rawShift : vh / 1.3;

            introTitles.forEach((el) => {
                el.style.transform = `translate(-50%, calc(50% - ${shift}px))`;
            });

            // 이미지 스케일 + top 리프트
            const scaleRaw = 1 - r * SCALE_SLOPE; // 1 → 감소
            if (r <= R_AT_MIN_SCALE) {
                introImage.style.transform = `scale(${scaleRaw})`;
                introImage.style.position = "relative";
                introImage.style.top = "0px";
            } else {
                const extraRatio = (r - R_AT_MIN_SCALE) / (1 - R_AT_MIN_SCALE);
                const lift = Math.round(extraRatio * EXTRA_TOP_MAX_PX);
                introImage.style.transform = `scale(${MIN_SCALE_CAP})`;
                introImage.style.position = "relative";
                introImage.style.top = `${-lift * 3}px`;
            }
        }

        // sub_visual 스와이프 잠금/해제
        function setSubTouchEnabled(enabled) {
            if (!subSwiper) return;
            subSwiper.allowTouchMove = !!enabled;
            subSwiper.allowSlideNext = !!enabled;
            subSwiper.allowSlidePrev = !!enabled;
        }

        function snapTo(index) {
            animating = true;
            fullpage.classList.add("is-animating");
            setSubTouchEnabled(false);

            currentIndex = clamp(index, 0, sections.length - 1);
            applyTransform();
            saveLastIndex(currentIndex);

            updateIntroParallax();

            setTimeout(() => {
                animating = false;
                fullpage.classList.remove("is-animating");
                setSubTouchEnabled(true);
                updateIntroParallax();
            }, TRANSITION_MS + TRANSITION_BUFFER);
        }

        function saveLastIndex(idx) {
            try {
                localStorage.setItem(
                    LS_KEY,
                    JSON.stringify({
                        idx: clamp(idx, 0, sections.length - 1),
                        ts: Date.now(),
                    })
                );
            } catch (_) {}
        }
        function loadLastIndex() {
            try {
                const raw = localStorage.getItem(LS_KEY);
                if (!raw) return 0;
                const obj = JSON.parse(raw);
                if (!obj || typeof obj.idx !== "number" || typeof obj.ts !== "number") return 0;
                if (Date.now() - obj.ts > TTL_MS) return 0;
                return clamp(obj.idx, 0, sections.length - 1);
            } catch (_) {
                return 0;
            }
        }

        // 헤더 토글 브릿지
        function emitHeaderByStackChange(newStack, oldStack) {
            if (newStack > oldStack) $(document).trigger("dau:header:hide");
            else if (newStack < oldStack) $(document).trigger("dau:header:show");
        }

        // -----------------------------------------------------
        // C) sub_visual (세로 슬라이드 + 고정 텍스트 페이드) + LS 저장/복원
        // -----------------------------------------------------
        const SUB_LS_KEY = "dau:subvisual:lastIndex";
        const SUB_TTL_MS = 60 * 60 * 1000; // 1h

        function saveSubIndex(idx, total) {
            try {
                const last = Math.max(0, Math.min(idx, total - 1));
                localStorage.setItem(SUB_LS_KEY, JSON.stringify({ idx: last, ts: Date.now() }));
            } catch (_) {}
        }
        function loadSubIndex(total) {
            try {
                const raw = localStorage.getItem(SUB_LS_KEY);
                if (!raw) return 0;
                const obj = JSON.parse(raw);
                if (!obj || typeof obj.idx !== "number" || typeof obj.ts !== "number") return 0;
                if (Date.now() - obj.ts > SUB_TTL_MS) return 0;
                return Math.max(0, Math.min(obj.idx, total - 1));
            } catch (_) {
                return 0;
            }
        }

        const subVisual = document.querySelector(".sub_visual");
        const subTitlesWrap = subVisual?.querySelector(".sub_titles_wrap");
        const subContent = subVisual?.querySelector(".sub_visual_content");

        let subSwiper = null;
        let subIndex = -1;
        let subLocalStack = 0;
        let subCooldown = false;
        let subAnimating = false;

        const subCooldownMS = 300;
        const subThreshold = () => Math.max(140, Math.floor(window.innerHeight * 0.3));

        if (subVisual && subContent) {
            // content → Swiper 래핑
            const items = Array.from(subContent.querySelectorAll(".sub_visual_item"));
            if (items.length) {
                subContent.classList.add("swiper");
                const wrapper = document.createElement("div");
                wrapper.className = "swiper-wrapper";
                items.forEach((item) => {
                    const slide = document.createElement("div");
                    slide.className = "swiper-slide";
                    slide.appendChild(item);
                    wrapper.appendChild(slide);
                });
                while (subContent.firstChild) subContent.removeChild(subContent.firstChild);
                subContent.appendChild(wrapper);
            }

            // 고정 텍스트(.sub_tilte_wrap 전체 페이드)
            const fixedBlocks = subTitlesWrap
                ? Array.from(subTitlesWrap.querySelectorAll(".sub_tilte_wrap"))
                : [];
            function activateFixedBlock(i) {
                fixedBlocks.forEach((el, idx) => {
                    const on = idx === i;
                    el.classList.toggle("is-active", on);
                    el.setAttribute("aria-hidden", on ? "false" : "true");
                });
            }

            subSwiper = new Swiper(subContent, {
                direction: "vertical",
                effect: "slide",
                speed: 700,
                loop: false,
                allowTouchMove: true,
                simulateTouch: true,
                on: {
                    init() {
                        const total = this.slides.length;
                        const restored = loadSubIndex(total);
                        if (restored > 0) {
                            this.slideTo(restored, 0);
                            activateFixedBlock(restored);
                        } else {
                            const i = this.realIndex ?? this.activeIndex ?? 0;
                            activateFixedBlock(i);
                        }
                    },
                    slideChange() {
                        const i = this.realIndex ?? this.activeIndex ?? 0;
                        activateFixedBlock(i);
                        saveSubIndex(i, this.slides.length);
                    },
                    slideChangeTransitionStart() {
                        subAnimating = true;
                    },
                    transitionStart() {
                        subAnimating = true;
                    },
                    slideChangeTransitionEnd() {
                        subAnimating = false;
                    },
                    transitionEnd() {
                        subAnimating = false;
                    },
                },
            });

            subIndex = sections.findIndex((sec) => sec.contains(subVisual));
        }

        // -----------------------------------------------------
        // D) 델타 라우팅 (sub에서 소비 → 남은 델타만 fullpage)
        // -----------------------------------------------------
        function accumulateSub(deltaY) {
            if (!subSwiper || subCooldown) return;
            subLocalStack += deltaY;

            if (Math.abs(subLocalStack) >= subThreshold()) {
                const goingDown = subLocalStack > 0;
                const i = subSwiper.realIndex ?? subSwiper.activeIndex ?? 0;
                const last = subSwiper.slides.length - 1;

                if (goingDown && i < last) subSwiper.slideNext();
                else if (!goingDown && i > 0) subSwiper.slidePrev();

                subLocalStack = 0;
                subCooldown = true;
                setTimeout(() => {
                    subCooldown = false;
                }, subCooldownMS);
            }
        }

        function routeDelta(deltaY) {
            if (currentIndex !== subIndex || !subSwiper) {
                return { consumed: 0, remain: deltaY };
            }

            const i = subSwiper.realIndex ?? subSwiper.activeIndex ?? 0;
            const last = subSwiper.slides.length - 1;
            const goingDown = deltaY > 0;

            if (subAnimating) {
                accumulateSub(deltaY);
                return { consumed: deltaY, remain: 0 };
            }

            if ((goingDown && i < last) || (!goingDown && i > 0)) {
                accumulateSub(deltaY);
                return { consumed: deltaY, remain: 0 };
            }

            return { consumed: 0, remain: deltaY };
        }

        // -----------------------------------------------------
        // E) #fullpage 누적/스냅
        // -----------------------------------------------------
        function accumulate(deltaY) {
            if ((currentIndex === subIndex && subAnimating) || animating) return;

            const effDelta = currentIndex === 0 ? deltaY * FIRST_SECTION_SCROLL_FACTOR : deltaY;

            if (currentIndex === 0) {
                introProgress = Math.max(0, Math.min(introProgress + effDelta, vh));
                updateIntroParallax();
            }

            const old = stack;
            stack += effDelta;

            console.log("[fullpage stack]", Math.trunc(stack));
            $(document).trigger("dau:fullpageScroll", { deltaY: effDelta, stack, prevStack: old });
            emitHeaderByStackChange(stack, old);

            updateIntroParallax();

            if (Math.abs(stack) >= vh) {
                const goingDown = stack > 0;

                if (goingDown && currentIndex === sections.length - 1) {
                    Smooth.add(deltaY);
                    stack = 0;
                    prevStack = 0;
                    return;
                }

                const nextIdx = currentIndex + (goingDown ? 1 : -1);
                if (nextIdx >= 0 && nextIdx < sections.length) snapTo(nextIdx);
                stack = 0;
                prevStack = 0;
            } else {
                prevStack = stack;
            }
        }

        // -----------------------------------------------------
        // F) 캡처 게이트 & 탈출 룩어헤드
        // -----------------------------------------------------
        function shouldCapture() {
            if (animating) return true;
            return isAtFullpageBottom();
        }
        function lookaheadExitToNormal(deltaY) {
            if (!isAtFullpageBottom()) return false;
            const willStack =
                stack + (currentIndex === 0 ? deltaY * FIRST_SECTION_SCROLL_FACTOR : deltaY);
            if (currentIndex === sections.length - 1 && deltaY > 0 && Math.abs(willStack) >= vh) {
                Smooth.add(deltaY);
                stack = 0;
                prevStack = 0;
                return true;
            }
            return false;
        }

        // ─────────────────────────────────────────────────────
        // J) TEC 세로 스와이퍼 (≤720px 전용)
        //     - #tec .section_contents 내부의 .swiper_item들을 래핑
        //     - 인디케이터/네비 없음
        //     - 휠 스크롤로만 이동(마우스휠/터치 모두)
        //     - 가로>720px이면 파괴(destroy)
        //     - #fullpage 전역 휠 캡처와 충돌 방지:
        //         · tec 섹션에서 스와이퍼 엘리먼트 위의 입력은 fullpage가 가로채지 않음
        // ─────────────────────────────────────────────────────
        const tecSection = document.querySelector("#tec .section_contents");
        let tecSwiper = null;
        let tecIndex = -1;
        const tecMQ = window.matchMedia("(max-width: 720px)");

        // TEC 마크업 보정: .section_contents 자체를 호스트로 사용하고,
        // 그 안의 .swiper_item들을 래핑해 swiper 구조로 만든다.
        function ensureTecMarkup() {
            if (!tecSection) return null;

            // .section_contents를 호스트로 승격
            const host = tecSection;
            host.classList.add("tec-swiper", "swiper");

            // 이미 래핑돼 있으면 통과
            if (host.querySelector(".swiper-wrapper")) return host;

            const items = Array.from(host.querySelectorAll(":scope > .swiper_item"));
            if (!items.length) return host;

            const wrapper = document.createElement("div");
            wrapper.className = "swiper-wrapper";

            items.forEach((item) => {
                const slide = document.createElement("div");
                slide.className = "swiper-slide";
                slide.appendChild(item);
                wrapper.appendChild(slide);
            });

            // 기존 자식 교체
            while (host.firstChild) host.removeChild(host.firstChild);
            host.appendChild(wrapper);
            return host;
        }

        function mountTec() {
            if (!tecSection || tecSwiper) return;
            const host = ensureTecMarkup();
            if (!host) return;

            tecSwiper = new Swiper(host, {
                direction: "vertical",
                slidesPerView: "auto",
                spaceBetween: 12,
                speed: 450,
                loop: false,
                // 인디케이터/네비/페이징 없음
                allowTouchMove: true,
                simulateTouch: true,
                nested: true, // 상위 스크롤과 충돌 최소화
                touchAngle: 30,
                threshold: 4,
                freeMode: { enabled: true, momentum: true },
                mousewheel: {
                    enabled: true,
                    forceToAxis: true, // 수직 휠만 반영
                    sensitivity: 1.0,
                    releaseOnEdges: true, // 엣지에서만 바깥으로
                },
                // scrollbar: { el: null }, // 명시적 비활성 (요청: UI 없음)
                on: {
                    // 스와이퍼가 바닥/천장에 있을 때만 이벤트를 상위로 넘기게 해줌
                    reachEnd() {},
                    reachBeginning() {},
                },
            });

            tecIndex = sections.findIndex((sec) => sec.contains(tecSection));
        }

        function unmountTec() {
            if (!tecSwiper) return;
            tecSwiper.destroy(true, true);
            tecSwiper = null;
        }

        function applyTecByMQ() {
            if (!tecSection) return;
            if (tecMQ.matches) mountTec();
            else unmountTec();
        }
        applyTecByMQ();
        if (tecMQ.addEventListener) tecMQ.addEventListener("change", applyTecByMQ);
        else window.addEventListener("resize", applyTecByMQ);

        // -----------------------------------------------------
        // G) 입력 핸들러 (휠/터치)
        //    ※ tec 스와이퍼 영역에서는 fullpage가 이벤트를 소비하지 않도록 우선 체크
        // -----------------------------------------------------
        function wheelIsOnTec(e) {
            if (!tecSwiper || currentIndex !== tecIndex) return false;
            const target = e.target;
            return !!(
                target &&
                target.closest &&
                target.closest("#tec .section_contents .tec-swiper")
            );
        }

        function touchIsOnTec(e) {
            if (!tecSwiper || currentIndex !== tecIndex) return false;
            const touch = e.touches && e.touches[0];
            if (!touch) return false;
            // 터치 시작 지점 요소로 판별
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            return !!(el && el.closest && el.closest("#tec .section_contents .tec-swiper"));
        }

        function onWheel(e) {
            const deltaY = e.deltaY;

            // ▶ TEC 영역: 스와이퍼가 자체적으로 처리하게 두고, fullpage는 관여 X
            if (wheelIsOnTec(e)) return;

            if (animating) {
                e.preventDefault();
                return;
            }

            if (!shouldCapture()) {
                e.preventDefault();
                Smooth.add(deltaY);
                return;
            }

            if (lookaheadExitToNormal(deltaY)) {
                e.preventDefault();
                return;
            }

            const { consumed, remain } = routeDelta(deltaY);
            if (consumed !== 0) e.preventDefault();
            if (remain === 0) return;

            e.preventDefault();
            accumulate(remain);
        }

        function onTouchStart(e) {
            if (e.touches && e.touches.length > 0) touchStartY = e.touches[0].clientY;
        }
        function onTouchMove(e) {
            // ▶ TEC 영역: 스와이퍼에 맡김
            if (touchIsOnTec(e)) return;

            if (!e.touches || e.touches.length === 0) return;
            const currentY = e.touches[0].clientY;
            const deltaY = touchStartY - currentY; // 양수=아래

            if (animating) {
                e.preventDefault();
                return;
            }

            if (!shouldCapture()) {
                e.preventDefault();
                Smooth.add(deltaY);
                return;
            }

            if (lookaheadExitToNormal(deltaY)) {
                e.preventDefault();
                return;
            }

            const { consumed, remain } = routeDelta(deltaY);
            if (consumed !== 0) e.preventDefault();
            if (remain === 0) return;

            e.preventDefault();
            accumulate(remain);
        }

        function onResize() {
            vh = window.innerHeight;
            applyTransform();
            Smooth.resize();
            introProgress = Math.max(0, Math.min(introProgress, vh));
            updateIntroParallax();
        }

        // 초기 복원
        currentIndex = loadLastIndex();
        applyTransformImmediate();
        introProgress = currentIndex > 0 ? vh : 0;
        updateIntroParallax();

        // 바인딩
        window.addEventListener("wheel", onWheel, { passive: false });
        window.addEventListener("touchstart", onTouchStart, { passive: true });
        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("resize", onResize);

        // -----------------------------------------------------
        // H) PROJECT 가로 스와이퍼 (#project .swiper)
        // -----------------------------------------------------
        (function initProjectSwiper() {
            const host = document.querySelector("#project");
            if (!host) return;

            if (host.__inited) return;
            host.__inited = true;

            // 기존 .swiper_item들을 .swiper-wrapper/.swiper-slide로 래핑
            const items = Array.from(host.querySelectorAll(".swiper_item"));
            if (!items.length) return;

            const wrapper = document.createElement("div");
            wrapper.className = "swiper-wrapper";

            items.forEach((item) => {
                const slide = document.createElement("div");
                slide.className = "swiper-slide";
                slide.appendChild(item);
                wrapper.appendChild(slide);
            });

            while (host.firstChild) host.removeChild(host.firstChild);
            host.appendChild(wrapper);

            // 컨트롤 UI(불릿 + 재생/정지)
            const controls = document.createElement("div");
            controls.className = "project-controls";
            const pagination = document.createElement("div");
            pagination.className = "swiper-pagination";
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "swiper-play-toggle";
            toggle.setAttribute("aria-pressed", "true");
            toggle.setAttribute("aria-label", "Pause autoplay");
            toggle.textContent = "Pause";

            controls.appendChild(pagination);
            controls.appendChild(toggle);

            const wrap = host.closest(".swiper_wrap") || host.parentElement;
            (wrap || host).appendChild(controls);

            const prevBtn = document.createElement("div");
            prevBtn.className = "swiper-button-prev";
            prevBtn.setAttribute("aria-label", "Previous slide");

            const nextBtn = document.createElement("div");
            nextBtn.className = "swiper-button-next";
            nextBtn.setAttribute("aria-label", "Next slide");

            (wrap || host).appendChild(prevBtn);
            (wrap || host).appendChild(nextBtn);

            const projectSwiper = new Swiper(host, {
                direction: "horizontal",
                slidesPerView: 1,
                spaceBetween: 24,
                loop: true,
                speed: 600,
                allowTouchMove: true,
                simulateTouch: true,
                grabCursor: true,
                nested: true,
                touchAngle: 30,
                threshold: 8,
                pagination: {
                    el: pagination,
                    clickable: true,
                },
                navigation: {
                    nextEl: nextBtn,
                    prevEl: prevBtn,
                },
                autoplay: {
                    delay: 3500,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                },
            });

            function setPaused(paused) {
                if (paused) {
                    projectSwiper.autoplay.stop();
                    toggle.setAttribute("aria-pressed", "false");
                    toggle.setAttribute("aria-label", "Resume autoplay");
                    toggle.textContent = "Play";
                    toggle.classList.add("is-paused");
                } else {
                    projectSwiper.autoplay.start();
                    toggle.setAttribute("aria-pressed", "true");
                    toggle.setAttribute("aria-label", "Pause autoplay");
                    toggle.textContent = "Pause";
                    toggle.classList.remove("is-paused");
                }
            }
            toggle.addEventListener("click", () => {
                const isPlaying = toggle.getAttribute("aria-pressed") === "true";
                setPaused(isPlaying);
            });

            setPaused(false);
        })();

        // Our Core Tec : 호버 패널
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
        // I) PR 가로 스와이퍼 (#pr .section_contents .swiper)
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
                spaceBetween: 160,
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
                on: {
                    init() {
                        const total =
                            this.slides.length - this.loopedSlides * 2 || this.slides.length;
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
    }
})();

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
