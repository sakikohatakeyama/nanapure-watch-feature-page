/* ============================================================
   ななぷれ 腕時計特集ページ - script.js
   ------------------------------------------------------------
   ・jQuery不要、素のJavaScriptのみで実装
   ・お気に入りボタンは見た目確認用のダミー実装です。
     楽天の「お気に入り登録」コードに差し替えた場合、
     このファイルの該当処理（初期化 favorite ボタン部分）は不要になります。
   ============================================================ */

(function () {
  'use strict';

  var scrollContainer = document.getElementById('scrollContainer');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    var LOCK_DURATION = 550; // ← 慣性による誤爆防止のロック時間
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

    function changeSection(nextIndex) {
      nextIndex = Math.max(0, Math.min(sections.length - 1, nextIndex));
      if (nextIndex === currentIndex) return;
      locked = true;
      currentIndex = nextIndex;
      smoothScrollTo(sections[currentIndex].offsetTop);
      window.setTimeout(function () { locked = false; }, LOCK_DURATION);
    }

    // 現在位置を監視し、初期表示や万一のズレにも追従させる
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting && !locked) {
              currentIndex = sections.indexOf(entry.target);
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
     よって画像の実際の表示サイズ・位置が変わる（PCの縦長ウィンドウ等では
     上下に余白＝レターボックスができる）。CSSのbottom:%指定だけだと
     セクション基準になってしまい画像の余白位置とズレるため、実際に
     描画された画像の下端を基準に位置を計算し直している。
     ------------------------------------------------------------ */
  function initOverlayPosition() {
    var sections = Array.prototype.slice.call(document.querySelectorAll('.product-section--overlay'));
    if (sections.length === 0) return;

    var GAP_RATIO = 0.05; // ← 画像下端から何%上に重ねるか（画像側の余白位置に合わせて調整）

    function update() {
      sections.forEach(function (section) {
        var img = section.querySelector('.product-image');
        var info = section.querySelector('.product-overlay-info');
        if (!img || !info || !img.complete) return;

        var sectionRect = section.getBoundingClientRect();
        var imgRect = img.getBoundingClientRect();
        var gap = imgRect.height * GAP_RATIO;

        info.style.bottom = (sectionRect.bottom - imgRect.bottom + gap) + 'px';
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
     4. お気に入りボタン（ダミー実装）
     ------------------------------------------------------------
     楽天GOLDへ実装する際は、このブロックごと削除し、
     RMS管理画面から発行される「お気に入り登録」ボタンのコードに
     置き換えてください。
     ------------------------------------------------------------ */
  function initFavoriteButtons() {
    var buttons = document.querySelectorAll('[data-favorite]');

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pressed = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!pressed));
      });
    });
  }

  /* ------------------------------------------------------------
     初期化
     ------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    initFadeIn();
    initSectionNav();
    initOverlayPosition();
    initFavoriteButtons();
  });
})();
