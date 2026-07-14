/* ============================================================
   ななぷれ ごほうびバッグ特集ページ - script.js
   ------------------------------------------------------------
   ・jQuery不要、素のJavaScriptのみで実装
   ============================================================ */

(function () {
  'use strict';

  var scrollContainer = document.getElementById('scrollContainer');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------
     object-fit:contain で実際に描画されている画像範囲
     （レターボックスを除いた部分）を計算する共通関数。
     getBoundingClientRect() は<img>要素の外枠サイズを返すだけで、
     containで実際に描画されている範囲は教えてくれないため、
     naturalWidth/naturalHeightから自前で計算し直している。
     ------------------------------------------------------------ */
  function getRenderedImageRect(img) {
    var box = img.getBoundingClientRect();
    var boxRatio = box.width / box.height;
    var imgRatio = img.naturalWidth / img.naturalHeight;
    var width, height;

    if (imgRatio > boxRatio) {
      width = box.width;
      height = box.width / imgRatio;
    } else {
      height = box.height;
      width = box.height * imgRatio;
    }

    var offsetY = (box.height - height) / 2;
    var offsetX = (box.width - width) / 2;
    return {
      top: box.top + offsetY,
      bottom: box.top + offsetY + height,
      left: box.left + offsetX,
      width: width,
      height: height
    };
  }

  /* ------------------------------------------------------------
     1. フェードイン演出（IntersectionObserver）
     data-animate 属性を持つ要素が画面内に入ったら is-visible を付与
     ------------------------------------------------------------ */
  function initFadeIn() {
    var targets = document.querySelectorAll('[data-animate]');
    if (!('IntersectionObserver' in window) || targets.length === 0) {
      // 非対応ブラウザは即表示にフォールバック
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.25 }
    );

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* ------------------------------------------------------------
     2. セクション間ナビゲーション（PC：ホイール／スマホ：スワイプ）
     ------------------------------------------------------------
     CSSのScroll Snapではなく、JavaScriptで1操作＝1セクション分だけ
     動かす方式。requestAnimationFrameで自前のイージングつきスクロール
     （約180ms）を行い、キビキビした遷移にしている。
     ・速さを変えたい場合は DURATION（ミリ秒）を調整
     ・反応の鈍感さを変えたい場合は MIN_DELTA（PC）/ SWIPE_THRESHOLD（スマホ）を調整
     ・慣性スクロールで連続ジャンプしないよう LOCK_DURATION の間だけ操作を無視する
     ------------------------------------------------------------ */
  function initSectionNav() {
    var sections = Array.prototype.slice.call(document.querySelectorAll('.snap-section'));
    var currentIndex = 0;
    var locked = false;

    var DURATION = prefersReducedMotion ? 0 : 180; // ← 遷移速度の調整はここ
    var LOCK_DURATION = 1000; // ← 慣性による誤爆防止のロック時間（トラックパッドの余韻がこれより長いと2回分ジャンプすることがある）
    var MIN_DELTA = 10; // ← PCホイールの反応しきい値
    var SWIPE_THRESHOLD = 40; // ← スマホのスワイプ判定のしきい値（px）

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function smoothScrollTo(targetTop) {
      if (DURATION === 0) {
        scrollContainer.scrollTop = targetTop;
        return;
      }
      var start = scrollContainer.scrollTop;
      var distance = targetTop - start;
      var startTime = null;

      function step(now) {
        if (!startTime) startTime = now;
        var t = Math.min((now - startTime) / DURATION, 1);
        scrollContainer.scrollTop = start + distance * easeOutCubic(t);
        if (t < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }

    // 現在いるブロックに対応する目次の項目を太字にする（現在地の目印）
    function updateTocActive() {
      var currentId = sections[currentIndex] && sections[currentIndex].id;
      document.querySelectorAll('.hero-toc-list a').forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('data-jump-to') === currentId);
      });
    }

    function changeSection(nextIndex) {
      nextIndex = Math.max(0, Math.min(sections.length - 1, nextIndex));
      if (nextIndex === currentIndex) return;
      locked = true;
      currentIndex = nextIndex;
      smoothScrollTo(sections[currentIndex].offsetTop);
      updateTocActive();
      window.setTimeout(function () { locked = false; }, LOCK_DURATION);
    }

    // 現在位置を監視し、初期表示や万一のズレにも追従させる
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting && !locked) {
              currentIndex = sections.indexOf(entry.target);
              updateTocActive();
            }
          });
        },
        { root: scrollContainer, threshold: 0.5 }
      );
      sections.forEach(function (s) { observer.observe(s); });
    }

    // HEROの「SCROLL」ボタン
    var cue = document.getElementById('scrollCue');
    if (cue) {
      cue.addEventListener('click', function () { changeSection(currentIndex + 1); });
    }

    // 目次パネルなど、data-jump-to="セクションid" を持つ要素から該当セクションへジャンプ
    document.querySelectorAll('[data-jump-to]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        var targetId = el.getAttribute('data-jump-to');
        var index = sections.findIndex(function (s) { return s.id === targetId; });
        if (index === -1) return;
        e.preventDefault();
        changeSection(index);
      });
    });

    // PC：ホイール操作
    scrollContainer.addEventListener(
      'wheel',
      function (e) {
        e.preventDefault();
        if (locked || Math.abs(e.deltaY) < MIN_DELTA) return;
        changeSection(currentIndex + (e.deltaY > 0 ? 1 : -1));
      },
      { passive: false }
    );

    // スマホ：スワイプ操作
    // touchmoveをpreventDefaultし、ドラッグ中に前のブロックがネイティブスクロールで
    // わずかに動いて見える（ぬるっと残る）のを防ぎ、指を離した瞬間にスパッと切り替える
    var startY = 0;
    scrollContainer.addEventListener(
      'touchstart',
      function (e) {
        if (locked) return;
        startY = e.touches[0].clientY;
      },
      { passive: true }
    );

    scrollContainer.addEventListener(
      'touchmove',
      function (e) {
        e.preventDefault();
      },
      { passive: false }
    );

    scrollContainer.addEventListener(
      'touchend',
      function (e) {
        if (locked) return;
        var diff = startY - e.changedTouches[0].clientY;
        if (Math.abs(diff) < SWIPE_THRESHOLD) return; // 少し動いただけなら誤作動防止で無視
        changeSection(currentIndex + (diff > 0 ? 1 : -1));
      },
      { passive: true }
    );
  }

  /* ------------------------------------------------------------
     3. 画像に余白入りの商品（product-section--overlay）の
     価格・ボタン位置を調整
     ------------------------------------------------------------
     画像はobject-fit:containで表示されるため、ウィンドウの縦横比に
     よって画像の実際の表示サイズ・位置が変わる（上下または左右に
     余白＝レターボックスができる）。ただしgetBoundingClientRect()は
     <img>要素の外枠サイズを返すだけで、containで実際に描画されている
     範囲は教えてくれないため、naturalWidth/naturalHeightから
     実際の描画範囲を自前で計算し直している。
     ------------------------------------------------------------ */
  function initOverlayPosition() {
    var sections = Array.prototype.slice.call(document.querySelectorAll('.product-section--overlay'));
    if (sections.length === 0) return;

    var GAP_RATIO = 0.02; // ← 画像下端から何%上に重ねるか（画像側の余白位置に合わせて調整）

    function update() {
      sections.forEach(function (section) {
        var img = section.querySelector('.product-image');
        var info = section.querySelector('.product-overlay-info');
        if (!img || !info || !img.complete || !img.naturalWidth) return;

        var sectionRect = section.getBoundingClientRect();
        var renderedImg = getRenderedImageRect(img);
        var gap = renderedImg.height * GAP_RATIO;

        info.style.bottom = (sectionRect.bottom - renderedImg.bottom + gap) + 'px';
      });
    }

    window.addEventListener('resize', update);

    sections.forEach(function (section) {
      var img = section.querySelector('.product-image');
      if (img) {
        if (img.complete) {
          update();
        } else {
          img.addEventListener('load', update);
        }
      }
    });
  }

  /* ------------------------------------------------------------
     3-1. HERO：バッグが横に流れるエリアの位置・ループ距離の調整
     ------------------------------------------------------------
     看板画像の空白帯（画像の高さに対する割合）にバッグの帯が
     重なるよう、画像の実際の描画範囲を基準に位置とサイズを計算する。
     画像はcontainで表示されるため、上下だけでなく左右にも余白が
     できることがあり、左右の余白まで含めてしまうと画像の外（背景色の
     部分）にバッグがはみ出して見えるため、左右の位置・幅も実際の
     描画範囲に合わせて絞り込む。

     また、ループ位置をCSSの50%指定だけに頼ると、画像の読み込み
     タイミングによっては1セット分の実際の幅とズレて、ループの
     つなぎ目でバッグが表示されない瞬間ができることがあるため、
     画像読み込み後にちょうど1セット分の正確なピクセル距離を計算し、
     CSS変数として渡している。
     ------------------------------------------------------------ */
  function initHeroMarquee() {
    var heroImg = document.querySelector('#hero .hero-image');
    var marquee = document.querySelector('.hero-bag-marquee');
    var track = document.querySelector('.hero-bag-track');
    if (!heroImg || !marquee || !track) return;

    var TOP_RATIO = 0.36;    // ← バッグ帯の開始位置（画像の高さに対する割合。看板画像の空白帯に合わせて調整）
    var HEIGHT_RATIO = 0.33; // ← バッグ帯の高さ（画像の高さに対する割合）

    function updatePosition() {
      if (!heroImg.complete || !heroImg.naturalWidth) return;

      var sectionRect = document.getElementById('hero').getBoundingClientRect();
      var rendered = getRenderedImageRect(heroImg);

      marquee.style.top = (rendered.top - sectionRect.top + rendered.height * TOP_RATIO) + 'px';
      marquee.style.height = (rendered.height * HEIGHT_RATIO) + 'px';
      marquee.style.left = (rendered.left - sectionRect.left) + 'px';
      marquee.style.width = rendered.width + 'px';
    }

    function updateLoopDistance() {
      var images = Array.prototype.slice.call(track.querySelectorAll('.hero-bag'));
      var half = images.length / 2;
      if (half === 0) return;

      // 前半セットの1枚目と、複製した後半セットの1枚目のoffsetLeftの差が
      // ちょうど1セット分の距離になる（offsetLeftはtransformの影響を受けないため、
      // アニメーション中でも正確に測れる）
      var distance = images[half].offsetLeft - images[0].offsetLeft;
      if (distance > 0) {
        track.style.setProperty('--marquee-shift', '-' + distance + 'px');
      }
    }

    window.addEventListener('resize', function () {
      updatePosition();
      updateLoopDistance();
    });

    if (heroImg.complete) {
      updatePosition();
    } else {
      heroImg.addEventListener('load', updatePosition);
    }

    var bagImgs = Array.prototype.slice.call(track.querySelectorAll('.hero-bag'));
    var loadedCount = 0;
    bagImgs.forEach(function (img) {
      if (img.complete) {
        loadedCount++;
      } else {
        img.addEventListener('load', function () {
          loadedCount++;
          if (loadedCount === bagImgs.length) updateLoopDistance();
        });
      }
    });
    if (loadedCount === bagImgs.length) updateLoopDistance();
  }

  /* ------------------------------------------------------------
     4. お気に入りボタン（ダミー実装）
     ------------------------------------------------------------
     楽天GOLDへ実装する際は、このブロックごと削除し、
     RMS管理画面から発行される「お気に入り登録」ボタンのコードに
     置き換えてください。
     ------------------------------------------------------------ */
  /* ------------------------------------------------------------
     スマホ・タブレット用：ハンバーガーメニューで目次パネルを開閉する
     ------------------------------------------------------------ */
  function initTocToggle() {
    var toggle = document.getElementById('tocToggle');
    var toc = document.getElementById('heroToc');
    var backdrop = document.getElementById('tocBackdrop');
    if (!toggle || !toc || !backdrop) return;

    function openToc() {
      toc.classList.add('is-open');
      backdrop.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
    }

    function closeToc() {
      toc.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
      if (toc.classList.contains('is-open')) {
        closeToc();
      } else {
        openToc();
      }
    });

    backdrop.addEventListener('click', closeToc);

    // 目次内のリンクをクリックしたら閉じる（PCでは常時表示のため影響なし）
    toc.querySelectorAll('[data-jump-to]').forEach(function (el) {
      el.addEventListener('click', closeToc);
    });
  }

  /* ------------------------------------------------------------
     初期化
     ------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    initFadeIn();
    initSectionNav();
    initOverlayPosition();
    initHeroMarquee();
    initTocToggle();
  });
})();
